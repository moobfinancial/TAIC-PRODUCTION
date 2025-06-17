from typing import Optional, List
import uuid # Import the uuid module
from pydantic import BaseModel, EmailStr, Field, validator, root_validator, root_validator
from datetime import datetime
import re # For wallet address regex validation

class UserRegisterSchema(BaseModel):
    """Schema for user registration request payload using email and password."""
    username: str = Field(..., min_length=3, max_length=50, description="User's unique username.")
    email: EmailStr = Field(..., description="User's unique email address.")
    password: str = Field(..., min_length=8, description="User password. Must be at least 8 characters. Will be hashed before storage.")
    full_name: Optional[str] = Field(default=None, max_length=100, description="User's full name (optional).")
    role: str = Field(..., description="User role. Can be 'SHOPPER' or 'MERCHANT'.") # Removed default
    business_name: Optional[str] = Field(default=None, max_length=150, description="Merchant's business name (conditionally required if role is MERCHANT).")
    business_description: Optional[str] = Field(default=None, description="Merchant's business description (optional).")

    @validator('role')
    def role_must_be_valid(cls, value):
        allowed_roles = ['SHOPPER', 'MERCHANT']
        if value.upper() not in allowed_roles:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
        return value.upper() # Store in uppercase for consistency

    @root_validator(skip_on_failure=True)
    def check_business_name_for_merchant(cls, values):
        # This validator runs after individual field validators,
        # so 'role' would have been validated and uppercased by 'role_must_be_valid'.
        role = values.get('role')
        business_name = values.get('business_name')

        if role == 'MERCHANT':
            if not business_name or not business_name.strip():
                raise ValueError('Business name is required and cannot be empty for the MERCHANT role.')
        return values

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "username": "newuser",
                "email": "new_user@example.com",
                "password": "SecurePassword123!",
                "full_name": "John Doe",
                "role": "SHOPPER",
                "business_name": None,
                "business_description": None
            }
        }

class MerchantRegisterSchema(BaseModel): # This might become redundant if UserRegisterSchema handles roles
    """
    Schema for merchant registration.
    Note: This schema might become redundant if UserRegisterSchema adequately handles roles.
    """
    username: str = Field(..., min_length=3, max_length=50, description="Merchant's unique username.")
    email: EmailStr = Field(..., description="Merchant's unique email address.")
    password: str = Field(..., min_length=8, description="Merchant password. Must be at least 8 characters. Will be hashed before storage.")
    business_name: str = Field(..., min_length=1, max_length=150, description="Merchant's business name.")
    # Role will be implicitly 'MERCHANT' if this schema is used.

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "username": "merchantuser",
                "email": "merchant_user@example.com",
                "password": "MerchantSecurePass789!",
                "business_name": "Awesome Goods Inc."
            }
        }

class UserResponse(BaseModel):
    """Schema for representing a user's public information."""
    id: uuid.UUID = Field(..., description="Unique identifier for the user.")
    username: Optional[str] = Field(default=None, description="User's username.")
    email: Optional[EmailStr] = Field(default=None, description="User's email address. Can be null for wallet-first signups.")
    full_name: Optional[str] = Field(default=None, description="User's full name.")
    role: str = Field(..., description="Role assigned to the user (e.g., 'SHOPPER', 'MERCHANT', 'ADMIN').")
    is_active: bool = Field(..., description="Indicates if the user account is currently active.")
    email_verified: bool = Field(..., description="Indicates if the user's email address has been verified.")
    wallet_address: Optional[str] = Field(default=None, description="User's linked wallet address. Can be null.")
    wallet_verified: Optional[bool] = Field(default=None, description="Indicates if the user's wallet address has been verified.")
    created_at: datetime = Field(..., description="Timestamp of when the user account was created.")
    last_login_at: Optional[datetime] = Field(default=None, description="Timestamp of the user's last login.")
    business_name: Optional[str] = Field(default=None, description="Merchant's business name, if applicable.")
    business_description: Optional[str] = Field(default=None, description="Merchant's business description, if applicable.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "user_uuid_12345",
                "username": "jane.doe",
                "email": "user@example.com",
                "full_name": "Jane Doe",
                "role": "SHOPPER",
                "is_active": True,
                "email_verified": False,
                "wallet_address": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
                "wallet_verified": True,
                "created_at": "2023-01-01T12:00:00Z",
                "last_login_at": "2023-01-10T10:00:00Z",
                "business_name": None,
                "business_description": None
            }
        }


