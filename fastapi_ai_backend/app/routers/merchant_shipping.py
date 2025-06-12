import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Path, Query
import asyncpg

from app.models.shipping_models import (
    MerchantShippingMethodCreate,
    MerchantShippingMethodUpdate,
    MerchantShippingMethodResponse,
    ShippingZoneCreate,
    ShippingZoneResponse,
    ShippingZoneUpdate,
    ShippingZoneDetailResponse,
    ShippingZoneLocationCreate,
    ShippingZoneLocationResponse,
    # ShippingZoneLocationCreateBulk, # For later if implementing bulk location add
    ShippingRateCreate,
    ShippingRateUpdate,
    ShippingRateResponse
)
from app.db import get_db_connection, release_db_connection
# For Path parameters
from fastapi import Path as FastApiPath # Renamed to avoid conflict with standard Path

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Merchant Shipping Management"],
    # Actual prefix will be /api/merchant (from main.py) + /shipping (from this router's inclusion)
    # So endpoints will be like /api/merchant/shipping/methods
)

# --- Placeholder Authentication Dependency ---
async def get_current_merchant_id() -> str:
    """
    Placeholder for a dependency that would extract the merchant_id
    from an authentication token for a user with 'MERCHANT' role.
    """
    return "placeholder_merchant_001" # Fixed ID for testing

# --- Helper function to check shipping method ownership ---
async def get_merchant_shipping_method(
    method_id: int,
    merchant_id: str,
    conn: asyncpg.Connection
) -> asyncpg.Record:
    method_row = await conn.fetchrow(
        "SELECT * FROM merchant_shipping_methods WHERE id = $1 AND merchant_id = $2",
        method_id, merchant_id
    )
    if not method_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipping method with ID {method_id} not found or does not belong to this merchant."
        )
    return method_row

# --- Helper function to check shipping zone ownership (via method) ---
async def get_merchant_shipping_zone(
    zone_id: int,
    merchant_id: str,
    conn: asyncpg.Connection
) -> asyncpg.Record:
    zone_row = await conn.fetchrow(
        """
        SELECT sz.*
        FROM shipping_zones sz
        JOIN merchant_shipping_methods msm ON sz.shipping_method_id = msm.id
        WHERE sz.id = $1 AND msm.merchant_id = $2
        """,
        zone_id, merchant_id
    )
    if not zone_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipping zone with ID {zone_id} not found or does not belong to this merchant."
        )
    return zone_row


# --- Merchant Shipping Methods Endpoints ---

