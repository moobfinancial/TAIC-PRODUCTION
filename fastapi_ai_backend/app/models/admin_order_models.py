from typing import Optional, List, Dict, Any # Added Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime

class OrderAdminItemDetail(BaseModel):
    id: int = Field(..., description="Unique identifier for this order item entry.")
    product_id: str = Field(..., description="Identifier of the product (from products table).")
    variant_id: Optional[int] = Field(default=None, description="Identifier of the product variant (from product_variants table), if applicable.")
    quantity: int = Field(..., gt=0, description="Quantity of this item ordered.")
    price_per_item: Decimal = Field(..., description="Price of a single unit of this item at the time of order.")
    product_name_snapshot: str = Field(..., description="Snapshot of the product name at the time of order.")
    variant_attributes_snapshot: Optional[Dict[str, Any]] = Field(default=None, description="Snapshot of variant attributes (e.g., {'color': 'Red', 'size': 'L'}) at the time of order.")

    class Config:
        from_attributes = True
        json_encoders = {Decimal: str}
        json_schema_extra = {
            "example": {
                "id": 1001,
                "product_id": "prod_abc",
                "variant_id": 10,
                "quantity": 1,
                "price_per_item": "49.99",
                "product_name_snapshot": "Deluxe Widget - Red, Large",
                "variant_attributes_snapshot": {"color": "Red", "size": "Large"}
            }
        }

class OrderAdminDetailResponse(BaseModel):
    order_id: int = Field(..., description="Unique identifier for the order (corresponds to orders.id).")
    user_id: Optional[str] = Field(default=None, description="Identifier of the user who placed the order.")
    status: str = Field(..., description="Current status of the order.")
    total_amount: Decimal = Field(..., description="Total amount of the order.") # This is orders.amount
    currency: str = Field(..., description="Currency code for the order.")

    shipping_address_summary: Optional[str] = Field(default=None, description="A summary of the shipping address (from orders table).")
    tracking_number: Optional[str] = Field(default=None, description="Shipping tracking number, if applicable (from orders table).")
    carrier_name: Optional[str] = Field(default=None, description="Shipping carrier name, if applicable (from orders table).")

    items: List[OrderAdminItemDetail] = Field(default_factory=list, description="List of items included in the order.")

    created_at: datetime = Field(..., description="Timestamp of when the order was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the order.")

    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }
        json_schema_extra = {
            "example": {
                "order_id": 12345,
                "user_id": "user_xyz_789",
                "status": "processing",
                "total_amount": "125.50",
                "currency": "USD",
                "shipping_address_summary": "123 Main St, Anytown, USA, 12345",
                "tracking_number": "1Z999AA10123456784",
                "carrier_name": "UPS",
                "items": [
                    OrderAdminItemDetail.Config.json_schema_extra["example"]
                ],
                "created_at": "2023-10-01T14:30:00Z",
                "updated_at": "2023-10-01T15:00:00Z"
            }
        }
