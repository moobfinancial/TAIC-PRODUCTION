from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator, RootModel
from datetime import datetime

# Re-using the existing Product model for responses, as it includes variants.
# If admin-specific views of Product are needed later, ProductForAdminReview can be a distinct model.
# from .product import Product as ProductForAdminReview

class ProductReviewAction(BaseModel):
    """Schema for an administrator's action on a product review."""
    new_status: str = Field(..., description="The new approval status to set for the product (e.g., 'approved', 'rejected').")
    admin_notes: Optional[str] = Field(default=None, description="Optional notes from the administrator regarding the review decision.")

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
    """Schema representing a single entry in the admin audit log."""
    id: int = Field(..., description="Unique identifier for the audit log entry.")
    timestamp: datetime = Field(..., description="Timestamp of when the audited action occurred.")
    admin_username: str = Field(..., description="Username or identifier of the admin who performed the action.")
    action: str = Field(..., description="Description of the action performed (e.g., 'product_review', 'user_ban').")
    target_entity_type: Optional[str] = Field(default=None, description="Type of the entity that was affected (e.g., 'product', 'user').")
    target_entity_id: Optional[str] = Field(default=None, description="Identifier of the specific entity affected.")
    details: Optional[Dict[str, Any]] = Field(default=None, description="A JSON object containing additional details about the action.") # JSONB from DB will be parsed to Dict

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    """Schema for aggregated statistics typically displayed on an admin dashboard."""
    total_shoppers: int = Field(default=0, description="Total count of registered users with the 'SHOPPER' role.")
    total_merchants: int = Field(default=0, description="Total count of registered users with the 'MERCHANT' role.")
    products_pending_approval: int = Field(default=0, description="Number of products currently in 'pending' or 'needs_review' approval status.")
    total_sales_volume: float = Field(default=0.0, description="Total monetary value of all completed sales. Rounded to 2 decimal places.")
    new_users_last_30_days: int = Field(default=0, description="Count of all new users (shoppers and merchants) registered within the last 30 days.")

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