@router.post(
    "/methods",
    response_model=MerchantShippingMethodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Shipping Method",
    description="Allows a merchant to create a new shipping method (e.g., 'Standard Ground', 'Express')."
)
async def create_shipping_method(
    method_data: MerchantShippingMethodCreate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        query = """
            INSERT INTO merchant_shipping_methods (merchant_id, method_name, is_active)
            VALUES ($1, $2, $3)
            RETURNING id, merchant_id, method_name, is_active, created_at, updated_at
        """
        row = await conn.fetchrow(
            query,
            merchant_id,
            method_data.method_name,
            method_data.is_active
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create shipping method.")
        return MerchantShippingMethodResponse(**dict(row))
    except asyncpg.exceptions.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A shipping method with the name '{method_data.method_name}' already exists for this merchant."
        )
    except Exception as e:
        logger.error(f"Error creating shipping method for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/methods",
    response_model=List[MerchantShippingMethodResponse],
    summary="List Merchant's Shipping Methods",
    description="Retrieves all shipping methods created by the currently authenticated merchant."
)
async def list_shipping_methods(
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection),
    is_active: Optional[bool] = Query(default=None, description="Optionally filter by active status (true or false).")
):
    try:
        base_query = "SELECT * FROM merchant_shipping_methods WHERE merchant_id = $1"
        params: List[Any] = [merchant_id]
        param_idx = 2
        if is_active is not None:
            base_query += f" AND is_active = ${param_idx}"
            params.append(is_active)
            param_idx +=1
        base_query += " ORDER BY method_name ASC"

        rows = await conn.fetch(base_query, *params)
        return [MerchantShippingMethodResponse(**dict(row)) for row in rows]
    except Exception as e:
        logger.error(f"Error listing shipping methods for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/methods/{method_id}",
    response_model=MerchantShippingMethodResponse,
    summary="Get Specific Shipping Method",
    description="Retrieves details of a specific shipping method belonging to the authenticated merchant."
)
async def get_shipping_method(
    method_id: int = FastApiPath(..., description="ID of the shipping method to retrieve."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Use helper for consistent check and fetch
        method_row = await get_merchant_shipping_method(method_id, merchant_id, conn)
        return MerchantShippingMethodResponse(**dict(method_row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shipping method {method_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put(
    "/methods/{method_id}",
    response_model=MerchantShippingMethodResponse,
    summary="Update Shipping Method",
    description="Allows a merchant to update the name or active status of their shipping method."
)
async def update_shipping_method(
    method_id: int = FastApiPath(..., description="ID of the shipping method to update."),
    method_data: MerchantShippingMethodUpdate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        update_payload = method_data.model_dump(exclude_unset=True)
        if not update_payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_payload.keys())]
        params = list(update_payload.values())

        # Add merchant_id and method_id for WHERE clause, and updated_at
        params.extend([merchant_id, method_id])

        query = f"""
            UPDATE merchant_shipping_methods
            SET {', '.join(set_clauses)}, updated_at = NOW()
            WHERE merchant_id = ${len(params)-1} AND id = ${len(params)}
            RETURNING *
        """
        updated_row = await conn.fetchrow(query, *params)

        if not updated_row:
            # Check if the method ID itself is valid for this merchant before assuming it's just "no update happened"
            exists_check = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM merchant_shipping_methods WHERE id = $1 AND merchant_id = $2)", method_id, merchant_id)
            if not exists_check:
                 raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipping method with ID {method_id} not found or does not belong to this merchant.")
            # If it exists but was not updated (e.g. data sent matched current data), it could still return the current state.
            # However, RETURNING * should return if the WHERE clause matched, regardless of whether values changed.
            # So, if updated_row is None here, it means the WHERE clause didn't match (likely wrong merchant_id for method_id).
            # The above check handles this. If it still is None, then it's an issue.
            logger.warning(f"Update for shipping method {method_id} by merchant {merchant_id} did not return data, though it might exist.")
            # Re-fetch to be sure, or rely on the 404 from exists_check. For now, assume 404 logic is primary.
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipping method with ID {method_id} not found for update, or no effective changes made if data was identical.")


        return MerchantShippingMethodResponse(**dict(updated_row))
    except asyncpg.exceptions.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A shipping method with the name '{method_data.method_name}' already exists for this merchant."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shipping method {method_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete(
    "/methods/{method_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Shipping Method",
    description="Deletes a shipping method for the authenticated merchant. This will also delete associated shipping zones and rates due to CASCADE constraints."
)
async def delete_shipping_method(
    method_id: int = FastApiPath(..., description="ID of the shipping method to delete."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure the method belongs to the merchant before deleting (implicitly done by WHERE clause)
        result = await conn.execute(
            "DELETE FROM merchant_shipping_methods WHERE id = $1 AND merchant_id = $2",
            method_id, merchant_id
        )
        if result == "DELETE 0": # No rows deleted because it didn't exist or didn't belong to merchant
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipping method with ID {method_id} not found or does not belong to this merchant.")
        # No explicit return for 204 (FastAPI handles this for 204 status code)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting shipping method {method_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Shipping Zones Endpoints ---

@router.post(
    "/methods/{method_id}/zones",
    response_model=ShippingZoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Shipping Zone",
    description="Creates a new shipping zone under a specified shipping method for the merchant."
)
async def create_shipping_zone(
    method_id: int = FastApiPath(..., description="ID of the parent shipping method."),
    zone_data: ShippingZoneCreate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure parent shipping method exists and belongs to the merchant
        await get_merchant_shipping_method(method_id, merchant_id, conn)

        query = """
            INSERT INTO shipping_zones (shipping_method_id, zone_name)
            VALUES ($1, $2)
            RETURNING id, shipping_method_id, zone_name, created_at, updated_at
        """
        row = await conn.fetchrow(query, method_id, zone_data.zone_name)
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create shipping zone.")
        return ShippingZoneResponse(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating shipping zone for method {method_id}, merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/methods/{method_id}/zones",
    response_model=List[ShippingZoneResponse],
    summary="List Shipping Zones for Method",
    description="Lists all shipping zones associated with a specific shipping method of the merchant."
)
async def list_shipping_zones_for_method(
    method_id: int = FastApiPath(..., description="ID of the parent shipping method."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure parent shipping method exists and belongs to the merchant
        await get_merchant_shipping_method(method_id, merchant_id, conn)

        query = "SELECT * FROM shipping_zones WHERE shipping_method_id = $1 ORDER BY zone_name ASC"
        rows = await conn.fetch(query, method_id)
        return [ShippingZoneResponse(**dict(row)) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing shipping zones for method {method_id}, merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/zones/{zone_id}",
    response_model=ShippingZoneDetailResponse, # Includes locations
    summary="Get Specific Shipping Zone with Details",
    description="Retrieves details of a specific shipping zone, including its defined locations. Ensures the zone belongs to the merchant."
)
async def get_shipping_zone_detail(
    zone_id: int = FastApiPath(..., description="ID of the shipping zone to retrieve."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        zone_row = await get_merchant_shipping_zone(zone_id, merchant_id, conn) # Verifies ownership

        locations_query = "SELECT * FROM shipping_zone_locations WHERE shipping_zone_id = $1 ORDER BY country_code, state_province_code, postal_code_pattern"
        location_rows = await conn.fetch(locations_query, zone_id)

        zone_detail = ShippingZoneDetailResponse(**dict(zone_row))
        zone_detail.locations = [ShippingZoneLocationResponse(**dict(loc_row)) for loc_row in location_rows]

        rates_query = "SELECT * FROM shipping_rates WHERE shipping_zone_id = $1 ORDER BY base_rate ASC"
        rate_rows = await conn.fetch(rates_query, zone_id)
        zone_detail.rates = [ShippingRateResponse(**dict(rate_row)) for rate_row in rate_rows]

        return zone_detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shipping zone detail {zone_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put(
    "/zones/{zone_id}",
    response_model=ShippingZoneResponse,
    summary="Update Shipping Zone",
    description="Allows a merchant to update the name of their shipping zone."
)
async def update_shipping_zone(
    zone_id: int = FastApiPath(..., description="ID of the shipping zone to update."),
    zone_data: ShippingZoneUpdate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure zone exists and belongs to merchant
        await get_merchant_shipping_zone(zone_id, merchant_id, conn)

        update_payload = zone_data.model_dump(exclude_unset=True)
        if not update_payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_payload.keys())]
        params = list(update_payload.values())
        params.append(zone_id)

        query = f"""
            UPDATE shipping_zones
            SET {', '.join(set_clauses)}, updated_at = NOW()
            WHERE id = ${len(params)}
            RETURNING *
        """
        updated_row = await conn.fetchrow(query, *params)
        if not updated_row: # Should be caught by initial check
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipping zone with ID {zone_id} not found during update attempt.")
        return ShippingZoneResponse(**dict(updated_row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shipping zone {zone_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete(
    "/zones/{zone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Shipping Zone",
    description="Deletes a shipping zone for the merchant. Associated locations and rates will also be deleted due to CASCADE constraints."
)
async def delete_shipping_zone(
    zone_id: int = FastApiPath(..., description="ID of the shipping zone to delete."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure zone exists and belongs to merchant before deleting
        await get_merchant_shipping_zone(zone_id, merchant_id, conn)

        result = await conn.execute("DELETE FROM shipping_zones WHERE id = $1", zone_id)
        # No need to check result count if get_merchant_shipping_zone passed,
        # as it confirms existence and ownership. If it didn't exist, that would have raised 404.
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting shipping zone {zone_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Shipping Zone Locations Endpoints ---

@router.post(
    "/zones/{zone_id}/locations",
    response_model=ShippingZoneLocationResponse, # For single creation
    status_code=status.HTTP_201_CREATED,
    summary="Add Location to Shipping Zone",
    description="Adds a new location definition (country, state/province, postal code pattern) to a shipping zone."
)
async def add_location_to_zone(
    zone_id: int = FastApiPath(..., description="ID of the shipping zone to add location(s) to."),
    location_data: ShippingZoneLocationCreate, # Single location for now
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure zone exists and belongs to merchant
        await get_merchant_shipping_zone(zone_id, merchant_id, conn)

        query = """
            INSERT INTO shipping_zone_locations
                (shipping_zone_id, country_code, state_province_code, postal_code_pattern)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        """
        # Normalize optional fields to None if empty string, though Pydantic usually handles this.
        state_province = location_data.state_province_code if location_data.state_province_code and location_data.state_province_code.strip() else None
        postal_pattern = location_data.postal_code_pattern if location_data.postal_code_pattern and location_data.postal_code_pattern.strip() else None

        row = await conn.fetchrow(
            query,
            zone_id,
            location_data.country_code.upper(), # Standardize country code
            state_province,
            postal_pattern
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add location to shipping zone.")
        return ShippingZoneLocationResponse(**dict(row))
    except asyncpg.exceptions.UniqueViolationError:
         raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This exact location definition (country, state, postal pattern combination) already exists in this zone."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding location to zone {zone_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete(
    "/locations/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove Location from Shipping Zone",
    description="Removes a specific location definition from a shipping zone."
)
async def remove_location_from_zone(
    location_id: int = FastApiPath(..., description="ID of the shipping zone location entry to delete."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Check ownership: fetch location and its parent zone, then check zone's parent method's merchant_id
        location_check_row = await conn.fetchrow(
            """
            SELECT szl.id
            FROM shipping_zone_locations szl
            JOIN shipping_zones sz ON szl.shipping_zone_id = sz.id
            JOIN merchant_shipping_methods msm ON sz.shipping_method_id = msm.id
            WHERE szl.id = $1 AND msm.merchant_id = $2
            """,
            location_id, merchant_id
        )
        if not location_check_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipping location with ID {location_id} not found or does not belong to this merchant.")

        await conn.execute("DELETE FROM shipping_zone_locations WHERE id = $1", location_id)
        # No result check needed if the above fetch confirmed existence.
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing location {location_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Helper function to check shipping rate ownership (via zone and method) ---
async def get_merchant_shipping_rate(
    rate_id: int,
    merchant_id: str,
    conn: asyncpg.Connection
) -> asyncpg.Record:
    rate_row = await conn.fetchrow(
        """
        SELECT sr.*
        FROM shipping_rates sr
        JOIN shipping_zones sz ON sr.shipping_zone_id = sz.id
        JOIN merchant_shipping_methods msm ON sz.shipping_method_id = msm.id
        WHERE sr.id = $1 AND msm.merchant_id = $2
        """,
        rate_id, merchant_id
    )
    if not rate_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipping rate with ID {rate_id} not found or does not belong to this merchant."
        )
    return rate_row

# --- Shipping Rates Endpoints ---

@router.post(
    "/zones/{zone_id}/rates",
    response_model=ShippingRateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Shipping Rate for Zone",
    description="Creates a new shipping rate for a specific shipping zone owned by the merchant."
)
async def create_shipping_rate(
    zone_id: int = FastApiPath(..., description="ID of the shipping zone to add this rate to."),
    rate_data: ShippingRateCreate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure zone exists and belongs to merchant
        await get_merchant_shipping_zone(zone_id, merchant_id, conn)

        query = """
            INSERT INTO shipping_rates (
                shipping_zone_id, rate_name,
                condition_min_order_value, condition_max_order_value,
                condition_min_weight_kg, condition_max_weight_kg,
                base_rate, rate_per_kg, is_free_shipping
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        """
        row = await conn.fetchrow(
            query,
            zone_id, rate_data.rate_name,
            rate_data.condition_min_order_value, rate_data.condition_max_order_value,
            rate_data.condition_min_weight_kg, rate_data.condition_max_weight_kg,
            rate_data.base_rate, rate_data.rate_per_kg, rate_data.is_free_shipping
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create shipping rate.")
        return ShippingRateResponse(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating shipping rate for zone {zone_id}, merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/zones/{zone_id}/rates",
    response_model=List[ShippingRateResponse],
    summary="List Shipping Rates for Zone",
    description="Lists all shipping rates associated with a specific shipping zone owned by the merchant."
)
async def list_shipping_rates_for_zone(
    zone_id: int = FastApiPath(..., description="ID of the shipping zone."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure zone exists and belongs to merchant
        await get_merchant_shipping_zone(zone_id, merchant_id, conn)

        query = "SELECT * FROM shipping_rates WHERE shipping_zone_id = $1 ORDER BY base_rate ASC"
        rows = await conn.fetch(query, zone_id)
        return [ShippingRateResponse(**dict(row)) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing shipping rates for zone {zone_id}, merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/rates/{rate_id}",
    response_model=ShippingRateResponse,
    summary="Get Specific Shipping Rate",
    description="Retrieves details of a specific shipping rate, ensuring it belongs to the merchant."
)
async def get_shipping_rate(
    rate_id: int = FastApiPath(..., description="ID of the shipping rate to retrieve."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        rate_row = await get_merchant_shipping_rate(rate_id, merchant_id, conn) # Verifies ownership
        return ShippingRateResponse(**dict(rate_row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shipping rate {rate_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put(
    "/rates/{rate_id}",
    response_model=ShippingRateResponse,
    summary="Update Shipping Rate",
    description="Allows a merchant to update the details of their shipping rate."
)
async def update_shipping_rate(
    rate_id: int = FastApiPath(..., description="ID of the shipping rate to update."),
    rate_data: ShippingRateUpdate,
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure rate exists and belongs to merchant
        await get_merchant_shipping_rate(rate_id, merchant_id, conn)

        update_payload = rate_data.model_dump(exclude_unset=True)
        if not update_payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_payload.keys())]
        params = list(update_payload.values())
        params.append(rate_id)

        query = f"""
            UPDATE shipping_rates
            SET {', '.join(set_clauses)}, updated_at = NOW()
            WHERE id = ${len(params)}
            RETURNING *
        """
        updated_row = await conn.fetchrow(query, *params)
        if not updated_row: # Should be caught by initial check
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipping rate with ID {rate_id} not found during update attempt.")
        return ShippingRateResponse(**dict(updated_row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shipping rate {rate_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete(
    "/rates/{rate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Shipping Rate",
    description="Deletes a specific shipping rate for the merchant."
)
async def delete_shipping_rate(
    rate_id: int = FastApiPath(..., description="ID of the shipping rate to delete."),
    merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Ensure rate exists and belongs to merchant before deleting
        await get_merchant_shipping_rate(rate_id, merchant_id, conn)

        await conn.execute("DELETE FROM shipping_rates WHERE id = $1", rate_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting shipping rate {rate_id} for merchant {merchant_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# Conceptual note for Checkout Integration Logic:
# When a user proceeds to checkout with a given shipping address and cart:
# 1. Determine the merchant(s) for items in the cart.
# 2. For each merchant:
#    a. Resolve the destination country_code, state_province_code, postal_code from the shipping address.
#    b. Query `merchant_shipping_methods` for this merchant where `is_active = TRUE`.
#    c. For each active method, query `shipping_zones` linked to it.
#    d. For each zone, query `shipping_zone_locations` to see if the destination address matches any location definition
#       (country, state/province, postal code pattern). This can be complex:
#       - Exact match for country.
#       - If state/province is defined, it must match. If NULL in DB, it matches any state/province within the country.
#       - If postal_code_pattern is defined, it must match. If NULL, it matches any postal code within the country/state.
#       - A hierarchy of matches might be needed (most specific wins).
#    e. If a matching zone is found:
#       i. Calculate total order value and weight for items from this merchant.
#       ii. Query `shipping_rates` for that `shipping_zone_id`.
#       iii. Filter rates based on conditions (order value, weight). Multiple rates might apply (e.g., base + per_kg).
#       iv. Select the best/cheapest applicable rate, or present options to the user.
#       v. If `is_free_shipping` is true on an applicable rate, shipping cost is 0.
# 3. Aggregate shipping costs from all merchants if it's a multi-merchant cart.
# This logic would likely reside in an order processing service or a dedicated shipping calculation service.
# The `products` table might need a `weight_kg` column and potentially dimensions for more advanced rate calculations.
# The `product_variants` table could also have specific weights.
# The `external_shipping_rules_id` on products could link to a more complex external shipping rule system if needed.
# For CJ Dropshipping items, their API would be the source of truth for shipping costs.
# This internal system is primarily for merchants defining their own shipping.
