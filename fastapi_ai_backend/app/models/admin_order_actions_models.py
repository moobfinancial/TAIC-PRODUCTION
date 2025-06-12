from typing import Optional
from pydantic import BaseModel, Field, validator
from decimal import Decimal

ALLOWED_ADMIN_ORDER_STATUSES = [
    'shipped',
    'delivered',
    'refund_processed', # For shopper
    'payout_sent_to_merchant' # For merchant
]

class AdminOrderStatusUpdate(BaseModel):
    new_status: str = Field(..., description="The new status to apply to the conceptual order.")
    tracking_number: Optional[str] = Field(default=None, description="Tracking number, required if new_status is 'shipped'.")
    carrier_name: Optional[str] = Field(default=None, description="Carrier name, optional if new_status is 'shipped'.")
    refund_amount: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"), description="Refund amount, required if new_status is 'refund_processed'.")
    payout_amount: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"), description="Payout amount, required if new_status is 'payout_sent_to_merchant'.")
    notes: Optional[str] = Field(default=None, description="Admin notes for this action.")

    @validator('new_status')
    def status_must_be_valid(cls, value):
        if value not in ALLOWED_ADMIN_ORDER_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(ALLOWED_ADMIN_ORDER_STATUSES)}")
        return value

    @validator('tracking_number', always=True)
    def tracking_number_required_for_shipped(cls, v, values):
        new_status = values.get('new_status')
        if new_status == 'shipped' and not v:
            raise ValueError("Tracking number is required when status is 'shipped'.")
        return v

    @validator('refund_amount', always=True)
    def refund_amount_required_for_refunded(cls, v, values):
        new_status = values.get('new_status')
        if new_status == 'refund_processed' and v is None: # Check for None explicitly
            raise ValueError("Refund amount is required when status is 'refund_processed'.")
        return v

    @validator('payout_amount', always=True)
    def payout_amount_required_for_payout(cls, v, values):
        new_status = values.get('new_status')
        if new_status == 'payout_sent_to_merchant' and v is None: # Check for None explicitly
            raise ValueError("Payout amount is required when status is 'payout_sent_to_merchant'.")
        return v

    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: lambda v: str(v) if v is not None else None
        }
        json_schema_extra = {
            "example_shipped": {
                "new_status": "shipped",
                "tracking_number": "1Z999AA10123456784",
                "carrier_name": "UPS",
                "notes": "All items shipped."
            },
            "example_refund": {
                "new_status": "refund_processed",
                "refund_amount": "49.99",
                "notes": "Customer returned item, processed refund."
            }
        }
