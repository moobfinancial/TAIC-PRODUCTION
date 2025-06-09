from typing import Optional, List
from pydantic import BaseModel
from .product import Product # Assuming Product model is in product.py in the same directory

class UserQueryInput(BaseModel):
    query: str
    user_id: Optional[str] = None # Optional: for personalization later
    session_id: Optional[str] = None # Optional: for conversation history later

class ShoppingAssistantResponse(BaseModel):
    natural_language_response: str
    suggested_products: Optional[List[Product]] = None
    debug_info: Optional[dict] = None # For any intermediate steps or errors
