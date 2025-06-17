import logging
import httpx
import os
import json # For parsing LLM JSON output
from typing import List, Optional, Dict, Any, Set # Added Set for deduplication
from pydantic import BaseModel, Field # Added BaseModel and Field
from dotenv import load_dotenv
import openai # For OpenRouter

from mcp.server.fastmcp.server import FastMCP, Context as ToolContext # Corrected import for ToolContext
from app.models.gift_recommendation_models import (
    GiftRecommendationRequest,
    GiftRecommendationResponse,
    # GiftRecipientInfo # Not strictly needed for import if only used in GiftRecommendationRequest
)
from app.models.product import Product, ListProductsToolInput # For Product Service interaction and response

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# --- OpenAI Client Setup for OpenRouter (similar to ShoppingAssistant) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_BASE = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
# Using a potentially more capable model for gift idea generation if available, else fallback
OPENROUTER_GIFT_MODEL_NAME = os.getenv("OPENROUTER_GIFT_MODEL_NAME", "mistralai/mixtral-8x7b-instruct")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "TAIC Gift Recommender")

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
    logger.warning("GRA Warning: OPENROUTER_API_KEY not found. LLM functionalities will be significantly limited or disabled.")
# --- End OpenAI Client Setup ---


# Configuration for the Product Service MCP (Gift Recommendation Agent will be a client to this)
PRODUCT_SERVICE_BASE_URL = os.getenv("PRODUCT_SERVICE_BASE_URL", "http://localhost:8000")
PRODUCT_SERVICE_AGENT_MOUNT_PATH = os.getenv("PRODUCT_SERVICE_AGENT_MOUNT_PATH", "/mcp_product_service")

gift_recommendation_mcp_server = FastMCP(
    name="GiftRecommendationService",
    title="TAIC Gift Recommendation Service",
    description="An AI agent that suggests gift ideas based on recipient information and context.",
    version="0.1.0"
)

# --- Pydantic model for LLM-derived search parameters ---
class LLMDerivedSearchParams(BaseModel):
    search_queries: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    # attributes_filter: Optional[Dict[str, str]] = None # Future: LLM could also suggest attribute filters


