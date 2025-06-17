import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Path as FastApiPath
import asyncpg
from datetime import datetime, timezone # Added timezone

from app.models.pioneer_deliverable_models import (
    PioneerDeliverableSubmitPioneer,
    PioneerDeliverableResponse
)
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id # Standard user auth

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Pioneer Portal - Deliverables"],
    # Actual prefix will be /api/pioneer/me (from main.py)
)

# --- Dependency for Pioneer Portal ---
async def get_current_pioneer_application_id_or_403(
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
) -> int:
    """
    Checks if the current authenticated user is an approved/onboarded pioneer.
    Returns their pioneer_applications.id if they are, otherwise raises HTTPException 403.
    """
    query = """
        SELECT id FROM pioneer_applications
        WHERE user_id = $1 AND status IN ('approved', 'onboarded')
        ORDER BY created_at DESC LIMIT 1
        -- Takes the most recent approved/onboarded application if multiple exist
    """
    application_id = await conn.fetchval(query, current_user_id)
    if not application_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an active pioneer or has no approved/onboarded application."
        )
    return application_id

# --- Pioneer-Facing Endpoints ---

@router.get(
    "/deliverables",
    response_model=List[PioneerDeliverableResponse],
    summary="List My Assigned Deliverables",
    description="Retrieves a list of all deliverables assigned to the authenticated (and approved/onboarded) pioneer."
)
async def list_my_pioneer_deliverables(
    application_id: int = Depends(get_current_pioneer_application_id_or_403),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        query = "SELECT * FROM pioneer_deliverables WHERE application_id = $1 ORDER BY due_date ASC, created_at ASC"
        rows = await conn.fetch(query, application_id)
        return [PioneerDeliverableResponse(**dict(row)) for row in rows]
    except HTTPException: # Re-raise if from dependency
        raise
    except Exception as e:
        logger.error(f"Error listing deliverables for pioneer application {application_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve deliverables.")


@router.put(
    "/deliverables/{deliverable_id}/submit",
    response_model=PioneerDeliverableResponse,
    summary="Submit a Deliverable",
    description="Allows an authenticated pioneer to submit content for one of their assigned deliverables. Sets the status to 'submitted_for_review'."
)
async def submit_pioneer_deliverable(
    payload: PioneerDeliverableSubmitPioneer,
    deliverable_id: int = FastApiPath(..., description="ID of the deliverable being submitted."),
    application_id: int = Depends(get_current_pioneer_application_id_or_403), # Ensures user is an active pioneer
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        async with conn.transaction():
            # Verify deliverable belongs to this pioneer's application and is in a submittable state
            deliverable_row = await conn.fetchrow(
                "SELECT id, status FROM pioneer_deliverables WHERE id = $1 AND application_id = $2",
                deliverable_id, application_id
            )
            if not deliverable_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Deliverable with ID {deliverable_id} not found for your pioneer application, or you are not authorized."
                )

            current_status = deliverable_row['status']
            if current_status not in ['pending', 'requires_revision']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Deliverable is not in a submittable status. Current status: {current_status}"
                )

            # Update the deliverable
            query = """
                UPDATE pioneer_deliverables
                SET submission_content = $1,
                    status = 'submitted_for_review',
                    submitted_at = $2,
                    updated_at = $2
                WHERE id = $3 AND application_id = $4
                RETURNING *
            """
            # Using timezone.utc for NOW() equivalent if not relying on DB's NOW()
            current_time = datetime.now(timezone.utc)

            updated_row = await conn.fetchrow(
                query,
                payload.submission_content,
                current_time, # for submitted_at and updated_at
                deliverable_id,
                application_id
            )
            if not updated_row: # Should not happen if previous checks passed
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit deliverable.")

            logger.info(f"Pioneer (App ID: {application_id}) submitted deliverable ID: {deliverable_id}")
            return PioneerDeliverableResponse(**dict(updated_row))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting deliverable {deliverable_id} for pioneer app {application_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit deliverable.")

# Potential future endpoints for pioneers:
# - GET /deliverables/{deliverable_id} (View specific deliverable details)
# - POST /deliverables/{deliverable_id}/request-extension (Placeholder)
# - GET /me/profile (View their pioneer application details - might be part of user profile or separate)
