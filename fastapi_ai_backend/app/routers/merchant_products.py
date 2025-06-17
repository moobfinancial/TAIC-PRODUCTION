import logging
from typing import List, Optional, Any, Set
from fastapi import APIRouter, HTTPException, Depends, status, Path as FastApiPath
import asyncpg
from decimal import Decimal # For comparing with DB Decimal values

from app.models.merchant_product_models import MerchantProductUpdateSchema
from app.models.product import Product, ProductVariant, ProductVariantCreate, ProductVariantUpdate # Added Create/Update
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id # Assuming this returns the merchant's user_id

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Merchant - Product Management"],
    # Actual prefix will be /api/merchant (from main.py) + /products (from this router's inclusion)
)

# --- Placeholder Authentication Dependency (using the one for general users for now) ---
# In a real app, this would specifically ensure the user has 'MERCHANT' role.
async def get_current_merchant_id(current_user_id: str = Depends(get_current_active_user_id)) -> str:
    # TODO: Add logic here to verify if current_user_id actually has a 'MERCHANT' role
    # For now, just returning the user_id.
    # Example check:
    # conn = await get_db_connection()
    # user_role = await conn.fetchval("SELECT role FROM users WHERE id = $1", current_user_id)
    # await release_db_connection(conn)
    # if user_role != 'MERCHANT':
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not authorized as a merchant.")
    return current_user_id

# Fields that, if changed on an 'approved' product, trigger re-approval to 'pending'
SIGNIFICANT_PRODUCT_FIELDS_FOR_REAPPROVAL: Set[str] = {
    "name", "description", "price", "platform_category_id",
    "image_url", "additional_image_urls", "cashback_percentage"
    # base_price could be added if it affects compliance/platform rules
}

# Fields for variants that, if changed on a variant of an 'approved' product, trigger re-approval
SIGNIFICANT_VARIANT_FIELDS_FOR_REAPPROVAL: Set[str] = {
    "sku", "attributes", "specific_price"
    # stock_quantity, image_url changes on a variant might not require full product re-approval by default.
}


# --- Helper to get product and check ownership ---
async def get_merchant_product_or_404_and_check_ownership(
    product_id: str,
    merchant_id: str,
    conn: asyncpg.Connection
) -> asyncpg.Record:
    product_row = await conn.fetchrow("SELECT * FROM products WHERE id = $1", product_id)
    if not product_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    if product_row['merchant_id'] != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this product.")
    return product_row

# --- Helper to get variant and check ownership via parent product ---
async def get_merchant_variant_or_404_and_check_ownership(
    variant_id: int,
    merchant_id: str,
    conn: asyncpg.Connection
) -> asyncpg.Record: # Returns the variant row
    variant_row = await conn.fetchrow(
        """
        SELECT pv.*, p.merchant_id as parent_product_merchant_id, p.approval_status as parent_product_approval_status
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = $1
        """,
        variant_id
    )
    if not variant_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product variant not found.")
    if variant_row['parent_product_merchant_id'] != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This product variant does not belong to you.")
    return variant_row


