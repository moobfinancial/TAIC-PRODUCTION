from .product import ProductModel
from .shopping_assistant import ChatMessageSchema, ShoppingAssistantRequestSchema, ShoppingAssistantResponseSchema

# This makes `from app.models import ...` possible for all listed models
__all__ = [
    "ProductModel",
    "ChatMessageSchema",
    "ShoppingAssistantRequestSchema",
    "ShoppingAssistantResponseSchema",
]
