from fastapi import APIRouter, Depends, HTTPException
from typing import List

# Corrected imports assuming 'app' is discoverable in PYTHONPATH
# or structure allows these direct imports from 'app' root
from app.models.shopping_assistant import ShoppingAssistantRequestSchema, ShoppingAssistantResponseSchema, ChatMessageSchema
# from app.models.product import ProductModel # Not used directly for product suggestions in this phase
from app.llm_clients.openrouter_client import call_openrouter_mistral, OpenRouterError
from app.core.config import settings
# from app.db.session import get_db # Only if direct DB access needed here
# from psycopg2.extras import RealDictCursor # Only if direct DB access needed here
# from app.services.product_service import search_products_by_name # If using product search

router = APIRouter()

@router.post("/query", response_model=ShoppingAssistantResponseSchema)
async def query_assistant(
    request_data: ShoppingAssistantRequestSchema,
    # db_cursor: RealDictCursor = Depends(get_db) # Example for future DB use
):
    """
    Receives a query for the shopping assistant, calls the OpenRouter API,
    and returns the AI's response.
    """
    log_prefix = f"[AI Service - User: {request_data.user_id} - Query: '{request_data.query[:30]}...']"
    print(f"{log_prefix} Received request.")

    prompt_messages: List[ChatMessageSchema] = [
        ChatMessageSchema(
            role="system",
            content="You are a helpful and friendly shopping assistant for TAIC, a global e-commerce platform. Your main goal is to assist users with their shopping queries, provide information about products, and help them navigate the platform. Be concise, polite, and focus on e-commerce related tasks. Do not go off-topic."
        )
    ]

    if request_data.conversation_history:
        print(f"{log_prefix} Conversation history provided with {len(request_data.conversation_history)} messages.")
        prompt_messages.extend(request_data.conversation_history)

    prompt_messages.append(ChatMessageSchema(role="user", content=request_data.query))

    try:
        print(f"{log_prefix} Preparing to call OpenRouter LLM.")
        llm_reply_content = await call_openrouter_mistral(
            prompt_messages=prompt_messages,
            api_key=settings.OPENROUTER_API_KEY,
            model_name=settings.OPENROUTER_MISTRAL_MODEL_NAME,
            site_url=settings.AI_APP_SITE_URL,
            app_title="TAIC Platform Shopping Assistant"
        )
        print(f"{log_prefix} Received reply from OpenRouter.")

        # Product search/suggestion logic would go here in the future
        # For now, suggested_products remains empty.
        # Example:
        # suggested_products_list: List[ProductModel] = []
        # if "search for" in request_data.query.lower() and db_cursor:
        #     search_term = request_data.query.lower().split("search for")[-1].strip()
        #     if search_term:
        #         print(f"{log_prefix} Identified search term: '{search_term}'")
        #         # suggested_products_list = search_products_by_name(db_cursor, search_term, limit=3) # Assuming service takes db_cursor
        #         print(f"{log_prefix} Found {len(suggested_products_list)} products (simulated).")

        return ShoppingAssistantResponseSchema(
            reply=llm_reply_content,
            suggested_products=[] # No product suggestion logic in this phase
        )
    except OpenRouterError as e:
        error_message_detail = str(e.error_data) if e.error_data else "No additional details from LLM provider."
        print(f"{log_prefix} OpenRouterError. Status: {e.status_code}. Details: {error_message_detail}")

        client_error_detail = f"The AI service encountered an issue with the LLM provider (status: {e.status_code}). Please try again later."
        if e.status_code == 401:
            client_error_detail = "AI service is not authorized with the LLM provider. Configuration issue."
        elif e.status_code == 429:
            client_error_detail = "AI service is currently experiencing high demand. Please try again shortly."
        elif str(e.error_data).includes("OpenRouter API Key not configured"): # Check for specific config error from client
             client_error_detail = "AI Service API Key configuration error. Please contact support."

        raise HTTPException(
            status_code=502, # Bad Gateway, as our service (gateway) had an issue with an upstream service
            detail=client_error_detail
        )
    except Exception as e:
        print(f"{log_prefix} Unexpected error: {type(e).__name__} - {str(e)}")
        # For debugging in dev, you might want to see the stack trace
        # import traceback
        # print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred with the AI Shopping Assistant."
        )
