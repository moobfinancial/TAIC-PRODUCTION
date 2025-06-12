import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg

from app.models.pioneer_application_models import (
    PioneerApplicationCreate,
    PioneerApplicationResponse
)
from app.db import get_db_connection, release_db_connection
# Assuming get_optional_current_user_id might exist in app.dependencies
# If not, a local placeholder might be needed or created in dependencies.py
# For this subtask, we'll assume it can be imported or defined simply.

# Placeholder for the dependency if not already available globally
# from app.dependencies import get_optional_current_user_id
async def get_optional_current_user_id() -> Optional[str]:
    """
    Placeholder dependency to simulate getting a user ID if a user is authenticated.
    In a real app, this would involve checking an optional authentication token.
    """
    # To simulate: return "test_user_id_123" or None
    return None

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Pioneer Program"],
)

@router.post(
    "/apply",
    response_model=PioneerApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Pioneer Program Application",
    description="""
Allows individuals to apply for the TAIC Pioneer Program.
- Applications are checked for uniqueness based on the provided email address.
- If the applicant is logged in while applying, their `user_id` will be associated with the application.
- All submitted applications start with a 'pending' status.
    """
)
async def submit_pioneer_application(
    application_data: PioneerApplicationCreate,
    current_user_id: Optional[str] = Depends(get_optional_current_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Check for duplicate application by email
        existing_application = await conn.fetchval(
            "SELECT id FROM pioneer_applications WHERE email = $1",
            application_data.email
        )
        if existing_application:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An application with this email address has already been submitted."
            )

        # Prepare data for insertion
        # `application_status` and `submitted_at` have defaults in DB schema
        # `id` is SERIAL
        # `updated_at` has a default and trigger
        # `reviewed_at`, `reviewed_by_admin_username`, `internal_review_notes` are NULL initially

        query = """
            INSERT INTO pioneer_applications (
                user_id, full_name, email, telegram_handle, discord_id, country_of_residence,
                applying_for_tier, primary_social_profile_link, follower_subscriber_count,
                secondary_social_profile_links, audience_demographics_description,
                engagement_statistics_overview, interest_reason, contribution_proposal,
                previous_programs_experience, taic_compatible_wallet_address,
                agreed_to_terms, agreed_to_token_vesting
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
            RETURNING id, user_id, full_name, email, telegram_handle, discord_id, country_of_residence,
                      applying_for_tier, primary_social_profile_link, follower_subscriber_count,
                      secondary_social_profile_links, audience_demographics_description,
                      engagement_statistics_overview, interest_reason, contribution_proposal,
                      previous_programs_experience, taic_compatible_wallet_address,
                      agreed_to_terms, agreed_to_token_vesting,
                      application_status, submitted_at -- Fetch DB defaults
        """

        # Convert HttpUrl to string for DB if necessary, though asyncpg might handle it.
        # Pydantic v2+ HttpUrl fields are Url type, str(url_obj) gives the string.
        primary_social_link_str = str(application_data.primary_social_profile_link) if application_data.primary_social_profile_link else None

        created_row = await conn.fetchrow(
            query,
            current_user_id, application_data.full_name, application_data.email,
            application_data.telegram_handle, application_data.discord_id, application_data.country_of_residence,
            application_data.applying_for_tier, primary_social_link_str,
            application_data.follower_subscriber_count, application_data.secondary_social_profile_links,
            application_data.audience_demographics_description, application_data.engagement_statistics_overview,
            application_data.interest_reason, application_data.contribution_proposal,
            application_data.previous_programs_experience, application_data.taic_compatible_wallet_address,
            application_data.agreed_to_terms, application_data.agreed_to_token_vesting
        )

        if not created_row:
            logger.error(f"Failed to insert pioneer application for email: {application_data.email}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Pioneer program application submission failed due to an internal error."
            )

        logger.info(f"Pioneer application submitted successfully for email: {created_row['email']}, ID: {created_row['id']}")

        return PioneerApplicationResponse(**dict(created_row))

    except HTTPException:
        raise # Re-raise HTTPExceptions directly
    except asyncpg.exceptions.UniqueViolationError: # Should be caught by the email check, but as a safeguard
        logger.warning(f"Unique violation during pioneer application for email {application_data.email} (should have been caught earlier).")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An application with this email address has already been submitted."
        )
    except Exception as e:
        logger.error(f"Unexpected error during pioneer application submission for {application_data.email}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during application submission."
        )
    finally:
        if conn: # conn might not be assigned if get_db_connection itself fails.
            await release_db_connection(conn)
