from typing import Optional, List, Dict
from pydantic import BaseModel, Field, HttpUrl

class SearchResultItem(BaseModel):
    type: str = Field(..., description="Type of the search result item (e.g., 'product', 'merchant_store', 'category').")
    id: str = Field(..., description="Unique identifier of the item found.")
    name: str = Field(..., description="Display name of the item.")
    description: Optional[str] = Field(default=None, description="A short description or snippet related to the item.")
    url: Optional[str] = Field(default=None, description="A relative URL or path to view the item on the frontend.")
    image_url: Optional[HttpUrl] = Field(default=None, description="URL of a representative image for the item, if available.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example_product": {
                "type": "product",
                "id": "prod_123xyz",
                "name": "Organic Cotton T-Shirt",
                "description": "Comfortable and eco-friendly t-shirt made from 100% organic cotton.",
                "url": "/products/prod_123xyz",
                "image_url": "https://example.com/images/tshirt.jpg"
            },
            "example_store": {
                "type": "merchant_store",
                "id": "merchant_abc",
                "name": "Green Living Goods",
                "description": "Your one-stop shop for sustainable and eco-friendly products.",
                "url": "/store/green-living-goods",
                "image_url": "https://example.com/logos/green-living.png"
            }
        }

class GlobalSearchResponse(BaseModel):
    query: str = Field(..., description="The search query string that was processed.")
    results: List[SearchResultItem] = Field(..., description="A list of search result items found, aggregated across different types.")
    counts: Dict[str, int] = Field(..., description="A dictionary containing the count of results found for each type (e.g., {'products': 5, 'merchant_stores': 2}).")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "organic cotton",
                "results": [
                    SearchResultItem.Config.json_schema_extra["example_product"]
                ],
                "counts": {"products": 1, "merchant_stores": 0, "categories": 0}
            }
        }
