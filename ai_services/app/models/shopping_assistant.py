from pydantic import BaseModel
from typing import List, Optional
from .product import ProductModel # Assuming ProductModel is in product.py

class ChatMessageSchema(BaseModel):
    role: str # "user" or "assistant"
    content: str
    model_config = { "extra": "ignore" }


class ShoppingAssistantRequestSchema(BaseModel):
    query: str
    user_id: str # For context, logging, or future personalization
    conversation_history: Optional[List[ChatMessageSchema]] = None
    model_config = { "extra": "ignore" }


class ShoppingAssistantResponseSchema(BaseModel):
    reply: str
    suggested_products: Optional[List[ProductModel]] = None
    # Add other relevant fields for the response later
    model_config = { "extra": "ignore" }