@gift_recommendation_mcp_server.tool(
    name="get_gift_suggestions",
    description="Generates gift suggestions based on recipient information, occasion, budget, and any additional context."
    # input_model and output_model are inferred from type hints
)
async def get_gift_suggestions(ctx: ToolContext, request_data: GiftRecommendationRequest) -> GiftRecommendationResponse:
    logger.info(f"Received gift recommendation request: {request_data.model_dump_json(indent=2, exclude_none=True)}")

    recipient_info = request_data.recipient_info
    query_context = request_data.query_context

    llm_derived_params = LLMDerivedSearchParams()
    llm_query_formulation_error: Optional[str] = None
    final_llm_response_error: Optional[str] = None

    # --- 1. LLM Call for Query Formulation ---
    if openai_client:
        query_formulation_system_prompt = (
            "You are an AI assistant helping to formulate search queries for finding gifts. "
            "Based on the recipient's details (age, gender, interests, occasion, budget) and any user context, "
            "generate a JSON object with keys: 'search_queries' (a list of 2-3 diverse keyword strings), "
            "'categories' (a list of up to 2 relevant product categories), "
            "'price_min' (float, optional), and 'price_max' (float, optional). "
            "Examples for categories: 'Electronics', 'Fashion', 'Books', 'Outdoor Gear', 'Home Decor', 'Toys & Games', 'Sports Equipment'. "
            "Prioritize general keywords and categories. If budget is mentioned (e.g., 'around $50', 'under $100', '$50-$100'), infer price_min/max. "
            "If specific interests are 'hiking' and 'coffee', search_queries could be ['hiking gear', 'gourmet coffee', 'outdoor accessories']. "
            "Only return the JSON object."
        )

        recipient_info_str = recipient_info.model_dump_json(exclude_none=True)
        query_formulation_user_prompt = (
            f"Recipient Info: {recipient_info_str}\n"
            f"User Context: \"{query_context if query_context else 'None'}\"\n\n"
            "Generate search parameters as a JSON object:"
        )

        try:
            logger.info(f"GRA: Calling LLM for query formulation. Model: {OPENROUTER_GIFT_MODEL_NAME}")
            completion = await openai_client.chat.completions.create(
                model=OPENROUTER_GIFT_MODEL_NAME,
                messages=[
                    {"role": "system", "content": query_formulation_system_prompt},
                    {"role": "user", "content": query_formulation_user_prompt}
                ],
                max_tokens=200, # Allow for a few queries and categories
                temperature=0.5
            )
            llm_response_content = completion.choices[0].message.content
            logger.info(f"GRA: LLM query formulation response: {llm_response_content}")

            try:
                if llm_response_content.strip().startswith("```json"):
                    llm_response_content = llm_response_content.strip()[7:-3].strip()
                elif llm_response_content.strip().startswith("```"):
                     llm_response_content = llm_response_content.strip()[3:-3].strip()

                llm_data = json.loads(llm_response_content)
                llm_derived_params = LLMDerivedSearchParams(**llm_data)
                logger.info(f"GRA: Parsed LLM search params: {llm_derived_params.model_dump_json(exclude_none=True)}")
            except (json.JSONDecodeError, TypeError, Exception) as e_parse: # Catch Pydantic validation errors too
                llm_query_formulation_error = f"Failed to parse/validate JSON from LLM for query formulation: {str(e_parse)}. Response: {llm_response_content}"
                logger.error(f"GRA: {llm_query_formulation_error}")
        except Exception as e_llm_call:
            llm_query_formulation_error = f"Error during LLM call for query formulation: {str(e_llm_call)}"
            logger.error(f"GRA: {llm_query_formulation_error}")
    else:
        llm_query_formulation_error = "OpenAI client not configured; skipping LLM query formulation."
        logger.warning(f"GRA: {llm_query_formulation_error}")

    # --- 2. Call Product Service (Potentially multiple times) ---
    all_suggested_products: Dict[str, Product] = {} # Use dict to auto-deduplicate by product ID
    product_service_error_message: Optional[str] = None
    product_service_payloads_debug: List[Dict] = [] # Store all payloads sent

    # Determine search parameters: use LLM derived if available and valid, else fallback
    search_terms_to_use: List[Optional[str]] = [None] # Default to one search with no specific query term if LLM fails badly
    categories_to_use: List[Optional[str]] = [None]

    final_price_min = llm_derived_params.price_min if llm_derived_params.price_min is not None else recipient_info.budget_min
    final_price_max = llm_derived_params.price_max if llm_derived_params.price_max is not None else recipient_info.budget_max

    if llm_derived_params.search_queries:
        search_terms_to_use = llm_derived_params.search_queries
    elif not llm_query_formulation_error: # LLM ran but returned no queries, use original context
        base_fallback_query_parts = recipient_info.interests or []
        if recipient_info.occasion: base_fallback_query_parts.append(recipient_info.occasion)
        if query_context: base_fallback_query_parts.append(query_context)
        if base_fallback_query_parts: search_terms_to_use = [" ".join(base_fallback_query_parts)]
    # If llm_query_formulation_error is set, search_terms_to_use remains [None] unless base_fallback_query_parts populates it

    if llm_derived_params.categories:
        categories_to_use = llm_derived_params.categories
    # If categories_to_use remains [None], each search term will be tried without category filter

    # Cap the number of product service calls to avoid excessive requests
    max_product_service_calls = 3
    call_count = 0

    for term_idx, search_query in enumerate(search_terms_to_use):
        if call_count >= max_product_service_calls: break

        # If LLM provided categories, try to align them with queries, or cycle through them.
        # Simple approach: if categories exist, use the first one for first query, second for second, etc.
        # Or, if only one category, use it for all queries from LLM.
        # If no categories from LLM, category_filter remains None.
        category_filter: Optional[str] = None
        if categories_to_use and categories_to_use[0] is not None: # Check if list is not empty and first item is not None
            category_filter = categories_to_use[term_idx % len(categories_to_use)]


        if not search_query and not category_filter and final_price_min is None and final_price_max is None and not product_service_payloads_debug:
            # Avoid making an empty call if it's the first attempt and all params are null
            logger.info("GRA: Skipping product service call as all effective search parameters are empty.")
            continue

        product_service_payload = ListProductsToolInput(
            query=search_query,
            category=category_filter,
            price_min=final_price_min,
            price_max=final_price_max,
        ).model_dump(exclude_none=True)
        product_service_payloads_debug.append(product_service_payload)

        product_service_tool_url = f"{PRODUCT_SERVICE_BASE_URL}{PRODUCT_SERVICE_AGENT_MOUNT_PATH}/call_tool/get_all_products"
        logger.info(f"GRA: Calling Product Service ({call_count+1}): {product_service_tool_url} with payload: {product_service_payload}")
        call_count += 1

        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client: # Added timeout
                response = await http_client.post(product_service_tool_url, json=product_service_payload)
                response.raise_for_status()
                product_service_raw_output = response.json()

                if isinstance(product_service_raw_output, dict) and "output" in product_service_raw_output:
                    potential_products = product_service_raw_output['output']
                    if isinstance(potential_products, list):
                        for prod_data in potential_products:
                            try:
                                product = Product(**prod_data)
                                if product.id not in all_suggested_products: # Deduplicate
                                    all_suggested_products[product.id] = product
                            except Exception as e_map:
                                logger.error(f"GRA: Error mapping product data from Product Service: {e_map}. Data: {prod_data}")
                        logger.info(f"GRA: Received and parsed {len(potential_products)} products from this Product Service call. Total unique products: {len(all_suggested_products)}")
                    else:
                        product_service_error_message = (product_service_error_message or "") + "Product Service 'output' was not a list in one of the calls. "
                        logger.error(f"GRA: {product_service_error_message} Type: {type(potential_products)}")
                else:
                    product_service_error_message = (product_service_error_message or "") + "Product Service response format unexpected in one of the calls. "
                    logger.error(f"GRA: {product_service_error_message} Response: {product_service_raw_output}")
        except Exception as e_ps_call: # Catch all exceptions from this block including httpx errors
            current_call_error = f"Error during Product Service call ({call_count}): {str(e_ps_call)}"
            product_service_error_message = (product_service_error_message or "") + current_call_error
            logger.error(f"GRA: {current_call_error}")

        if len(all_suggested_products) >= 10: # Stop if we have enough diverse products
            logger.info("GRA: Collected enough products, stopping further Product Service calls.")
            break

    suggested_products_list = list(all_suggested_products.values())

    # --- 3. LLM Call for Final Response Generation ---
    message_to_user = "Here are some gift ideas I found for you!" # Default message

    if openai_client:
        final_response_system_prompt = (
            "You are a friendly and insightful Gift Recommendation AI. Based on the recipient's profile "
            "(age, gender, interests, occasion, budget) and a list of potential gift products, "
            "craft a personalized and engaging message to the user. Explain *why* some of these products "
            "(highlight 1-2 diverse options if many are found) might be good choices for this specific recipient. "
            "If few or no products were found, offer some general advice or alternative ideas based on the recipient's profile, "
            "or suggest broadening the search. Keep the tone warm and helpful."
        )

        product_summary_for_llm = "No specific products found matching all criteria."
        if suggested_products_list:
            product_summary_for_llm = "Potential products found:\n"
            for i, p in enumerate(suggested_products_list[:5]): # Max 5 products in prompt summary
                 product_summary_for_llm += f"- Name: {p.name}, Category: {p.category}, Price: {p.price:.2f}"
                 if p.has_variants and p.variants:
                     variant_info = f", Options: {len(p.variants)} available (e.g., "
                     example_attrs = set()
                     for v_attr_dict in [var.attributes for var in p.variants if var.attributes]:
                         for attr_name in v_attr_dict.keys():
                             example_attrs.add(attr_name.lower())
                             if len(example_attrs) >= 2: break
                         if len(example_attrs) >= 2: break
                     variant_info += ", ".join(list(example_attrs)) if example_attrs else "various styles"
                     variant_info += ")"
                     product_summary_for_llm += f"{variant_info}\n"
                 else:
                     product_summary_for_llm += "\n"

        final_response_user_prompt = (
            f"Recipient Profile: {recipient_info.model_dump_json(exclude_none=True)}\n"
            f"User's Initial Context: \"{query_context if query_context else 'None'}\"\n"
            f"Products Summary: {product_summary_for_llm}\n\n"
            "Please generate a friendly and helpful message for the user with your recommendations or advice:"
        )

        try:
            logger.info(f"GRA: Calling LLM for final response generation. Model: {OPENROUTER_GIFT_MODEL_NAME}")
            completion = await openai_client.chat.completions.create(
                model=OPENROUTER_GIFT_MODEL_NAME,
                messages=[
                    {"role": "system", "content": final_response_system_prompt},
                    {"role": "user", "content": final_response_user_prompt}
                ],
                max_tokens=350, # Allow for a more detailed explanation
                temperature=0.75
            )
            message_to_user = completion.choices[0].message.content
            logger.info(f"GRA: LLM final response: {message_to_user}")
        except Exception as e_llm_final:
            final_llm_response_error = f"Error during final LLM response generation: {str(e_llm_final)}"
            logger.error(f"GRA: {final_llm_response_error}")
            if suggested_products_list:
                message_to_user = f"I found {len(suggested_products_list)} potential gift(s), but I'm having a bit of trouble crafting a personalized summary right now. Please take a look at the suggestions!"
            elif product_service_error_message:
                 message_to_user = "I encountered an issue searching for products. Please try again later."
            else:
                message_to_user = "I'm having trouble coming up with specific recommendations at the moment. Perhaps try a broader search?"
    elif suggested_products_list: # Fallback if LLM for final response fails or is off, but we have products
        message_to_user = f"I found {len(suggested_products_list)} gift idea(s) that might interest you. Here are a few:"
        if len(suggested_products_list) > 5:
            message_to_user = f"I found many potential gift ideas! Here are the first 5 based on your criteria:"
        # suggested_products_list is already capped at 5 for the response if it was longer.
    elif product_service_error_message:
         message_to_user = "I had some trouble searching for products right now. Please try again in a moment."
    elif not (search_terms_to_use != [None] or final_price_min is not None or final_price_max is not None): # No effective search criteria
        message_to_user = "Could you provide a bit more information? For example, some interests, the occasion, or a budget would help me find the perfect gift!"
    else: # No products found, no specific errors
        message_to_user = "I couldn't find specific gifts matching all your criteria. You might want to broaden your search or check out our general catalog."


    # Prepare final list of recommendations for response (e.g. top 5-10)
    final_recommendations = suggested_products_list[:10] # Max 10 recommendations in response

    debug_info = {
        "input_recipient_info": recipient_info.model_dump(exclude_none=True),
        "input_query_context": query_context,
        "llm_query_formulation_error": llm_query_formulation_error,
        "llm_derived_search_params": llm_derived_params.model_dump(exclude_none=True),
        "product_service_payloads": product_service_payloads_debug,
        "product_service_error": product_service_error_message,
        "num_unique_products_found": len(suggested_products_list),
        "final_llm_response_error": final_llm_response_error,
        "num_recommendations_in_response": len(final_recommendations)
    }

    return GiftRecommendationResponse(
        recommendations=final_recommendations,
        message_to_user=message_to_user,
        debug_info=debug_info
    )

# Example of how to run this agent standalone for testing (if needed)
# if __name__ == "__main__":
#     import uvicorn
#     # This would require the main FastAPI app (and thus ProductService) to be running on port 8000
#     # for the Product Service calls to work.
#     gift_recommendation_mcp_server.run_standalone_server(port=8002)
#     import uvicorn
#     # This would require the main FastAPI app (and thus ProductService) to be running on port 8000
#     # for the Product Service calls to work.
#     gift_recommendation_mcp_server.run_standalone_server(port=8002)
