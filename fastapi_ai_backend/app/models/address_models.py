from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime

# Allowed values for package_drop_off_location
PACKAGE_DROP_OFF_LOCATIONS = Literal["front_door", "outside_garage", "no_preference"]

class SpecialDeliveryInstructionsSchema(BaseModel):
    package_drop_off_location: Optional[PACKAGE_DROP_OFF_LOCATIONS] = Field(default=None, description="Preferred location for package drop-off.")
    security_access_required: Optional[bool] = Field(default=None, description="Is security access (e.g., gate code, buzzer) required for delivery?")
    security_details: Optional[str] = Field(default=None, max_length=500, description="Details for security access (e.g., gate code, concierge instructions).")
    closed_on_weekends: Optional[bool] = Field(default=None, description="Is the delivery location typically closed on weekends?")
    has_dog: Optional[bool] = Field(default=None, description="Is there a dog at the delivery location that the courier should be aware of?")
    additional_notes: Optional[str] = Field(default=None, max_length=1000, description="Any other special delivery instructions or notes for the courier.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "package_drop_off_location": "front_door",
                "security_access_required": True,
                "security_details": "Gate code #1234, then call John Doe.",
                "closed_on_weekends": False,
                "has_dog": True,
                "additional_notes": "Please leave packages behind the large potted plant if I'm not home."
            }
        }


class UserAddressBase(BaseModel):
    address_nickname: Optional[str] = Field(default=None, max_length=255, description="A nickname for the address (e.g., 'Home', 'Work', 'Mom's House').")
    contact_name: str = Field(..., min_length=1, max_length=255, description="Full name of the recipient at this address.")
    full_address_str: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="The complete address as a single string, including street, city, state/province, postal code, and country. E.g., '123 Main St, Anytown, CA 90210, USA'."
    )
    property_type: Optional[str] = Field(default=None, max_length=100, description="Type of property (e.g., 'House', 'Apartment', 'Office', 'Warehouse').")
    # Renamed from special_instructions to special_delivery_instructions to match schema.sql
    special_delivery_instructions: Optional[SpecialDeliveryInstructionsSchema] = Field(default=None, description="Structured special delivery instructions for this address.")

    class Config:
        from_attributes = True


class UserAddressCreate(UserAddressBase):
    """Schema for creating a new user address. is_default can be set during creation."""
    is_default: Optional[bool] = Field(default=False, description="Set to true if this should be the user's default address. If set, other addresses will be made non-default.")

    class Config:
        json_schema_extra = {
            "example": {
                "address_nickname": "Home Office",
                "contact_name": "Dr. Jane Innovations",
                "full_address_str": "456 Innovation Drive, Suite 200, Tech City, TC 54321, USA",
                "property_type": "Office",
                "is_default": True,
                "special_delivery_instructions": SpecialDeliveryInstructionsSchema.Config.json_schema_extra["example"]
            }
        }

class UserAddressUpdate(BaseModel):
    """Schema for updating an existing user address. All fields are optional."""
    address_nickname: Optional[str] = Field(default=None, max_length=255, description="New nickname for the address.")
    contact_name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="New contact name for the recipient.")
    full_address_str: Optional[str] = Field(default=None, min_length=10, max_length=1000, description="New full address string.")
    property_type: Optional[str] = Field(default=None, max_length=100, description="New property type.")
    special_delivery_instructions: Optional[SpecialDeliveryInstructionsSchema] = Field(default=None, description="New or updated special delivery instructions. Provide full object to update, or null to clear.")
    is_default: Optional[bool] = Field(default=None, description="Set to true to make this the default address. If set, other addresses will be made non-default by the API logic.")

    class Config:
        json_schema_extra = {
            "example": {
                "address_nickname": "Main Residence",
                "is_default": True
            }
        }


class UserAddressResponse(UserAddressBase):
    """Response schema for a user address, including database-generated fields."""
    id: int = Field(..., description="Unique identifier for the address.")
    user_id: str = Field(..., description="Identifier of the user this address belongs to.")
    is_default: bool = Field(..., description="Indicates if this is the user's default address.")
    created_at: datetime = Field(..., description="Timestamp of when the address was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the address.")
    # special_delivery_instructions is inherited from UserAddressBase

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None,
        }
        json_schema_extra = {
            "example": {
                "id": 1,
                "user_id": "user_abc_123",
                "address_nickname": "Home",
                "contact_name": "John Doe",
                "full_address_str": "123 Main Street, Anytown, USA, 12345",
                "property_type": "House",
                "is_default": True,
                "special_delivery_instructions": SpecialDeliveryInstructionsSchema.Config.json_schema_extra["example"],
                "created_at": "2023-01-01T10:00:00Z",
                "updated_at": "2023-01-05T14:30:00Z"
            }
        }
