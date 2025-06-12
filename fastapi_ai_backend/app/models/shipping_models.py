from typing import Optional, List, Any
from pydantic import BaseModel, Field, constr
from datetime import datetime

# --- MerchantShippingMethod Models ---

class MerchantShippingMethodBase(BaseModel):
    method_name: str = Field(..., min_length=1, max_length=255, description="Name of the shipping method (e.g., 'Standard Ground', 'Express Shipping').")
    is_active: bool = Field(True, description="Whether this shipping method is currently active and available for use.")

class MerchantShippingMethodCreate(MerchantShippingMethodBase):
    pass

class MerchantShippingMethodUpdate(BaseModel):
    method_name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="New name for the shipping method.")
    is_active: Optional[bool] = Field(default=None, description="New active status for the shipping method.")

class MerchantShippingMethodResponse(MerchantShippingMethodBase):
    id: int = Field(..., description="Unique identifier for the shipping method.")
    merchant_id: str = Field(..., description="Identifier of the merchant this shipping method belongs to.")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- ShippingZone Models ---

class ShippingZoneBase(BaseModel):
    zone_name: str = Field(..., min_length=1, max_length=255, description="Name of the shipping zone (e.g., 'Domestic US', 'Europe Zone 1').")

class ShippingZoneCreate(ShippingZoneBase):
    # shipping_method_id will be a path parameter or part of the context
    pass

class ShippingZoneUpdate(BaseModel):
    zone_name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="New name for the shipping zone.")

class ShippingZoneResponse(ShippingZoneBase):
    id: int = Field(..., description="Unique identifier for the shipping zone.")
    shipping_method_id: int = Field(..., description="Identifier of the parent shipping method.")
    created_at: datetime
    updated_at: datetime
    # locations: List['ShippingZoneLocationResponse'] = [] # This will be moved to ShippingZoneDetailResponse

    class Config:
        from_attributes = True

# --- ShippingZoneLocation Models ---

class ShippingZoneLocationBase(BaseModel):
    country_code: constr(min_length=2, max_length=2) = Field(..., description="ISO 3166-1 alpha-2 country code (e.g., 'US', 'CA', 'GB').")
    state_province_code: Optional[str] = Field(default=None, max_length=50, description="Code for state or province, if applicable (e.g., 'CA' for California, 'ON' for Ontario).")
    postal_code_pattern: Optional[str] = Field(default=None, max_length=255, description="Pattern for postal codes to include in this zone location (e.g., '90*', 'SW1A*').")

class ShippingZoneLocationCreate(ShippingZoneLocationBase):
    # shipping_zone_id will be a path parameter or part of the context
    pass

class ShippingZoneLocationUpdate(BaseModel): # Usually, locations are added/deleted rather than updated.
    country_code: Optional[constr(min_length=2, max_length=2)] = Field(default=None, description="New ISO 3166-1 alpha-2 country code.")
    state_province_code: Optional[str] = Field(default=None, max_length=50, description="New code for state or province.")
    postal_code_pattern: Optional[str] = Field(default=None, max_length=255, description="New pattern for postal codes.")

class ShippingZoneLocationResponse(ShippingZoneLocationBase):
    id: int = Field(..., description="Unique identifier for the shipping zone location entry.")
    shipping_zone_id: int = Field(..., description="Identifier of the parent shipping zone.")
    # No created_at/updated_at for this table as per schema design, but can be added if needed.

    class Config:
        from_attributes = True

class ShippingZoneLocationCreateBulk(BaseModel):
    """Schema for bulk creating shipping zone locations."""
    locations: List[ShippingZoneLocationCreate] = Field(..., description="A list of location definitions to add to the zone.")

    class Config:
        json_schema_extra = {
            "example": {
                "locations": [
                    {"country_code": "US", "state_province_code": "CA"},
                    {"country_code": "US", "state_province_code": "NY"},
                    {"country_code": "CA"}
                ]
            }
        }

# --- ShippingRate Models ---

class ShippingRateBase(BaseModel):
    rate_name: Optional[str] = Field(default=None, max_length=255, description="Descriptive name for the rate (e.g., 'Standard Rate', 'Free Shipping over $100').")
    condition_min_order_value: Optional[float] = Field(default=None, ge=0, description="Minimum order value for this rate to apply.")
    condition_max_order_value: Optional[float] = Field(default=None, ge=0, description="Maximum order value for this rate to apply.")
    condition_min_weight_kg: Optional[float] = Field(default=None, ge=0, description="Minimum total weight of cart items (in kg) for this rate to apply.")
    condition_max_weight_kg: Optional[float] = Field(default=None, ge=0, description="Maximum total weight of cart items (in kg) for this rate to apply.")
    base_rate: float = Field(default=0.00, ge=0, description="The base shipping cost for this rate.")
    rate_per_kg: Optional[float] = Field(default=None, ge=0, description="Additional cost per kilogram, if applicable.")
    is_free_shipping: bool = Field(False, description="If true, this rate provides free shipping (base_rate and rate_per_kg might be ignored or zero).")

class ShippingRateCreate(ShippingRateBase):
    # shipping_zone_id will be a path parameter or part of the context
    pass

class ShippingRateUpdate(BaseModel):
    rate_name: Optional[str] = Field(default=None, max_length=255)
    condition_min_order_value: Optional[float] = Field(default=None, ge=0)
    condition_max_order_value: Optional[float] = Field(default=None, ge=0)
    condition_min_weight_kg: Optional[float] = Field(default=None, ge=0)
    condition_max_weight_kg: Optional[float] = Field(default=None, ge=0)
    base_rate: Optional[float] = Field(default=None, ge=0)
    rate_per_kg: Optional[float] = Field(default=None, ge=0)
    is_free_shipping: Optional[bool] = Field(default=None)

class ShippingRateResponse(ShippingRateBase):
    id: int = Field(..., description="Unique identifier for the shipping rate.")
    shipping_zone_id: int = Field(..., description="Identifier of the parent shipping zone.")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# For detailed responses, e.g., getting a ShippingMethod with its zones and rates:
class ShippingZoneDetailResponse(ShippingZoneResponse): # Inherits fields from ShippingZoneResponse (id, name, method_id, timestamps)
    """Detailed response for a shipping zone, including its locations and rates."""
    locations: List[ShippingZoneLocationResponse] = Field(default_factory=list, description="List of locations included in this shipping zone.")
    rates: List[ShippingRateResponse] = Field(default_factory=list, description="List of shipping rates applicable to this zone.")

class MerchantShippingMethodDetailResponse(MerchantShippingMethodResponse):
    shipping_zones: List[ShippingZoneDetailResponse] = []
