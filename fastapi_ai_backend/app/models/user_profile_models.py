from typing import Optional, List, Dict, Any # Added List, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

# Forward reference for StoreProfile, will be imported properly in router
# For Pydantic v2, string annotations for forward references are often preferred.
# from .store_profile_models import StoreProfile # This would cause circular import if StoreProfile also imports from here.
# Using string annotation: 'StoreProfile'

class UserProfileResponse(BaseModel):
    id: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: str
    wallet_address: Optional[str] = None
    email_verified: bool
    wallet_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "user_uuid_12345",
                "email": "user@example.com",
                "full_name": "Jane Doe",
                "role": "SHOPPER",
                "wallet_address": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
                "email_verified": True,
                "wallet_verified": True,
                "created_at": "2023-01-01T12:00:00Z",
                "updated_at": "2023-01-10T10:30:00Z",
                "last_login_at": "2023-01-10T10:00:00Z"
            }
        }

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="User's full name. Provide to update.")

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Jane Smith-Doe"
            }
        }

# --- Models for User Data Export ---

class UserOrderData(BaseModel):
    id: int # Assuming order.id is int based on schema.sql
    amount: float # Pydantic will convert Decimal from DB if needed
    currency: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserStoreReviewData(BaseModel):
    id: int
    merchant_id: str
    rating: int
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserExportData(BaseModel):
    profile: UserProfileResponse
    orders: List[UserOrderData] = Field(default_factory=list)
    store_reviews_written: List[UserStoreReviewData] = Field(default_factory=list)
    merchant_profile: Optional['app.models.store_profile_models.StoreProfile'] = None
    merchant_products_listed_count: Optional[int] = None
    export_generated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "profile": UserProfileResponse.Config.json_schema_extra["example"],
                "orders": [{"id": 1, "amount": 100.50, "currency": "USD", "status": "completed", "created_at": "2023-02-15T14:30:00Z"}],
                "store_reviews_written": [{"id":1, "merchant_id": "merchant_abc", "rating": 4, "review_title": "Good store", "created_at": "2023-03-01T18:00:00Z"}],
                "merchant_profile": None,
                "merchant_products_listed_count": None,
                "export_generated_at": "2023-10-27T10:00:00Z"
            }
        }

# --- Model for Account Deletion Response ---
class AccountDeletionResponse(BaseModel):
    message: str
    status: str # e.g., "account_marked_for_deletion", "anonymization_initiated"

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Your account deletion process has been initiated.",
                "status": "deletion_initiated"
            }
        }
