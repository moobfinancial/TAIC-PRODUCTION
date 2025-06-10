from typing import Optional, Dict, Any
from pydantic import BaseModel, HttpUrl, Field
from datetime import datetime

class StoreProfileBase(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=255)
    store_description: Optional[str] = None
    banner_url: Optional[HttpUrl] = None
    logo_url: Optional[HttpUrl] = None
    custom_settings: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class StoreProfileCreate(StoreProfileBase):
    # store_slug will be generated automatically, merchant_id comes from auth
    pass

class StoreProfileUpdate(StoreProfileBase):
    store_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    # All other fields from StoreProfileBase are already optional or can be made optional here explicitly if needed,
    # but Pydantic's `model_dump(exclude_unset=True)` in the router will handle partial updates.
    # For clarity, we can make them all Optional here:
    store_description: Optional[str] = None
    banner_url: Optional[HttpUrl] = None
    logo_url: Optional[HttpUrl] = None
    custom_settings: Optional[Dict[str, Any]] = None


class StoreProfile(StoreProfileBase):
    merchant_id: str
    store_slug: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "merchant_id": "user_merchant_12345",
                "store_slug": "awesome-goods-inc",
                "store_name": "Awesome Goods Inc.",
                "store_description": "Your one-stop shop for awesome goods!",
                "banner_url": "https://example.com/banners/awesome-banner.jpg",
                "logo_url": "https://example.com/logos/awesome-logo.png",
                "custom_settings": {"theme_color": "#FF5733", "show_featured": True},
                "created_at": "2023-01-01T10:00:00Z",
                "updated_at": "2023-01-10T12:30:00Z"
            }
        }
