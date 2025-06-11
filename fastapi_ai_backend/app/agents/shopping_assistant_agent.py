from mcp.server.fastmcp import FastMCP
from app.models.shopping_assistant_models import UserQueryInput, ShoppingAssistantResponse
from app.models.product import Product, ListProductsToolInput # For type hinting and input model
from typing import List, Optional
import httpx
import os
import json # For parsing LLM JSON output
import logging # Added logging
from dotenv import load_dotenv
import openai # For OpenRouter
from pydantic import BaseModel, Field # For ExtractedFilters model

# --- Logger Setup ---
logger = logging.getLogger(__name__)
# --- End Logger Setup ---

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
    logger.warning("ASA Warning: OPENROUTER_API_KEY not found. LLM functionalities will be disabled.")
# --- End OpenAI Client Setup ---

# Configuration for the Product Service MCP (ASA will be a client to this)
# This will be the base URL of the FastAPI application where ProductService is mounted.
# Assuming the main FastAPI app (from main.py) runs on port 8000.
PRODUCT_SERVICE_BASE_URL = os.getenv("PRODUCT_SERVICE_BASE_URL", "http://localhost:8000")
PRODUCT_SERVICE_AGENT_MOUNT_PATH = os.getenv("PRODUCT_SERVICE_AGENT_MOUNT_PATH", "/mcp_product_service")

# Configuration for the CJ Dropshipping Agent MCP (ASA might be a client to this)
CJ_DROPSHIPPING_AGENT_BASE_URL = os.getenv("CJ_DROPSHIPPING_AGENT_BASE_URL", "http://localhost:8000")
CJ_DROPSHIPPING_AGENT_DETAILS_TOOL_PATH = os.getenv("CJ_DROPSHIPPING_AGENT_DETAILS_TOOL_PATH", "/mcp_cj_dropshipping/call_tool/get_cj_product_details")
CJ_DROPSHIPPING_AGENT_STOCK_TOOL_PATH = os.getenv("CJ_DROPSHIPPING_AGENT_STOCK_TOOL_PATH", "/mcp_cj_dropshipping/call_tool/get_cj_product_stock")
CJ_DROPSHIPPING_AGENT_SHIPPING_TOOL_PATH = os.getenv("CJ_DROPSHIPPING_AGENT_SHIPPING_TOOL_PATH", "/mcp_cj_dropshipping/call_tool/get_cj_product_shipping_info")


