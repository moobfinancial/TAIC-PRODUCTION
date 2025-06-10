from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from app.models.product import ProductVariant, ProductVariantCreate, ProductVariantUpdate # Pydantic models
from app.db import get_db_connection, release_db_connection # Database utilities
import asyncpg # For type hinting and potential errors

router = APIRouter(
    tags=["Product Variants"],
    # prefix="/api/v1" # Consider adding a global prefix in main.py if needed
)

# Utility function to fetch a product and check its `has_variants` status
async def get_product_for_variant_operations(product_id: str, conn: asyncpg.Connection) -> asyncpg.Record:
    product_row = await conn.fetchrow("SELECT id, has_variants FROM products WHERE id = $1", product_id)
    if not product_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id '{product_id}' not found.")
    return product_row

@router.post("/products/{product_id}/variants", response_model=ProductVariant, status_code=status.HTTP_201_CREATED)
async def create_variant_for_product(product_id: str, variant_in: ProductVariantCreate):
    """
    Create a new variant for a specific product.
    """
    conn = None
    try:
        conn = await get_db_connection()

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
            product_id, variant_in.sku, variant_in.attributes, variant_in.specific_price,
            variant_in.stock_quantity, str(variant_in.image_url) if variant_in.image_url else None
        )

        if not created_variant_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create product variant.")

        # If this is the first variant, update product's `has_variants` to TRUE
        if not product_row['has_variants']:
            await conn.execute("UPDATE products SET has_variants = TRUE WHERE id = $1", product_id)

        return ProductVariant(**dict(created_variant_row))

    except asyncpg.exceptions.UniqueViolationError as e:
        # Assuming SKU should be unique per product or globally, depending on schema.
        # The current schema has SKU UNIQUE in product_variants table.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Variant with SKU '{variant_in.sku}' may already exist or conflicts with constraints. Error: {e}")
    except HTTPException:
        raise # Re-raise HTTPExceptions directly
    except Exception as e:
        # Log the exception details for debugging
        print(f"Error creating variant: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")
    finally:
        if conn:
            await release_db_connection(conn)

@router.get("/products/{product_id}/variants", response_model=List[ProductVariant])
async def list_variants_for_product(product_id: str):
    """
    List all variants for a specific product.
    """
    conn = None
    try:
        conn = await get_db_connection()
        # Check if product exists (optional, but good practice)
        product_row = await conn.fetchrow("SELECT id FROM products WHERE id = $1", product_id)
        if not product_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id '{product_id}' not found.")

        variant_rows = await conn.fetch(
            "SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url FROM product_variants WHERE product_id = $1 ORDER BY id ASC",
            product_id
        )
        return [ProductVariant(**dict(row)) for row in variant_rows]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing variants: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.get("/variants/{variant_id}", response_model=ProductVariant)
async def get_variant_by_id(variant_id: int):
    """
    Get a specific variant by its ID.
    """
    conn = None
    try:
        conn = await get_db_connection()
        variant_row = await conn.fetchrow(
            "SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url FROM product_variants WHERE id = $1",
            variant_id
        )
        if not variant_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant with id {variant_id} not found.")
        return ProductVariant(**dict(variant_row))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting variant by ID: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.put("/variants/{variant_id}", response_model=ProductVariant)
async def update_variant(variant_id: int, variant_update: ProductVariantUpdate):
    """
    Update an existing product variant.
    """
    conn = None
    try:
        conn = await get_db_connection()

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
            # Special handling for HttpUrl to convert to string for DB
            if field == 'image_url' and value is not None:
                 params.append(str(value))
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

        return ProductVariant(**dict(updated_row))

    except asyncpg.exceptions.UniqueViolationError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Update conflicts with existing data (e.g., SKU). Error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating variant: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variant(variant_id: int):
    """
    Delete a specific product variant.
    If it's the last variant for a product, update product's `has_variants` to FALSE.
    """
    conn = None
    try:
        conn = await get_db_connection()

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

        return # Returns 204 No Content by default

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting variant: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)
