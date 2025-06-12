import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg

from app.models.order_placeholder_models import (
    OrderCreatePlaceholder,
    OrderResponsePlaceholder,
    OrderItemPlaceholder,
    CartItemInput # Used by checkout_item_service
)
from app.models.checkout_models import MerchantItemDetail # For the result of item detail fetching
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id
from app.services.checkout_item_service import get_checkout_item_details # New service for authoritative item data
from app.email_utils import (
    send_order_confirmation_email,
    send_new_order_to_merchant_email,
    FRONTEND_BASE_URL # For constructing links
)

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Orders (Placeholder)"],
    # prefix will be /api/orders (from main.py)
)

@router.post(
    "/placeholder-create-order",
    response_model=OrderResponsePlaceholder,
    status_code=status.HTTP_201_CREATED,
    summary="Create Placeholder Order & Trigger Emails",
    description="Simulates order creation and triggers Order Confirmation (shopper) and New Order Received (merchant) email notifications."
)
async def create_placeholder_order(
    order_payload: OrderCreatePlaceholder,
    current_shopper_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection) # For fetching shopper details
):
import json # For variant_attributes_snapshot

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Orders (Placeholder)"],
    # prefix will be /api/orders (from main.py)
)

@router.post(
    "/placeholder-create-order",
    response_model=OrderResponsePlaceholder,
    status_code=status.HTTP_201_CREATED,
    summary="Create Placeholder Order, Store in DB & Trigger Emails",
    description="Simulates order creation, fetches product details from DB for accuracy, stores order and items in DB within a transaction, and triggers email notifications."
)
async def create_placeholder_order(
    order_payload: OrderCreatePlaceholder, # Client now only sends product_id, variant_id, quantity for items
    current_shopper_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    logger.info(f"Placeholder order creation initiated by shopper: {current_shopper_id} with {len(order_payload.items)} item types.")

    # 1. Fetch authoritative item details from DB using the new service
    # Convert OrderItemPlaceholder (input) to CartItemInput for get_checkout_item_details
    cart_items_for_fetcher = [
        CartItemInput(product_id=item.product_id, variant_id=item.variant_id, quantity=item.quantity)
        for item in order_payload.items
    ]
    try:
        authoritative_item_details: List[MerchantItemDetail] = await get_checkout_item_details(conn, cart_items_for_fetcher)
    except HTTPException as e:
        logger.error(f"Error fetching item details during order creation: {e.detail}")
        raise e # Propagate client-facing errors (400, 404 for items)
    except Exception as e:
        logger.error(f"Unexpected error fetching item details: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error validating cart items.")

    if not authoritative_item_details or len(authoritative_item_details) != len(order_payload.items):
        # This case implies some items were not found or were invalid,
        # and get_checkout_item_details already raised an HTTPException.
        # If it didn't (e.g., returned empty list for some reason), this is a fallback.
        logger.error("Mismatch in item count or empty details returned by item fetcher.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more items in the cart are invalid or unavailable.")

    # 2. Recalculate total_amount on the server based on fetched prices
    server_calculated_total_amount = Decimal("0.00")
    for i, auth_item in enumerate(authoritative_item_details):
        # Original cart item quantity is needed
        original_cart_item = order_payload.items[i] # Assumes order is maintained
        server_calculated_total_amount += auth_item.price * original_cart_item.quantity

    logger.info(f"Server calculated total amount: {server_calculated_total_amount} {order_payload.currency}")

    # Initialize variables for DB results
    db_order_id: Optional[int] = None
    db_order_created_at: Optional[datetime] = None
    db_order_status: str = "pending_payment"

    async with conn.transaction():
        # 3. Insert into 'orders' table with server-calculated total
        try:
            order_insert_query = """
                INSERT INTO orders (user_id, amount, currency, status, shipping_address_summary, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                RETURNING id, created_at, status
            """
            order_row = await conn.fetchrow(
                order_insert_query,
                current_shopper_id,
                server_calculated_total_amount, # Use server-calculated total
                order_payload.currency,
                db_order_status,
                order_payload.shipping_address_summary
            )
            if not order_row:
                logger.error("Failed to insert into orders table.")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Order creation failed at order table insertion.")

            db_order_id = order_row['id']
            db_order_created_at = order_row['created_at']
            db_order_status = order_row['status']
            logger.info(f"Order record created with ID: {db_order_id}")

        except Exception as e_order_insert:
            logger.error(f"Error inserting into orders table: {e_order_insert}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Order creation error: {e_order_insert}")

        # 4. Insert into 'order_items' table using authoritative data
        if db_order_id is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Order ID not available for item insertion.")

        for auth_item in authoritative_item_details:
            try:
                # variant_attributes_snapshot would ideally come from variant details if fetched
                variant_attributes_snapshot_json = json.dumps({}) # Placeholder for V1

                item_insert_query = """
                    INSERT INTO order_items (
                        order_id, product_id, variant_id, quantity, price_per_item,
                        product_name_snapshot, variant_attributes_snapshot, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                """
                await conn.execute(
                    item_insert_query,
                    db_order_id, auth_item.product_id, auth_item.variant_id, auth_item.quantity, # auth_item.quantity is from CartItemInput
                    auth_item.price, auth_item.name, variant_attributes_snapshot_json
                )
            except Exception as e_item_insert:
                logger.error(f"Error inserting item {auth_item.product_id} for order {db_order_id}: {e_item_insert}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Order creation failed at item insertion: {e_item_insert}")

        logger.info(f"All {len(authoritative_item_details)} items inserted for order ID: {db_order_id}")

    # --- Conceptual Merchant Identification (remains placeholder) ---
    # In a real system, you'd iterate items, find their merchants, and potentially send multiple merchant notifications.
    conceptual_merchant_email = "merchant@example.com" # Hardcoded for placeholder
    conceptual_merchant_name = "Demo Merchant Store"    # Hardcoded for placeholder

    # --- Fetch Shopper Details for Email ---
    shopper_email_for_notification: Optional[str] = None
    shopper_name_for_notification: str = "Valued Shopper"

    try:
        shopper_user_row = await conn.fetchrow(
            "SELECT email, full_name FROM users WHERE id = $1", current_shopper_id
        )
        if shopper_user_row:
            shopper_email_for_notification = shopper_user_row['email']
            shopper_name_for_notification = shopper_user_row['full_name'] or shopper_name_for_notification
        else:
            logger.error(f"Could not find user details for shopper_id: {current_shopper_id} for email notification.")
    except Exception as e_user_fetch:
        logger.error(f"Error fetching shopper details for {current_shopper_id} for email notification: {e_user_fetch}")

    # --- Prepare Order Details for Email Context ---
    order_items_summary_list = [
        f"- {item.name} (Product ID: {item.product_id}, Variant ID: {item.variant_id or 'N/A'}), Qty: {item.quantity}, Price: {item.price} {order_payload.currency}"
        for item in authoritative_item_details # Use authoritative details for summary
    ]
    order_items_summary_text = "\n".join(order_items_summary_list)

    order_details_for_email_dict = {
        "id": str(db_order_id),
        "total_amount": str(server_calculated_total_amount), # Use server-calculated total
        "currency_symbol": "$" if order_payload.currency == "USD" else order_payload.currency,
        "currency": order_payload.currency,
        "shipping_address": order_payload.shipping_address_summary,
        "order_url": f"{FRONTEND_BASE_URL}/shopper/orders/{db_order_id}",
        "order_items_summary": order_items_summary_text,
        "customer_info": {
            "name": shopper_name_for_notification,
            "user_id": current_shopper_id,
            "email": shopper_email_for_notification
        },
        "merchant_order_url": f"{FRONTEND_BASE_URL}/merchant/orders/{db_order_id}"
    }

    # --- Send Shopper Order Confirmation Email ---
    if shopper_email_for_notification:
        try:
            email_sent_shopper = await send_order_confirmation_email(
                to_email=shopper_email_for_notification,
                order_details=order_details_for_email_dict,
                user_name=str(shopper_name_for_notification)
            )
            if email_sent_shopper:
                logger.info(f"Order confirmation email successfully sent/simulated to shopper {shopper_email_for_notification} for order {db_order_id}.")
            else:
                logger.warning(f"Failed to send/simulate order confirmation email to shopper {shopper_email_for_notification} for order {db_order_id}.")
        except Exception as e_shopper_email:
            logger.error(f"Error sending order confirmation email to {shopper_email_for_notification}: {e_shopper_email}")
    else:
        logger.warning(f"No email found for shopper {current_shopper_id}; cannot send order confirmation email for order {db_order_id}.")

    # --- Send Merchant New Order Received Email ---
    try:
        email_sent_merchant = await send_new_order_to_merchant_email(
            email_to=conceptual_merchant_email,
            order_details=order_details_for_email_dict,
            merchant_name=conceptual_merchant_name
        )
        if email_sent_merchant:
            logger.info(f"New order notification email successfully sent/simulated to merchant {conceptual_merchant_email} for order {db_order_id}.")
        else:
            logger.warning(f"Failed to send/simulate new order notification email to merchant {conceptual_merchant_email} for order {db_order_id}.")
    except Exception as e_merchant_email:
        logger.error(f"Error sending new order notification to merchant {conceptual_merchant_email}: {e_merchant_email}")

    # --- Construct and Return Response ---
    # Ensure db_order_id and db_order_created_at are not None before using
    if db_order_id is None or db_order_created_at is None:
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Order creation failed to return necessary ID or date.")


    response_data = OrderResponsePlaceholder(
        order_id=db_order_id,
        shopper_user_id=current_shopper_id,
        items=order_payload.items, # Echo back original input items structure
        total_amount=server_calculated_total_amount, # Use server-calculated total
        shipping_address_summary=order_payload.shipping_address_summary,
        currency=order_payload.currency,
        order_status=db_order_status,
        order_date=db_order_created_at
    )

    logger.info(f"Placeholder order {db_order_id} successfully created in DB and processed for shopper {current_shopper_id}.")
    return response_data
