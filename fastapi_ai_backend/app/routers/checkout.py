import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
from decimal import Decimal

from app.models.checkout_models import (
    CheckoutCalculationRequest,
    CheckoutCalculationResponse,
    MerchantSubtotal,
    MerchantItemDetail,
    CalculatedShippingOption,
    CartItemInput, # For iterating
    ShippingAddressInput # For passing to service
)

from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id
from app.services.shipping_rate_calculator_service import get_available_shipping_options
from app.services.tax_service import calculate_tax_for_order # V1 tax calculator
from app.services.checkout_item_service import get_checkout_item_details # New service

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Checkout Orchestration"],
    prefix="/api/checkout", # Prefix for all checkout related endpoints
)

# --- Placeholder for Product/Variant Detail Fetching ---
# In a real system, this would query the DB for products and variants
async def fetch_item_details_from_db(
    conn: asyncpg.Connection,
    cart_item: CartItemInput
) -> Optional[Dict[str, Any]]:
    """
    Placeholder: Fetches product/variant details including price, merchant_id, name, weight_kg.
    Returns a dict or None if not found.
    Assumes products table has merchant_id and weight_kg.
    If variant_id is present, it should ideally fetch variant-specific price/weight.
    """
    # This is highly simplified. A real implementation would join products and product_variants.
    # It also assumes a 'weight_kg' column on the 'products' table for V1.
    # --- THIS PLACEHOLDER FUNCTION IS NOW REPLACED BY THE checkout_item_service.py ---
    # if cart_item.variant_id:
    #     query_variant_adjusted = """
    #         SELECT
    #             p.id as product_id,
    #             pv.id as variant_id,
    #             p.name || ' (' || pv.sku || ')' as name,
    #             COALESCE(pv.specific_price, p.price) as price,
    #             p.merchant_id,
    #             p.weight_kg
    #         FROM products p
    #         JOIN product_variants pv ON p.id = pv.product_id
    #         WHERE p.id = $1 AND pv.id = $2 AND p.is_active = TRUE AND p.approval_status = 'approved'
    #     """
    #     row = await conn.fetchrow(query_variant_adjusted, cart_item.product_id, cart_item.variant_id)
    # else:
    #     query_product = """
    #         SELECT id as product_id, name, price, merchant_id, weight_kg
    #         FROM products
    #         WHERE id = $1 AND is_active = TRUE AND approval_status = 'approved' AND has_variants = FALSE
    #     """
    #     row = await conn.fetchrow(query_product, cart_item.product_id)

    # if row:
    #     return dict(row)
    # logger.warning(f"Could not fetch details for product_id: {cart_item.product_id}, variant_id: {cart_item.variant_id}")
    # return None
    pass # Placeholder function removed


