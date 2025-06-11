import logging
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
from slugify import slugify # Using python-slugify, will add to requirements if not there

from app.models.store_profile_models import StoreProfile, StoreProfileCreate, StoreProfileUpdate
from app.db import get_db_connection, release_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Merchant Store Profiles"],
    # prefix will be set in main.py, e.g., /api/merchant
)

# --- Placeholder Authentication Dependency ---
async def get_current_merchant_id() -> str:
    """
    Placeholder for a dependency that would extract the merchant_id
    from an authentication token.
    """
    # In a real app, this would involve token decoding and user validation.
    # For now, it returns a fixed ID for testing.
    return "placeholder_merchant_001"

# --- Slug Generation Utility ---
async def generate_unique_slug(db_conn: asyncpg.Connection, store_name: str, merchant_id: str) -> str:
    """
    Generates a unique slug for a store.
    Appends a short suffix based on merchant_id if the base slug exists.
    """
    base_slug = slugify(store_name, lower=True, max_length=50) # python-slugify handles many edge cases
    if not base_slug: # Handle empty store_name or name that results in empty slug
        base_slug = "store"

    # Check for uniqueness
    slug_check_query = "SELECT 1 FROM merchant_store_profiles WHERE store_slug = $1"

    current_slug = base_slug
    counter = 1
    # Limit iterations to prevent infinite loops in unlikely scenarios
    max_attempts = 10

    while await db_conn.fetchval(slug_check_query, current_slug) and counter <= max_attempts:
        # If slug exists, try appending a suffix
        # Suffix using a part of merchant_id can be too long/ugly. Let's use counter first.
        if counter == 1: # First collision, try with short merchant_id hash or part
             # Use a small, relatively stable part of merchant_id if possible
            suffix = merchant_id.split('-')[-1][:4] if '-' in merchant_id else merchant_id[:4]
            current_slug = f"{base_slug}-{suffix}"
        else: # Subsequent collisions
            current_slug = f"{base_slug}-{counter}"
        counter += 1

    if counter > max_attempts:
        # Extremely unlikely with good base_slug and merchant_id parts, but a safeguard
        # Fallback to a more random suffix if many attempts fail
        import uuid
        current_slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"
        # Final check (optional, as UUID should be unique)
        if await db_conn.fetchval(slug_check_query, current_slug):
            raise HTTPException(status_code=500, detail="Failed to generate a unique store slug after multiple attempts.")

    return current_slug

# --- API Endpoints ---

@router.post(
    "/store-profile",
    response_model=StoreProfile,
    summary="Create or Update My Store Profile",
    description="""
Allows an authenticated merchant to create or update their store profile.
- This endpoint performs an **UPSERT** operation:
    - If a store profile for the merchant already exists, it's updated with the provided data.
    - If no profile exists, a new one is created.
- When creating a new profile, a unique `store_slug` is automatically generated from the `store_name`.
- If `store_name` is updated on an existing profile, the `store_slug` currently **does not change** automatically with this endpoint. Slug changes would require a separate mechanism.
- All fields from `StoreProfileCreate` can be provided. For updates, only changed fields need to be sent.
- **Protected Endpoint:** Requires merchant authentication. The `merchant_id` is derived from the authentication token.
    """,
    status_code=status.HTTP_200_OK # Or 201 if primarily for creation, but UPSERT often uses 200
)
async def create_or_update_store_profile(
    profile_data: StoreProfileCreate,
    merchant_id: str = Depends(get_current_merchant_id)
):
    conn = None
    try:
        conn = await get_db_connection()

        existing_profile_row = await conn.fetchrow(
            "SELECT * FROM merchant_store_profiles WHERE merchant_id = $1",
            merchant_id
        )

        if existing_profile_row:
            # --- UPDATE existing profile ---
            logger.info(f"Updating store profile for merchant_id: {merchant_id}")
            update_model = StoreProfileUpdate(**profile_data.model_dump()) # Convert Create to Update
            update_data = update_model.model_dump(exclude_unset=True)

            # Slug does not change on name update in this version.
            # If store_name is updated, slug remains the same.
            # A separate endpoint or admin tool could manage slug changes if needed.

            if not update_data: # No actual data sent for update
                 return StoreProfile(**dict(existing_profile_row))


            set_clauses = []
            params = []
            param_idx = 1
            for field, value in update_data.items():
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1

            params.append(merchant_id) # For WHERE merchant_id = $N

            update_query = f"""
                UPDATE merchant_store_profiles
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE merchant_id = ${param_idx}
                RETURNING *
            """
            updated_row = await conn.fetchrow(update_query, *params)
            if not updated_row: # Should not happen if existing_profile_row was found
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update store profile.")
            return StoreProfile(**dict(updated_row))

        else:
            # --- CREATE new profile ---
            logger.info(f"Creating new store profile for merchant_id: {merchant_id}")
            store_slug = await generate_unique_slug(conn, profile_data.store_name, merchant_id)

            insert_query = """
                INSERT INTO merchant_store_profiles
                    (merchant_id, store_slug, store_name, store_description, banner_url, logo_url, custom_settings)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            """
            # Using model_dump to get values from profile_data which is StoreProfileCreate
            new_row = await conn.fetchrow(
                insert_query,
                merchant_id,
                store_slug,
                profile_data.store_name,
                profile_data.store_description,
                str(profile_data.banner_url) if profile_data.banner_url else None,
                str(profile_data.logo_url) if profile_data.logo_url else None,
                profile_data.custom_settings
            )
            if not new_row:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create store profile.")
            return StoreProfile(**dict(new_row))

    except asyncpg.exceptions.UniqueViolationError as e:
        logger.error(f"Unique constraint error for merchant {merchant_id}: {e}")
        # This might happen if generate_unique_slug has a race condition or issue,
        # or if store_name + merchant_id combination has other unique constraints not handled by slug.
        # The current slug generation aims to prevent this for store_slug.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Store profile creation/update failed due to a conflict: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating/updating store profile for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/store-profile/mine",
    response_model=StoreProfile,
    summary="Get My Store Profile",
    description="""
Retrieves the store profile for the currently authenticated merchant.
- **Protected Endpoint:** Requires merchant authentication. The `merchant_id` is derived from the token.
- Returns a 404 error if the merchant has not yet created a store profile.
    """
)
async def get_my_store_profile(merchant_id: str = Depends(get_current_merchant_id)):
    conn = None
    try:
        conn = await get_db_connection()
        profile_row = await conn.fetchrow(
            "SELECT * FROM merchant_store_profiles WHERE merchant_id = $1",
            merchant_id
        )
        if not profile_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store profile not found for your account. Please create one.")
        return StoreProfile(**dict(profile_row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching store profile for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/store-profile/slug/{store_slug}",
    response_model=StoreProfile,
    summary="Get Store Profile by Slug (Public)",
    description="""
Retrieves a merchant's store profile using its publicly accessible `store_slug`.
- This endpoint is intended for public use (e.g., displaying store pages).
- Returns a 404 error if no store profile matches the given slug.
    """
)
async def get_store_profile_by_slug(
    store_slug: str = Path(..., description="The URL-friendly slug of the store to retrieve.")
):
    conn = None
    try:
        conn = await get_db_connection()
        profile_row = await conn.fetchrow(
            "SELECT * FROM merchant_store_profiles WHERE store_slug = $1",
            store_slug
        )
        if not profile_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Store with slug '{store_slug}' not found.")
        return StoreProfile(**dict(profile_row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching store profile by slug {store_slug}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)
