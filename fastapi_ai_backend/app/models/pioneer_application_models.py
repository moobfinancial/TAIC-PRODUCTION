from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr, HttpUrl, validator
from datetime import datetime

# Define allowed tiers based on schema.sql
ALLOWED_TIERS = [
    'Tier 1: Visionary Partner',
    'Tier 2: Strategic Influencer',
    'Tier 3: Early Champion',
    'Tier 4: Community Advocate',
    'Tier 5: Platform Pioneer'
]

# Define allowed application statuses based on schema.sql
ALLOWED_APPLICATION_STATUSES = [
    'pending',
    'under_review',
    'additional_info_requested',
    'approved',
    'rejected',
    'waitlisted',
    'onboarded'
]
# Define statuses an admin can typically set
ADMIN_SETTABLE_STATUSES = [
    'under_review',
    'additional_info_requested',
    'approved',
    'rejected',
    'waitlisted',
    'onboarded'
    # 'pending' is usually the initial state set by the system
]


class PioneerApplicationBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255, description="Applicant's full legal name.")
    email: EmailStr = Field(..., description="Applicant's primary email address.")
    telegram_handle: Optional[str] = Field(default=None, max_length=100, description="Applicant's Telegram username (optional).")
    discord_id: Optional[str] = Field(default=None, max_length=100, description="Applicant's Discord ID (optional).")
    country_of_residence: Optional[str] = Field(default=None, max_length=100, description="Applicant's country of residence (optional).")

    applying_for_tier: str = Field(..., description="The Pioneer Program tier the applicant is applying for.")

    primary_social_profile_link: Optional[HttpUrl] = Field(default=None, description="URL to the applicant's primary social media profile or content platform (optional).")
    follower_subscriber_count: Optional[str] = Field(default=None, max_length=100, description="Estimated number of followers/subscribers (e.g., '10k-50k', '1M+').")
    secondary_social_profile_links: Optional[str] = Field(default=None, description="Other relevant social media links, separated by newlines or commas (optional).")

    audience_demographics_description: Optional[str] = Field(default=None, description="Description of the applicant's typical audience demographics (optional).")
    engagement_statistics_overview: Optional[str] = Field(default=None, description="Overview of typical engagement statistics (e.g., likes, comments, views per post) (optional).")

    interest_reason: str = Field(..., min_length=50, description="Detailed explanation of why the applicant is interested in the TAIC Pioneer Program (min 50 characters).")
    contribution_proposal: Optional[str] = Field(default=None, description="Applicant's proposal on how they plan to contribute to the TAIC ecosystem (optional).")
    previous_programs_experience: Optional[str] = Field(default=None, description="Description of experience with similar ambassador or pioneer programs (optional).")

    taic_compatible_wallet_address: Optional[str] = Field(default=None, max_length=255, description="Applicant's TAIC-compatible wallet address for potential rewards (optional during application).")

    agreed_to_terms: bool = Field(..., description="Confirmation that the applicant has read and agreed to the program terms and conditions.")
    agreed_to_token_vesting: bool = Field(..., description="Confirmation that the applicant understands and agrees to any token vesting schedules, if applicable.")

    @validator('applying_for_tier')
    def tier_must_be_valid(cls, value):
        if value not in ALLOWED_TIERS:
            raise ValueError(f"Invalid tier. Must be one of: {', '.join(ALLOWED_TIERS)}")
        return value

    @validator('agreed_to_terms')
    def must_agree_to_terms(cls, value):
        if not value:
            raise ValueError("Agreement to terms and conditions is required.")
        return value

    @validator('agreed_to_token_vesting')
    def must_agree_to_vesting(cls, value):
        if not value:
            raise ValueError("Agreement to token vesting schedule is required.")
        return value

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "full_name": "Jane Doe",
                "email": "jane.doe@example.com",
                "telegram_handle": "janedoe_tg",
                "applying_for_tier": "Tier 2: Strategic Influencer",
                "primary_social_profile_link": "https://twitter.com/janedoe",
                "follower_subscriber_count": "25k",
                "interest_reason": "I am very passionate about the potential of AI in commerce and believe TAIC is leading the way. I want to contribute...",
                "agreed_to_terms": True,
                "agreed_to_token_vesting": True
            }
        }

class PioneerApplicationCreate(PioneerApplicationBase):
    """Request model for submitting a new Pioneer Program application."""
    pass


class PioneerApplicationResponse(PioneerApplicationBase):
    """Response model after successfully submitting a Pioneer Program application."""
    id: int = Field(..., description="Unique identifier for the submitted application.")
    user_id: Optional[str] = Field(default=None, description="If the applicant was logged in, their user ID. Null otherwise.")
    application_status: str = Field(..., description="Current status of the application (e.g., 'pending').")
    submitted_at: datetime = Field(..., description="Timestamp of when the application was submitted.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 101,
                "full_name": "Jane Doe",
                "email": "jane.doe@example.com",
                "telegram_handle": "janedoe_tg",
                "applying_for_tier": "Tier 2: Strategic Influencer",
                "primary_social_profile_link": "https://twitter.com/janedoe",
                "follower_subscriber_count": "25k",
                "interest_reason": "I am very passionate about the potential of AI in commerce and believe TAIC is leading the way. I want to contribute...",
                "agreed_to_terms": True,
                "agreed_to_token_vesting": True,
                "user_id": "user_uuid_example_if_logged_in",
                "application_status": "pending",
                "submitted_at": "2023-10-28T12:00:00Z"
            }
        }

class PioneerApplicationUpdateAdmin(BaseModel):
    """Schema for an admin to update a Pioneer Program application."""
    application_status: str = Field(..., description="The new status to set for the application.")
    internal_review_notes: Optional[str] = Field(default=None, description="Internal notes from the admin regarding this application or status change. Previous notes may be overwritten or appended depending on endpoint logic.")

    @validator('application_status')
    def status_must_be_valid_admin_settable(cls, value):
        if value not in ADMIN_SETTABLE_STATUSES: # Use the admin-specific list
            raise ValueError(f"Invalid status for admin update. Must be one of: {', '.join(ADMIN_SETTABLE_STATUSES)}")
        return value

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "application_status": "approved",
                "internal_review_notes": "Excellent candidate. Strong social presence and clear contribution plan."
            }
        }
