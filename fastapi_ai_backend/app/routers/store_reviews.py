import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Query, Path
import asyncpg
from datetime import datetime # Required for response model

from app.models.store_review_models import (
    StoreReviewCreateBody,
    StoreReviewDBInput,
    StoreReviewResponse
)
from app.db import get_db_connection, release_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Store Reviews"],
    # prefix will be set in main.py, e.g., /api
)

# --- Placeholder Authentication Dependency ---
async def get_optional_current_user_id() -> Optional[str]:
    """
    Placeholder for a dependency that would extract the user_id
    from an authentication token if available. Returns None if user is not authenticated.
    """
    # In a real app, this would involve trying to decode a token and returning user_id or None.
    # For testing, can cycle through returning an ID or None:
    # import random
    # if random.choice([True, False]):
    #     return "placeholder_reviewer_001"
    return "placeholder_reviewer_001" # For now, consistently return a placeholder reviewer
    # return None # To test anonymous reviews

# --- Helper to check if merchant store exists ---
async def check_merchant_store_exists(conn: asyncpg.Connection, merchant_id: str):
    exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM merchant_store_profiles WHERE merchant_id = $1)", merchant_id)
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Merchant store with id '{merchant_id}' not found.")

# --- API Endpoints ---

@router.post(
    "/stores/{merchant_id}/reviews",
    response_model=StoreReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Store Review",
    description="""
Submits a new review for a specified merchant's store.
- The `merchant_id` is taken from the URL path.
- Review content (rating, title, text, reviewer_name) is provided in the request body.
- `reviewer_id` is automatically determined from the authentication context (if the user is logged in). If not logged in, it may be treated as an anonymous review depending on the `get_optional_current_user_id` dependency's behavior.
- New reviews are typically set to `is_approved = True` by default but could be subject to moderation.
- **Protected or Semi-Protected Endpoint:** Requires user authentication to associate review with a user; might allow anonymous posting with different handling.
    """
)
async def create_store_review(
    review_body: StoreReviewCreateBody,
    merchant_id: str = Path(..., description="The unique identifier of the merchant or store to review."),
    reviewer_id: Optional[str] = Depends(get_optional_current_user_id)
):
    conn = None
    try:
        conn = await get_db_connection()

        # Check if merchant store exists
        await check_merchant_store_exists(conn, merchant_id)

        # Prepare data for DB insertion
        review_db_input = StoreReviewDBInput(
            merchant_id=merchant_id,
            reviewer_id=reviewer_id,
            rating=review_body.rating,
            review_title=review_body.review_title,
            review_text=review_body.review_text,
            reviewer_name=review_body.reviewer_name if review_body.reviewer_name else ("Anonymous" if not reviewer_id else "User " + reviewer_id[:6]), # Basic logic for reviewer_name
            is_approved=True # Default as per model, change if moderation is implemented
        )

        query = """
            INSERT INTO store_reviews
                (merchant_id, reviewer_id, reviewer_name, rating, review_title, review_text, is_approved, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id, merchant_id, reviewer_id, reviewer_name, rating, review_title, review_text, is_approved, created_at, updated_at
        """

        created_review_row = await conn.fetchrow(
            query,
            review_db_input.merchant_id,
            review_db_input.reviewer_id,
            review_db_input.reviewer_name,
            review_db_input.rating,
            review_db_input.review_title,
            review_db_input.review_text,
            review_db_input.is_approved
        )

        if not created_review_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create store review.")

        return StoreReviewResponse(**dict(created_review_row))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating store review for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/stores/{merchant_id}/reviews",
    response_model=List[StoreReviewResponse],
    summary="List Store Reviews",
    description="""
Retrieves a list of approved reviews for a specific merchant's store.
- Supports pagination using `limit` and `offset` query parameters.
- Allows filtering by a minimum star `rating`.
- Only `is_approved = TRUE` reviews are returned to the general public.
- **Public Endpoint:** Typically, store reviews are public information.
    """
)
async def list_store_reviews_for_merchant(
    merchant_id: str = Path(..., description="The unique identifier of the merchant or store whose reviews are being listed."),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of reviews to return."),
    offset: int = Query(0, ge=0, description="Number of reviews to skip for pagination."),
    min_rating: Optional[int] = Query(default=None, ge=1, le=5, description="Filter reviews to include only those with this minimum rating (e.g., 3 for 3 stars and up).")
):
    conn = None
    try:
        conn = await get_db_connection()

        # Check if merchant store exists
        await check_merchant_store_exists(conn, merchant_id)

        base_query = """
            SELECT id, merchant_id, reviewer_id, reviewer_name, rating, review_title, review_text, is_approved, created_at, updated_at
            FROM store_reviews
        """
        filter_conditions = ["merchant_id = $1", "is_approved = TRUE"]
        params: List[Any] = [merchant_id]
        param_idx = 2 # Start indexing from $2 as $1 is merchant_id

        if min_rating is not None:
            filter_conditions.append(f"rating >= ${param_idx}")
            params.append(min_rating)
            param_idx += 1

        if filter_conditions:
            base_query += " WHERE " + " AND ".join(filter_conditions)

        base_query += f" ORDER BY created_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
        params.extend([limit, offset])

        review_rows = await conn.fetch(base_query, *params)

        return [StoreReviewResponse(**dict(row)) for row in review_rows]

    except HTTPException:
        raise
    except asyncpg.exceptions.UndefinedTableError as e:
        logger.error(f"Error listing store reviews: Table not found. Schema might be outdated. Details: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error accessing review data. Please try again later.")
    except Exception as e:
        logger.error(f"Error listing store reviews for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)
