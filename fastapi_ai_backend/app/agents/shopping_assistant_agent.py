from mcp.server.fastmcp import FastMCP
from app.models.shopping_assistant_models import UserQueryInput, ShoppingAssistantResponse
from app.models.product import Product, ListProductsToolInput # For type hinting and input model
from typing import List, Optional
import httpx
import os
import json # For parsing LLM JSON output
from dotenv import load_dotenv
import openai # For OpenRouter
from pydantic import BaseModel, Field # For ExtractedFilters model

# Load environment variables from .env file specific to the backend if it exists
# Assumes a .env file might be in the same directory as this script or a parent accessible by load_dotenv
load_dotenv()

# --- OpenAI Client Setup for OpenRouter ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_BASE = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL_NAME = os.getenv("OPENROUTER_MODEL_NAME", "mistralai/mistral-7b-instruct") # Default if not set
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL") # Optional, e.g., your app's frontend URL
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME") # Optional, e.g., "TAIC Shopping Assistant"

openai_client = None
if OPENROUTER_API_KEY:
    openai_client = openai.AsyncOpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_API_BASE,
        default_headers={
            "HTTP-Referer": OPENROUTER_SITE_URL if OPENROUTER_SITE_URL else "",
            "X-Title": OPENROUTER_APP_NAME if OPENROUTER_APP_NAME else "",
        } if OPENROUTER_SITE_URL or OPENROUTER_APP_NAME else None,
    )
else:
    print("ASA Warning: OPENROUTER_API_KEY not found. LLM functionalities will be disabled.")
# --- End OpenAI Client Setup ---

# Configuration for the Product Service MCP (ASA will be a client to this)
PRODUCT_SERVICE_MCP_URL = "http://localhost:8001" # Assuming it runs on the same host/port
PRODUCT_SERVICE_CONTEXT_PATH = "/mcp_product_service/context"

# --- Pydantic Model for Extracted Filters ---
class ExtractedFilters(BaseModel):
    search_query: Optional[str] = Field(None, description="Refined search keywords extracted from the user query. This will be used for a text search against product names and descriptions.")
    category: Optional[str] = Field(None, description="A specific product category extracted from the user query. If identified, this should match one of the known categories if possible. Examples: 'Electronics', 'Fashion', 'Home Goods', 'Books'.")
    # We can add more fields here later, like price_min, price_max, specific_attributes, etc.
# --- End Pydantic Model ---

shopping_assistant_mcp_server = FastMCP(
    name="ShoppingAssistantService",
    title="TAIC Shopping Assistant Service", # Added title
    description="An AI Shopping Assistant that helps users find products and get information." # Changed from instructions
)

