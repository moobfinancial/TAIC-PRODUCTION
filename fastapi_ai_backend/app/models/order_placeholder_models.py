from typing import List, Optional
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime

class OrderItemPlaceholder(BaseModel):
    product_id: str = Field(..., description="Identifier of the product.")
    variant_id: Optional[int] = Field(default=None, description="Identifier of the specific product variant, if applicable.")
    quantity: int = Field(..., gt=0, description="Quantity of this item ordered.")
    # product_name and price_per_item will now be fetched by the server
    # product_name: str = Field(..., description="Name of the product (or variant description).") # For snapshot
    # price_per_item: Decimal = Field(..., gt=Decimal("0.00"), description="Price per single unit of the item at the time of order.")

    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: lambda v: str(v) # Ensure Decimal is serialized as string
        }
        json_schema_extra = {
            "example": {
                "product_id": "prod_123",
                "variant_id": 101,
                "quantity": 2
                # name and price_per_item are removed from input example
            }
        }


class OrderCreatePlaceholder(BaseModel):
    items: List[OrderItemPlaceholder] = Field(..., min_length=1, description="List of items in the order, specifying product/variant IDs and quantities.")
    # total_amount will now be calculated on the server.
    # total_amount: Decimal = Field(..., gt=Decimal("0.00"), description="Total amount for the order, as calculated by the client (for cross-check by backend).")
    shipping_address_summary: str = Field(..., min_length=10, max_length=500, description="A summary of the shipping address (e.g., '123 Main St, Anytown, CA 90210, USA').")
    currency: str = Field(default="USD", min_length=3, max_length=3, description="3-letter ISO currency code for the order (e.g., USD, EUR).")

    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: lambda v: str(v)
        }
        json_schema_extra = {
            "example": {
                "items": [
                    OrderItemPlaceholder.Config.json_schema_extra["example"],
                    {
                        "product_id": "prod_456",
                        "product_id": "prod_456",
                        "quantity": 1
                    }
                ],
                # "total_amount": "66.00", # Removed, will be calculated by server
                "shipping_address_summary": "456 Oak Ave, Otherville, NY 10001, USA",
                "currency": "USD"
            }
        }


class OrderResponsePlaceholder(BaseModel): # Does not inherit from OrderCreatePlaceholder anymore due to total_amount change
    order_id: int = Field(..., description="Unique identifier (integer) for the created order from the database.")
    shopper_user_id: str = Field(..., description="Identifier of the shopper who placed the order.")
    items: List[OrderItemPlaceholder] = Field(..., description="List of items included in the order, echoing input structure.") # Echoes input items
    total_amount: Decimal = Field(..., description="Total amount for the order, calculated by the server based on current prices.")
    shipping_address_summary: str = Field(..., description="A summary of the shipping address provided.")
    currency: str = Field(..., description="3-letter ISO currency code for the order.")
    order_status: str = Field(..., description="Current status of the order from the database (e.g., 'pending_payment').")
    order_date: datetime = Field(..., description="Timestamp of when the order was created in the database.")

    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: lambda v: str(v), # Keep Decimal serialization for consistency
            datetime: lambda dt: dt.isoformat() # Ensure datetime is ISO formatted string
        }
        json_schema_extra = {
            "example": {
                "order_id": "ord_uuid_placeholder_12345",
                "shopper_user_id": "user_shopper_abcde",
                 "items": [
                    OrderItemPlaceholder.Config.json_schema_extra["example"],
                    {
                        "product_id": "prod_456",
                        "product_name": "Cool Cap",
                        "quantity": 1,
                        "price_per_item": "15.00"
                    }
                ],
                "total_amount": "66.00",
                "shipping_address_summary": "456 Oak Ave, Otherville, NY 10001, USA",
                "currency": "USD",
                "order_status": "Confirmed",
                "order_date": "2023-10-29T10:30:00Z"
            }
        }
