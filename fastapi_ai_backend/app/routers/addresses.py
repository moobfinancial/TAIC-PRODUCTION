import logging
import json # For handling JSONB conversion if needed, though asyncpg handles dicts well
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Path as FastApiPath, Response
import asyncpg

from app.models.address_models import (
    UserAddressCreate,
    UserAddressUpdate,
    UserAddressResponse,
    SpecialDeliveryInstructionsSchema # For type hinting if needed
)
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["User Addresses"],
    prefix="/users/me/addresses" # Prefix for all endpoints in this router
)

# --- Helper function to fetch an address and verify ownership ---
async def get_address_and_verify_ownership(
    address_id: int,
    user_id: str,
    conn: asyncpg.Connection
) -> asyncpg.Record:
    address_row = await conn.fetchrow(
        "SELECT * FROM user_addresses WHERE id = $1 AND user_id = $2",
        address_id, user_id
    )
    if not address_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Address with ID {address_id} not found or does not belong to the current user."
        )
    return address_row

# --- Helper function to unset other default addresses ---
async def unset_other_default_addresses(
    conn: asyncpg.Connection,
    user_id: str,
    exclude_address_id: Optional[int] = None # Address ID to NOT unset (e.g., the one being set to default)
):
    query = "UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1 AND is_default = TRUE"
    params = [user_id]
    if exclude_address_id is not None:
        query += " AND id != $2"
        params.append(exclude_address_id)
    await conn.execute(query, *params)


