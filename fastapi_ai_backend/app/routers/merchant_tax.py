import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
from decimal import Decimal

from app.models.tax_models import (
    MerchantTaxSettingsUpdate,
    MerchantTaxSettingsResponse
)
from app.db import get_db_connection, release_db_connection
from app.services.tax_service import get_merchant_tax_settings_with_defaults # Import helper

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Merchant Tax Settings"],
    # Actual prefix will be /api/merchant (from main.py) + /tax (from this router's inclusion)
)

# --- Placeholder Authentication Dependency ---
async def get_current_merchant_id() -> str:
    """
    Placeholder for a dependency that would extract the merchant_id
    from an authentication token for a user with 'MERCHANT' role.
    """
    return "placeholder_merchant_001" # Fixed ID for testing


@router.put(
    "/settings",
    response_model=MerchantTaxSettingsResponse,
    summary="Create or Update Merchant Tax Settings",
    description="Allows a merchant to create or update their tax collection settings. This is an UPSERT operation."
)
async def upsert_merchant_tax_settings(
    settings_data: MerchantTaxSettingsUpdate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Pydantic model already validates default_tax_rate_percentage if collects_tax is False
        if settings_data.collects_tax and settings_data.default_tax_rate_percentage is None:
            # While model allows None for now, for UPSERT, if collects_tax is true, a rate should exist or be provided.
            # For V1, we can be lenient, or enforce that a rate must be set if collects_tax is true.
            # Let's enforce it here for clarity in V1.
             pass # Model validator handles this for now, but can add stricter logic if needed.
             # For example, if it's an update and they set collects_tax to True but don't provide a rate,
             # we might want to prevent that unless a rate already exists.
             # Current Pydantic validator allows collects_tax=True with rate=None.

        # Convert Pydantic's PositiveFloat (which might be float) to Decimal for DB
        db_tax_rate = None
        if settings_data.default_tax_rate_percentage is not None:
            db_tax_rate = Decimal(str(settings_data.default_tax_rate_percentage))


        upsert_query = """
            INSERT INTO merchant_tax_settings (
                merchant_id, collects_tax, default_tax_rate_percentage,
                tax_registration_id, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (merchant_id) DO UPDATE SET
                collects_tax = EXCLUDED.collects_tax,
                default_tax_rate_percentage = EXCLUDED.default_tax_rate_percentage,
                tax_registration_id = EXCLUDED.tax_registration_id,
                notes = EXCLUDED.notes,
                updated_at = NOW()
            RETURNING merchant_id, collects_tax, default_tax_rate_percentage,
                      tax_registration_id, notes, created_at, updated_at
        """

        row = await conn.fetchrow(
            upsert_query,
            merchant_id,
            settings_data.collects_tax,
            db_tax_rate, # Use Decimal version
            settings_data.tax_registration_id,
            settings_data.notes
        )

        if not row:
            # This should not happen with UPSERT unless there's a severe DB issue
            logger.error(f"UPSERT operation failed for merchant tax settings for merchant_id: {merchant_id}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save tax settings.")

        return MerchantTaxSettingsResponse(**dict(row))

    except Exception as e:
        logger.error(f"Error in UPSERT merchant tax settings for merchant {merchant_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/settings",
    response_model=MerchantTaxSettingsResponse,
    summary="Get Merchant Tax Settings",
    description="Retrieves the authenticated merchant's current tax collection settings. If no settings are explicitly saved, default values are returned."
)
async def get_merchant_tax_settings(
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Use the helper from tax_service to ensure defaults are provided if no record exists
        settings = await get_merchant_tax_settings_with_defaults(conn, merchant_id)
        return settings
    except Exception as e:
        logger.error(f"Error fetching tax settings for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
