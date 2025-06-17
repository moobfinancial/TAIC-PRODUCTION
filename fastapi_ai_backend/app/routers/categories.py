from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status, Query
from datetime import datetime
import json # For handling Dict to JSONB conversion if asyncpg requires explicit string

from ..models.category import Category, CategoryCreate, CategoryUpdate
from ..db import get_db_connection, release_db_connection
import asyncpg

router = APIRouter(
    tags=["Categories"],
    # prefix="/api/categories" # Prefix will be set in main.py
)

@router.post(
    "/",
    response_model=Category,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Category",
    description="""
Creates a new category for organizing products or services.
- `name`: Name of the category (required).
- `description`: Optional detailed description.
- `parent_category_id`: Optional ID of a parent category to create a sub-category.
- `is_active`: Defaults to `True`. Set to `False` to make the category hidden/unusable.
- `category_type`: Either 'PRODUCT' (default) or 'SERVICE'.
- `custom_attributes`: For 'SERVICE' categories, allows defining a schema for service-specific attributes (e.g., duration, location type). Must be null or empty for 'PRODUCT' categories.
- Returns the created category details, including its new system-generated ID.
- **Protected Endpoint:** (Typically requires admin or merchant rights with specific permissions).
    """
)
async def create_category(category_in: CategoryCreate):
    conn = None
    try:
        conn = await get_db_connection()

        # Ensure custom_attributes is None if category_type is 'PRODUCT'
        # This is also handled by Pydantic validator, but good to be defensive.
        actual_custom_attributes = category_in.custom_attributes
        if category_in.category_type == 'PRODUCT':
            if actual_custom_attributes is not None and actual_custom_attributes != {}:
                 raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="custom_attributes must be null or empty for 'PRODUCT' category type."
                )
            actual_custom_attributes = None # Store as NULL in DB for PRODUCT type

        # Convert dict to JSON string for asyncpg if it doesn't handle dicts for JSONB automatically
        # asyncpg generally handles dicts for JSONB well, so direct pass-through should work.

        query = """
            INSERT INTO categories (name, description, parent_category_id, is_active, category_type, custom_attributes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id, name, description, parent_category_id, is_active, category_type, custom_attributes, created_at, updated_at
        """
        row = await conn.fetchrow(
            query,
            category_in.name,
            category_in.description,
            category_in.parent_category_id,
            category_in.is_active,
            category_in.category_type,
            actual_custom_attributes # Pass None or the dict
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create category.")
        return Category(**dict(row))
    except asyncpg.exceptions.UniqueViolationError:
        # Assuming (name, parent_category_id) UNIQUE constraint from schema.sql
        detail_msg = f"A category with the name '{category_in.name}'"
        if category_in.parent_category_id is not None:
            detail_msg += f" under parent ID {category_in.parent_category_id}"
        else:
            detail_msg += " at the root level"
        detail_msg += " already exists."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail_msg)
    except asyncpg.exceptions.ForeignKeyViolationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid parent_category_id: {category_in.parent_category_id} does not exist.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating category: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/",
    response_model=List[Category],
    summary="List All Categories",
    description="""
Retrieves a list of all categories.
- Optionally filters by `category_type` ('PRODUCT' or 'SERVICE').
- Categories are returned ordered by name.
- **Protected Endpoint:** (Access level may vary; public for browsing, restricted for management).
    """
)
async def list_categories(
    category_type: Optional[str] = Query(default=None, pattern="^(PRODUCT|SERVICE)$", description="Filter categories by type ('PRODUCT' or 'SERVICE').")
):
    conn = None
    try:
        conn = await get_db_connection()
        query = "SELECT id, name, description, parent_category_id, is_active, category_type, custom_attributes, created_at, updated_at FROM categories"
        params = []
        if category_type:
            if category_type.upper() not in ['PRODUCT', 'SERVICE']:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_type. Must be 'PRODUCT' or 'SERVICE'.")
            query += " WHERE category_type = $1"
            params.append(category_type.upper())
        query += " ORDER BY name ASC"

        rows = await conn.fetch(query, *params)
        return [Category(**dict(row)) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing categories: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/{category_id}",
    response_model=Category,
    summary="Get Category by ID",
    description="""
Retrieves a specific category by its unique ID.
- Returns a 404 error if no category with the given ID is found.
- **Protected Endpoint:** (Access level may vary).
    """
)
async def get_category(category_id: int):
    conn = None
    try:
        conn = await get_db_connection()
        query = "SELECT id, name, description, parent_category_id, is_active, category_type, custom_attributes, created_at, updated_at FROM categories WHERE id = $1"
        row = await conn.fetchrow(query, category_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Category with id {category_id} not found.")
        return Category(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting category {category_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.put(
    "/{category_id}",
    response_model=Category,
    summary="Update Category",
    description="""
Updates an existing category's details.
- Requires the `category_id` in the path.
- The request body should contain only the fields to be updated.
- Handles `custom_attributes` validation based on `category_type` (must be null/empty for 'PRODUCT' type).
- Returns the complete updated category details.
- Returns a 404 error if the category is not found.
- **Protected Endpoint:** (Typically requires admin or specific merchant rights).
    """
)
async def update_category(category_id: int, category_upd: CategoryUpdate):
    conn = None
    try:
        conn = await get_db_connection()

        # Fetch current category to check type if custom_attributes are being updated
        current_category = await conn.fetchrow("SELECT category_type FROM categories WHERE id = $1", category_id)
        if not current_category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Category with id {category_id} not found.")

        update_data = category_upd.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update fields provided.")

        # Logic for custom_attributes based on category_type
        # Determine the final category_type (either existing or new if being updated)
        final_category_type = update_data.get('category_type', current_category['category_type'])

        if final_category_type == 'PRODUCT':
            if 'custom_attributes' in update_data and update_data['custom_attributes'] is not None and update_data['custom_attributes'] != {}:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="custom_attributes must be null or empty if category_type is 'PRODUCT'."
                )
            # Ensure custom_attributes is set to NULL in DB if type is PRODUCT
            update_data['custom_attributes'] = None

        # Construct SET clause
        set_clauses = []
        params = []
        param_idx = 1
        for field, value in update_data.items():
            set_clauses.append(f"{field} = ${param_idx}")
            params.append(value)
            param_idx += 1

        # Add updated_at timestamp
        set_clauses.append(f"updated_at = NOW()")
        params.append(category_id) # For WHERE id = $N

        update_query = f"UPDATE categories SET {', '.join(set_clauses)} WHERE id = ${param_idx} RETURNING id, name, description, parent_category_id, is_active, category_type, custom_attributes, created_at, updated_at"

        updated_row = await conn.fetchrow(update_query, *params)
        if not updated_row:
             # Should be caught by the initial fetch if category_id is invalid
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update category.")

        return Category(**dict(updated_row))

    except asyncpg.exceptions.UniqueViolationError:
        # Handle potential unique constraint violation on name+parent_id
        detail_msg = "An update would result in a duplicate category name"
        if category_upd.name:
             detail_msg = f"A category with the name '{category_upd.name}'"
             # parent_category_id might not be in update_data, or could be None
             parent_id = update_data.get('parent_category_id', 'its current parent')
             if parent_id is not None: # If it's being set to NULL, this logic is okay.
                 detail_msg += f" under parent ID {parent_id}"
             else: # If parent_id is explicitly None in update or was already None and name is changing
                 detail_msg += " at the root level"
             detail_msg += " already exists."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail_msg)
    except asyncpg.exceptions.ForeignKeyViolationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid parent_category_id provided.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating category {category_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Category",
    description="""
Deletes a specific category by its ID.
- **Important:** The current database schema uses `ON DELETE SET NULL` for `parent_category_id` in the `categories` table and for `platform_category_id` in the `products` table. This means:
    - Sub-categories of the deleted category will become top-level categories (their `parent_category_id` becomes NULL).
    - Products assigned to the deleted category will have their `platform_category_id` set to NULL.
- Consider business logic implications (e.g., preventing deletion if category is actively used by many products, or reassigning products/sub-categories). For this endpoint, a direct delete is performed as per schema rules.
- Returns a 204 No Content response on successful deletion.
- Returns a 404 error if the category is not found.
- **Protected Endpoint:** (Typically requires admin rights).
    """
)
async def delete_category(category_id: int):
    conn = None
    try:
        conn = await get_db_connection()
        # The schema has ON DELETE SET NULL for parent_category_id,
        # and platform_category_id in products table.
        # This means deleting a category will set these foreign keys to NULL.
        # Consider if additional cleanup or restrictions are needed (e.g., cannot delete if category has products).
        # For now, direct delete as per ON DELETE SET NULL.

        result = await conn.execute("DELETE FROM categories WHERE id = $1", category_id)
        if result == "DELETE 0": # No rows deleted
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Category with id {category_id} not found.")

        # No explicit return for 204
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting category {category_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)
