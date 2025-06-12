from typing import List, Optional
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status, Query
import asyncpg
from datetime import datetime # Import datetime

from app.models.admin_models import ProductReviewAction, AdminAuditLogEntry
from app.models.product import Product, ProductVariant
from app.models.pioneer_application_models import PioneerApplicationResponse, PioneerApplicationUpdateAdmin
from app.models.admin_order_actions_models import AdminOrderStatusUpdate
from app.models.admin_order_models import OrderAdminDetailResponse, OrderAdminItemDetail
from app.models.pioneer_deliverable_models import ( # New models for deliverables
    PioneerDeliverableCreateAdmin,
    PioneerDeliverableUpdateAdmin,
    PioneerDeliverableResponse
)
from app.db import get_db_connection, release_db_connection
from app.audit_utils import record_admin_audit_log
from app.email_utils import ( # For new order status emails
    send_order_shipped_email,
    send_order_delivered_email,
    send_refund_processed_email,
    send_payout_sent_email,
    FRONTEND_BASE_URL
)
from decimal import Decimal # For amounts

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

# --- Placeholder for Admin Username Dependency ---
async def get_current_admin_username_placeholder() -> str:
    """Placeholder to simulate getting the authenticated admin's username."""
    return "current_admin_placeholder" # In real app, this would come from an auth dependency

# --- Admin Order Management Endpoints ---

async def fetch_order_details_for_admin_response(order_id: int, conn: asyncpg.Connection) -> Optional[OrderAdminDetailResponse]:
    """Helper to fetch full order details for admin response, including order items."""
    order_row = await conn.fetchrow(
        """
        SELECT
            id as order_id, user_id, status, amount as total_amount, currency,
            created_at, updated_at,
            tracking_number, carrier_name, shipping_address_summary
        FROM orders
        WHERE id = $1
        """,
        order_id
    )
    if not order_row:
        return None


    item_rows = await conn.fetch(
        """
        SELECT id, product_id, variant_id, quantity, price_per_item,
               product_name_snapshot, variant_attributes_snapshot
        FROM order_items
        WHERE order_id = $1
        ORDER BY id ASC
        """,
        order_id
    )
    order_items = [OrderAdminItemDetail(**dict(item_row)) for item_row in item_rows]

    return OrderAdminDetailResponse(**dict(order_row), items=order_items)