@router.put(
    "/{product_id}",
    response_model=Product,
    summary="Update Merchant's Product",
    description="Allows a merchant to update their product. Certain significant changes to already approved products will reset the approval status to 'pending' and deactivate the product pending re-review."
)
async def update_merchant_product(
    update_data: MerchantProductUpdateSchema,
    product_id: str = FastApiPath(..., description="ID of the product to update."),
    current_merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # 1. Fetch Product and Verify Ownership
        # Fetch all fields that might be compared or returned, including those needed for Product response model
        product_row = await conn.fetchrow(
            """
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.platform_category_id = c.id
            WHERE p.id = $1
            """,
            product_id
        )
        if not product_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

        current_product_data = dict(product_row)

        if current_product_data['merchant_id'] != current_merchant_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this product.")

        # 2. Prepare Update and Determine if Re-approval is Needed
        update_payload = update_data.model_dump(exclude_unset=True) # Only fields provided in request
        if not update_payload:
            # If nothing to update, just return current product data (or 304 Not Modified, but FastAPI needs explicit handling for that)
            # For simplicity, re-fetch and return full product object.
            logger.info(f"No actual update data provided for product {product_id}. Returning current data.")
            # Re-construct the Product object to include variants if any
            variants_rows = await conn.fetch("SELECT * FROM product_variants WHERE product_id = $1", product_id)
            current_product_data['variants'] = [ProductVariant(**dict(v_row)) for v_row in variants_rows]
            current_product_data['category'] = current_product_data.pop('category_name', None)
            return Product(**current_product_data)


        needs_reapproval = False
        original_approval_status = current_product_data['approval_status']

        db_update_fields: Dict[str, Any] = {}

        if original_approval_status == 'approved':
            for field_name, new_value in update_payload.items():
                if field_name in SIGNIFICANT_PRODUCT_FIELDS_FOR_REAPPROVAL: # Use specific set for product fields
                    current_value = current_product_data.get(field_name)
                    # Handle type differences for comparison (e.g., Pydantic float vs DB Decimal)
                    if isinstance(current_value, Decimal) and isinstance(new_value, (float, int)):
                        current_value_comparable = float(current_value)
                    elif isinstance(current_value, list) and isinstance(new_value, list): # For additional_image_urls
                         # Simple comparison for lists; more robust might sort or use sets if order doesn't matter
                        current_value_comparable = sorted([str(url) for url in current_value]) if current_value else []
                        new_value = sorted([str(url) for url in new_value]) if new_value else []
                    else:
                        current_value_comparable = current_value

                    if new_value != current_value_comparable:
                        needs_reapproval = True
                        break

        # Prepare fields for SQL SET clause
        for field_name, value in update_payload.items():
            if value is not None: # Pydantic exclude_unset should handle this, but double check
                if field_name == "additional_image_urls" and isinstance(value, list):
                    db_update_fields[field_name] = [str(url) for url in value] # Store as list of strings for JSONB
                else:
                    db_update_fields[field_name] = value

        if not db_update_fields: # Should be caught by earlier check on update_payload
             logger.info(f"No effective changes for product {product_id} after None filtering.")
             # Re-fetch and return
             variants_rows = await conn.fetch("SELECT * FROM product_variants WHERE product_id = $1", product_id)
             current_product_data['variants'] = [ProductVariant(**dict(v_row)) for v_row in variants_rows]
             current_product_data['category'] = current_product_data.pop('category_name', None)
             return Product(**current_product_data)


        if needs_reapproval:
            db_update_fields['approval_status'] = 'pending'
            db_update_fields['is_active'] = False # As per policy
            if 'admin_review_notes' in current_product_data: # Optionally clear admin notes
                db_update_fields['admin_review_notes'] = None
            logger.info(f"Product {product_id} requires re-approval due to significant changes. Status set to 'pending', is_active to False.")
        elif 'is_active' in db_update_fields and original_approval_status != 'approved':
            # If merchant tries to set is_active=True on a non-approved product, override it.
            # This ensures only approved products can be made active by merchant directly.
            if db_update_fields['is_active'] is True:
                logger.warning(f"Merchant {current_merchant_id} attempted to activate non-approved product {product_id}. `is_active` will remain False or follow approval_status.")
                db_update_fields['is_active'] = False # Or set based on what 'pending'/'rejected' implies for activity

        # 3. Construct and Execute Update Query
        set_clauses_parts = [f"{field} = ${i+1}" for i, field in enumerate(db_update_fields.keys())]
        set_clauses_parts.append(f"updated_at = NOW()")

        sql_params = list(db_update_fields.values())
        sql_params.extend([product_id, current_merchant_id])

        update_query = f"""
            UPDATE products
            SET {', '.join(set_clauses_parts)}
            WHERE id = ${len(sql_params)-1} AND merchant_id = ${len(sql_params)}
            RETURNING id, name, description, price, base_price, image_url, additional_image_urls,
                      platform_category_id, is_active, approval_status, merchant_id,
                      created_at, updated_at, has_variants, source, original_cj_product_id,
                      cashback_percentage, data_ai_hint, admin_review_notes,
                      (SELECT name FROM categories WHERE id = products.platform_category_id) as category_name
        """

        updated_product_row = await conn.fetchrow(update_query, *sql_params)

        if not updated_product_row:
            # This might happen if the WHERE clause (id and merchant_id) didn't match,
            # which should have been caught by the initial fetch and ownership check.
            # Or if the DB is unavailable.
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update product or product not found for this merchant.")

        # 4. Fetch variants and construct response
        response_data = dict(updated_product_row)
        response_data['category'] = response_data.pop('category_name', None)

        variants_rows = await conn.fetch("SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id ASC", product_id)
        response_data['variants'] = [ProductVariant(**dict(v_row)) for v_row in variants_rows]

        # Calculate stock_quantity from variants if product has_variants
        if response_data.get('has_variants'):
            total_stock = sum(v.stock_quantity for v in response_data['variants'] if v.stock_quantity is not None)
            response_data['stock_quantity'] = total_stock
        elif 'stock_quantity' not in response_data or response_data['stock_quantity'] is None:
             # This might occur if a product has no variants and its own stock isn't managed directly
             # For now, default to 0 if not set and no variants.
             # The `products` table itself does not have a `stock_quantity` column.
             # This should be derived or handled based on variant stock.
             response_data['stock_quantity'] = 0


        logger.info(f"Product {product_id} updated successfully by merchant {current_merchant_id}.")
        return Product(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product {product_id} for merchant {current_merchant_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while updating the product.")
    finally:
        if conn:
            await release_db_connection(conn)

# TODO: Add endpoints for:
# - Listing merchant's products (GET /)
# - Getting a specific merchant product (GET /{product_id}) - can use the same logic as update's initial fetch
# - Creating a new product (POST /) - similar to bulk upload logic for a single product


# --- Merchant Product Variants Endpoints ---

@router.post(
    "/products/{product_id}/variants",
    response_model=ProductVariant,
    status_code=status.HTTP_201_CREATED,
    summary="Add Variant to Product",
    description="Allows a merchant to add a new variant to one of their existing products. Adding a variant to an approved product will trigger re-approval for the parent product."
)
async def add_variant_to_product(
    variant_data: ProductVariantCreate,
    product_id: str = FastApiPath(..., description="ID of the parent product."),
    current_merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    async with conn.transaction():
        # Fetch parent product and verify ownership
        parent_product_row = await get_merchant_product_or_404_and_check_ownership(product_id, current_merchant_id, conn)
        original_approval_status = parent_product_row['approval_status']

        # Insert new variant
        try:
            created_variant_row = await conn.fetchrow(
                """
                INSERT INTO product_variants
                    (product_id, sku, attributes, specific_price, stock_quantity, image_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                product_id, variant_data.sku, variant_data.attributes,
                variant_data.specific_price, variant_data.stock_quantity,
                str(variant_data.image_url) if variant_data.image_url else None
            )
            if not created_variant_row:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create product variant.")
        except asyncpg.exceptions.UniqueViolationError as e:
            # This assumes SKU is globally unique as per current schema. If SKU unique per product, this check needs refinement.
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Variant with SKU '{variant_data.sku}' already exists.")

        # Update parent product: set has_variants = TRUE
        product_update_clauses = ["has_variants = TRUE"]
        product_update_params = []

        if original_approval_status == 'approved':
            product_update_clauses.extend(["approval_status = 'pending'", "is_active = FALSE"])
            if parent_product_row['admin_review_notes'] is not None: # Optionally clear admin notes
                product_update_clauses.append("admin_review_notes = NULL")
            logger.info(f"Product {product_id} requires re-approval due to new variant addition.")

        if product_update_clauses:
            product_update_clauses.append("updated_at = NOW()")
            await conn.execute(
                f"UPDATE products SET {', '.join(product_update_clauses)} WHERE id = $1",
                product_id
            )

        return ProductVariant(**dict(created_variant_row))

@router.put(
    "/variants/{variant_id}",
    response_model=ProductVariant,
    summary="Update Product Variant",
    description="Allows a merchant to update details of their product variant. Significant changes to a variant of an approved product will trigger re-approval for the parent product."
)
async def update_merchant_product_variant(
    variant_data: ProductVariantUpdate,
    variant_id: int = FastApiPath(..., description="ID of the product variant to update."),
    current_merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    async with conn.transaction():
        # Fetch variant, its parent product, and verify ownership
        current_variant_row = await get_merchant_variant_or_404_and_check_ownership(variant_id, current_merchant_id, conn)
        parent_product_id = current_variant_row['product_id']
        original_parent_approval_status = current_variant_row['parent_product_approval_status']

        update_payload = variant_data.model_dump(exclude_unset=True)
        if not update_payload:
            return ProductVariant(**dict(current_variant_row)) # Return current if no changes

        needs_reapproval = False
        if original_parent_approval_status == 'approved':
            for field_name, new_value in update_payload.items():
                if field_name in SIGNIFICANT_VARIANT_FIELDS_FOR_REAPPROVAL:
                    current_value = current_variant_row.get(field_name)
                    # Handle specific_price (Decimal vs float) and attributes (dict) comparison
                    if field_name == 'specific_price' and isinstance(current_value, Decimal) and isinstance(new_value, (float, int)):
                        current_value = float(current_value)
                    elif field_name == 'attributes' and isinstance(current_value, dict) and isinstance(new_value, dict):
                        # Simple dict comparison, might need deep comparison for nested structures if attributes get complex
                        pass # Default dict comparison is usually fine for flat dicts

                    if new_value != current_value:
                        needs_reapproval = True
                        break

        # Update variant
        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_payload.keys())]
        sql_params = list(update_payload.values())
        sql_params.append(variant_id)

        update_variant_query = f"""
            UPDATE product_variants SET {', '.join(set_clauses)}, updated_at = NOW()
            WHERE id = ${len(sql_params)} RETURNING *
        """
        try:
            updated_variant_row = await conn.fetchrow(update_variant_query, *sql_params)
            if not updated_variant_row: # Should not happen if initial fetch worked
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update variant.")
        except asyncpg.exceptions.UniqueViolationError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Update failed: SKU may already exist. Error: {e}")


        # If re-approval triggered, update parent product
        if needs_reapproval:
            product_update_clauses = ["approval_status = 'pending'", "is_active = FALSE", "updated_at = NOW()"]
            # Optionally clear admin_review_notes for the parent product
            parent_product_admin_notes = await conn.fetchval("SELECT admin_review_notes FROM products WHERE id = $1", parent_product_id)
            if parent_product_admin_notes is not None:
                 product_update_clauses.append("admin_review_notes = NULL")

            await conn.execute(
                f"UPDATE products SET {', '.join(product_update_clauses)} WHERE id = $1",
                parent_product_id
            )
            logger.info(f"Parent product {parent_product_id} requires re-approval due to significant variant {variant_id} update.")

        return ProductVariant(**dict(updated_variant_row))

@router.delete(
    "/variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Product Variant",
    description="Allows a merchant to delete their product variant. Deleting a variant from an approved product will trigger re-approval for the parent product."
)
async def delete_merchant_product_variant(
    variant_id: int = FastApiPath(..., description="ID of the product variant to delete."),
    current_merchant_id: str = Depends(get_current_merchant_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    async with conn.transaction():
        # Fetch variant, its parent product, and verify ownership
        variant_to_delete_row = await get_merchant_variant_or_404_and_check_ownership(variant_id, current_merchant_id, conn)
        parent_product_id = variant_to_delete_row['product_id']
        original_parent_approval_status = variant_to_delete_row['parent_product_approval_status']

        # Delete the variant
        await conn.execute("DELETE FROM product_variants WHERE id = $1", variant_id)

        # Check remaining variants for the parent product
        remaining_variants_count = await conn.fetchval(
            "SELECT COUNT(*) FROM product_variants WHERE product_id = $1",
            parent_product_id
        )

        product_update_clauses = []
        if remaining_variants_count == 0:
            product_update_clauses.append("has_variants = FALSE")

        # Re-approval logic: Deletion is a significant change
        if original_parent_approval_status == 'approved':
            product_update_clauses.extend(["approval_status = 'pending'", "is_active = FALSE"])
            parent_product_admin_notes = await conn.fetchval("SELECT admin_review_notes FROM products WHERE id = $1", parent_product_id)
            if parent_product_admin_notes is not None:
                 product_update_clauses.append("admin_review_notes = NULL")
            logger.info(f"Parent product {parent_product_id} requires re-approval due to variant {variant_id} deletion.")

        if product_update_clauses:
            product_update_clauses.append("updated_at = NOW()")
            await conn.execute(
                f"UPDATE products SET {', '.join(product_update_clauses)} WHERE id = $1",
                parent_product_id
            )
        return # FastAPI handles 204 response