class RegistrationResponse(BaseModel): # Kept for placeholder router, might be deprecated by UserResponse
    """Response schema for placeholder registration endpoints. May be deprecated."""
    message: str = Field(..., description="A message indicating the result of the registration attempt.")
    user_email: Optional[EmailStr] = Field(default=None, description="Email of the registered user, if applicable.")
    merchant_email: Optional[EmailStr] = Field(default=None, description="Email of the registered merchant, if applicable.")



class TokenData(BaseModel):
    """Schema for the data encoded within a JWT access token."""
    email: Optional[EmailStr] = Field(default=None, description="User's email address, typically the token subject.")
    sub: Optional[str] = Field(default=None, description="Token subject (often user ID or email).") # Alternative to email, or can coexist
    role: Optional[str] = Field(default=None, description="User's role.")
    scopes: List[str] = Field(default_factory=list, description="List of scopes granted by the token.")
    exp: Optional[int] = Field(default=None, description="Token expiration timestamp (Unix epoch). Pydantic will handle datetime conversion if needed.")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "sub": "user@example.com",
                "role": "SHOPPER",
                "scopes": ["read:profile", "write:orders"],
                "exp": 1678886400
            }
        }


# --- For Login ---
class UserLoginSchema(BaseModel):
    """Schema for user login with email and password."""
    email: EmailStr = Field(..., description="User's registered email address.")
    password: str = Field(..., description="User's password.")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePassword123!"
            }
        }

class WalletLoginSchema(BaseModel):
    """Schema for user login or account linking using a crypto wallet signature."""
    wallet_address: str = Field(..., description="The user's Ethereum wallet address (e.g., 0x...).")
    original_message: str = Field(..., description="The original message that was signed by the user's wallet. Typically includes a timestamp or nonce.")
    signed_message: str = Field(..., description="The EIP-191 compliant signature (hex string) provided by the user's wallet.")

    @validator('wallet_address')
    def wallet_address_must_be_valid_ethereum_address(cls, v):
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            print(f"DEBUG: Invalid wallet_address format: {v}")
            raise ValueError("Invalid Ethereum wallet address format.")
        return v.lower() # Normalize to lowercase

    @validator('signed_message')
    def signature_must_be_valid_hex_string(cls, v):
        if not re.match(r"^0x[a-fA-F0-9]+$", v):
            print(f"DEBUG: Invalid signed_message hex format: {v}")
            raise ValueError("Signature must be a hexadecimal string starting with 0x.")
        if len(v) != 132:
            print(f"DEBUG: Invalid signed_message length ({len(v)}): {v}")
            raise ValueError("Signature must be 132 characters long (including 0x prefix).")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "wallet_address": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
                "original_message": "Link this wallet to your TAIC account: 1678886400000",
                "signed_message": "0x123abc..."
            }
        }

# Alias WalletLoginSchema for LinkWalletSchema as they are functionally identical for request payload.
LinkWalletSchema = WalletLoginSchema


class LinkEmailPasswordSchema(BaseModel):
    """Schema for linking an email and password to an existing (e.g., wallet-first) user account."""
    email: EmailStr = Field(..., description="The email address to link to the account.")
    password: str = Field(..., min_length=8, description="A new password for the account. Must be at least 8 characters.")
    full_name: Optional[str] = Field(default=None, max_length=100, description="User's full name. Can be used to set or update the full name on the account.")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user_from_wallet@example.com",
                "password": "MyNewStrongPassword123!",
                "full_name": "Wallet User With Email"
            }
        }


class TokenResponse(BaseModel):
    """Schema for returning a JWT access token upon successful authentication."""
    access_token: str = Field(..., description="The JWT access token.")
    token_type: str = Field(default="bearer", description="The type of token, typically 'bearer'.")
    user: UserResponse = Field(..., description="User information")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwicm9sZSI6IlNIT1BQRVIiLCJleHAiOjE2NzU4NjAwMDB9.thisIsASampleToken",
                "token_type": "bearer",
                "user": UserResponse.Config.json_schema_extra['example']
            }
        }
