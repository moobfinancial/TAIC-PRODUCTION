from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, PositiveInt, PositiveFloat, constr
from decimal import Decimal
from datetime import datetime

class CartItemInput(BaseModel):
    product_id: str = Field(..., description="Identifier of the product.")
    variant_id: Optional[int] = Field(default=None, description="Identifier of the specific product variant, if applicable.")
    quantity: PositiveInt = Field(..., description="Quantity of this item in the cart.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "product_id": "prod_123",
                "variant_id": 101,
                "quantity": 2
            }
        }

class ShippingAddressInput(BaseModel):
    country_code: constr(min_length=2, max_length=2) = Field(..., description="ISO 3166-1 alpha-2 country code (e.g., 'US', 'CA').")
    state_province_code: Optional[str] = Field(default=None, max_length=50, description="State or province code, if applicable (e.g., 'CA' for California, 'ON' for Ontario).")
    postal_code: Optional[str] = Field(default=None, max_length=20, description="Postal or ZIP code, if applicable.")

    @validator('country_code')
    def country_code_to_uppercase(cls, v):
        return v.upper()

    @validator('state_province_code')
    def state_province_code_to_uppercase(cls, v):
        if v is not None:
            return v.upper()
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "country_code": "US",
                "state_province_code": "CA",
                "postal_code": "90210"
            }
        }

class CheckoutCalculationRequest(BaseModel):
    items: List[CartItemInput] = Field(..., min_length=1, description="List of items in the cart for checkout.")
    shipping_address: ShippingAddressInput = Field(..., description="The shipping address for calculating shipping costs and taxes.")
    # coupon_code: Optional[str] = None # Future enhancement

    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {"product_id": "prod_123", "variant_id": 101, "quantity": 1},
                    {"product_id": "prod_456", "quantity": 2}
                ],
                "shipping_address": ShippingAddressInput.Config.json_schema_extra["example"]
            }
        }

class CalculatedShippingOption(BaseModel):
    shipping_method_id: int = Field(..., description="Identifier of the merchant's shipping method.")
    method_name: str = Field(..., description="Name of the shipping method (e.g., 'Standard Ground').")
    zone_name: str = Field(..., description="Name of the shipping zone this rate applies to.")
    rate_name: Optional[str] = Field(default=None, description="Specific name for this rate (e.g., 'Standard Weight', 'Free Shipping Promo').")
    cost: Decimal = Field(..., description="Calculated shipping cost for this option.")
    estimated_delivery_min_days: Optional[int] = Field(default=None, ge=0, description="Estimated minimum delivery time in days.")
    estimated_delivery_max_days: Optional[int] = Field(default=None, ge=0, description="Estimated maximum delivery time in days.")
    is_free_shipping: bool = Field(False, description="Indicates if this option results in free shipping.")

    class Config:
        from_attributes = True
        json_encoders = {Decimal: str}


class MerchantItemDetail(BaseModel): # For internal calculation use
    product_id: str = Field(..., description="Product ID.")
    variant_id: Optional[int] = Field(default=None, description="Variant ID, if applicable.")
    quantity: int = Field(..., description="Quantity of this item.")
    name: str = Field(..., description="Name of the product or variant.")
    price: Decimal = Field(..., description="Authoritative price per item from the database.")
    weight_kg: Optional[Decimal] = Field(default=Decimal("0.100"), description="Weight of a single unit of this item in kilograms. Defaults to 0.1kg if not specified in DB.") # Default weight if not found
    merchant_id: str = Field(..., description="Identifier of the merchant selling this item.")
    source: Optional[str] = Field(default=None, description="Source of the product (e.g., 'CJ', 'MERCHANT').")


    class Config:
        from_attributes = True
        json_encoders = {Decimal: str}


class MerchantSubtotal(BaseModel):
    merchant_id: str = Field(..., description="Identifier of the merchant.")
    # store_name: Optional[str] = None # Could be added if fetched
    items_subtotal: Decimal = Field(..., description="Subtotal for all items from this merchant before shipping and tax.")
    available_shipping_options: List[CalculatedShippingOption] = Field(default_factory=list, description="List of available shipping options for items from this merchant to the given address.")
    selected_shipping_cost: Optional[Decimal] = Field(default=None, description="Cost of the selected shipping option (null if none selected/available yet). For V1, this might not be set by calculation endpoint.")
    tax_amount: Decimal = Field(..., description="Calculated tax amount for items from this merchant (based on items_subtotal and potentially selected_shipping_cost).")
    total_for_merchant: Decimal = Field(..., description="Total amount for this merchant (items_subtotal + selected_shipping_cost + tax_amount).")

    class Config:
        from_attributes = True
        json_encoders = {Decimal: str}


class CheckoutCalculationResponse(BaseModel):
    merchant_breakdown: List[MerchantSubtotal] = Field(..., description="Breakdown of costs per merchant involved in the order.")
    grand_total: Decimal = Field(..., description="The grand total for the entire order across all merchants.")
    currency: str = Field(default="USD", description="Currency code for all monetary values.")
    # applied_coupon_info: Optional[Any] = None # Future enhancement

    class Config:
        from_attributes = True
        json_encoders = {Decimal: str}
        json_schema_extra = {
            "example": {
                "merchant_breakdown": [
                    {
                        "merchant_id": "merchant_xyz",
                        "items_subtotal": "55.99",
                        "available_shipping_options": [
                            {
                                "shipping_method_id": 1, "method_name": "Standard", "zone_name": "Domestic",
                                "rate_name": "Standard Rate", "cost": "5.00", "is_free_shipping": False
                            }
                        ],
                        "selected_shipping_cost": "5.00", # Example if pre-selected or only one
                        "tax_amount": "4.35",
                        "total_for_merchant": "65.34"
                    }
                ],
                "grand_total": "65.34",
                "currency": "USD"
            }
        }
