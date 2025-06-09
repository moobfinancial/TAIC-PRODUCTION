from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from psycopg2.extras import RealDictCursor # Added

from app.models.shopping_assistant import ShoppingAssistantRequestSchema, ShoppingAssistantResponseSchema, ChatMessageSchema
from app.models.product import ProductModel # Added
from app.llm_clients.openrouter_client import call_openrouter_mistral, OpenRouterError
from app.core.config import settings
from app.db.session import get_db # Added
from app.services.product_service import search_products_by_name # Added

router = APIRouter()

@router.post("/query", response_model=ShoppingAssistantResponseSchema)
async def query_assistant(
    request_data: ShoppingAssistantRequestSchema,
    db_cursor: RealDictCursor = Depends(get_db) # Added db_cursor dependency
):
    """
    Receives a query for the shopping assistant, calls the OpenRouter API,
    and returns the AI's response. Potentially searches for products if keywords are detected.
    """
    log_prefix = f"[AI Service - User: {request_data.user_id} - Query: '{request_data.query[:30]}...']"
    print(f"{log_prefix} Received request.")

    found_products: List[ProductModel] = []
    search_term_extracted = ""

    # Simple keyword detection for product search
    # Keywords should ideally be at the beginning or clearly indicate search intent.
    search_triggers = {
        "search for ": len("search for "),
        "find products named ": len("find products named "),
        "find product named ": len("find product named "),
        "find me products called ": len("find me products called "),
        "find me product called ": len("find me product called "),
        "find me ": len("find me "),
        "search ": len("search "),
        "find ": len("find ")
    } # Store length for easier slicing

    query_lower = request_data.query.lower()

    for keyword, key_len in search_triggers.items():
        if query_lower.startswith(keyword):
            search_term_extracted = request_data.query[key_len:].strip()
            # Remove common suffixes if they are not part of the product name itself
            common_suffixes = [" products", " product", " items", " item", " for me", " please"]
            for suffix in common_suffixes:
                if search_term_extracted.lower().endswith(suffix):
                    search_term_extracted = search_term_extracted[:-len(suffix)].strip()
            if search_term_extracted: # Ensure search term is not empty after stripping
                break

    if not search_term_extracted and " about " not in query_lower: # If no prefix keyword, check if it's a general query that might be a product
        # This is a more general catch-all, might be too broad,
        # but for a shopping assistant, many short queries might be product names.
        # Consider length or other heuristics if this is too aggressive.
        if len(request_data.query.split()) < 5: # Example: if query is short
             search_term_extracted = request_data.query.strip()

    if search_term_extracted:
        print(f"{log_prefix} Detected product search intent. Extracted Term: '{search_term_extracted}' (Original query: '{request_data.query}')")
        try:
            # limit to 3 for context, as per new requirement
            found_products = search_products_by_name(db_cursor, search_term_extracted, limit=3)
            print(f"{log_prefix} Product service found {len(found_products)} products for term '{search_term_extracted}'.")
        except Exception as e:
            print(f"{log_prefix} Error calling product_service.search_products_by_name: {e}")
            found_products = [] # Ensure found_products is empty on error to avoid issues later

    # Construct prompt_messages (this part should follow the product search)
    # Use the full system prompt as specified in the request
    prompt_messages: List[ChatMessageSchema] = [
        ChatMessageSchema(role="system", content="You are a helpful and friendly shopping assistant for TAIC, a global e-commerce platform. Your main goal is to assist users with their shopping queries, provide information about products, and help them navigate the platform. Be concise, polite, and focus on e-commerce related tasks. Do not go off-topic.")
    ]

    if request_data.conversation_history:
        print(f"{log_prefix} Conversation history provided with {len(request_data.conversation_history)} messages.")
        prompt_messages.extend(request_data.conversation_history)

    # Add current user query
    prompt_messages.append(ChatMessageSchema(role="user", content=request_data.query))

    # Augment with product search results if any
    if found_products:
        product_summary_for_llm = "\n\nSystem Information: I found the following products in our catalog based on the query:\n"
        for i, p in enumerate(found_products):
            product_summary_for_llm += f"{i+1}. Name: {p.name} (ID: {p.id}, Price: ${p.price:.2f}"
            if p.category_name:
                product_summary_for_llm += f", Category: {p.category_name}"
            product_summary_for_llm += ")\n" # Removed description from here as per request's prompt example
        product_summary_for_llm += "Please use this information to answer the user's query. If these products are relevant, incorporate them into your response. If the user was searching, confirm what you found or indicate if nothing matched well."

        prompt_messages.append(ChatMessageSchema(role="system", content=product_summary_for_llm))

    # The try-except block for call_openrouter_mistral follows this:
    try:
        print(f"{log_prefix} Preparing to call OpenRouter LLM. Total prompt messages: {len(prompt_messages)}")
        # for msg_idx, msg_content in enumerate(prompt_messages):
        #     print(f"{log_prefix} Prompt msg {msg_idx}: Role: {msg_content.role}, Content: {msg_content.content[:200]}")

        llm_reply_content = await call_openrouter_mistral(
            prompt_messages=prompt_messages,
            api_key=settings.OPENROUTER_API_KEY,
            model_name=settings.OPENROUTER_MISTRAL_MODEL_NAME,
            site_url=settings.AI_APP_SITE_URL,
            app_title="TAIC Platform Shopping Assistant"
        )
        print(f"{log_prefix} Received reply from OpenRouter.")

        return ShoppingAssistantResponseSchema(
            reply=llm_reply_content,
            suggested_products=found_products # Return found_products directly
        )
    except OpenRouterError as e:
        error_message_detail = str(e.error_data) if e.error_data else "No additional details from LLM provider."
        print(f"{log_prefix} OpenRouterError. Status: {e.status_code}. Details: {error_message_detail}")

        client_error_detail = f"The AI service encountered an issue with the LLM provider (status: {e.status_code}). Please try again later."
        if e.status_code == 401:
            client_error_detail = "AI service is not authorized with the LLM provider. Configuration issue."
        elif e.status_code == 429:
            client_error_detail = "AI service is currently experiencing high demand. Please try again shortly."

        # Check for specific configuration error message from the custom OpenRouterError
        if e.error_data and isinstance(e.error_data, dict):
            err_msg_from_provider = e.error_data.get("error", {}).get("message", "")
            if "OpenRouter API Key not configured" in err_msg_from_provider:
                 client_error_detail = "AI Service API Key configuration error. Please contact support."

        raise HTTPException(
            status_code=502,
            detail=client_error_detail
        )
    except Exception as e:
        print(f"{log_prefix} Unexpected error: {type(e).__name__} - {str(e)}")
        # import traceback
        # print(traceback.format_exc()) # Consider logging stack trace in dev
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred with the AI Shopping Assistant."
        )
