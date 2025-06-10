from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Query
import asyncpg

from app.models.admin_models import ProductReviewAction
from app.models.product import Product, ProductVariant # Using existing Product model for response
from app.db import get_db_connection, release_db_connection
from app.audit_utils import record_admin_audit_log # Import audit utility

router = APIRouter(
    tags=["Admin - Product Management"],
    # prefix="/api/admin" # Prefix will be set in main.py
    # TODO: Add dependencies=[Depends(get_current_admin_user)] for actual auth
)

@router.get("/products-for-review", response_model=List[Product])
async def list_products_for_review(
    approval_status: Optional[str] = Query("pending", enum=["pending", "approved", "rejected"])
):
    """
    List products based on their approval status.
    Defaults to 'pending' status.
    """
    conn = None
    fetched_products_for_review: List[Product] = []
    try:
        conn = await get_db_connection()

        # Base query matching fields in Product Pydantic model and schema.sql
        # Includes category_name via join for Product.category field
        product_query = """
            SELECT
                p.id, p.name, p.description, p.price, p.image_url,
                c.name as category_name,
                p.platform_category_id,
                p.approval_status, p.merchant_id, p.has_variants,
                p.source, p.original_cj_product_id,
                p.is_active, p.data_ai_hint,
                p.admin_review_notes -- Assuming this column exists as per subtask desc
            FROM products p
            LEFT JOIN categories c ON p.platform_category_id = c.id
            WHERE p.approval_status = $1
            ORDER BY p.updated_at DESC -- Show most recently updated first for review queue
        """
        db_product_rows = await conn.fetch(product_query, approval_status)

        for row_data in db_product_rows:
            product_dict = dict(row_data)
            product_dict['category'] = product_dict.pop('category_name', None)

            # Initialize stock_quantity; will be updated if variants exist
            product_dict['stock_quantity'] = 0

            product_variants_list: List[ProductVariant] = []
            if product_dict.get('has_variants'):
                variant_sql = """
                    SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url
                    FROM product_variants
                    WHERE product_id = $1 ORDER BY id ASC
                """
                db_variant_rows = await conn.fetch(variant_sql, product_dict['id'])
                current_product_total_stock = 0
                for var_row in db_variant_rows:
                    variant_dict = dict(var_row)
                    product_variants_list.append(ProductVariant(**variant_dict))
                    current_product_total_stock += variant_dict.get('stock_quantity', 0)
                product_dict['stock_quantity'] = current_product_total_stock

            product_dict['variants'] = product_variants_list
            fetched_products_for_review.append(Product(**product_dict))

        return fetched_products_for_review
    except Exception as e:
        print(f"Error listing products for review: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.post("/products/{product_id}/review", response_model=Product)
async def review_product(product_id: str, review_action: ProductReviewAction):
    """
    Approve or reject a product and add optional admin review notes.
    """
    conn = None
    try:
        conn = await get_db_connection()

        # Check if product exists
        product_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)", product_id)
        if not product_exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id '{product_id}' not found.")

        # Update product status and admin notes
        # The `admin_review_notes` column is assumed to exist per subtask description.
        update_fields = {
            "approval_status": review_action.new_status,
            "updated_at": "NOW()" # Use NOW() directly in SQL
        }
        # admin_notes can be None, only add to update if provided
        if review_action.admin_notes is not None:
            update_fields["admin_review_notes"] = review_action.admin_notes

        if review_action.new_status == "approved":
            update_fields["is_active"] = True
        elif review_action.new_status == "rejected":
            update_fields["is_active"] = False
        # If new_status is 'pending', is_active remains unchanged by this specific logic block
        # (though other policies like edit-re-approval might set it to FALSE)

        # Dynamically construct SET clauses and parameters
        set_clauses = []
        params = []
        param_idx = 1
        for field, value in update_fields.items():
            if field == "updated_at": # NOW() is SQL function, not a parameter
                set_clauses.append(f"{field} = NOW()")
            else:
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1

        params.append(product_id) # For WHERE id = $N (which will be param_idx)

        update_query_sql = f"""
            UPDATE products
            SET {', '.join(set_clauses)}
            WHERE id = ${param_idx}
            RETURNING id, name, description, price, image_url,
                      (SELECT name FROM categories WHERE id = platform_category_id) as category_name,
                      platform_category_id, approval_status, merchant_id, has_variants,
                      source, original_cj_product_id, is_active, data_ai_hint, admin_review_notes
        """

        updated_row = await conn.fetchrow(update_query_sql, *params)

        if not updated_row:
            # Should not happen if product_exists check passed, but as a safeguard
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update product review status.")

        product_dict = dict(updated_row)
        product_dict['category'] = product_dict.pop('category_name', None)
        product_dict['stock_quantity'] = 0 # Default, will be updated

        product_variants_list: List[ProductVariant] = []
        if product_dict.get('has_variants'):
            variant_sql = """
                SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url
                FROM product_variants WHERE product_id = $1 ORDER BY id ASC
            """
            db_variant_rows = await conn.fetch(variant_sql, product_dict['id'])
            current_product_total_stock = 0
            for var_row in db_variant_rows:
                variant_dict = dict(var_row)
                product_variants_list.append(ProductVariant(**variant_dict))
                current_product_total_stock += variant_dict.get('stock_quantity', 0)
            product_dict['stock_quantity'] = current_product_total_stock

        product_dict['variants'] = product_variants_list

        updated_product_obj = Product(**product_dict)

        # --- Record Audit Log ---
        # In a real app, admin_username would come from the authenticated user context
        admin_username_placeholder = "current_admin_placeholder"
        audit_action = f"product_{review_action.new_status}" # e.g., product_approved, product_rejected
        audit_details = {
            "new_status": review_action.new_status,
            "admin_notes": review_action.admin_notes,
            "product_name": updated_product_obj.name # For context in audit log
        }
        # Ensure conn is not None before calling audit log
        if conn: # Should always be true if updated_row was fetched
             await record_admin_audit_log(
                db_conn=conn,
                admin_username=admin_username_placeholder,
                action=audit_action,
                target_entity_type="product",
                target_entity_id=product_id,
                details=audit_details
            )
        # --- End Audit Log ---

        return updated_product_obj

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reviewing product {product_id}: {e}")
        # Check for specific DB errors if column `admin_review_notes` does not exist
        if isinstance(e, asyncpg.exceptions.UndefinedColumnError) and "admin_review_notes" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database schema error: 'admin_review_notes' column might be missing from 'products' table.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)
