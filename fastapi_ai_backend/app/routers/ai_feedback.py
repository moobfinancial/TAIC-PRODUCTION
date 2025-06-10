import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
import json # For storing details as JSONB if it's a dict

from app.models.ai_feedback_models import AIAgentFeedbackCreate, AIAgentFeedbackResponse
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_optional_current_user_id # For optional user ID

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["AI Agent Feedback"],
    # prefix will be set in main.py, e.g., /api/ai
)

@router.post("/feedback", response_model=AIAgentFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_ai_agent_feedback(
    feedback_data: AIAgentFeedbackCreate,
    current_user_id: Optional[str] = Depends(get_optional_current_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """
    Submit feedback for an AI agent's recommendations or interactions.
    """
    try:
        # Pydantic model validation (especially root_validator) should have already
        # ensured consistency between feedback_type and rating_value.

        query = """
            INSERT INTO ai_agent_feedback
                (agent_name, session_id, user_query, recommendation_reference_id,
                 feedback_type, rating_value, comment_text, user_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING id, agent_name, session_id, user_query, recommendation_reference_id,
                      feedback_type, rating_value, comment_text, user_id, created_at
        """

        # Note: The 'details' column from the conceptual schema is not directly used here
        # as AIAgentFeedbackCreate doesn't have a 'details' field. If it were needed,
        # it would be passed as a JSON string or dict.

        created_feedback_row = await conn.fetchrow(
            query,
            feedback_data.agent_name,
            feedback_data.session_id,
            feedback_data.user_query,
            feedback_data.recommendation_reference_id,
            feedback_data.feedback_type,
            feedback_data.rating_value,
            feedback_data.comment_text,
            current_user_id
        )

        if not created_feedback_row:
            logger.error(f"Failed to insert AI agent feedback: {feedback_data.model_dump_json()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record feedback due to an internal error."
            )

        logger.info(f"AI agent feedback successfully recorded with ID: {created_feedback_row['id']}")

        return AIAgentFeedbackResponse(**dict(created_feedback_row))

    except asyncpg.exceptions.UndefinedTableError:
        logger.critical(
            "CRITICAL: 'ai_agent_feedback' table does not exist. Feedback submission failed. "
            "Please ensure database schema is up to date."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, # 503 as service is unavailable
            detail="Feedback system is temporarily unavailable. Please try again later."
        )
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Unexpected error submitting AI agent feedback: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while submitting feedback."
        )
    # Connection release is handled by FastAPI's dependency injection assuming get_db_connection is a generator.
    # If get_db_connection is not a generator, then a finally block with release_db_connection(conn) would be needed here.
    # Based on previous patterns, assuming DI handles it.
