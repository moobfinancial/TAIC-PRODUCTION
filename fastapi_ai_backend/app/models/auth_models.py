from pydantic import BaseModel, EmailStr, Field

class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="User password, should be hashed in a real scenario.")
    full_name: str = Field(..., min_length=1, max_length=100)

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "email": "shopper@example.com",
                "password": "SecurePassword123!",
                "full_name": "Test Shopper"
            }
        }

class MerchantRegisterSchema(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Merchant password, should be hashed in a real scenario.")
    business_name: str = Field(..., min_length=1, max_length=150)

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "email": "merchant@example.com",
                "password": "MerchantSecurePass789!",
                "business_name": "Awesome Goods Inc."
            }
        }

class RegistrationResponse(BaseModel):
    message: str
    user_email: Optional[EmailStr] = None
    merchant_email: Optional[EmailStr] = None
