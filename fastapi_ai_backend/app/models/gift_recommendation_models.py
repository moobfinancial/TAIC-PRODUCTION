from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

# Assuming Product model will be imported in the agent file where it's used in GiftRecommendationResponse
# from .product import Product # Avoid direct import here if Product might also import from here or for simplicity

class GiftRecipientInfo(BaseModel):
    age: Optional[int] = Field(default=None, ge=0, description="Age of the gift recipient.")
    gender: Optional[str] = Field(default=None, description="Gender of the gift recipient (e.g., 'male', 'female', 'other', 'prefer_not_to_say').")
    interests: Optional[List[str]] = Field(default_factory=list, description="List of interests of the gift recipient.")
    occasion: Optional[str] = Field(default=None, description="Occasion for the gift (e.g., 'birthday', 'anniversary', 'holiday').")
    budget_min: Optional[float] = Field(default=None, ge=0, description="Minimum budget for the gift.")
    budget_max: Optional[float] = Field(default=None, ge=0, description="Maximum budget for the gift.")

    @validator('gender')
    def gender_must_be_valid(cls, value):
        if value is None:
            return value
        allowed_genders = ["male", "female", "other", "prefer_not_to_say", ""] # Allow empty string for not specified
        if value.lower() not in allowed_genders and value != "": # Check after lowercasing
            raise ValueError(f"Invalid gender. Must be one of: {', '.join(allowed_genders[:-1])} or empty.")
        return value.lower() if value else None # Store as lowercase or None

    @validator('budget_max')
    def budget_max_must_be_greater_than_min(cls, v, values):
        if v is not None and 'budget_min' in values and values['budget_min'] is not None:
            if v < values['budget_min']:
                raise ValueError('budget_max must be greater than or equal to budget_min')
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "age": 30,
                "gender": "female",
                "interests": ["hiking", "reading", "coffee"],
                "occasion": "birthday",
                "budget_min": 25.0,
                "budget_max": 75.0
            }
        }

class GiftRecommendationRequest(BaseModel):
    recipient_info: GiftRecipientInfo
    query_context: Optional[str] = Field(default=None, description="Any additional free-text query or context from the user about the gift search.")
    # Example: "She loves sci-fi books and gadgets."

    class Config:
        json_schema_extra = {
            "example": {
                "recipient_info": GiftRecipientInfo.Config.json_schema_extra["example"],
                "query_context": "Looking for something unique and thoughtful."
            }
        }

class GiftRecommendationResponse(BaseModel):
    # Using string annotation for Product to avoid circular dependency issues if Product model is complex
    # The actual Product model from app.models.product will be used at runtime.
    recommendations: List['app.models.product.Product'] = Field(default_factory=list)
    message_to_user: str = Field(description="A friendly message summarizing the recommendations or search status.")
    debug_info: Optional[Dict[str, Any]] = Field(default=None, description="Debugging information related to the recommendation process.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "recommendations": [
                    {"id": "DUMMYPROD001", "name": "Advanced Hiking Boots", "price": 120.00, "category": "Outdoor Gear"},
                    {"id": "DUMMYPROD002", "name": "Specialty Coffee Bean Sampler", "price": 45.00, "category": "Food & Drink"}
                ],
                "message_to_user": "Based on the interest in hiking and coffee, here are a couple of ideas!",
                "debug_info": {"criteria_used": ["hiking", "coffee"], "product_service_query": "hiking OR coffee"}
            }
        }
