from typing import Optional
from pydantic import BaseModel, Field, PositiveFloat, validator
from datetime import datetime

class MerchantTaxSettingsBase(BaseModel):
    collects_tax: bool = Field(default=False, description="Indicates if the merchant collects sales tax or VAT.")
    default_tax_rate_percentage: Optional[PositiveFloat] = Field(
        default=None,
        description="The default tax rate percentage (e.g., 7.25 for 7.25%). Required if collects_tax is true and no other regional rules apply (for V1, this is the main rate). Max 99.999.",
        ge=0, # Allow 0 as a valid rate
        le=99.999
    )
    tax_registration_id: Optional[str] = Field(default=None, max_length=255, description="Merchant's tax registration ID (e.g., VAT ID, Sales Tax ID).")
    notes: Optional[str] = Field(default=None, description="Internal notes for the merchant regarding their tax setup.")

    @validator('default_tax_rate_percentage', always=True)
    def check_tax_rate_if_collecting_tax(cls, v, values):
        collects_tax = values.get('collects_tax')
        # For V1, if collects_tax is true, a default_tax_rate_percentage could be considered mandatory.
        # However, a merchant might collect tax based on regional lookups (future enhancement) rather than a single default.
        # For now, we'll allow it to be None, but application logic for tax calculation will need to handle this.
        # If it becomes strictly required when collects_tax is true, this validator can be stricter.
        if collects_tax and v is None:
            # raise ValueError("default_tax_rate_percentage is required if collects_tax is true.")
            pass # Allowing None for now, as per current V1 plan (simple stored rate if provided)
        if not collects_tax and v is not None:
            raise ValueError("default_tax_rate_percentage must be null if collects_tax is false.")
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "collects_tax": True,
                "default_tax_rate_percentage": 8.5,
                "tax_registration_id": "VAT123456789",
                "notes": "Collects sales tax in CA region."
            }
        }

class MerchantTaxSettingsUpdate(MerchantTaxSettingsBase):
    """Schema for creating or updating merchant tax settings. All fields are effectively optional for PUT (UPSERT)."""
    pass


class MerchantTaxSettingsResponse(MerchantTaxSettingsBase):
    """Response schema for merchant tax settings, including read-only fields."""
    merchant_id: str = Field(..., description="The merchant's unique identifier.")
    created_at: datetime = Field(..., description="Timestamp of when the tax settings were created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the tax settings.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "merchant_id": "merchant_user_123",
                "collects_tax": True,
                "default_tax_rate_percentage": 7.25,
                "tax_registration_id": "EIN1234567",
                "notes": "Standard sales tax collection.",
                "created_at": "2023-05-01T10:00:00Z",
                "updated_at": "2023-05-15T14:30:00Z"
            }
        }