@router.post(
    "/",
    response_model=UserAddressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Address",
    description="Adds a new shipping address for the authenticated user. If `is_default` is true, other addresses will be marked as non-default."
)
async def create_user_address(
    address_data: UserAddressCreate,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        async with conn.transaction():
            if address_data.is_default:
                await unset_other_default_addresses(conn, current_user_id)

            # Convert Pydantic model for special_delivery_instructions to dict for JSONB
            special_instructions_dict = address_data.special_delivery_instructions.model_dump(exclude_none=True) \
                if address_data.special_delivery_instructions else None

            query = """
                INSERT INTO user_addresses (
                    user_id, address_nickname, contact_name, full_address_str,
                    property_type, is_default, special_delivery_instructions
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, user_id, address_nickname, contact_name, full_address_str,
                          property_type, is_default, special_delivery_instructions,
                          created_at, updated_at
            """
            row = await conn.fetchrow(
                query,
                current_user_id,
                address_data.address_nickname,
                address_data.contact_name,
                address_data.full_address_str,
                address_data.property_type,
                address_data.is_default if address_data.is_default is not None else False, # Ensure boolean
                json.dumps(special_instructions_dict) if special_instructions_dict else None
            )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create address.")

        # Parse special_delivery_instructions from JSON string if it's not None
        response_data = dict(row)
        if response_data.get('special_delivery_instructions') and isinstance(response_data['special_delivery_instructions'], str):
            response_data['special_delivery_instructions'] = json.loads(response_data['special_delivery_instructions'])

        return UserAddressResponse(**response_data)
    except Exception as e:
        logger.error(f"Error creating address for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")


@router.get(
    "/",
    response_model=List[UserAddressResponse],
    summary="List User Addresses",
    description="Retrieves all shipping addresses for the authenticated user, ordered by default status and then by most recently updated."
)
async def list_user_addresses(
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        query = """
            SELECT id, user_id, address_nickname, contact_name, full_address_str,
                   property_type, is_default, special_delivery_instructions,
                   created_at, updated_at
            FROM user_addresses
            WHERE user_id = $1
            ORDER BY is_default DESC, updated_at DESC
        """
        rows = await conn.fetch(query, current_user_id)

        response_list = []
        for row in rows:
            response_data = dict(row)
            if response_data.get('special_delivery_instructions') and isinstance(response_data['special_delivery_instructions'], str):
                 response_data['special_delivery_instructions'] = json.loads(response_data['special_delivery_instructions'])
            response_list.append(UserAddressResponse(**response_data))
        return response_list
    except Exception as e:
        logger.error(f"Error listing addresses for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve addresses.")


@router.get(
    "/{address_id}",
    response_model=UserAddressResponse,
    summary="Get Specific Address",
    description="Retrieves a specific shipping address by its ID for the authenticated user."
)
async def get_user_address(
    address_id: int = FastApiPath(..., description="ID of the address to retrieve."),
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        address_row = await get_address_and_verify_ownership(address_id, current_user_id, conn)

        response_data = dict(address_row)
        if response_data.get('special_delivery_instructions') and isinstance(response_data['special_delivery_instructions'], str):
            response_data['special_delivery_instructions'] = json.loads(response_data['special_delivery_instructions'])

        return UserAddressResponse(**response_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting address {address_id} for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve address.")


@router.put(
    "/{address_id}",
    response_model=UserAddressResponse,
    summary="Update Address",
    description="Updates an existing shipping address for the authenticated user. If `is_default` is set to true, other addresses will be marked as non-default."
)
async def update_user_address(
    address_data: UserAddressUpdate,
    address_id: int = FastApiPath(..., description="ID of the address to update."),
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        async with conn.transaction():
            # Verify ownership first
            await get_address_and_verify_ownership(address_id, current_user_id, conn)

            update_payload = address_data.model_dump(exclude_unset=True)
            if not update_payload:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update fields provided.")

            if address_data.is_default is True:
                await unset_other_default_addresses(conn, current_user_id, exclude_address_id=address_id)

            # Handle special_delivery_instructions separately for JSON conversion
            special_instructions_update = None
            if 'special_delivery_instructions' in update_payload:
                if update_payload['special_delivery_instructions'] is not None:
                    special_instructions_update = json.dumps(update_payload['special_delivery_instructions'])
                else: # Explicitly setting to null
                    special_instructions_update = None
                update_payload['special_delivery_instructions'] = special_instructions_update


            set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_payload.keys())]
            sql_params = list(update_payload.values())

            set_clauses.append("updated_at = NOW()")
            sql_params.extend([address_id, current_user_id]) # For WHERE clause

            query = f"""
                UPDATE user_addresses
                SET {', '.join(set_clauses)}
                WHERE id = ${len(sql_params)-1} AND user_id = ${len(sql_params)}
                RETURNING id, user_id, address_nickname, contact_name, full_address_str,
                          property_type, is_default, special_delivery_instructions,
                          created_at, updated_at
            """
            updated_row = await conn.fetchrow(query, *sql_params)

        if not updated_row:
            # This should ideally be caught by the ownership check if the ID is wrong,
            # or if no actual change happened and RETURNING behaves that way (though it shouldn't)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Failed to update address or address not found.")

        response_data = dict(updated_row)
        if response_data.get('special_delivery_instructions') and isinstance(response_data['special_delivery_instructions'], str):
            response_data['special_delivery_instructions'] = json.loads(response_data['special_delivery_instructions'])

        return UserAddressResponse(**response_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating address {address_id} for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")


@router.delete(
    "/{address_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Address",
    description="Deletes a specific shipping address for the authenticated user."
)
async def delete_user_address(
    address_id: int = FastApiPath(..., description="ID of the address to delete."),
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Verify ownership before deleting
        await get_address_and_verify_ownership(address_id, current_user_id, conn)

        result = await conn.execute("DELETE FROM user_addresses WHERE id = $1 AND user_id = $2", address_id, current_user_id)
        if result == "DELETE 0": # Should be caught by ownership check
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found or already deleted.")
        # No content to return for 204
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting address {address_id} for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete address.")


@router.post(
    "/{address_id}/set-default",
    response_model=UserAddressResponse,
    summary="Set Address as Default",
    description="Marks a specific address as the default for the authenticated user. Any other address previously marked as default will be unset."
)
async def set_default_user_address(
    address_id: int = FastApiPath(..., description="ID of the address to set as default."),
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        async with conn.transaction():
            # Verify ownership
            await get_address_and_verify_ownership(address_id, current_user_id, conn)

            # Unset other defaults
            await unset_other_default_addresses(conn, current_user_id, exclude_address_id=address_id)

            # Set this address as default
            updated_row = await conn.fetchrow(
                """
                UPDATE user_addresses SET is_default = TRUE, updated_at = NOW()
                WHERE id = $1 AND user_id = $2
                RETURNING id, user_id, address_nickname, contact_name, full_address_str,
                          property_type, is_default, special_delivery_instructions,
                          created_at, updated_at
                """,
                address_id, current_user_id
            )
        if not updated_row: # Should not happen if ownership check passed
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Failed to set address as default or address not found.")

        response_data = dict(updated_row)
        if response_data.get('special_delivery_instructions') and isinstance(response_data['special_delivery_instructions'], str):
            response_data['special_delivery_instructions'] = json.loads(response_data['special_delivery_instructions'])

        return UserAddressResponse(**response_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting address {address_id} as default for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to set default address.")
