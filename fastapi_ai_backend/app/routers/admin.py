from typing import List, Optional
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status, Query
import asyncpg
from datetime import datetime # Import datetime

from app.models.admin_models import ProductReviewAction, AdminAuditLogEntry # Import AdminAuditLogEntry
from app.models.product import Product, ProductVariant # Using existing Product model for response
from app.db import get_db_connection, release_db_connection
from app.audit_utils import record_admin_audit_log # Import audit utility

router = APIRouter(
    tags=["Administration"], # Using a more general tag for now, can be split later if needed
    # prefix="/api/admin" # Prefix will be set in main.py
    # TODO: Add dependencies=[Depends(get_current_admin_user)] for actual auth
)

@router.get(
    "/products-for-review",
    response_model=List[Product],
    summary="List Products for Admin Review",
    description="""
Retrieves a list of products based on their approval status (e.g., 'pending', 'approved', 'rejected').
- Useful for admin interfaces where products need to be reviewed and managed.
- Defaults to listing products with 'pending' status.
- Includes product variants and category information in the response.
- **Protected Endpoint:** Requires admin authentication.
    """
)
async def list_products_for_review(
    approval_status: Optional[str] = Query("pending", enum=["pending", "approved", "rejected"], description="Filter products by their approval status.")
):
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

@router.get(
    "/audit-logs",
    response_model=List[AdminAuditLogEntry],
    summary="List Admin Audit Log Entries",
    description="""
Retrieves a paginated and filterable list of administrative audit log entries.
- Allows tracking of significant actions performed by administrators.
- Supports filtering by admin username, action type, target entity, and date range.
- **Protected Endpoint:** Requires admin authentication (typically super admin or specific audit viewer role).
    """
)
async def list_admin_audit_logs(
    limit: int = Query(50, ge=1, le=100, description="Number of audit log entries to return per page."),
    offset: int = Query(0, ge=0, description="Offset for pagination."),
    admin_username: Optional[str] = Query(default=None, description="Filter by admin username (case-insensitive partial match)."),
    action: Optional[str] = Query(default=None, description="Filter by action type (case-insensitive partial match)."),
    target_entity_type: Optional[str] = Query(default=None, description="Filter by target entity type (e.g., 'product', 'user')."),
    target_entity_id: Optional[str] = Query(default=None, description="Filter by specific target entity ID."),
    start_date: Optional[datetime] = Query(default=None, description="Filter logs from this timestamp onwards (inclusive)."),
    end_date: Optional[datetime] = Query(default=None, description="Filter logs up to this timestamp (inclusive)."),
):
    conn = None
    try:
        conn = await get_db_connection()

        base_query = "SELECT id, timestamp, admin_username, action, target_entity_type, target_entity_id, details FROM admin_audit_log"
        filter_conditions = []
        params = []
        param_idx = 1

        if admin_username:
            filter_conditions.append(f"admin_username ILIKE ${param_idx}")
            params.append(f"%{admin_username}%")
            param_idx += 1
        if action:
            filter_conditions.append(f"action ILIKE ${param_idx}")
            params.append(f"%{action}%")
            param_idx += 1
        if target_entity_type:
            filter_conditions.append(f"target_entity_type ILIKE ${param_idx}")
            params.append(f"%{target_entity_type}%")
            param_idx += 1
        if target_entity_id:
            filter_conditions.append(f"target_entity_id = ${param_idx}")
            params.append(target_entity_id)
            param_idx += 1
        if start_date:
            filter_conditions.append(f"timestamp >= ${param_idx}")
            params.append(start_date)
            param_idx += 1
        if end_date:
            # Add 1 day to end_date to make it inclusive of the whole day
            # from datetime import timedelta
            # end_date_inclusive = end_date + timedelta(days=1)
            # filter_conditions.append(f"timestamp < ${param_idx}")
            # params.append(end_date_inclusive)
            # Simpler: if end_date is just a date, it implies up to the end of that date.
            # If it's a specific timestamp, then direct comparison is fine.
            # For now, assuming direct comparison:
            filter_conditions.append(f"timestamp <= ${param_idx}")
            params.append(end_date)
            param_idx += 1

        if filter_conditions:
            base_query += " WHERE " + " AND ".join(filter_conditions)

        base_query += f" ORDER BY timestamp DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
        params.extend([limit, offset])

        log_rows = await conn.fetch(base_query, *params)

        return [AdminAuditLogEntry(**dict(row)) for row in log_rows]

    except asyncpg.exceptions.UndefinedTableError:
        # This specific error is handled in audit_utils when trying to record,
        # but good to have here if the table is missing during read attempt.
        print("Error listing audit logs: 'admin_audit_log' table does not exist.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Audit log table not found. Please contact support.")
    except Exception as e:
        print(f"Error listing admin audit logs: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

@router.post(
    "/products/{product_id}/review",
    response_model=Product,
    summary="Review and Approve/Reject Product",
    description="""
Allows an administrator to approve or reject a product, and optionally add review notes.
- Updates the product's `approval_status` and `admin_review_notes`.
- Sets `is_active` to `True` if approved, `False` if rejected.
- Records the action in the admin audit log.
- Returns the updated product details, including variants.
- **Protected Endpoint:** Requires admin authentication.
    """
)
async def review_product(
    product_id: str,
    review_action: ProductReviewAction
):
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
