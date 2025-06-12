from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, validator

# Note: The main Product model is defined in app.models.product.Product

class CJProductDetailRequest(BaseModel):
    cj_product_id: str = Field(..., description="The unique identifier for the CJ Dropshipping product.")

    class Config:
        json_schema_extra = {
            "example": {
                "cj_product_id": "CJ123456789"
            }
        }

# --- Models for Product Stock Tool ---
class CJProductStockRequest(BaseModel):
    cj_product_id: str = Field(..., description="The unique identifier for the CJ Dropshipping product.")
    sku: Optional[str] = Field(default=None, description="Specific SKU to check stock for. If None, overall/variant stock is returned.")

    class Config:
        json_schema_extra = {
            "example_overall": {
                "cj_product_id": "CJ123456789"
            },
            "example_specific_sku": {
                "cj_product_id": "CJ123456789",
                "sku": "CJ123456789-Red-S"
            }
        }

class VariantStockInfo(BaseModel): # Helper model for CJProductStockStatus
    sku: str
    stock_level: int

class CJProductStockStatus(BaseModel):
    cj_product_id: str = Field(description="The CJ Product ID for which stock was checked.")
    requested_sku: Optional[str] = Field(default=None, description="The specific SKU that was requested, if any.")
    overall_stock_level: Optional[int] = Field(default=None, description="Total stock for the product across all variants if applicable and no specific SKU was requested.")
    variant_stock: Optional[List[VariantStockInfo]] = Field(default=None, description="List of stock levels for each variant, if no specific SKU was requested and product has variants.")
    specific_sku_stock_level: Optional[int] = Field(default=None, description="Stock level for the `requested_sku`, if an SKU was provided in the request.")
    status_text: str = Field(description="A human-readable summary of the stock status (e.g., 'In Stock', 'Out of Stock', 'SKU Not Found').")

    class Config:
        from_attributes = True
        json_schema_extra = { # Shortened for brevity, examples are illustrative
            "example_in_stock_specific_sku": {
                "cj_product_id": "CJ123456789", "requested_sku": "CJ123456789-Red-S",
                "specific_sku_stock_level": 150, "status_text": "In Stock"
            }
        }

# --- Models for Product Shipping Tool ---
class CJProductShippingRequest(BaseModel):
    cj_product_id: str = Field(..., description="The unique identifier for the CJ Dropshipping product.")
    destination_country: str = Field(..., min_length=2, max_length=2, description="ISO 3166-1 alpha-2 destination country code (e.g., 'US', 'CA', 'GB').")
    sku: Optional[str] = Field(default=None, description="Specific SKU for variant-specific shipping, if applicable and supported.")

    @validator('destination_country')
    def country_code_to_uppercase(cls, v):
        return v.upper()

    class Config:
        json_schema_extra = {
            "example": {
                "cj_product_id": "CJ123456789",
                "destination_country": "US",
                "sku": "CJ123456789-Red-S"
            }
        }

class CJProductShippingInfo(BaseModel):
    cj_product_id: str = Field(description="The CJ Product ID for which shipping was checked.")
    requested_sku: Optional[str] = Field(default=None, description="The specific SKU that was requested, if any.")
    destination_country: str = Field(description="The destination country for which shipping was estimated.")

    shipping_method_name: Optional[str] = Field(default=None, description="Name of the shipping method, if available.")
    estimated_delivery_min_days: Optional[int] = Field(default=None, ge=0, description="Estimated minimum delivery time in days.")
    estimated_delivery_max_days: Optional[int] = Field(default=None, ge=0, description="Estimated maximum delivery time in days.")
    shipping_cost: Optional[float] = Field(default=None, ge=0, description="Estimated shipping cost.")
    currency: Optional[str] = Field(default=None, description="Currency of the shipping cost (e.g., USD).")

    message: str = Field(description="A summary message about the shipping information, e.g., 'Estimated shipping details', 'Shipping info not available', 'Real-time API call needed'.")

    @validator('estimated_delivery_max_days')
    def max_days_must_be_gte_min_days(cls, v, values):
        min_days = values.get('estimated_delivery_min_days')
        if v is not None and min_days is not None and v < min_days:
            raise ValueError('estimated_delivery_max_days must be greater than or equal to estimated_delivery_min_days')
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example_found": {
                "cj_product_id": "CJ123456789",
                "requested_sku": "CJ123456789-Red-S",
                "destination_country": "US",
                "shipping_method_name": "CJPacket Ordinary",
                "estimated_delivery_min_days": 8,
                "estimated_delivery_max_days": 15,
                "shipping_cost": 5.99,
                "currency": "USD",
                "message": "Estimated shipping details based on stored data."
            },
            "example_not_found": {
                "cj_product_id": "CJXYZUNKNOWN",
                "destination_country": "DE",
                "message": "Specific shipping information not found in stored data. Real-time API call to CJ Dropshipping would be needed for precise details."
            }
        }
