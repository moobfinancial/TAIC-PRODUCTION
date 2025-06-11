from typing import Optional, List, Dict, Any # Added List, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime

class VTOImageMetadataResponse(BaseModel):
    """Response schema for VTO image metadata after upload or retrieval."""
    id: str = Field(..., description="Unique identifier for the VTO image metadata record.")
    user_id: str = Field(..., description="Identifier of the user who uploaded or owns the image.")
    image_type: str = Field(..., description="Type of the image (e.g., 'user_profile_for_vto', 'generated_vto_result').")
    original_filename: Optional[str] = Field(default=None, description="The original filename of the uploaded image, if available.")
    stored_filepath: str = Field(..., description="The path or key where the image is stored (e.g., in a cloud bucket or local filesystem).")
    mime_type: str = Field(..., description="MIME type of the image (e.g., 'image/jpeg', 'image/png').")
    file_size_bytes: int = Field(..., description="Size of the image file in bytes.")
    created_at: datetime = Field(..., description="Timestamp of when the image metadata record was created.")
    expires_at: Optional[datetime] = Field(default=None, description="Optional timestamp indicating when this image might expire or be auto-deleted.")
    related_product_id: Optional[str] = Field(default=None, description="If this image is related to a specific product (e.g., a VTO result for a product), its ID is stored here.")

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
    """Request schema for initiating a Virtual Try-On (VTO) generation."""
    user_image_id: str = Field(..., description="The unique ID of the user's previously uploaded image (which should be of type 'user_profile_for_vto' or similar) to be used as the base for VTO.")
    product_id: str = Field(..., description="The unique ID of the product the user wishes to virtually try on.")

    class Config:
        json_schema_extra = {
            "example": {
                "user_image_id": "img_uuid_12345", # This ID comes from a VTOImageMetadataResponse after upload
                "product_id": "product_def456"
            }
        }

class VTOGenerationResponse(BaseModel):
    """Response schema after submitting a VTO generation request."""
    job_id: Optional[str] = Field(default=None, description="An optional job ID that can be used to track the status of an asynchronous VTO generation process. If generation is synchronous, this might be null.")
    status: str = Field(..., description="Current status of the VTO generation request (e.g., 'pending', 'processing', 'completed', 'failed').")
    generated_image_id: Optional[str] = Field(default=None, description="If generation is successful, the unique ID of the newly created VTO image metadata record.")
    generated_image_url: Optional[HttpUrl] = Field(default=None, description="If generation is successful, a direct URL to the generated VTO image.")
    error_message: Optional[str] = Field(default=None, description="Provides a message if the VTO generation process encountered an error.")
    # Optionally include the VTOImageMetadataResponse for the new image if completed synchronously
    generated_image_metadata: Optional[VTOImageMetadataResponse] = Field(default=None, description="If generation is successful and synchronous, this field can directly provide the metadata of the generated image.")


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