# --- Pydantic Model for Extracted Filters ---
class ExtractedFilters(BaseModel):
    search_query: Optional[str] = Field(None, description="Refined search keywords extracted from the user query for product names/descriptions.")
    category: Optional[str] = Field(None, description="A specific product category. Examples: 'Electronics', 'Fashion', 'Home Goods'.")
    price_min: Optional[float] = Field(None, description="Minimum price for products.")
    price_max: Optional[float] = Field(None, description="Maximum price for products.")
    attributes: Optional[Dict[str, str]] = Field(None, description="Specific product attributes, e.g., {'color': 'red', 'size': 'large'}.")
    destination_country: Optional[str] = Field(None, description="Destination country for shipping, if mentioned (2-letter ISO code).")
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
    logger.info(f"ASA: Received query: '{user_query}'")

    # Initialize variables for response and debug info
    natural_language_response = "I'm sorry, I couldn't process your request at the moment."
    suggested_products: List[Product] = []
    llm_filter_extraction_error: Optional[str] = None
    product_service_error_message: Optional[str] = None
    final_llm_error_message: Optional[str] = None
    cj_details_enrichment_errors: List[str] = []
    cj_stock_enrichment_errors: List[str] = []
    cj_shipping_enrichment_errors: List[str] = [] # Added for shipping errors
    llm_model_used_for_response_gen = OPENROUTER_MODEL_NAME
    raw_product_count_debug: Any = 'N/A'
    tool_input_payload_debug: Dict = {}
    product_service_tool_url_debug: str = "N/A"

    extracted_filters = ExtractedFilters()

    try:
        # Attempt filter extraction if OpenAI client is available
        # llm_filter_extraction_error = None # Already initialized above

        if openai_client:
            filter_extraction_system_prompt = (
                "You are an intelligent assistant that analyzes user queries for e-commerce product searches. "
                "Your task is to extract relevant search terms, a product category, price range, product attributes, and a destination country for shipping. "
                "Respond with a JSON object containing 'search_query', 'category', 'price_min', 'price_max', 'attributes', and 'destination_country'. "
                "'search_query' should be the refined keywords for searching product names/descriptions. "
                "'category' should be one of the general e-commerce categories if identifiable, otherwise null. Example categories: Electronics, Fashion, Home Goods, Books, Sports, Beauty, Toys, Automotive. "
                "'price_min' and 'price_max' should be numbers if a price range is specified (e.g., 'under $50' implies price_max: 50; 'over $100' implies price_min: 100; '$100 to $200' implies price_min: 100, price_max: 200). "
                "'attributes' should be a dictionary of attribute key-value pairs if specific features are mentioned (e.g., for 'red t-shirt size large', attributes would be {'color': 'red', 'size': 'large'}). "
                "If the user asks about shipping to a specific country or location (e.g., 'shipping to Canada', 'can I get it in US?'), extract a 2-letter ISO country code for 'destination_country' (e.g., 'CA', 'US'). "
                "If a field is not mentioned or cannot be reliably extracted, its value should be null. "
                "Only return the JSON object. Do not add any explanatory text before or after the JSON object."
            )
            filter_extraction_user_prompt = f"User query: \"{user_query}\"\n\nJSON:"

            try:
                logger.info(f"ASA: Calling LLM for filter extraction. Model: {OPENROUTER_MODEL_NAME}")
                completion = await openai_client.chat.completions.create(
                    model=OPENROUTER_MODEL_NAME,
                    messages=[
                        {"role": "system", "content": filter_extraction_system_prompt},
                        {"role": "user", "content": filter_extraction_user_prompt}
                    ],
                    max_tokens=100,
                    temperature=0.2
                )
                llm_response_content = completion.choices[0].message.content
                logger.info(f"ASA: LLM filter extraction response: {llm_response_content}")
                
                try:
                    if llm_response_content.strip().startswith("```json"):
                        llm_response_content = llm_response_content.strip()[7:-3].strip()
                    elif llm_response_content.strip().startswith("```"):
                        llm_response_content = llm_response_content.strip()[3:-3].strip()

                    filter_data = json.loads(llm_response_content)
                    # Ensure all potential fields are handled, even if missing from LLM response (Pydantic default None will apply)
                    extracted_filters = ExtractedFilters(
                        search_query=filter_data.get('search_query'),
                        category=filter_data.get('category'),
                        price_min=filter_data.get('price_min'),
                        price_max=filter_data.get('price_max'),
                        attributes=filter_data.get('attributes'),
                        destination_country=filter_data.get('destination_country') # Added
                    )
                    logger.info(f"ASA: Extracted filters: {extracted_filters.model_dump_json(indent=2, exclude_none=True)}")
                except (json.JSONDecodeError, TypeError) as e_json:
                    llm_filter_extraction_error = f"Failed to parse JSON from LLM filter extraction: {str(e_json)}. Response: {llm_response_content}"
                    logger.error(f"ASA: {llm_filter_extraction_error}")
                except Exception as e_val: # Catches Pydantic validation errors and other issues
                     llm_filter_extraction_error = f"Failed to validate/process ExtractedFilters from LLM: {str(e_val)}. Response: {llm_response_content}"
                     logger.error(f"ASA: {llm_filter_extraction_error}")
            except Exception as e_llm_filter:
                llm_filter_extraction_error = f"Error during LLM filter extraction call: {str(e_llm_filter)}"
                logger.error(f"ASA: {llm_filter_extraction_error}")

        if not openai_client:
            logger.warning("ASA: OpenAI client not available. Skipping LLM filter extraction.")
            if not extracted_filters.search_query and user_query: # If filters are still empty, use raw query
                 extracted_filters.search_query = user_query
        elif llm_filter_extraction_error and not extracted_filters.search_query and user_query:
            logger.warning(f"ASA: LLM filter extraction failed. Falling back to using raw user query: '{user_query}' for search_query.")
            extracted_filters.search_query = user_query


        # --- Determine path: Greeting or Product Search ---
        common_greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"]
        is_generic_greeting_query = user_query.strip().lower() in common_greetings
        # Filters are considered effectively empty if search_query is just the original generic greeting and category is also empty
        is_effectively_empty_filter_for_greeting = not extracted_filters.category and \
                                                   (not extracted_filters.search_query or extracted_filters.search_query.strip().lower() in common_greetings)

        if is_generic_greeting_query and is_effectively_empty_filter_for_greeting and not llm_filter_extraction_error:
            logger.info("ASA: Detected generic greeting with no specific filters. Responding with a standard greeting.")
            natural_language_response = "Hello! I'm your friendly shopping assistant. What can I help you find today?"
            llm_model_used_for_response_gen = "N/A (greeting path)"
            raw_product_count_debug = 0
        else: # This is the product search path
            logger.info("ASA: Proceeding with product search logic.")
            # Prepare payload for Product Service
            # Use extracted_filters if available and not empty, otherwise use raw user_query for product search if appropriate
            current_search_query = extracted_filters.search_query
            current_category = extracted_filters.category

            # If filter extraction failed AND the original query wasn't just a greeting,
            # ensure search_query is populated with the original user_query.
            if llm_filter_extraction_error and not current_search_query and not is_generic_greeting_query:
                current_search_query = user_query
                logger.info(f"ASA: Using raw user query '{user_query}' for search due to filter extraction error and empty extracted search query.")

            tool_input_payload = ListProductsToolInput(
                query=current_search_query,
                category=current_category,
                price_min=extracted_filters.price_min,
                price_max=extracted_filters.price_max,
                attributes_filter=extracted_filters.attributes
            ).model_dump(exclude_none=True)
            tool_input_payload_debug = tool_input_payload

            product_service_tool_url = f"{PRODUCT_SERVICE_BASE_URL}{PRODUCT_SERVICE_AGENT_MOUNT_PATH}/call_tool/get_all_products"
            product_service_tool_url_debug = product_service_tool_url

            initial_suggested_products: List[Product] = []

            try:
                async with httpx.AsyncClient(timeout=10.0) as http_client: # Added timeout
                    logger.info(f"ASA: Calling Product Service: {product_service_tool_url} with payload: {tool_input_payload}")
                    try:
                        response = await http_client.post(product_service_tool_url, json=tool_input_payload)
                        response.raise_for_status()
                        products_data = response.json()
                        
                        if isinstance(products_data, dict) and "output" in products_data:
                            potential_products = products_data['output']
                            if isinstance(potential_products, list):
                                for prod_data in potential_products:
                                    try:
                                        initial_suggested_products.append(Product(**prod_data))
                                    except Exception as e_map:
                                        logger.error(f"ASA: Error mapping individual product data from Product Service: {str(e_map)}. Data: {prod_data}")
                                raw_product_count_debug = len(initial_suggested_products)
                            else:
                                product_service_error_message = "Product service returned 'output', but it was not a list of products."
                                logger.error(f"ASA: {product_service_error_message}. Received type: {type(potential_products)}")
                                raw_product_count_debug = 0
                            logger.info(f"ASA: Received and parsed {raw_product_count_debug} products from main Product Service.")
                        else:
                            product_service_error_message = "Product service response format was unexpected (missing 'output' or not a dict)."
                            logger.error(f"ASA: {product_service_error_message} Response: {products_data}")
                            raw_product_count_debug = 0
                    # ... (rest of the httpx error handling remains the same) ...
                    except httpx.HTTPStatusError as e_http:
                        product_service_error_message = f"HTTP error calling Product Service: {e_http.response.status_code}. Response: {e_http.response.text}"
                        logger.error(f"ASA: {product_service_error_message}")
                    except httpx.RequestError as e_req:
                        product_service_error_message = f"Request error calling Product Service: {str(e_req)}"
                        logger.error(f"ASA: {product_service_error_message}")
                    except json.JSONDecodeError as e_json_resp:
                        product_service_error_message = f"Failed to decode JSON response from Product Service: {str(e_json_resp)}"
                        logger.error(f"ASA: {product_service_error_message}")

            except Exception as e_outer_ps:
                product_service_error_message = f"Unexpected error during Product Service interaction: {str(e_outer_ps)}"
                logger.error(f"ASA: {product_service_error_message}")

            # --- Enrich CJ Products if any ---
            enriched_products_temp: List[Product] = []
            if initial_suggested_products:
                logger.info(f"ASA: Starting enrichment for {len(initial_suggested_products)} products.")
                for i, product in enumerate(initial_suggested_products):
                    if product.source == 'CJ' and (product.original_cj_product_id or product.id):
                        cj_product_id_to_fetch = product.original_cj_product_id if product.original_cj_product_id else product.id
                        logger.info(f"ASA: Product {product.id} (CJ ID: {cj_product_id_to_fetch}) identified as CJ source. Attempting to enrich.")
                        cj_payload = {"cj_product_id": cj_product_id_to_fetch}
                        cj_tool_url = f"{CJ_DROPSHIPPING_AGENT_BASE_URL}{CJ_DROPSHIPPING_AGENT_DETAILS_TOOL_PATH}"
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as cj_http_client:
                                cj_response = await cj_http_client.post(cj_tool_url, json=cj_payload)
                                cj_response.raise_for_status()
                                cj_product_data_envelope = cj_response.json()
                                if isinstance(cj_product_data_envelope, dict) and "output" in cj_product_data_envelope:
                                    enriched_product = Product(**cj_product_data_envelope['output'])
                                    enriched_products_temp.append(enriched_product)
                                    logger.info(f"ASA: Successfully enriched CJ Product ID {cj_product_id_to_fetch}. Original idx {i} replaced.")
                                else:
                                    logger.warning(f"ASA: CJ Agent details response for {cj_product_id_to_fetch} was not in expected format. Keeping original. Response: {cj_product_data_envelope}")
                                    cj_details_enrichment_errors.append(f"CJ Agent bad details response for {cj_product_id_to_fetch}")
                                    enriched_products_temp.append(product) # Keep original

                        except httpx.HTTPStatusError as e_cj_http:
                            err_msg = f"HTTP error enriching CJ Product details for {cj_product_id_to_fetch}: {e_cj_http.response.status_code} - {e_cj_http.response.text}"
                            logger.error(f"ASA: {err_msg}")
                            cj_details_enrichment_errors.append(err_msg)
                            enriched_products_temp.append(product) # Keep original
                        except Exception as e_cj_enrich:
                            err_msg = f"Unexpected error enriching CJ Product details for {cj_product_id_to_fetch}: {str(e_cj_enrich)}"
                            logger.error(f"ASA: {err_msg}")
                            cj_details_enrichment_errors.append(err_msg)
                            enriched_products_temp.append(product) # Keep original
                    else:
                        enriched_products_temp.append(product)
                suggested_products = enriched_products_temp # First pass of enrichment done

                # --- Second pass: Enrich CJ Products with Stock Information ---
                final_suggested_products: List[Product] = []
                for product_to_stock_check in suggested_products:
                    if product_to_stock_check.source == 'CJ' and (product_to_stock_check.original_cj_product_id or product_to_stock_check.id):
                        cj_product_id_for_stock = product_to_stock_check.original_cj_product_id if product_to_stock_check.original_cj_product_id else product_to_stock_check.id
                        logger.info(f"ASA: Product {product_to_stock_check.id} (CJ ID: {cj_product_id_for_stock}) identified as CJ source. Attempting to get stock.")
                        cj_stock_payload = {"cj_product_id": cj_product_id_for_stock, "sku": None} # Get overall stock for now
                        cj_stock_tool_url = f"{CJ_DROPSHIPPING_AGENT_BASE_URL}{CJ_DROPSHIPPING_AGENT_STOCK_TOOL_PATH}"
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as cj_stock_http_client:
                                cj_stock_response = await cj_stock_http_client.post(cj_stock_tool_url, json=cj_stock_payload)
                                cj_stock_response.raise_for_status()
                                cj_stock_data_envelope = cj_stock_response.json()

                                if isinstance(cj_stock_data_envelope, dict) and "output" in cj_stock_data_envelope:
                                    stock_status_data = cj_stock_data_envelope['output']
                                    # Assuming stock_status_data is a dict matching CJProductStockStatus model
                                    product_to_stock_check.stock_quantity = stock_status_data.get('overall_stock_level', product_to_stock_check.stock_quantity) # Update if available
                                    product_to_stock_check.stock_status_text = stock_status_data.get('status_text', product_to_stock_check.stock_status_text)
                                    logger.info(f"ASA: Successfully updated stock for CJ Product ID {cj_product_id_for_stock}: Qty={product_to_stock_check.stock_quantity}, Status='{product_to_stock_check.stock_status_text}'")
                                else:
                                    logger.warning(f"ASA: CJ Agent stock response for {cj_product_id_for_stock} was not in expected format. Stock info not updated. Response: {cj_stock_data_envelope}")
                                    cj_stock_enrichment_errors.append(f"CJ Agent bad stock response for {cj_product_id_for_stock}")
                        except httpx.HTTPStatusError as e_cj_stock_http:
                            err_msg = f"HTTP error getting stock for CJ Product {cj_product_id_for_stock}: {e_cj_stock_http.response.status_code} - {e_cj_stock_http.response.text}"
                            logger.error(f"ASA: {err_msg}")
                            cj_stock_enrichment_errors.append(err_msg)
                        except Exception as e_cj_stock_enrich:
                            err_msg = f"Unexpected error getting stock for CJ Product {cj_product_id_for_stock}: {str(e_cj_stock_enrich)}"
                            logger.error(f"ASA: {err_msg}")
                            cj_stock_enrichment_errors.append(err_msg)
                    final_suggested_products.append(product_to_stock_check)
                suggested_products = final_suggested_products # Update with stock-enriched products
            else: # No initial products to enrich
                suggested_products = initial_suggested_products

                # --- Third pass: Enrich CJ Products with Shipping Information ---
                if extracted_filters.destination_country:
                    logger.info(f"ASA: Destination country '{extracted_filters.destination_country}' extracted. Attempting to get shipping info for CJ products.")
                    products_after_shipping_enrich: List[Product] = []
                    for product_to_ship_check in suggested_products:
                        if product_to_ship_check.source == 'CJ' and (product_to_ship_check.original_cj_product_id or product_to_ship_check.id):
                            cj_product_id_for_shipping = product_to_ship_check.original_cj_product_id if product_to_ship_check.original_cj_product_id else product_to_ship_check.id
                            cj_shipping_payload = {
                                "cj_product_id": cj_product_id_for_shipping,
                                "destination_country": extracted_filters.destination_country,
                                "sku": None # For now, general product shipping; variant-specific could be future
                            }
                            cj_shipping_tool_url = f"{CJ_DROPSHIPPING_AGENT_BASE_URL}{CJ_DROPSHIPPING_AGENT_SHIPPING_TOOL_PATH}"
                            try:
                                async with httpx.AsyncClient(timeout=10.0) as cj_shipping_http_client:
                                    cj_shipping_response = await cj_shipping_http_client.post(cj_shipping_tool_url, json=cj_shipping_payload)
                                    cj_shipping_response.raise_for_status()
                                    cj_shipping_data_envelope = cj_shipping_response.json()

                                    if isinstance(cj_shipping_data_envelope, dict) and "output" in cj_shipping_data_envelope:
                                        shipping_info_data = cj_shipping_data_envelope['output']
                                        # Product.shipping_info expects CJProductShippingInfo or Dict
                                        # The CJ agent's get_cj_product_shipping_info returns CJProductShippingInfo model
                                        # If that model is compatible or if Product.shipping_info is Dict, direct assignment or ** works.
                                        # Assuming Product.shipping_info is Optional[CJProductShippingInfo]
                                        from app.models.cj_product_models import CJProductShippingInfo # Ensure import
                                        try:
                                            product_to_ship_check.shipping_info = CJProductShippingInfo(**shipping_info_data)
                                            logger.info(f"ASA: Successfully updated shipping for CJ Product ID {cj_product_id_for_shipping} to {extracted_filters.destination_country}.")
                                        except Exception as e_map_ship:
                                            logger.error(f"ASA: Error mapping CJ shipping data for {cj_product_id_for_shipping}: {e_map_ship}. Data: {shipping_info_data}")
                                            cj_shipping_enrichment_errors.append(f"CJ Agent mapping error for {cj_product_id_for_shipping}")

                                    else:
                                        logger.warning(f"ASA: CJ Agent shipping response for {cj_product_id_for_shipping} was not in expected format. Shipping info not updated. Response: {cj_shipping_data_envelope}")
                                        cj_shipping_enrichment_errors.append(f"CJ Agent bad shipping response for {cj_product_id_for_shipping}")
                            except httpx.HTTPStatusError as e_cj_ship_http:
                                err_msg = f"HTTP error getting shipping for CJ Product {cj_product_id_for_shipping}: {e_cj_ship_http.response.status_code} - {e_cj_ship_http.response.text}"
                                logger.error(f"ASA: {err_msg}")
                                cj_shipping_enrichment_errors.append(err_msg)
                            except Exception as e_cj_ship_enrich:
                                err_msg = f"Unexpected error getting shipping for CJ Product {cj_product_id_for_shipping}: {str(e_cj_ship_enrich)}"
                                logger.error(f"ASA: {err_msg}")
                                cj_shipping_enrichment_errors.append(err_msg)
                        products_after_shipping_enrich.append(product_to_ship_check)
                    suggested_products = products_after_shipping_enrich
                else: # No destination country extracted, skip shipping enrichment
                    logger.info("ASA: No destination country extracted, skipping CJ shipping info enrichment.")


            # --- Generate Final Natural Language Response ---
            if product_service_error_message and not suggested_products:
                natural_language_response = "I'm having trouble accessing product information at the moment. Please try your search again in a few minutes."
                llm_model_used_for_response_gen = "N/A (due to Product Service error)"
            elif not openai_client:
                llm_model_used_for_response_gen = "N/A (OpenAI client not available for final response)"
                if suggested_products:
                    natural_language_response = f"I found {len(suggested_products)} product(s) for you. You can review them in the list below."
                    if llm_filter_extraction_error: # If filter extraction also failed
                         natural_language_response = f"I had a bit of trouble refining your search terms, but based on your query, I found {len(suggested_products)} product(s). Please see the list."
                elif llm_filter_extraction_error:
                     natural_language_response = "I had some trouble understanding your request and couldn't find any products. Could you please try rephrasing?"
                else: # No products, no filter error, but LLM for response gen is off
                    natural_language_response = "I couldn't find any products matching your query."
            else: # OpenAI client available and no product service error
                response_gen_system_prompt = (
                    "You are an AI Shopping Assistant. Your primary goal is to provide a helpful and natural language response based on the user's query and the products found (if any). "
                    "If products are found, briefly mention one or two, or summarize the findings (e.g., 'I found several options for electronics'). Indicate the total number of products found if it's more than a few. "
                    "If a product has multiple options or variants (indicated in the summary provided to you), explicitly mention this and suggest the user can ask for more details about specific options (e.g., 'The T-shirt comes in different sizes and colors. Let me know if you'd like details on a specific one.'). "
                    "Also, consider mentioning noteworthy stock statuses if available (e.g., 'low stock', 'out of stock'). "
                    "If shipping information (like estimated delivery time or cost) is available for a product AND the user asked about shipping or a country, mention it briefly. " # Added shipping instruction
                    "If no products are found, politely inform the user and perhaps suggest they rephrase their query or try different terms. "
                    "If there was an earlier issue with understanding their query (e.g., filter extraction failed), acknowledge it subtly if relevant (e.g., 'Based on your query, I found...'). "
                    "Keep the response conversational and not overly long. Do not repeat the product list verbatim unless specifically asked or if it's very short (1-2 items)."
                )
                response_gen_user_prompt_parts = [f"User's original query: \"{user_query}\""]
                if extracted_filters.destination_country:
                    response_gen_user_prompt_parts.append(f"\nUser seems interested in shipping to: {extracted_filters.destination_country}.")
                if llm_filter_extraction_error:
                    response_gen_user_prompt_parts.append(f"\nNote: There was an issue processing the query details: {llm_filter_extraction_error}")

                if suggested_products:
                    product_summary_for_llm = "\n\nProducts found (summary for you to use in response):\n"
                    for i, p in enumerate(suggested_products[:3]):
                        base_info = f"- Name: {p.name}, Category: {p.category}, Price: {p.price:.2f}"
                        if p.stock_status_text:
                            base_info += f", Stock: {p.stock_status_text}"

                        # Variant Info
                        if p.has_variants and p.variants:
                            variant_info = f", Variants: {len(p.variants)} options (e.g., "
                            example_attrs = set()
                            for v_attr_dict in [var.attributes for var in p.variants if var.attributes]:
                                for attr_name in v_attr_dict.keys():
                                    example_attrs.add(attr_name.lower())
                                    if len(example_attrs) >= 2: break
                                if len(example_attrs) >= 2: break
                            variant_info += ", ".join(list(example_attrs)) if example_attrs else "various styles"
                            variant_info += ")"
                            base_info += variant_info
                        elif p.has_variants and p.variant_attribute_names:
                            base_info += f", Options: (e.g., different {', '.join(p.variant_attribute_names)})"

                        # Shipping Info
                        # Check if p.shipping_info is an instance of CJProductShippingInfo Pydantic model
                        # or if it's a dict that needs to be parsed.
                        # Based on previous step, it should be CJProductShippingInfo model instance.
                        if p.shipping_info:
                            si = p.shipping_info # type: ignore (as it's CJProductShippingInfo model)
                            ship_msg = si.message # Default to the message from CJ agent
                            if si.estimated_delivery_min_days and si.estimated_delivery_max_days and si.destination_country:
                                ship_msg = f"Est. Delivery: {si.estimated_delivery_min_days}-{si.estimated_delivery_max_days} days to {si.destination_country}"
                                if si.shipping_cost is not None and si.currency:
                                    ship_msg += f", Cost: ${si.shipping_cost:.2f} {si.currency}"
                            base_info += f", Shipping: {ship_msg}"

                        product_summary_for_llm += f"{base_info}\n"
                    if len(suggested_products) > 3:
                        product_summary_for_llm += f"...and {len(suggested_products) - 3} more.\n"
                    response_gen_user_prompt_parts.append(product_summary_for_llm)
                else:
                    response_gen_user_prompt_parts.append("\n\nNo products were found matching the query criteria.")

                response_gen_user_prompt = "".join(response_gen_user_prompt_parts)
                response_gen_user_prompt += "\n\nCraft a concise, helpful, and natural language response for the user:"

                try:
                    logger.info(f"ASA: Calling LLM for final response generation. Model: {OPENROUTER_MODEL_NAME}")
                    completion = await openai_client.chat.completions.create(
                        model=OPENROUTER_MODEL_NAME,
                        messages=[
                            {"role": "system", "content": response_gen_system_prompt},
                            {"role": "user", "content": response_gen_user_prompt}
                        ],
                        max_tokens=300, # Increased slightly for potentially more nuanced responses
                        temperature=0.7
                    )
                    natural_language_response = completion.choices[0].message.content
                    logger.info(f"ASA: LLM final response: {natural_language_response}")
                except Exception as e_llm_final:
                    final_llm_error_message = f"Error during final LLM response generation: {str(e_llm_final)}"
                    logger.error(f"ASA: {final_llm_error_message}")
                    if suggested_products:
                        natural_language_response = f"I found {len(suggested_products)} product(s) for you, but I'm having a little trouble summarizing them right now. Please check the product list below."
                    elif llm_filter_extraction_error: # No products, and filter extraction also failed
                        natural_language_response = "I had some trouble understanding your request and couldn't find any products. Could you please try rephrasing?"
                    else: # No products, but filter extraction was okay (or skipped)
                        natural_language_response = "I couldn't find any products matching your query, and I'm having some technical difficulties at the moment. Please try again shortly."
                    llm_model_used_for_response_gen = f"{OPENROUTER_MODEL_NAME} (Error: {final_llm_error_message})"

    # --- End Main Logic Block ---
    except Exception as e_critical:
        import traceback
        critical_error_message = f"A critical unexpected error occurred in process_user_query_tool: {type(e_critical).__name__} - {str(e_critical)}"
        logger.error(f"ASA: CRITICAL ERROR: {critical_error_message}\n{traceback.format_exc()}")
        natural_language_response = "I encountered a critical unexpected issue and cannot process your request at this time."
        suggested_products = []
        # Ensure debug_info captures what's available at this point
        debug_info = {
            "user_query": user_query,
            "critical_error": critical_error_message,
            "llm_filter_extraction_error": llm_filter_extraction_error,
            "extracted_search_query_param": extracted_filters.search_query if 'extracted_filters' in locals() else "N/A",
            "extracted_category_param": extracted_filters.category if 'extracted_filters' in locals() else "N/A",
            "product_service_url": product_service_tool_url_debug if 'product_service_tool_url_debug' in locals() else "N/A",
            "product_service_payload": tool_input_payload_debug if 'tool_input_payload_debug' in locals() else {},
            "product_service_error": product_service_error_message,
            "final_llm_error": final_llm_error_message,
            "llm_model_used_for_response_gen": llm_model_used_for_response_gen if 'llm_model_used_for_response_gen' in locals() else OPENROUTER_MODEL_NAME,
            "raw_product_count_from_service": raw_product_count_debug if 'raw_product_count_debug' in locals() else "N/A"
        }
        return ShoppingAssistantResponse(
            natural_language_response=natural_language_response,
            suggested_products=suggested_products,
            debug_info=debug_info
        )

    # --- Construct Final Debug Info & Response ---
    debug_info = {
        "user_query": user_query,
        "llm_filter_extraction_error": llm_filter_extraction_error,
        "extracted_search_query_param": extracted_filters.search_query,
        "extracted_category_param": extracted_filters.category,
        "extracted_price_min": extracted_filters.price_min,
        "extracted_price_max": extracted_filters.price_max,
        "extracted_attributes": extracted_filters.attributes,
        "extracted_destination_country": extracted_filters.destination_country, # Added
        "product_service_url": product_service_tool_url_debug,
        "product_service_payload": tool_input_payload_debug,
        "product_service_error": product_service_error_message,
        "cj_details_enrichment_errors": cj_details_enrichment_errors,
        "cj_stock_enrichment_errors": cj_stock_enrichment_errors,
        "cj_shipping_enrichment_errors": cj_shipping_enrichment_errors, # Added
        "final_llm_error": final_llm_error_message,
        "llm_model_used_for_response_gen": llm_model_used_for_response_gen,
        "raw_product_count_from_service": raw_product_count_debug
    }
    return ShoppingAssistantResponse(
        natural_language_response=natural_language_response,
        suggested_products=suggested_products,
        debug_info=debug_info
    )
                    "provide a helpful and natural language response. "
                    "If products are found, briefly mention a few or summarize them, and indicate how many were found if it's a large number. "
                    "If a product has multiple options or variants, mention this and suggest the user can ask for more details about specific options if they are interested. " # Added instruction for variants
                    "If no products are found, politely inform the user. "
                    "Do not repeat the product list verbatim unless very short. Focus on a conversational summary."
                )
                response_gen_user_prompt_parts = [f"User query: \"{user_query}\""]
                if suggested_products:
                    product_summary_for_llm = "\n\nProducts found (summary):\n"
                    for i, p in enumerate(suggested_products[:3]): # Show first 3 products in summary
                        base_info = f"- {p.name} (Category: {p.category}, Price: {p.price:.2f})" # Ensure price is formatted
                        if p.has_variants and p.variants:
                            variant_info = f" - Available in {len(p.variants)} options (e.g., different "
                            # Try to get some example attribute names
                            example_attrs = set()
                            for v_attr_dict in [var.attributes for var in p.variants if var.attributes]:
                                for attr_name in v_attr_dict.keys():
                                    example_attrs.add(attr_name.lower())
                                    if len(example_attrs) >= 2: break
                                if len(example_attrs) >= 2: break
                            if example_attrs:
                                variant_info += ", ".join(list(example_attrs))
                            else:
                                variant_info += "styles" # Fallback if no attributes found
                            variant_info += ")."
                            product_summary_for_llm += f"{base_info}{variant_info}\n"
                        else:
                            product_summary_for_llm += f"{base_info}\n"
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


# TODO:
# 1. Implement actual MCP client logic to call Product Service.
#    - Fetch Product Service context.
#    - Find and call 'get_all_products' tool.
# 2. Integrate an LLM for:
#    - Query understanding and intent extraction.
#    - Parameter extraction for Product Service tools.
#    - Generating the final natural_language_response based on tool outputs.
# 3. Add error handling for MCP calls and LLM interactions.
