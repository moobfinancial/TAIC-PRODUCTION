from typing import Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime

class StoreReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars.")
    review_title: Optional[str] = Field(default=None, max_length=255, description="Optional title for the review.")
    review_text: Optional[str] = Field(default=None, description="Detailed text content of the review.")
    reviewer_name: Optional[str] = Field(default=None, max_length=255, description="Name of the reviewer, can be anonymous or a display name.")

    class Config:
        from_attributes = True

class StoreReviewCreateBody(StoreReviewBase):
    """
    Schema for the request body when creating a new store review.
    reviewer_id will be injected from auth dependency.
    merchant_id will be from path.
    """
    pass

class StoreReviewDBInput(StoreReviewBase):
    """
    Internal schema for preparing data before database insertion.
    Includes fields derived from path or auth.
    """
    merchant_id: str
    reviewer_id: Optional[str] = None # Could be None for anonymous/guest reviews not tied to a user account
    is_approved: bool = True # Default approval status, can be changed by admin later

class StoreReviewResponse(StoreReviewBase):
    """
    Schema for responses when returning store review data.
    Includes database-generated fields.
    """
    id: int
    merchant_id: str
    reviewer_id: Optional[str] = None
    is_approved: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "merchant_id": "merchant_xyz",
                "reviewer_id": "user_abc",
                "reviewer_name": "John Doe",
                "rating": 5,
                "review_title": "Amazing Store!",
                "review_text": "Loved the products and the service was excellent.",
                "is_approved": True,
                "created_at": "2023-10-26T10:00:00Z",
                "updated_at": "2023-10-26T10:00:00Z"
            }
        }