@shopping_assistant_mcp_server.tool(
    name="process_user_query",
    description="Processes a user's natural language query to find products or answer questions."
)
async def process_user_query_tool(input_data: UserQueryInput) -> ShoppingAssistantResponse:
    """
    Processes a user's query, potentially interacts with other services (like Product Service),
    and returns a comprehensive response.
    """
    user_query = input_data.query
    print(f"ASA: Received query: {user_query}")

    try:
        extracted_filters = ExtractedFilters()
        llm_filter_extraction_error = None

        if openai_client:
            filter_extraction_system_prompt = (
                "You are an intelligent assistant that analyzes user queries for e-commerce product searches. "
                "Your task is to extract relevant search terms and a product category from the user's query. "
                "Respond with a JSON object containing 'search_query' and 'category'. "
                "'search_query' should be the refined keywords for searching product names/descriptions. "
                "'category' should be one of the general e-commerce categories if identifiable, otherwise null. "
                "Example categories: Electronics, Fashion, Home Goods, Books, Sports, Beauty, Toys, Automotive. "
                "If the query is very generic (e.g., 'show me products'), 'search_query' can be null or the generic phrase. "
                "If no specific category is mentioned or implied, 'category' should be null. "
                "Only return the JSON object."
        )
            filter_extraction_user_prompt = f"User query: \"{user_query}\"\n\nJSON:"

            try:
                print(f"ASA: Calling LLM for filter extraction. Model: {OPENROUTER_MODEL_NAME}")
                # Note: For OpenAI models like gpt-3.5-turbo-1106+ or gpt-4-turbo, you can add: response_format={"type": "json_object"}
                # For other models, we rely on the prompt to produce valid JSON.
                completion = await openai_client.chat.completions.create(
                    model=OPENROUTER_MODEL_NAME,
                    messages=[
                        {"role": "system", "content": filter_extraction_system_prompt},
                        {"role": "user", "content": filter_extraction_user_prompt}
                    ],
                    max_tokens=100,
                    temperature=0.2 # Low temperature for more deterministic JSON output
                )
                llm_response_content = completion.choices[0].message.content
                print(f"ASA: LLM filter extraction response: {llm_response_content}")
                
                # Attempt to parse the JSON from the LLM response
                try:
                    # The LLM might sometimes include markdown ```json ... ``` around the JSON
                    if llm_response_content.strip().startswith("```json"):
                        llm_response_content = llm_response_content.strip()[7:-3].strip()
                    elif llm_response_content.strip().startswith("```"):
                        llm_response_content = llm_response_content.strip()[3:-3].strip()

                    filter_data = json.loads(llm_response_content)
                    extracted_filters = ExtractedFilters(**filter_data)
                    print(f"ASA: Extracted filters: query='{extracted_filters.search_query}', category='{extracted_filters.category}'")
                except (json.JSONDecodeError, TypeError) as e_json:
                    llm_filter_extraction_error = f"Failed to parse JSON from LLM filter extraction: {e_json}. Response: {llm_response_content}"
                    print(f"ASA: {llm_filter_extraction_error}")
                except Exception as e_val:
                     llm_filter_extraction_error = f"Failed to validate ExtractedFilters from LLM: {e_val}. Response: {llm_response_content}"
                     print(f"ASA: {llm_filter_extraction_error}")

            except Exception as e_llm_filter:
                llm_filter_extraction_error = f"Error during LLM filter extraction: {str(e_llm_filter)}"
                print(f"ASA: {llm_filter_extraction_error}")
        else:
            print("ASA Warning: OpenAI client not available. Skipping LLM filter extraction.")
            # Fallback: use the raw user query if LLM is not available for filtering
            extracted_filters.search_query = user_query

        # --- Conditional Logic for Greetings vs. Product Search ---
        common_greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"]
        is_generic_greeting_query = user_query.strip().lower() in common_greetings
        filters_are_empty = not extracted_filters.search_query and not extracted_filters.category

        # Initialize variables that will be populated by either path
        natural_language_response = "I'm sorry, I couldn't process your request at the moment."
        suggested_products: List[Product] = []
        product_service_error_message = None
        llm_model_used_for_response_gen = OPENROUTER_MODEL_NAME # Default
        raw_product_count_debug = 'N/A'
        tool_input_payload_debug = {}
        product_service_tool_url_debug = "N/A"

        if is_generic_greeting_query and filters_are_empty and not llm_filter_extraction_error:
            print("ASA: Detected generic greeting with no specific filters. Responding with a standard greeting.")
            natural_language_response = "Hello! I'm your friendly shopping assistant. What can I help you find today?"
            suggested_products = [] # Ensure it's empty for greeting path
            llm_model_used_for_response_gen = "N/A (greeting path)"
            raw_product_count_debug = 0
            # product_service_tool_url_debug and tool_input_payload_debug remain "N/A" or empty

        else: # This is the product search path (original logic)
            print("ASA: Proceeding with product search logic.")
            # Prepare payload for Product Service using extracted filters
            tool_input_payload = ListProductsToolInput(
                query=extracted_filters.search_query,
                category=extracted_filters.category
            ).model_dump(exclude_none=True)
            tool_input_payload_debug = tool_input_payload # For debug info

            product_service_tool_url = f"{PRODUCT_SERVICE_MCP_URL}/mcp_product_service/call_tool/get_all_products"
            product_service_tool_url_debug = product_service_tool_url # For debug info

            products_list_raw_temp = [] # Temporary list for raw products from service

            try:
                # 1. Call Product Service
                async with httpx.AsyncClient() as http_client:
                    print(f"ASA: Calling Product Service: {product_service_tool_url} with payload: {tool_input_payload}")
                    try:
                        response = await http_client.post(product_service_tool_url, json=tool_input_payload)
                        response.raise_for_status()
                        products_data = response.json()
                        
                        if isinstance(products_data, dict) and "output" in products_data:
                            potential_products = products_data['output']
                            if isinstance(potential_products, list):
                                products_list_raw_temp = potential_products
                            elif isinstance(potential_products, dict) and 'products' in potential_products and isinstance(potential_products['products'], list):
                                products_list_raw_temp = potential_products['products']
                            else:
                                print(f"ASA: Product Service output format not as expected. Received: {type(potential_products)}")
                                product_service_error_message = "Product service returned unexpected data format for products."
                            
                            raw_product_count_debug = len(products_list_raw_temp)
                            print(f"ASA: Received {raw_product_count_debug} raw products from Product Service.")

                            for prod_data in products_list_raw_temp:
                                try:
                                    suggested_products.append(Product(**prod_data))
                                except Exception as e_map:
                                    print(f"ASA: Error mapping product data: {e_map}. Data: {prod_data}")
                        else:
                            product_service_error_message = "Product service response did not contain 'output' or was not a dict."
                            print(f"ASA: {product_service_error_message} Response: {products_data}")

                    except httpx.HTTPStatusError as e_http:
                        product_service_error_message = f"HTTP error calling Product Service: {e_http.response.status_code} - {e_http.response.text}"
                        print(f"ASA: {product_service_error_message}")
                    except httpx.RequestError as e_req:
                        product_service_error_message = f"Request error calling Product Service: {e_req}"
                        print(f"ASA: {product_service_error_message}")
                    except json.JSONDecodeError as e_json_resp:
                        product_service_error_message = f"Failed to decode JSON response from Product Service: {e_json_resp}"
                        print(f"ASA: {product_service_error_message}")

            except Exception as e_outer_ps:
                product_service_error_message = f"Unexpected error during Product Service interaction: {str(e_outer_ps)}"
                print(f"ASA: {product_service_error_message}")

            # 2. Final LLM call to generate natural language response (if not a simple greeting)
            if product_service_error_message:
                natural_language_response = f"I encountered an issue: {product_service_error_message}. Please try again later."
                llm_model_used_for_response_gen = "N/A (due to Product Service error)"
            elif not openai_client:
                natural_language_response = "Product information retrieved, but I'm unable to generate a conversational response right now."
                if not suggested_products:
                    natural_language_response = "I'm currently unable to process your request fully. No products found and conversational AI is offline."
                llm_model_used_for_response_gen = "N/A (OpenAI client not available)"
            else: # OpenAI client available and no product service error
                response_gen_system_prompt = (
                    "You are an AI Shopping Assistant. Based on the user's query and the products found (if any), "
                    "provide a helpful and natural language response. "
                    "If products are found, briefly mention a few or summarize them, and indicate how many were found if it's a large number. "
                    "If no products are found, politely inform the user. "
                    "Do not repeat the product list verbatim unless very short. Focus on a conversational summary."
                )
                response_gen_user_prompt_parts = [f"User query: \"{user_query}\""]
                if suggested_products:
                    product_summary_for_llm = "\n\nProducts found (summary):\n"
                    for i, p in enumerate(suggested_products[:3]):
                        product_summary_for_llm += f"- {p.name} (Category: {p.category}, Price: {p.price})\n"
                    if len(suggested_products) > 3:
                        product_summary_for_llm += f"...and {len(suggested_products) - 3} more.\n"
                    response_gen_user_prompt_parts.append(product_summary_for_llm)
                else:
                    response_gen_user_prompt_parts.append("\n\nNo products were found matching the query.")
                
                response_gen_user_prompt = "".join(response_gen_user_prompt_parts)

                try:
                    print(f"ASA: Calling LLM for final response generation. Model: {OPENROUTER_MODEL_NAME}")
                    completion = await openai_client.chat.completions.create(
                        model=OPENROUTER_MODEL_NAME,
                        messages=[
                            {"role": "system", "content": response_gen_system_prompt},
                            {"role": "user", "content": response_gen_user_prompt}
                        ],
                        max_tokens=300,
                        temperature=0.7
                    )
                    natural_language_response = completion.choices[0].message.content
                    print(f"ASA: LLM final response: {natural_language_response}")
                except Exception as e_llm_final:
                    error_message_llm_final = f"Error during final LLM response generation: {str(e_llm_final)}"
                    print(f"ASA: {error_message_llm_final}")
                    if suggested_products:
                        natural_language_response = f"I found {len(suggested_products)} products, but had a bit of trouble crafting a summary. You can review them in the list."
                    else:
                        natural_language_response = "I couldn't find any products and also had an issue summarizing. Please try a different search."
                    llm_model_used_for_response_gen = f"{OPENROUTER_MODEL_NAME} (Error: {e_llm_final})"
    
    # --- End Conditional Logic ---

        # Debug information
        debug_info = {
        "user_query": user_query,
        "llm_filter_extraction_error": llm_filter_extraction_error,
        "extracted_search_query_param": extracted_filters.search_query,
        "extracted_category_param": extracted_filters.category,
        "product_service_url": product_service_tool_url_debug,
        "product_service_payload": tool_input_payload_debug,
        "product_service_error": product_service_error_message,
        "llm_model_used_for_response_gen": llm_model_used_for_response_gen,
        "raw_product_count_from_service": raw_product_count_debug
    }
        return ShoppingAssistantResponse(
        natural_language_response=natural_language_response,
        suggested_products=suggested_products,
        debug_info=debug_info
    )

    except Exception as e: # General fallback for unexpected errors during the whole process
        import traceback
        error_message = f"A critical unexpected error occurred in process_user_query_tool: {type(e).__name__} - {str(e)}"
        print(f"ASA: CRITICAL ERROR: {error_message}\n{traceback.format_exc()}")
        return ShoppingAssistantResponse(
            natural_language_response="I encountered a critical unexpected issue and cannot process your request at this time.",
            suggested_products=[], # Ensure suggested_products is empty on critical failure
            debug_info={
                "error": "Critical failure", 
                "details": error_message, 
                "user_query": user_query,
                "llm_filter_extraction_error": llm_filter_extraction_error,
                "extracted_search_query_param": extracted_filters.search_query,
                "extracted_category_param": extracted_filters.category
            }
        )

# TODO:
# 1. Implement actual MCP client logic to call Product Service.
#    - Fetch Product Service context.
#    - Find and call 'get_all_products' tool.
# 2. Integrate an LLM for:
#    - Query understanding and intent extraction.
#    - Parameter extraction for Product Service tools.
#    - Generating the final natural_language_response based on tool outputs.
# 3. Add error handling for MCP calls and LLM interactions.
