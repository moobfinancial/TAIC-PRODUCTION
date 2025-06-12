import logging
from typing import List, Optional, Dict, Any
from decimal import Decimal
import asyncpg
from fastapi import HTTPException, status

from app.models.checkout_models import CartItemInput, MerchantItemDetail

logger = logging.getLogger(__name__)

async def get_checkout_item_details(
    db_conn: asyncpg.Connection,
    cart_items: List[CartItemInput]
) -> List[MerchantItemDetail]:
    """
    Fetches authoritative details (price, name, weight, merchant_id, source)
    for a list of cart items from the database.
    Raises HTTPException if any item is not found, not active, or not approved.
    Assumes 'weight_kg' column exists on 'products' table (nullable).
    """
    processed_items: List[MerchantItemDetail] = []
    product_ids_to_fetch = list(set(item.product_id for item in cart_items if not item.variant_id))
    variant_ids_to_fetch = list(set(item.variant_id for item in cart_items if item.variant_id is not None))

    # Fetch base product details for all relevant product_ids
    # (including those that have variants, as we need merchant_id, source, base name/weight)
    all_involved_product_ids = list(set(item.product_id for item in cart_items))
    product_details_map: Dict[str, Dict[str, Any]] = {}
    if all_involved_product_ids:
        query_products = """
            SELECT id, name, price, merchant_id, source, weight_kg, is_active, approval_status, has_variants
            FROM products
            WHERE id = ANY($1::VARCHAR[])
        """
        product_rows = await db_conn.fetch(query_products, all_involved_product_ids)
        for row in product_rows:
            if not row['is_active'] or row['approval_status'] != 'approved':
                logger.warning(f"Product {row['id']} is not available (active/approved).")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {row['name']} (ID: {row['id']}) is currently not available for purchase."
                )
            product_details_map[row['id']] = dict(row)

    # Fetch variant specific details if variant_ids are present
    variant_details_map: Dict[int, Dict[str, Any]] = {}
    if variant_ids_to_fetch:
        query_variants = """
            SELECT id, product_id, sku, attributes, specific_price, image_url
            -- Add weight_kg_override here if product_variants table gets it
            FROM product_variants
            WHERE id = ANY($1::INTEGER[])
        """
        # TODO: Add check for product.is_active and approval_status for variants as well via JOIN.
        # For now, relying on the product-level check done above.
        variant_rows = await db_conn.fetch(query_variants, variant_ids_to_fetch)
        for row in variant_rows:
            variant_details_map[row['id']] = dict(row)

    for cart_item in cart_items:
        base_product_data = product_details_map.get(cart_item.product_id)
        if not base_product_data:
            logger.warning(f"Product ID {cart_item.product_id} from cart not found in fetched product details.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {cart_item.product_id} not found or is unavailable."
            )

        item_name: str = base_product_data['name']
        item_price: Decimal = Decimal(str(base_product_data['price'])) # Default to product price
        # Conceptual: Default weight from product, variant might override if schema supported it
        item_weight_kg = Decimal(str(base_product_data.get('weight_kg', "0.100"))) \
            if base_product_data.get('weight_kg') is not None else Decimal("0.100")


        if cart_item.variant_id:
            if not base_product_data['has_variants']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {base_product_data['name']} (ID: {cart_item.product_id}) does not have variants, but variant ID {cart_item.variant_id} was specified."
                )

            variant_data = variant_details_map.get(cart_item.variant_id)
            if not variant_data:
                logger.warning(f"Variant ID {cart_item.variant_id} for product {cart_item.product_id} not found.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Variant with ID {cart_item.variant_id} for product {cart_item.product_id} not found."
                )
            if variant_data['product_id'] != cart_item.product_id:
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Variant ID {cart_item.variant_id} does not belong to product ID {cart_item.product_id}."
                )

            # Construct name from product name and variant attributes
            # Example: "T-Shirt - Color: Red, Size: M"
            attribute_strings = []
            if isinstance(variant_data.get('attributes'), dict):
                for key, value in variant_data['attributes'].items():
                    attribute_strings.append(f"{key}: {value}")
            item_name = f"{base_product_data['name']} ({', '.join(attribute_strings)})" if attribute_strings else base_product_data['name']

            if variant_data.get('specific_price') is not None:
                item_price = Decimal(str(variant_data['specific_price']))

            # If variant_weight_override exists in schema, use it here
            # item_weight_kg = Decimal(str(variant_data.get('weight_kg_override', item_weight_kg)))

        elif base_product_data['has_variants']: # Product has variants, but no variant_id was specified
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product {base_product_data['name']} (ID: {cart_item.product_id}) has variants. Please specify a variant ID."
            )

        processed_items.append(MerchantItemDetail(
            product_id=cart_item.product_id,
            variant_id=cart_item.variant_id,
            quantity=cart_item.quantity,
            name=item_name,
            price=item_price,
            weight_kg=item_weight_kg,
            merchant_id=base_product_data['merchant_id'],
            source=base_product_data.get('source')
        ))
        logger.debug(f"Processed item for checkout: {processed_items[-1].model_dump_json()}")

    return processed_items
