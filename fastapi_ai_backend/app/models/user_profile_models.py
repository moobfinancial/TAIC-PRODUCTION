from typing import Optional, List, Dict, Any # Added List, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

# Forward reference for StoreProfile, will be imported properly in router
# For Pydantic v2, string annotations for forward references are often preferred.
# from .store_profile_models import StoreProfile # This would cause circular import if StoreProfile also imports from here.
# Using string annotation: 'StoreProfile'

class UserProfileResponse(BaseModel):
    """Detailed information about a user's profile."""
    id: str = Field(..., description="Unique identifier for the user.")
    email: Optional[EmailStr] = Field(default=None, description="User's email address. Can be null if not provided or for wallet-first users.")
    full_name: Optional[str] = Field(default=None, description="User's full name.")
    role: str = Field(..., description="Role of the user (e.g., 'SHOPPER', 'MERCHANT', 'ADMIN').")
    wallet_address: Optional[str] = Field(default=None, description="User's linked Ethereum wallet address. Can be null.")
    email_verified: bool = Field(..., description="Indicates if the user's email address has been verified.")
    wallet_verified: bool = Field(..., description="Indicates if the user's wallet address has been verified (e.g., via signature).")
    created_at: datetime = Field(..., description="Timestamp of when the user account was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the user's profile.")
    last_login_at: Optional[datetime] = Field(default=None, description="Timestamp of the user's last login.")

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
    """Schema for updating a user's profile information. Only fields to be updated should be included."""
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="User's full name. Provide to update.")
    email: Optional[EmailStr] = Field(default=None, description="User's email address. Provide to update. If changed, email_verified will be set to False.")
    password: Optional[str] = Field(default=None, min_length=8, description="New password for the user. Provide to update. Will be hashed before saving.")

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Jane Smith-Doe",
                "email": "jane.new@example.com",
                "password": "newSecurePassword123"
            }
        }

# --- Models for User Data Export ---

class UserOrderData(BaseModel):
    """Represents key information about a single order placed by the user."""
    id: int = Field(..., description="Unique identifier for the order.") # Assuming order.id is int based on schema.sql
    amount: float = Field(..., description="Total amount of the order.") # Pydantic will convert Decimal from DB if needed
    currency: str = Field(..., description="Currency code for the order amount (e.g., 'USD').")
    status: str = Field(..., description="Current status of the order (e.g., 'completed', 'pending').")
    created_at: datetime = Field(..., description="Timestamp of when the order was created.")

    class Config:
        from_attributes = True

class UserStoreReviewData(BaseModel):
    """Represents key information about a store review written by the user."""
    id: int = Field(..., description="Unique identifier for the review.")
    merchant_id: str = Field(..., description="Identifier of the merchant whose store was reviewed.")
    rating: int = Field(..., ge=1, le=5, description="Rating given by the user (typically 1-5 stars).")
    review_title: Optional[str] = Field(default=None, description="Optional title of the review.")
    review_text: Optional[str] = Field(default=None, description="Optional detailed text of the review.")
    created_at: datetime = Field(..., description="Timestamp of when the review was created.")

    class Config:
        from_attributes = True

class UserExportData(BaseModel):
    """Comprehensive data structure for exporting user-related information."""
    profile: UserProfileResponse = Field(..., description="The user's core profile information.")
    orders: List[UserOrderData] = Field(default_factory=list, description="A list of orders placed by the user.")
    store_reviews_written: List[UserStoreReviewData] = Field(default_factory=list, description="A list of store reviews written by the user.")
    merchant_profile: Optional['app.models.store_profile_models.StoreProfile'] = Field(default=None, description="Merchant's store profile, if the user is a merchant.")
    merchant_products_listed_count: Optional[int] = Field(default=None, description="Number of products listed by the merchant, if applicable.")
    export_generated_at: datetime = Field(..., description="Timestamp of when this data export was generated.")

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

# --- Models for Wallet Linking ---

class WalletChallengeResponse(BaseModel):
    """Response containing a nonce for wallet signature challenge."""
    nonce: str = Field(..., description="A unique, single-use nonce to be signed by the user's wallet.")

    class Config:
        json_schema_extra = {
            "example": {
                "nonce": "a1b2c3d4e5f67890"
            }
        }

class LinkWalletRequest(BaseModel):
    """Request to link a new wallet address to the user's account."""
    wallet_address: str = Field(..., description="The new wallet address to link.")
    signature: str = Field(..., description="The signature from the wallet, proving ownership of the wallet_address by signing the nonce.")
    nonce: str = Field(..., description="The nonce that was signed by the wallet.")

    class Config:
        json_schema_extra = {
            "example": {
                "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
                "signature": "0xS1gn4tur3H4shVa1u3",
                "nonce": "a1b2c3d4e5f67890"
            }
        }

# --- Model for Account Deletion Response ---
class AccountDeletionResponse(BaseModel):
    """Response schema after initiating an account deletion request."""
    message: str = Field(..., description="A human-readable message confirming the action taken.")
    status: str = Field(..., description="A status code indicating the result (e.g., 'account_marked_for_deletion', 'anonymization_initiated').")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Your account deletion process has been initiated.",
                "status": "deletion_initiated"
            }
        }
