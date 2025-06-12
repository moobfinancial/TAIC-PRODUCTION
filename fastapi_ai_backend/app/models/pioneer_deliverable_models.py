from typing import Optional, List
from pydantic import BaseModel, Field, validator
from datetime import datetime, date # Import date

# Allowed statuses for a deliverable (align with schema.sql)
DELIVERABLE_STATUSES_OVERALL = [
    'pending',
    'submitted_for_review',
    'requires_revision',
    'approved',
    'rejected'
]

# Statuses an Admin can typically set directly
ADMIN_SETTABLE_DELIVERABLE_STATUSES = [
    'pending', # Admin might reset to pending
    'requires_revision',
    'approved',
    'rejected'
    # 'submitted_for_review' is typically set by the pioneer.
]


class PioneerDeliverableBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Title of the deliverable, clearly identifying its purpose (e.g., 'Week 1 Blog Post').")
    description: Optional[str] = Field(default=None, description="Detailed description of what is expected for the deliverable, including any specific requirements or guidelines.")
    due_date: Optional[date] = Field(default=None, description="The date by which this deliverable is expected to be submitted by the pioneer.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "title": "Initial Blog Post Draft",
                "description": "Draft of the first blog post about TAIC, covering key platform features and personal expectations as a pioneer.",
                "due_date": "2024-03-15"
            }
        }

class PioneerDeliverableCreateAdmin(PioneerDeliverableBase):
    """Schema for an Admin to create/assign a new deliverable to a specific pioneer application."""
    # application_id will be supplied via a path parameter in the API endpoint.
    # Default status ('pending') will be set by the database or application logic upon creation.
    pass

class PioneerDeliverableUpdateAdmin(BaseModel):
    """Schema for an Admin to update a deliverable's details, status, or provide feedback."""
    title: Optional[str] = Field(default=None, min_length=3, max_length=255, description="New title for the deliverable.")
    description: Optional[str] = Field(default=None, description="New detailed description for the deliverable.")
    due_date: Optional[date] = Field(default=None, description="New due date for the deliverable.")
    status: Optional[str] = Field(default=None, description=f"Update the status of the deliverable. Allowed values by admin: {', '.join(ADMIN_SETTABLE_DELIVERABLE_STATUSES)}.")
    admin_feedback: Optional[str] = Field(default=None, description="Feedback from the admin after reviewing the submission. This is visible to the pioneer.")

    @validator('status')
    def status_must_be_valid(cls, value):
        if value is not None and value not in ADMIN_SETTABLE_DELIVERABLE_STATUSES:
            raise ValueError(f"Invalid status for admin update. Must be one of: {', '.join(ADMIN_SETTABLE_DELIVERABLE_STATUSES)}")
        return value

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "status": "approved",
                "admin_feedback": "Excellent work on this submission! This meets all criteria."
            }
        }

class PioneerDeliverableSubmitPioneer(BaseModel):
    """Schema for a Pioneer to submit their deliverable content."""
    submission_content: str = Field(..., min_length=10, description="Content of the submission. This can include text, links to external content (e.g., blog posts, social media), or other relevant information.")

    class Config:
        json_schema_extra = {
            "example": {
                "submission_content": "Blog post link: https://myawesomestuff.com/taic-pioneer-intro \n\nI've also shared it on my Twitter: https://twitter.com/mypioneer/status/123"
            }
        }

class PioneerDeliverableResponse(PioneerDeliverableBase):
    """Full response model for a pioneer deliverable, including all database and relational fields."""
    id: int = Field(..., description="Unique identifier for the deliverable.")
    application_id: int = Field(..., description="ID of the pioneer application this deliverable belongs to.")
    status: str = Field(..., description="Current status of the deliverable (e.g., 'pending', 'submitted_for_review').")
    submission_content: Optional[str] = Field(default=None, description="Content submitted by the pioneer for this deliverable.")
    admin_feedback: Optional[str] = Field(default=None, description="Feedback provided by the admin after reviewing the submission.")
    submitted_at: Optional[datetime] = Field(default=None, description="Timestamp of when the pioneer marked this deliverable as submitted.")
    reviewed_at: Optional[datetime] = Field(default=None, description="Timestamp of when an admin last reviewed this deliverable (e.g., changed status or added feedback).")
    reviewed_by_admin_username: Optional[str] = Field(default=None, description="Username of the admin who last reviewed or updated the deliverable.")
    created_at: datetime = Field(..., description="Timestamp of when the deliverable record was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the deliverable record.")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None,
            date: lambda d: d.isoformat() if d else None
        }
        json_schema_extra = {
            "example": {
                "id": 1,
                "application_id": 101,
                "title": "Week 1: Introductory Blog Post",
                "description": "Write and publish a blog post introducing TAIC and your role as a pioneer.",
                "due_date": "2024-01-15",
                "status": "submitted_for_review",
                "submission_content": "Link: https://myblog.com/taic-intro. Also shared on Twitter @myhandle.",
                "admin_feedback": "Thanks for your submission, we will review it shortly.",
                "submitted_at": "2024-01-14T10:00:00Z",
                "reviewed_at": "2024-01-14T11:00:00Z",
                "reviewed_by_admin_username": "admin_user1",
                "created_at": "2024-01-01T12:00:00Z",
                "updated_at": "2024-01-14T11:00:00Z"
            }
        }
