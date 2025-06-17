from typing import List, Optional, Dict, Any
import traceback
import json
from fastapi import APIRouter, HTTPException, Depends, status, Request
from ..models.product import ProductVariant, ProductVariantCreate, ProductVariantUpdate # Pydantic models
from ..db import get_db_connection, release_db_connection # Database utilities
import asyncpg # For type hinting and potential errors

router = APIRouter(
    tags=["Products - Variants"],
    # prefix="/api/v1" # Consider adding a global prefix in main.py if needed
)

# Utility function to fetch a product and check its `has_variants` status
async def get_product_for_variant_operations(product_id: str, conn: asyncpg.Connection) -> asyncpg.Record:
    product_row = await conn.fetchrow("SELECT id, has_variants FROM products WHERE id = $1", product_id)
    if not product_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id '{product_id}' not found.")
    return product_row

@router.post(
    "/products/{product_id}/variants",
    response_model=ProductVariant,
    status_code=status.HTTP_201_CREATED,
    summary="Create Product Variant",
    description="""
Creates a new variant for a specified product.
- Requires the parent `product_id` in the path.
- The request body should contain variant details like SKU, attributes, price, stock, and image URL.
- If this is the first variant added to a product, the product's `has_variants` flag is automatically set to `True`.
- Returns the created product variant details, including its new system-generated ID.
- **Protected Endpoint:** (Implicitly, as product management typically requires merchant or admin rights).
    """
)
async def create_variant_for_product(product_id: int, variant_in: ProductVariantCreate):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.transaction(): # START TRANSACTION
            # Check if product exists
            product_row = await get_product_for_variant_operations(product_id, conn)

            # Insert new variant
            # `id` is SERIAL and auto-generated
            created_variant_row = await conn.fetchrow(
                """
                INSERT INTO product_variants
                    (product_id, sku, attributes, specific_price, stock_quantity, image_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, product_id, sku, attributes, specific_price, stock_quantity, image_url
                """,
                product_id, variant_in.sku, json.dumps(variant_in.attributes) if variant_in.attributes is not None else None, variant_in.specific_price,
                variant_in.stock_quantity, str(variant_in.image_url) if variant_in.image_url else None
            )

            if not created_variant_row:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create product variant.")

            # If this is the first variant, update product's `has_variants` to TRUE
            if not product_row['has_variants']:
                await conn.execute("UPDATE products SET has_variants = TRUE WHERE id = $1", product_id)

            response_data = dict(created_variant_row)
            if response_data.get('attributes') and isinstance(response_data['attributes'], str):
                response_data['attributes'] = json.loads(response_data['attributes'])
            return ProductVariant(**response_data) # COMMIT (implicit on successful exit of 'with' block)
    except asyncpg.exceptions.UniqueViolationError as e: # ROLLBACK (implicit on exception)
        # Assuming SKU should be unique per product or globally, depending on schema.
        # The current schema has SKU UNIQUE in product_variants table.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Variant with SKU '{variant_in.sku}' may already exist or conflicts with constraints. Error: {e}")
    except HTTPException:
        raise # Re-raise HTTPExceptions directly
    except Exception as e:
        # Log the exception details for debugging
        error_details = traceback.format_exc()
        print(f"Error creating variant: {e}\nTraceback:\n{error_details}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/products/{product_id}/variants",
    response_model=List[ProductVariant],
    summary="List Product Variants",
    description="""
Retrieves a list of all variants associated with a specific product.
- Requires the parent `product_id` in the path.
- Returns an empty list if the product has no variants or does not exist (though a 404 is raised if product not found by initial check).
- **Protected Endpoint:** (Typically, viewing product details might be public or require user roles, depending on overall API design).
    """
)
async def list_variants_for_product(product_id: int, request: Request, conn: asyncpg.Connection = Depends(get_db_connection)):
    # conn is now provided by Depends, no need to call get_db_connection() again here
    try:
        # Check if product exists (optional, but good practice)
        product_row = await conn.fetchrow("SELECT id FROM products WHERE id = $1", product_id)
        if not product_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id '{product_id}' not found.")

        variant_rows = await conn.fetch(
            "SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url FROM product_variants WHERE product_id = $1 ORDER BY id ASC",
            product_id
        )
        parsed_variants = []
        for row in variant_rows:
            response_data = dict(row)
            if response_data.get('attributes') and isinstance(response_data['attributes'], str):
                response_data['attributes'] = json.loads(response_data['attributes'])
            
            # Construct absolute image URL if it's relative
            if response_data.get('image_url') and isinstance(response_data['image_url'], str) and response_data['image_url'].startswith('/'):
                response_data['image_url'] = str(request.base_url).rstrip('/') + response_data['image_url']
            
            parsed_variants.append(ProductVariant(**response_data))
        return parsed_variants
    except HTTPException:
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error listing variants: {e}\nTraceback:\n{error_details}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get(
    "/variants/{variant_id}",
    response_model=ProductVariant,
    summary="Get Variant by ID",
    description="""
Retrieves a specific product variant by its unique variant ID.
- Requires the `variant_id` in the path.
- Returns a 404 error if no variant with the given ID is found.
- **Protected Endpoint:** (Similar to listing variants, access depends on API design).
    """
)
async def get_variant_by_id(variant_id: int, request: Request, conn: asyncpg.Connection = Depends(get_db_connection)):
    # conn is provided by Depends
    try:
        variant_row = await conn.fetchrow(
            "SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url FROM product_variants WHERE id = $1",
            variant_id
        )
        if not variant_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant with id {variant_id} not found.")
        response_data = dict(variant_row)
        if response_data.get('attributes') and isinstance(response_data['attributes'], str):
            response_data['attributes'] = json.loads(response_data['attributes'])
        
        # Construct absolute image URL if it's relative
        if response_data.get('image_url') and isinstance(response_data['image_url'], str) and response_data['image_url'].startswith('/'):
            response_data['image_url'] = str(request.base_url).rstrip('/') + response_data['image_url']
            
        return ProductVariant(**response_data)
    except HTTPException:
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error getting variant by ID: {e}\nTraceback:\n{error_details}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.put(
    "/variants/{variant_id}",
    response_model=ProductVariant,
    summary="Update Product Variant",
    description="""
Updates an existing product variant's details.
- Requires the `variant_id` in the path.
- The request body should contain only the fields to be updated (e.g., SKU, price, stock).
- Returns the complete updated product variant details.
- Returns a 404 error if the variant is not found.
- **Protected Endpoint:** (Typically requires merchant or admin rights).
    """
)
async def update_variant(variant_id: int, variant_update: ProductVariantUpdate, request: Request, conn: asyncpg.Connection = Depends(get_db_connection)) -> ProductVariant:
    # conn is now provided by Depends, no need to call get_db_connection() again here
    # Also, conn will be an actual connection object from Depends, not None initially.
    try:
        async with conn.transaction(): # START TRANSACTION
            # Fetch current variant to ensure it exists
            current_variant_row = await conn.fetchrow("SELECT * FROM product_variants WHERE id = $1", variant_id)
            if not current_variant_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant with id {variant_id} not found.")

            # Construct the SET clause for the SQL query dynamically
            update_data = variant_update.model_dump(exclude_unset=True)
            if not update_data:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update fields provided.")

            set_clauses = []
            params = []
            param_idx = 1
            for field, value in update_data.items():
                set_clauses.append(f"{field} = ${param_idx}")
                # Special handling for HttpUrl to convert to string for DB and attributes to JSON string
                if field == 'image_url' and value is not None:
                    params.append(str(value))
                elif field == 'attributes' and value is not None:
                    params.append(json.dumps(value))
                else:
                    params.append(value)
                param_idx += 1

            params.append(variant_id) # For WHERE id = $N

            update_query = f"UPDATE product_variants SET {', '.join(set_clauses)} WHERE id = ${param_idx} RETURNING *"

            updated_row = await conn.fetchrow(update_query, *params)
            if not updated_row:
                # This case should ideally not be reached if the initial fetch succeeded,
                # but as a safeguard:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update variant.")

            response_data = dict(updated_row)
            if response_data.get('attributes') and isinstance(response_data['attributes'], str):
                response_data['attributes'] = json.loads(response_data['attributes'])

            # Construct absolute image URL if it's relative
            if response_data.get('image_url') and isinstance(response_data['image_url'], str) and response_data['image_url'].startswith('/'):
                response_data['image_url'] = str(request.base_url).rstrip('/') + response_data['image_url']

            return ProductVariant(**response_data) # COMMIT (implicit)
    except asyncpg.exceptions.UniqueViolationError as e: # ROLLBACK (implicit)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Update conflicts with existing data (e.g., SKU). Error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error updating variant: {e}\nTraceback:\n{error_details}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.delete(
    "/variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Product Variant",
    description="""
Deletes a specific product variant by its ID.
- Requires the `variant_id` in the path.
- If this is the last variant associated with a product, the parent product's `has_variants` flag is automatically set to `False`.
- Returns a 204 No Content response on successful deletion.
- Returns a 404 error if the variant is not found.
- **Protected Endpoint:** (Typically requires merchant or admin rights).
    """
)
async def delete_variant(variant_id: int):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.transaction(): # START TRANSACTION
            # Get product_id before deleting the variant to check other variants later
            variant_to_delete = await conn.fetchrow("SELECT product_id FROM product_variants WHERE id = $1", variant_id)
            if not variant_to_delete:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant with id {variant_id} not found.")

            product_id = variant_to_delete['product_id']

            deleted_count_result = await conn.execute("DELETE FROM product_variants WHERE id = $1", variant_id)

            deleted_count = int(deleted_count_result.split(" ")[1]) if deleted_count_result else 0
            if deleted_count == 0: # Should have been caught by the fetchrow above
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant with id {variant_id} not found for deletion.")

            # Check if the product has any other variants left
            remaining_variants_count = await conn.fetchval(
                "SELECT COUNT(*) FROM product_variants WHERE product_id = $1",
                product_id
            )
            if remaining_variants_count == 0:
                await conn.execute("UPDATE products SET has_variants = FALSE WHERE id = $1", product_id)

            return # Returns 204 No Content by default # COMMIT (implicit)
    except HTTPException: # ROLLBACK (implicit)
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error deleting variant: {e}\nTraceback:\n{error_details}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)