@router.get(
    "/orders",
    response_model=List[OrderAdminDetailResponse],
    summary="Admin List Orders",
    description="Allows administrators to list orders with pagination and filtering by status or user ID. Includes order items for each order."
)
async def admin_list_orders(
    status: Optional[str] = Query(default=None, description="Filter orders by status (e.g., 'pending', 'shipped')."),
    user_id: Optional[str] = Query(default=None, description="Filter orders by user ID."),
    limit: int = Query(50, ge=1, le=100, description="Number of orders to return."),
    offset: int = Query(0, ge=0, description="Offset for pagination."),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        base_query = """
            SELECT
                id as order_id, user_id, status, amount as total_amount, currency,
                created_at, updated_at,
                tracking_number, carrier_name, shipping_address_summary
            FROM orders
        """
        filter_conditions = []
        params_query: List[Any] = [] # Renamed to avoid conflict with FastAPI 'params'
        param_idx = 1

        if status:
            filter_conditions.append(f"status = ${param_idx}")
            params_query.append(status)
            param_idx += 1
        if user_id:
            filter_conditions.append(f"user_id = ${param_idx}")
            params_query.append(user_id)
            param_idx += 1

        if filter_conditions:
            base_query += " WHERE " + " AND ".join(filter_conditions)

        base_query += f" ORDER BY created_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
        params_query.extend([limit, offset])

        order_rows = await conn.fetch(base_query, *params_query)

        response_list = []
        # TODO: Optimize N+1 query for items. Fetch all order_ids from order_rows,
        # then do one query for all items for those order_ids, then map them back in Python.
        for row_data in order_rows:
            order_detail_response = await fetch_order_details_for_admin_response(row_data['order_id'], conn)
            if order_detail_response: # Should always be true if row_data exists
                 response_list.append(order_detail_response)
        return response_list

    except Exception as e:
        logger.error(f"Error listing orders for admin: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve orders.")

@router.get(
    "/orders/{order_id}",
    response_model=OrderAdminDetailResponse,
    summary="Admin Get Specific Order",
    description="Allows an administrator to retrieve detailed information for a specific order by its ID, including its items."
)
async def admin_get_order(
    order_id: int, # Order ID is SERIAL -> int. Changed from Query to Path implicitly.
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        order_response = await fetch_order_details_for_admin_response(order_id, conn)
        if not order_response:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order with ID {order_id} not found.")
        return order_response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order {order_id} for admin: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve order details.")


@router.put( # Changed from POST to PUT
    "/orders/{order_id}/status", # Changed path and name
    response_model=OrderAdminDetailResponse, # Return updated order
    summary="Admin Update Order Status & Trigger Notifications",
    description="""
Allows an administrator to update an order's status in the database and trigger relevant email notifications.
- **Protected Endpoint:** Requires admin authentication.
    """
)
async def admin_update_order_actual_status( # Renamed function
    order_id: int, # Order ID is SERIAL
    update_data: AdminOrderStatusUpdate,
    admin_username: str = Depends(get_current_admin_username_placeholder),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    logger.info(f"Admin {admin_username} updating actual order {order_id} to status {update_data.new_status}")

    async with conn.transaction():
        # 1. Fetch the order
        # Fetching with more details for email context, assuming columns exist
        order_row = await conn.fetchrow(
            """
            SELECT id, user_id, status, amount, currency,
                   shipping_address_summary, tracking_number, carrier_name
            FROM orders WHERE id = $1
            """,
            order_id
        )
        if not order_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order with ID {order_id} not found.")

        # 2. Update Order Status in DB
        update_fields_dict: Dict[str, Any] = {"status": update_data.new_status}
        if update_data.new_status == 'shipped':
            if not update_data.tracking_number: # Also validated by Pydantic
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tracking number is required for 'shipped' status.")
            update_fields_dict["tracking_number"] = update_data.tracking_number
            update_fields_dict["carrier_name"] = update_data.carrier_name

        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_fields_dict.keys())]
        sql_params_update = list(update_fields_dict.values())
        set_clauses.append(f"updated_at = NOW()")
        sql_params_update.append(order_id)

        update_query = f"UPDATE orders SET {', '.join(set_clauses)} WHERE id = ${len(sql_params_update)}"

        # We need to use RETURNING * with all columns for OrderAdminDetailResponse
        # For simplicity, we'll re-fetch after update, or construct from updated_order_row if all fields are returned.
        # Let's assume the RETURNING clause from fetch_order_details_for_admin_response is sufficient.

        await conn.execute(update_query, *sql_params_update)
        logger.info(f"Order {order_id} status updated to {update_data.new_status} in database.")

        # 3. Trigger Notifications
        notification_triggered_type: Optional[str] = None

        shopper_email: Optional[str] = None
        shopper_name: str = "Valued Customer"
        if order_row['user_id']: # user_id from the initially fetched order_row
            user_details_row = await conn.fetchrow("SELECT email, full_name FROM users WHERE id = $1", order_row['user_id'])
            if user_details_row:
                shopper_email = user_details_row['email']
                shopper_name = user_details_row['full_name'] or shopper_name

        # Conceptual merchant details
        merchant_email = "merchant@example.com"
        merchant_name = "Test Merchant"

        # Use potentially updated values from DB for email (or from input_data if preferred for tracking_number)
        updated_order_for_email = await conn.fetchrow(
            "SELECT id, amount, currency, shipping_address_summary, tracking_number, carrier_name FROM orders WHERE id = $1", order_id
        )
        if not updated_order_for_email: # Should not happen
            logger.error(f"Failed to re-fetch order {order_id} after update for email details.")
            raise HTTPException(status_code=500, detail="Error preparing notification data.")

        order_details_for_email = {
            "id": str(order_id),
            "total_amount": str(updated_order_for_email['amount']),
            "currency": updated_order_for_email['currency'],
            "currency_symbol": "$", # Placeholder
            "order_items_summary": "- Item 1 (Placeholder)\n- Item 2 (Placeholder)", # Placeholder items
            "shipping_address": updated_order_for_email.get('shipping_address_summary', "N/A"),
            "order_url": f"{FRONTEND_BASE_URL}/shopper/orders/{order_id}",
        }

        if shopper_email:
            if update_data.new_status == 'shipped':
                tracking_info = {
                    "shipped_items_summary": order_details_for_email["order_items_summary"],
                    "carrier_name": updated_order_for_email.get('carrier_name') or "N/A",
                    "tracking_number": updated_order_for_email.get('tracking_number') or "N/A",
                    "tracking_url": f"{FRONTEND_BASE_URL}/track?number={updated_order_for_email.get('tracking_number', '')}",
                    "estimated_delivery_date": "3-5 business days (Est.)"
                }
                await send_order_shipped_email(shopper_email, order_details_for_email, tracking_info, shopper_name)
                notification_triggered_type = "order_shipped"
            elif update_data.new_status == 'delivered':
                await send_order_delivered_email(shopper_email, order_details_for_email, shopper_name)
                notification_triggered_type = "order_delivered"
            elif update_data.new_status == 'refund_processed':
                if update_data.refund_amount is None: # Also validated by Pydantic
                    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Refund amount is required for 'refund_processed' status.")
                await send_refund_processed_email(shopper_email, order_details_for_email, str(update_data.refund_amount), shopper_name)
                notification_triggered_type = "refund_processed"

        if update_data.new_status == 'payout_sent_to_merchant':
            if update_data.payout_amount is None: # Also validated by Pydantic
                 raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Payout amount is required for 'payout_sent_to_merchant' status.")
            payout_details = {
                "order_id": str(order_id),
                "amount": str(update_data.payout_amount),
                "currency_symbol": order_details_for_email["currency_symbol"]
            }
            await send_payout_sent_email(merchant_email, payout_details, merchant_name)
            notification_triggered_type = "payout_sent_to_merchant"

        if notification_triggered_type:
            logger.info(f"{notification_triggered_type} email triggered for order {order_id}.")
        else:
            logger.info(f"No specific email notification triggered for status {update_data.new_status} for order {order_id}.")

        # 4. Audit Log
        audit_log_details = update_data.model_dump()
        audit_log_details["order_id"] = order_id # Ensure order_id is int for consistency if using int type elsewhere
        await record_admin_audit_log(
            db_conn=conn,
            admin_username=admin_username,
            action=f"order_status_updated_to_{update_data.new_status}",
            target_entity_type="order",
            target_entity_id=str(order_id),
            details=audit_log_details
        )

        # 5. Fetch and return updated order details
        final_order_response = await fetch_order_details_for_admin_response(order_id, conn)
        if not final_order_response: # Should not happen
            logger.error(f"Failed to retrieve updated order details for order {order_id} after status update.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated order details.")
        return final_order_response


# --- Pioneer Program Application Management Endpoints ---

@router.get(
    "/pioneer-applications",
    response_model=List[PioneerApplicationResponse],
    summary="List Pioneer Program Applications",
    description="""
Retrieves a list of Pioneer Program applications with pagination and filtering options.
- **Protected Endpoint:** Requires admin authentication.
    """
)
async def list_pioneer_applications(
    limit: int = Query(50, ge=1, le=100, description="Number of applications to return."),
    offset: int = Query(0, ge=0, description="Offset for pagination."),
    application_status: Optional[str] = Query(default=None, description="Filter by application status (e.g., 'pending', 'approved')."),
    applying_for_tier: Optional[str] = Query(default=None, description="Filter by the tier applied for."),
    email: Optional[str] = Query(default=None, description="Filter by applicant email (exact match)."),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        base_query = "SELECT * FROM pioneer_applications"
        filter_conditions = []
        params = []
        param_idx = 1

        if application_status:
            filter_conditions.append(f"application_status = ${param_idx}")
            params.append(application_status)
            param_idx += 1
        if applying_for_tier:
            filter_conditions.append(f"applying_for_tier = ${param_idx}")
            params.append(applying_for_tier)
            param_idx += 1
        if email:
            filter_conditions.append(f"email ILIKE ${param_idx}") # Case-insensitive match for email
            params.append(f"%{email}%") # Partial match, or use = for exact
            param_idx += 1

        if filter_conditions:
            base_query += " WHERE " + " AND ".join(filter_conditions)

        base_query += f" ORDER BY submitted_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
        params.extend([limit, offset])

        app_rows = await conn.fetch(base_query, *params)
        return [PioneerApplicationResponse(**dict(row)) for row in app_rows]

    except asyncpg.exceptions.UndefinedTableError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Pioneer applications table not found.")
    except Exception as e:
        print(f"Error listing pioneer applications: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/pioneer-applications/{application_id}",
    response_model=PioneerApplicationResponse,
    summary="Get Specific Pioneer Application",
    description="""
Retrieves detailed information for a specific Pioneer Program application by its ID.
- **Protected Endpoint:** Requires admin authentication.
    """
)
async def get_pioneer_application(
    application_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        query = "SELECT * FROM pioneer_applications WHERE id = $1"
        row = await conn.fetchrow(query, application_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pioneer application with ID {application_id} not found.")
        return PioneerApplicationResponse(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting pioneer application {application_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put(
    "/pioneer-applications/{application_id}/status",
    response_model=PioneerApplicationResponse,
    summary="Update Pioneer Application Status & Notes",
    description="""
Allows an administrator to update the status and internal review notes for a Pioneer Program application.
- Sets `reviewed_at` to the current timestamp and records the `reviewed_by_admin_username`.
- **Protected Endpoint:** Requires admin authentication.
    """
)
async def update_pioneer_application_status(
    application_id: int,
    update_data: PioneerApplicationUpdateAdmin,
    admin_username: str = Depends(get_current_admin_username_placeholder), # Placeholder for actual admin user
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        query = """
            UPDATE pioneer_applications
            SET application_status = $1,
                internal_review_notes = $2,
                reviewed_at = NOW(),
                reviewed_by_admin_username = $3,
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        """
        updated_row = await conn.fetchrow(
            query,
            update_data.application_status,
            update_data.internal_review_notes,
            admin_username,
            application_id
        )
        if not updated_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pioneer application with ID {application_id} not found for update.")

        # Log this action to admin audit log
        audit_details = {
            "updated_application_id": application_id,
            "new_status": update_data.application_status,
            "notes_updated": update_data.internal_review_notes is not None
        }
        await record_admin_audit_log(
            db_conn=conn, # Reusing the connection
            admin_username=admin_username,
            action="pioneer_application_status_update",
            target_entity_type="pioneer_application",
            target_entity_id=str(application_id),
            details=audit_details
        )

        return PioneerApplicationResponse(**dict(updated_row))
    except asyncpg.exceptions.CheckViolationError as e:
        # This can happen if application_status in update_data is not in the CHECK constraint list
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid application status value. Error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating pioneer application {application_id} status: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

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


# --- Admin Pioneer Program Deliverable Management Endpoints ---

@router.post(
    "/pioneer-applications/{application_id}/deliverables",
    response_model=PioneerDeliverableResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin Creates/Assigns a Deliverable for a Pioneer Application",
    description="Allows an admin to create and assign a new deliverable to a specific (approved or onboarded) pioneer application."
)
async def admin_create_pioneer_deliverable(
    application_id: int,
    deliverable_data: PioneerDeliverableCreateAdmin,
    admin_username: str = Depends(get_current_admin_username_placeholder),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Validate application_id exists and is in a suitable state
        app_status = await conn.fetchval("SELECT status FROM pioneer_applications WHERE id = $1", application_id)
        if not app_status:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pioneer application with ID {application_id} not found.")
        if app_status not in ['approved', 'onboarded']:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Deliverables can only be added to 'approved' or 'onboarded' applications. Current status: {app_status}")

        query = """
            INSERT INTO pioneer_deliverables
                (application_id, title, description, due_date, status, reviewed_by_admin_username)
            VALUES ($1, $2, $3, $4, 'pending', $5)
            RETURNING *
        """
        # Admin username is stored when they create/assign it
        row = await conn.fetchrow(
            query,
            application_id,
            deliverable_data.title,
            deliverable_data.description,
            deliverable_data.due_date,
            admin_username
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create pioneer deliverable.")

        # Audit Log
        await record_admin_audit_log(
            db_conn=conn, admin_username=admin_username, action="pioneer_deliverable_create",
            target_entity_type="pioneer_deliverable", target_entity_id=str(row['id']),
            details={"application_id": application_id, "title": deliverable_data.title}
        )
        return PioneerDeliverableResponse(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating pioneer deliverable for app {application_id} by admin {admin_username}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/pioneer-applications/{application_id}/deliverables",
    response_model=List[PioneerDeliverableResponse],
    summary="Admin Lists Deliverables for a Pioneer Application",
    description="Retrieves all deliverables associated with a specific pioneer application."
)
async def admin_list_pioneer_deliverables(
    application_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Check if application exists (optional, but good for context)
        app_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM pioneer_applications WHERE id = $1)", application_id)
        if not app_exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pioneer application with ID {application_id} not found.")

        query = "SELECT * FROM pioneer_deliverables WHERE application_id = $1 ORDER BY due_date ASC, created_at ASC"
        rows = await conn.fetch(query, application_id)
        return [PioneerDeliverableResponse(**dict(row)) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing pioneer deliverables for app {application_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put(
    "/pioneer-deliverables/{deliverable_id}",
    response_model=PioneerDeliverableResponse,
    summary="Admin Updates a Pioneer Deliverable",
    description="Allows an admin to update the details, status, or feedback for a specific pioneer deliverable."
)
async def admin_update_pioneer_deliverable(
    deliverable_id: int,
    update_data: PioneerDeliverableUpdateAdmin,
    admin_username: str = Depends(get_current_admin_username_placeholder),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        update_payload = update_data.model_dump(exclude_unset=True)
        if not update_payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update fields provided.")

        # If status or admin_feedback is updated, also update reviewed_at and reviewed_by_admin_username
        if 'status' in update_payload or 'admin_feedback' in update_payload:
            update_payload['reviewed_at'] = datetime.now(asyncpg. również.timezone.utc) # Ensure timezone aware for DB
            update_payload['reviewed_by_admin_username'] = admin_username

        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_payload.keys())]
        sql_params = list(update_payload.values())
        sql_params.append(deliverable_id)

        update_query = f"""
            UPDATE pioneer_deliverables
            SET {', '.join(set_clauses)}, updated_at = NOW()
            WHERE id = ${len(sql_params)}
            RETURNING *
        """
        updated_row = await conn.fetchrow(update_query, *sql_params)
        if not updated_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pioneer deliverable with ID {deliverable_id} not found.")

        # Audit Log
        await record_admin_audit_log(
            db_conn=conn, admin_username=admin_username, action="pioneer_deliverable_update",
            target_entity_type="pioneer_deliverable", target_entity_id=str(deliverable_id),
            details=update_payload
        )
        return PioneerDeliverableResponse(**dict(updated_row))
    except asyncpg.exceptions.CheckViolationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid status value provided. Error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pioneer deliverable {deliverable_id} by admin {admin_username}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete(
    "/pioneer-deliverables/{deliverable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Admin Deletes a Pioneer Deliverable",
    description="Allows an admin to delete a specific pioneer deliverable."
)
async def admin_delete_pioneer_deliverable(
    deliverable_id: int,
    admin_username: str = Depends(get_current_admin_username_placeholder),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Optionally, check if deliverable exists before deleting to provide 404, or let DELETE handle it.
        result = await conn.execute("DELETE FROM pioneer_deliverables WHERE id = $1", deliverable_id)
        if result == "DELETE 0":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pioneer deliverable with ID {deliverable_id} not found.")

        # Audit Log
        await record_admin_audit_log(
            db_conn=conn, admin_username=admin_username, action="pioneer_deliverable_delete",
            target_entity_type="pioneer_deliverable", target_entity_id=str(deliverable_id)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting pioneer deliverable {deliverable_id} by admin {admin_username}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post(
    "/products/{product_id}/review",
    response_model=Product,
    summary="Review Product (Approve/Reject) and Set Cashback",
    description="""
Allows an administrator to approve or reject a product, optionally add review notes, and set/update the product's cashback percentage.
- Updates the product's `approval_status`, `admin_review_notes`, and `cashback_percentage`.
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
            # updated_at will be set by trigger or explicitly later
        }

        if review_action.admin_notes is not None:
            update_fields["admin_review_notes"] = review_action.admin_notes

        if review_action.new_status == "approved":
            update_fields["is_active"] = True
        elif review_action.new_status == "rejected":
            update_fields["is_active"] = False
        # If new_status is 'pending', is_active behavior might depend on other logic or remain as is.

        # Handle cashback_percentage update
        # If review_action.cashback_percentage is explicitly provided (even if 0.0), update it.
        # If it's None in the request, we don't touch the DB column.
        if review_action.cashback_percentage is not None:
            update_fields["cashback_percentage"] = review_action.cashback_percentage

        if not update_fields: # Should not happen as new_status is required
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid update fields provided.")

        # Dynamically construct SET clauses and parameters
        set_clauses = []
        params = []
        param_idx = 1
        for field, value in update_fields.items():
            set_clauses.append(f"{field} = ${param_idx}")
            params.append(value)
            param_idx += 1

        # Always update updated_at
        set_clauses.append("updated_at = NOW()")

        params.append(product_id) # For WHERE id = $N (which will be param_idx in the final query)

        update_query_sql = f"""
            UPDATE products
            SET {', '.join(set_clauses)}
            WHERE id = ${param_idx}
            RETURNING id, name, description, price, image_url, cashback_percentage,
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
            "admin_notes": review_action.admin_notes, # Will be None if not provided
            "product_name": updated_product_obj.name, # For context in audit log
        }
        if review_action.cashback_percentage is not None:
            audit_details["cashback_percentage_set"] = float(review_action.cashback_percentage) # Ensure float for JSON

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
