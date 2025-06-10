from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

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
