from typing import Optional, Dict, Any
from pydantic import BaseModel, HttpUrl, Field
from datetime import datetime

class StoreProfileBase(BaseModel):
    """Base schema for a merchant's store profile, containing common editable fields."""
    store_name: str = Field(..., min_length=1, max_length=255, description="The display name of the merchant's store.")
    store_description: Optional[str] = Field(default=None, description="A detailed description of the store, its products, or its mission.")
    banner_url: Optional[HttpUrl] = Field(default=None, description="URL for the store's main banner image.")
    logo_url: Optional[HttpUrl] = Field(default=None, description="URL for the store's logo image.")
    custom_settings: Optional[Dict[str, Any]] = Field(default=None, description="A flexible JSON object for storing custom store settings, e.g., theme preferences, contact methods, social media links.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "store_name": "My Awesome Store",
                "store_description": "The best place to find unique and quality products.",
                "banner_url": "https://example.com/store/banner.jpg",
                "logo_url": "https://example.com/store/logo.png",
                "custom_settings": {"contact_email": "support@myawesomestore.com", "return_policy_days": 30}
            }
        }

class StoreProfileCreate(StoreProfileBase):
    """
    Schema for creating a new store profile.
    The `merchant_id` is typically derived from the authenticated user context.
    The `store_slug` is auto-generated from the `store_name` upon creation.
    """
    pass # Inherits all fields from StoreProfileBase, example is in StoreProfileBase


class StoreProfileUpdate(StoreProfileBase):
    """
    Schema for updating an existing store profile. All fields are optional.
    Only include the fields that need to be changed.
    If `store_name` is updated, the `store_slug` may also be regenerated.
    """
    store_name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="New display name for the store. If changed, the store_slug might be updated too.")
    store_description: Optional[str] = Field(default=None, description="New detailed description for the store. Set to null to clear.")
    banner_url: Optional[HttpUrl] = Field(default=None, description="New URL for the store's banner image. Set to null to remove.")
    logo_url: Optional[HttpUrl] = Field(default=None, description="New URL for the store's logo image. Set to null to remove.")
    custom_settings: Optional[Dict[str, Any]] = Field(default=None, description="New custom settings for the store. Providing this will overwrite all existing custom settings.")


class StoreProfile(StoreProfileBase):
    """Represents a full merchant store profile, including database-generated fields like IDs and timestamps."""
    merchant_id: str = Field(..., description="The unique identifier of the merchant who owns this store profile. Links to the users.id.")
    store_slug: str = Field(..., description="A URL-friendly slug generated from the store_name, used for accessing the store page.")
    created_at: datetime = Field(..., description="Timestamp of when the store profile was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the store profile.")

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
