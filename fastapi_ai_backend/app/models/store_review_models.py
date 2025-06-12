from typing import Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime

class StoreReviewBase(BaseModel):
    """Base schema for store review data, containing common fields for creation and representation."""
    rating: int = Field(..., ge=1, le=5, description="Star rating provided by the reviewer, from 1 (worst) to 5 (best).")
    review_title: Optional[str] = Field(default=None, max_length=255, description="An optional concise title for the review (e.g., 'Excellent Service!').")
    review_text: Optional[str] = Field(default=None, description="The detailed textual content of the review.")
    reviewer_name: Optional[str] = Field(default=None, max_length=255, description="Display name of the reviewer. Can be anonymous or a user-provided name. If a registered user posts, this might default to their profile name.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "rating": 5,
                "review_title": "Great Experience!",
                "review_text": "The store had everything I needed and the staff was very helpful.",
                "reviewer_name": "SatisfiedShopper123"
            }
        }

class StoreReviewCreateBody(StoreReviewBase):
    """
    Schema for the request body when a user submits a new store review.
    The `reviewer_id` is typically injected from the authenticated user's context on the server-side.
    The `merchant_id` is usually part of the URL path.
    """
    pass # Inherits all fields from StoreReviewBase, example is in StoreReviewBase


class StoreReviewDBInput(StoreReviewBase):
    """
    Internal schema used for preparing review data before it's inserted into the database.
    This includes system-set fields like `merchant_id` (from path), `reviewer_id` (from auth), and default `is_approved` status.
    """
    merchant_id: str = Field(..., description="The unique identifier of the merchant or store being reviewed.")
    reviewer_id: Optional[str] = Field(default=None, description="The unique identifier of the user who wrote the review. Can be null for anonymous or guest reviews if permitted.")
    is_approved: bool = Field(default=True, description="Approval status of the review. Defaults to True, but can be moderated by admins.")


class StoreReviewResponse(StoreReviewBase):
    """
    Schema for representing a store review when retrieved from the API.
    Includes all base fields plus database-generated fields like ID, timestamps, and approval status.
    """
    id: int = Field(..., description="Unique identifier for the store review.")
    merchant_id: str = Field(..., description="Identifier of the merchant or store that was reviewed.")
    reviewer_id: Optional[str] = Field(default=None, description="Identifier of the user who wrote the review, if available.")
    is_approved: bool = Field(..., description="Indicates whether the review is approved and publicly visible.")
    created_at: datetime = Field(..., description="Timestamp of when the review was originally created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the review (e.g., admin approval change).")

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