@router.post(
    "/calculate-totals",
    response_model=CheckoutCalculationResponse,
    summary="Calculate Checkout Totals (Shipping & Tax V1)",
    description="Calculates estimated shipping options and taxes for a given cart and shipping address. This is V1 and uses placeholder logic for some calculations."
)
async def calculate_checkout_totals(
    request_data: CheckoutCalculationRequest,
    current_user_id: str = Depends(get_current_active_user_id), # For context, not directly used in V1 calcs beyond logging perhaps
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    logger.info(f"Checkout calculation request for user {current_user_id}, items: {len(request_data.items)}, address: {request_data.shipping_address.country_code}")

    # 1. Fetch authoritative item details from DB using the new service
    try:
        authoritative_items_details = await get_checkout_item_details(conn, request_data.items)
    except HTTPException as e: # Propagate HTTP exceptions from service (e.g. item not found/unavailable)
        raise e
    except Exception as e:
        logger.error(f"Unexpected error fetching item details for checkout: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error preparing cart for checkout.")

    if not authoritative_items_details:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid items found to process for checkout.")

    # Group fetched items by merchant_id
    merchant_grouped_items: Dict[str, List[MerchantItemDetail]] = {}
    for item_detail in authoritative_items_details:
        # Ensure merchant_id is present (should be guaranteed by get_checkout_item_details)
        if not item_detail.merchant_id:
            logger.error(f"Item {item_detail.product_id} missing merchant_id after authoritative fetch. Skipping.")
            continue # Should ideally not happen
        if item_detail.merchant_id not in merchant_grouped_items:
            merchant_grouped_items[item_detail.merchant_id] = []
        merchant_grouped_items[item_detail.merchant_id].append(item_detail)

    if not merchant_grouped_items: # If all items somehow missed merchant_id
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not process items: merchant information missing.")

    # 2. For each merchant group, calculate subtotals, shipping, tax
    merchant_breakdowns: List[MerchantSubtotal] = []
    grand_total = Decimal("0.00")

    for merchant_id, items_for_merchant in merchant_grouped_items.items():
        logger.info(f"Processing merchant group: {merchant_id} with {len(items_for_merchant)} item types.")
        items_subtotal = sum(item.price * item.quantity for item in items_for_merchant)

        available_shipping_options = await get_available_shipping_options(
            db_conn=conn,
            merchant_id=merchant_id,
            merchant_items=items_for_merchant,
            shipping_address=request_data.shipping_address
        )

        # V1: For tax calculation, we don't have a "selected" shipping option yet.
        # Tax calculation might use items_subtotal only, or a default/cheapest shipping if rules require taxing shipping.
        # For this placeholder, assume tax is on items_subtotal only for simplicity, or items + cheapest shipping.
        # Let's assume items_subtotal + cheapest available shipping (if any) is taxed.
        cheapest_shipping_cost = Decimal("0.00")
        if available_shipping_options:
            cheapest_shipping_cost = min(opt.cost for opt in available_shipping_options) if available_shipping_options else Decimal("0.00")
            # If there's a free option, that's the cheapest.
            if any(opt.is_free_shipping for opt in available_shipping_options):
                cheapest_shipping_cost = Decimal("0.00")


        # For V1, selected_shipping_cost is not determined here. Client might choose or it's pre-selected.
        # We'll use the cheapest available for tax calculation for now.
        # A more advanced version might return all options, let client choose, then re-calculate or confirm.

        tax_amount = await calculate_tax_for_order(
            db_conn=conn,
            merchant_id=merchant_id,
            order_subtotal=items_subtotal,
            shipping_cost=cheapest_shipping_cost, # V1: Assume cheapest shipping is taxed
            shipping_address=request_data.shipping_address.model_dump()
        )

        # Total for merchant: items + (selected or cheapest) shipping + tax
        # Since we don't have a "selected" shipping yet, this total is illustrative.
        # The frontend would typically update this once a shipping option is chosen.
        # For this response, let's assume no shipping is selected yet, or use cheapest.
        # If we include selected_shipping_cost as None, total_for_merchant should reflect that.

        current_selected_shipping_cost = None # Placeholder for V1, client would select
        if available_shipping_options: # Default to cheapest if available for display/initial calculation
            current_selected_shipping_cost = cheapest_shipping_cost


        total_for_merchant = items_subtotal + tax_amount
        if current_selected_shipping_cost is not None:
            total_for_merchant += current_selected_shipping_cost

        merchant_breakdowns.append(MerchantSubtotal(
            merchant_id=merchant_id,
            items_subtotal=items_subtotal,
            available_shipping_options=available_shipping_options,
            selected_shipping_cost=current_selected_shipping_cost, # V1: Could be None or cheapest
            tax_amount=tax_amount,
            total_for_merchant=total_for_merchant
        ))

        grand_total += total_for_merchant

    return CheckoutCalculationResponse(
        merchant_breakdown=merchant_breakdowns,
        grand_total=grand_total,
        currency=request_data.currency # Assuming single currency for whole checkout for V1
    )
