from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator, RootModel
from datetime import datetime

# Re-using the existing Product model for responses, as it includes variants.
# If admin-specific views of Product are needed later, ProductForAdminReview can be a distinct model.
# from .product import Product as ProductForAdminReview

class ProductReviewAction(BaseModel):
    new_status: str = Field(..., description="The new approval status for the product.")
    admin_notes: Optional[str] = Field(default=None, description="Administrator notes regarding the review action.")

    @validator('new_status')
    def status_must_be_valid(cls, value):
        allowed_statuses = ['approved', 'rejected', 'pending'] # 'pending' might be useful for reverting an approval/rejection
        if value not in allowed_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(allowed_statuses)}")
        return value

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "new_status": "approved",
                "admin_notes": "Product looks good and meets all criteria."
            }
        }

class AdminAuditLogEntry(BaseModel):
    id: int
    timestamp: datetime
    admin_username: str
    action: str
    target_entity_type: Optional[str] = None
    target_entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None # JSONB from DB will be parsed to Dict

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_shoppers: int = Field(default=0, description="Total number of registered shoppers.")
    total_merchants: int = Field(default=0, description="Total number of registered merchants.")
    products_pending_approval: int = Field(default=0, description="Number of products currently awaiting admin approval.")
    total_sales_volume: float = Field(default=0.0, description="Total sales volume from completed orders, formatted to 2 decimal places.")
    new_users_last_30_days: int = Field(default=0, description="Total number of new users (shoppers and merchants) registered in the last 30 days.")

    @validator('total_sales_volume')
    def format_sales_volume(cls, v):
        return round(v or 0.0, 2)

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "total_shoppers": 1250,
                "total_merchants": 150,
                "products_pending_approval": 25,
                "total_sales_volume": 123456.78,
                "new_users_last_30_days": 85
            }
        }
