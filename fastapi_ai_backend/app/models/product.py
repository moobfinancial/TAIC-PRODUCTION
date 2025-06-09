from typing import Optional, List, Dict, Any
from pydantic import BaseModel, HttpUrl

class Product(BaseModel):
    id: str # This will remain the cj_product_id
    page_id: str # This will be the simple ID for Next.js page routes
    name: str
    description: str
    price: float
    imageUrl: HttpUrl
    category: str
    merchantId: str
    stockQuantity: Optional[int] = None
    attributes: Optional[Dict[str, Any]] = None
    dataAiHint: Optional[str] = None

    class Config:
        from_attributes = True

class ListProductsToolInput(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    # Add other potential filter fields here later if needed, e.g.:
    # min_price: Optional[float] = None
    # max_price: Optional[float] = None
    # merchant_id: Optional[str] = None
