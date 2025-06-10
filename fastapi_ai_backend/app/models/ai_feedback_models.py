from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator, root_validator
from datetime import datetime

ALLOWED_FEEDBACK_TYPES = ["thumbs_up", "thumbs_down", "rating_scale", "text_comment"]

class AIAgentFeedbackBase(BaseModel):
    agent_name: str = Field(..., max_length=100, description="Name of the AI agent receiving feedback (e.g., 'ShoppingAssistant', 'GiftRecommender').")
    session_id: Optional[str] = Field(default=None, max_length=255, description="Optional session or interaction ID to group related feedback.")
    user_query: Optional[str] = Field(default=None, description="The user query or input that led to the recommendation.")
    recommendation_reference_id: Optional[str] = Field(default=None, max_length=255, description="Identifier for the specific recommendation being reviewed (e.g., product ID).")
    feedback_type: str = Field(..., description=f"Type of feedback provided. Allowed types: {', '.join(ALLOWED_FEEDBACK_TYPES)}.")
    rating_value: Optional[int] = Field(default=None, description="Rating value, applicable if feedback_type is 'rating_scale' (e.g., 1-5).")
    comment_text: Optional[str] = Field(default=None, description="Text comment for feedback, or additional notes.")

    @validator('feedback_type')
    def feedback_type_must_be_valid(cls, value):
        if value not in ALLOWED_FEEDBACK_TYPES:
            raise ValueError(f"Invalid feedback_type. Must be one of: {', '.join(ALLOWED_FEEDBACK_TYPES)}")
        return value

    @root_validator(pre=False) # Pydantic v1 style, for Pydantic v2 use model_validator
    def check_rating_value_for_rating_scale(cls, values):
        feedback_type = values.get('feedback_type')
        rating_value = values.get('rating_value')
        if feedback_type == 'rating_scale':
            if rating_value is None:
                raise ValueError("rating_value is required when feedback_type is 'rating_scale'.")
            if not (1 <= rating_value <= 5):
                raise ValueError("rating_value must be between 1 and 5 for 'rating_scale' feedback.")
        elif rating_value is not None: # If not rating_scale, rating_value should ideally be None or ignored
            # For now, we allow it to be passed but it might not be used. Could also raise error.
            # values['rating_value'] = None # Or clear it
            pass
        return values

    class Config:
        from_attributes = True

class AIAgentFeedbackCreate(AIAgentFeedbackBase):
    pass
    class Config:
        json_schema_extra = {
            "example": {
                "agent_name": "GiftRecommender",
                "session_id": "session_abc123",
                "user_query": "gifts for dad who likes fishing",
                "recommendation_reference_id": "product_xyz789",
                "feedback_type": "thumbs_up",
                "comment_text": "Great suggestion, he'd love this!"
            },
            "example_rating": {
                "agent_name": "ShoppingAssistant",
                "feedback_type": "rating_scale",
                "rating_value": 4,
                "comment_text": "The product search was mostly relevant."
            }
        }


class AIAgentFeedbackResponse(AIAgentFeedbackBase):
    id: int
    user_id: Optional[str] = None # Populated from authenticated user if available
    created_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
             "example": {
                "id": 1,
                "agent_name": "GiftRecommender",
                "session_id": "session_abc123",
                "user_query": "gifts for dad who likes fishing",
                "recommendation_reference_id": "product_xyz789",
                "feedback_type": "thumbs_up",
                "comment_text": "Great suggestion, he'd love this!",
                "user_id": "user_uuid_123",
                "created_at": "2023-10-27T10:30:00Z",
                "rating_value": None
            }
        }
