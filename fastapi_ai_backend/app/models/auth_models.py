from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
import re # For wallet address regex validation

class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="User password. Will be hashed before storage.")
    full_name: Optional[str] = Field(default=None, max_length=100)
    role: str = Field(default='SHOPPER', description="User role, either 'SHOPPER' or 'MERCHANT'.")

    @validator('role')
    def role_must_be_valid(cls, value):
        allowed_roles = ['SHOPPER', 'MERCHANT']
        if value.upper() not in allowed_roles:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
        return value.upper() # Store in uppercase for consistency

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "email": "new_user@example.com",
                "password": "SecurePassword123!",
                "full_name": "John Doe",
                "role": "SHOPPER"
            }
        }

class MerchantRegisterSchema(BaseModel): # This might become redundant if UserRegisterSchema handles roles
    email: EmailStr
    password: str = Field(..., min_length=8, description="Merchant password. Will be hashed before storage.")
    business_name: str = Field(..., min_length=1, max_length=150)
    # Role will be implicitly 'MERCHANT' if this schema is used.

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "email": "merchant_user@example.com",
                "password": "MerchantSecurePass789!",
                "business_name": "Awesome Goods Inc."
            }
        }

class UserResponse(BaseModel):
    id: str
    email: Optional[EmailStr] = None # Email can be None for wallet-only users
    full_name: Optional[str] = None
    role: str
    is_active: bool
    email_verified: bool
    wallet_address: Optional[str] = None # Added wallet_address
    wallet_verified: Optional[bool] = None # Added wallet_verified
    created_at: datetime
    last_login_at: Optional[datetime] = None # Added last_login_at

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "user_uuid_12345",
                "email": "user@example.com",
                "full_name": "Jane Doe",
                "role": "SHOPPER",
                "is_active": True,
                "email_verified": False,
                "wallet_address": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
                "wallet_verified": True,
                "created_at": "2023-01-01T12:00:00Z",
                "last_login_at": "2023-01-10T10:00:00Z"
            }
        }


class RegistrationResponse(BaseModel): # Kept for placeholder router, might be deprecated by UserResponse
    message: str
    user_email: Optional[EmailStr] = None
    merchant_email: Optional[EmailStr] = None


# --- For Login ---
class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePassword123!"
            }
        }

class WalletLoginSchema(BaseModel):
    wallet_address: str = Field(..., description="The user's wallet address.")
    original_message: str = Field(..., description="The original message that was signed by the user's wallet.")
    signed_message: str = Field(..., description="The signature provided by the user's wallet.")

    @validator('wallet_address')
    def wallet_address_must_be_valid_ethereum_address(cls, v):
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum wallet address format.")
        return v

    @validator('signed_message')
    def signature_must_be_valid_hex_string(cls, v):
        if not re.match(r"^0x[a-fA-F0-9]+$", v):
            raise ValueError("Signature must be a hexadecimal string starting with 0x.")
        if len(v) != 132:
             pass
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "wallet_address": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
                "original_message": "Link this wallet to your TAIC account: 1678886400000",
                "signed_message": "0x123abc..."
            }
        }

# Alias WalletLoginSchema for LinkWalletSchema if they are identical
LinkWalletSchema = WalletLoginSchema


class LinkEmailPasswordSchema(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="New password for the account.")
    full_name: Optional[str] = Field(default=None, max_length=100, description="Full name, can update if not already set or if provided.")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user_from_wallet@example.com",
                "password": "MyNewStrongPassword123!",
                "full_name": "Wallet User With Email"
            }
        }


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwicm9sZSI6IlNIT1BQRVIiLCJleHAiOjE2NzU4NjAwMDB9.thisIsASampleToken",
                "token_type": "bearer"
            }
        }
