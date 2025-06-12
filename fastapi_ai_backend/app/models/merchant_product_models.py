from typing import Optional, List
from pydantic import BaseModel, Field, HttpUrl, PositiveFloat
from decimal import Decimal # Although PositiveFloat handles validation, Decimal might be used for internal logic if needed.

class MerchantProductUpdateSchema(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=255, description="The name of the product.")
    description: Optional[str] = Field(default=None, description="Detailed description of the product.")
    price: Optional[PositiveFloat] = Field(default=None, description="The selling price of the product. Must be a positive value.")
    base_price: Optional[PositiveFloat] = Field(default=None, description="Merchant's cost price or a base price before markups. Must be a positive value if provided.")
    image_url: Optional[HttpUrl] = Field(default=None, description="Primary image URL for the product.")
    additional_image_urls: Optional[List[HttpUrl]] = Field(default=None, max_items=10, description="A list of additional image URLs (up to 10).") # Max items is an example
    platform_category_id: Optional[int] = Field(default=None, description="The ID of the platform category this product belongs to.")
    is_active: Optional[bool] = Field(default=None, description="Merchant's desired active status for the product. If an approved product is made inactive, it's unlisted. If made active, it's listed (if already approved). Setting an unapproved product to active will not make it live until approved.")
    cashback_percentage: Optional[PositiveFloat] = Field(
        default=None,
        ge=0.0,
        le=99.99, # Max 99.99%
        description="Cashback percentage for the product (e.g., 5.0 for 5%). Set to 0 to explicitly remove cashback. Null means no change."
    )
    # Add other fields that merchants can update directly on the 'products' table:
    # e.g., data_ai_hint: Optional[str] = Field(default=None, description="Hints for AI processing or product discovery.")
    # Note: 'has_variants' is usually managed by adding/removing variants.
    # 'source' and 'original_cj_product_id' are typically system-set.
    # 'approval_status', 'admin_review_notes' are admin-controlled.

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "name": "Updated Premium T-Shirt",
                "description": "Now with even more comfort and style!",
                "price": 26.99,
                "is_active": True,
                "cashback_percentage": 2.5
            }
        }
