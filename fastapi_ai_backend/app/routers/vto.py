import logging
import uuid
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
import asyncpg

from app.models.vto_models import VTOImageMetadataResponse, VTOGenerationRequest, VTOGenerationResponse
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id
from app.services.vto_service import trigger_genkit_vto_flow_placeholder # Import the placeholder service

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Virtual Try-On (VTO)"],
    # prefix will be set in main.py, e.g., /api/vto
)

# Configuration for VTO uploads
# In a production environment, this should be configurable via environment variables
# and point to a persistent storage solution (e.g., S3 bucket mount, dedicated NAS).
# For development, a local directory is fine.
VTO_UPLOAD_DIR = Path(os.getenv("VTO_UPLOAD_DIR", "./uploads/vto_images"))
MAX_FILE_SIZE_MB = 5
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

# Ensure base upload directory exists on startup (or first use)
VTO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post(
    "/upload-vto-image",
    response_model=VTOImageMetadataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload User Image for VTO",
    description=f"""
Uploads an image (e.g., a user's photo) to be used as a base for Virtual Try-On (VTO).
- **File Requirements:**
    - Allowed MIME types: {', '.join(ALLOWED_MIME_TYPES)}.
    - Maximum file size: {MAX_FILE_SIZE_MB}MB.
- The image is stored locally (path configured on server) and its metadata (ID, user ID, path, type, size, etc.) is recorded in the `vto_images` database table.
- The `image_type` for this upload will be set to 'user_profile_for_vto'.
- Returns metadata of the uploaded image, including its unique ID which can be used in VTO generation requests.
- **Protected Endpoint:** Requires user authentication.
    """
)
async def upload_vto_image(
    current_user_id: str = Depends(get_current_active_user_id),
    image_file: UploadFile = File(..., description=f"Image file to upload for VTO. Max size: {MAX_FILE_SIZE_MB}MB. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}."),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    # 1. File Validation
    if image_file.content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"User {current_user_id} attempted to upload invalid VTO image type: {image_file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type. Allowed types are: {', '.join(ALLOWED_MIME_TYPES)}"
        )

    # Check file size and save to a temporary unique path first
    image_id_for_temp = str(uuid.uuid4()) # Generate ID early for temp filename
    temp_file_extension = Path(image_file.filename if image_file.filename else ".tmp").suffix.lower()
    if not temp_file_extension and image_file.content_type:
        ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
        temp_file_extension = ext_map.get(image_file.content_type, ".img")

    temp_upload_file_path = VTO_UPLOAD_DIR / f"temp_upload_{image_id_for_temp}{temp_file_extension}"
    actual_file_size = 0

    try:
        with open(temp_upload_file_path, "wb") as buffer:
            shutil.copyfileobj(image_file.file, buffer)
        actual_file_size = os.path.getsize(temp_upload_file_path)

        if actual_file_size == 0: # Should not happen if UploadFile is used correctly
            logger.warning(f"User {current_user_id} uploaded an empty VTO image file.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image file is empty.")

        if actual_file_size > MAX_FILE_SIZE_BYTES:
            logger.warning(f"User {current_user_id} attempted to upload VTO image too large: {actual_file_size} bytes.")
            # Clean up the oversized temp file immediately
            if temp_upload_file_path.exists():
                os.remove(temp_upload_file_path)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image file size exceeds the limit of {MAX_FILE_SIZE_MB}MB."
            )
    except HTTPException:
        raise # Re-raise validation HTTPExceptions
    except Exception as e: # Handle potential errors during temp file operations
        logger.error(f"Error during initial VTO image file save/check for user {current_user_id}: {e}")
        if temp_upload_file_path.exists(): # Ensure cleanup on other errors too
            os.remove(temp_upload_file_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing image file.")
    finally:
        image_file.file.close() # Ensure original uploaded file stream is closed

    # At this point, temp_upload_file_path contains the validated file.

    # 2. Directory Setup for user
    user_vto_dir = VTO_UPLOAD_DIR / current_user_id
    user_vto_dir.mkdir(parents=True, exist_ok=True)

    # 3. Generate Final Unique Filename/Path (using the ID from the temp file name for consistency)
    image_id = image_id_for_temp # Use the same UUID
    # Use the extension derived for the temp file
    unique_filename = f"{image_id}{temp_file_extension}"
    relative_stored_filepath = Path(current_user_id) / unique_filename
    absolute_stored_filepath = VTO_UPLOAD_DIR / relative_stored_filepath

    # 4. Move validated temporary file to its final destination
    try:
        shutil.move(temp_upload_file_path, absolute_stored_filepath)
        logger.info(f"VTO image for user {current_user_id} validated and moved to: {absolute_stored_filepath}")
    except Exception as e_move:
        logger.error(f"Failed to move VTO image from temp to final storage for user {current_user_id}: {e_move}")
        # Attempt to clean up temp file if it still exists (move might have partially failed)
        if temp_upload_file_path.exists():
            os.remove(temp_upload_file_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not store image file after validation.")
    # temp_upload_file_path should not exist here if move was successful


    # 5. Database Record
    try:
        insert_query = """
            INSERT INTO vto_images
                (id, user_id, image_type, original_filename, stored_filepath, mime_type, file_size_bytes, created_at, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
            RETURNING id, user_id, image_type, original_filename, stored_filepath, mime_type, file_size_bytes, created_at, expires_at
        """
        # expires_at can be set based on a policy, e.g., NOW() + INTERVAL '30 days'
        # For now, setting it to NULL.
        expires_at_value = None

        created_metadata_row = await conn.fetchrow(
            insert_query,
            image_id,
            current_user_id,
            'user_profile_for_vto', # image_type
            image_file.filename,
            str(relative_stored_filepath), # Store relative path
            image_file.content_type,
            actual_file_size, # Use size obtained from the saved temp file
            expires_at_value
        )

        if not created_metadata_row:
            logger.error(f"Failed to insert VTO image metadata for user {current_user_id}, image_id {image_id}")
            # Attempt to clean up saved file if DB insert fails
            if absolute_stored_filepath.exists():
                os.remove(absolute_stored_filepath)
                logger.info(f"Cleaned up orphaned VTO image file: {absolute_stored_filepath}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record image metadata.")

        logger.info(f"VTO image metadata recorded for user {current_user_id}, image ID: {image_id}")

        # Adjust stored_filepath for response to be relative, or construct a full URL if needed
        response_data = dict(created_metadata_row)
        # The model expects stored_filepath, which is already relative in the DB.

        return VTOImageMetadataResponse(**response_data)

    except asyncpg.exceptions.UndefinedTableError:
        logger.critical("CRITICAL: 'vto_images' table does not exist. VTO image upload failed. Please ensure database schema is up to date.")
        if absolute_stored_filepath.exists(): os.remove(absolute_stored_filepath) # Cleanup
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="VTO system is temporarily unavailable.")
    except HTTPException:
        if absolute_stored_filepath.exists(): os.remove(absolute_stored_filepath) # Cleanup on other HTTP exceptions if file was saved
        raise
    except Exception as e:
        logger.error(f"Unexpected error during VTO image DB operation for user {current_user_id}: {e}")
        if absolute_stored_filepath.exists(): os.remove(absolute_stored_filepath) # Cleanup
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during image upload.")
    # Connection release is handled by FastAPI's dependency injection for `conn`.

@router.post(
    "/generate-vto",
    response_model=VTOGenerationResponse,
    summary="Generate Virtual Try-On Image",
    status_code=status.HTTP_202_ACCEPTED, # Suggests async processing, even if placeholder is sync for now
    description="""
Initiates a Virtual Try-On (VTO) image generation task.
- Takes a `user_image_id` (ID of a previously uploaded 'user_profile_for_vto' image) and a `product_id`.
- Validates that the user image belongs to the authenticated user and the product is valid for VTO.
- Currently, this endpoint calls a **placeholder Python service** that simulates a more complex VTO generation flow (e.g., one managed by Genkit).
- The placeholder service creates a new VTO image record in the database (type 'generated_vto_result') and copies the user's image to a new location to simulate a generated image.
- Returns a response indicating the status of the generation request (e.g., 'pending', 'completed', 'failed') and details of the generated image if successful.
- A `job_id` is returned, which could be used to poll for status if the backend were truly asynchronous.
- **Protected Endpoint:** Requires user authentication.
    """
)
async def generate_vto_image_endpoint(
    request_data: VTOGenerationRequest,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    logger.info(f"User {current_user_id} requested VTO generation for user_image_id: {request_data.user_image_id} and product_id: {request_data.product_id}")

    # 1. Validate that user_image_id belongs to current_user_id and is of type 'user_profile_for_vto'
    user_image_meta = await conn.fetchrow(
        "SELECT id FROM vto_images WHERE id = $1 AND user_id = $2 AND image_type = 'user_profile_for_vto'",
        request_data.user_image_id,
        current_user_id
    )
    if not user_image_meta:
        logger.warning(f"Invalid user_image_id '{request_data.user_image_id}' for user '{current_user_id}' or not 'user_profile_for_vto'.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified user image not found or not suitable for VTO base."
        )

    # 2. Validate that product_id exists and is active/approved
    product_exists = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND is_active = TRUE AND approval_status = 'approved')",
        request_data.product_id
    )
    if not product_exists:
        logger.warning(f"Product ID '{request_data.product_id}' not found, inactive, or not approved for VTO request by user '{current_user_id}'.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified product not found or not available for Virtual Try-On."
        )

    # 3. Call the placeholder service function (simulating Genkit flow invocation)
    # This placeholder function will handle its own DB interactions for creating the generated image record.
    # A job_id could be generated here if the placeholder was truly async and returned immediately.
    # For now, our placeholder is synchronous from the endpoint's perspective.

    job_id = f"vto_job_{uuid.uuid4()}" # Create a job ID for tracking, even if sync for now
    logger.info(f"Triggering VTO placeholder service for job_id: {job_id}, user: {current_user_id}")

    try:
        vto_result = await trigger_genkit_vto_flow_placeholder(
            user_id=current_user_id,
            user_image_id=request_data.user_image_id,
            product_id=request_data.product_id,
            db_conn=conn # Pass the connection
        )

        # The placeholder returns a dict like:
        # {"status": "completed", "generated_image_id": "...", "generated_image_url": "..."}
        # or {"status": "failed", "error_message": "..."}

        if vto_result.get("status") == "completed":
            # Fetch the full metadata for the generated image to include in response
            generated_image_metadata_response: Optional[VTOImageMetadataResponse] = None
            if vto_result.get("generated_image_id"):
                 # Need to query all fields for VTOImageMetadataResponse
                gen_img_row = await conn.fetchrow(
                    "SELECT * FROM vto_images WHERE id = $1", vto_result["generated_image_id"]
                )
                if gen_img_row:
                    generated_image_metadata_response = VTOImageMetadataResponse(**dict(gen_img_row))


            return VTOGenerationResponse(
                job_id=job_id,
                status="completed", # Or vto_result.get("status")
                generated_image_id=vto_result.get("generated_image_id"),
                generated_image_url=vto_result.get("generated_image_url"), # This is relative path
                generated_image_metadata=generated_image_metadata_response
            )
        else:
            logger.error(f"VTO placeholder service failed for job_id {job_id}, user {current_user_id}. Error: {vto_result.get('error_message')}")
            return VTOGenerationResponse(
                job_id=job_id,
                status="failed",
                error_message=vto_result.get("error_message", "VTO generation failed due to an internal error.")
            )

    except Exception as e:
        logger.error(f"Exception calling VTO placeholder service for user {current_user_id}, job_id {job_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return VTOGenerationResponse(
            job_id=job_id,
            status="failed",
            error_message=f"An unexpected server error occurred during VTO generation: {str(e)}"
        )
    # Note: Connection release for `conn` is handled by FastAPI's dependency management.
