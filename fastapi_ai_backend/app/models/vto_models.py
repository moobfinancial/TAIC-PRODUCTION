from typing import Optional, List, Dict, Any # Added List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class VTOImageMetadataResponse(BaseModel):
    id: str
    user_id: str
    image_type: str
    original_filename: Optional[str] = None
    stored_filepath: str
    mime_type: str
    file_size_bytes: int
    created_at: datetime
    expires_at: Optional[datetime] = None
    related_product_id: Optional[str] = None # Added as it's in vto_images table

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "img_uuid_12345",
                "user_id": "user_uuid_abcde",
                "image_type": "user_profile_for_vto",
                "original_filename": "my_photo.jpg",
                "stored_filepath": "user_uuid_abcde/img_uuid_12345.jpg",
                "mime_type": "image/jpeg",
                "file_size_bytes": 1048576,
                "created_at": "2023-10-27T14:00:00Z",
                "expires_at": None,
                "related_product_id": "product_def456"
            }
        }

class VTOGenerationRequest(BaseModel):
    user_image_id: str = Field(..., description="ID of the user's uploaded image (type 'user_profile_for_vto') to use for VTO.")
    product_id: str = Field(..., description="ID of the product to virtually try on.")

    class Config:
        json_schema_extra = {
            "example": {
                "user_image_id": "img_uuid_12345",
                "product_id": "product_def456"
            }
        }

class VTOGenerationResponse(BaseModel):
    job_id: Optional[str] = Field(default=None, description="A job ID to track the VTO generation status, especially if asynchronous.")
    status: str = Field(..., description="Status of the VTO generation request (e.g., 'pending', 'completed', 'failed').")
    generated_image_id: Optional[str] = Field(default=None, description="ID of the newly generated VTO image metadata record (if successful).")
    generated_image_url: Optional[str] = Field(default=None, description="URL or relative path to the generated VTO image (if successful).")
    error_message: Optional[str] = Field(default=None, description="Error message if the VTO generation failed.")
    # Optionally include the VTOImageMetadataResponse for the new image if completed synchronously
    generated_image_metadata: Optional[VTOImageMetadataResponse] = None


    class Config:
        json_schema_extra = {
            "example_pending": {
                "job_id": "vto_job_uuid_78910",
                "status": "pending",
            },
            "example_completed": {
                "job_id": "vto_job_uuid_78910",
                "status": "completed",
                "generated_image_id": "gen_img_uuid_67890",
                "generated_image_url": "user_uuid_abcde/generated/gen_img_uuid_67890.jpg",
                "generated_image_metadata": VTOImageMetadataResponse.Config.json_schema_extra["example"] # Reusing example
            }
        }
