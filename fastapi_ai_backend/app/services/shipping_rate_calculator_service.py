import logging
from typing import List, Optional, Dict, Any
from decimal import Decimal, ROUND_HALF_UP
import asyncpg

from app.models.checkout_models import MerchantItemDetail, ShippingAddressInput, CalculatedShippingOption

logger = logging.getLogger(__name__)

async def get_available_shipping_options(
    db_conn: asyncpg.Connection,
    merchant_id: str,
    merchant_items: List[MerchantItemDetail],
    shipping_address: ShippingAddressInput
) -> List[CalculatedShippingOption]:
    """
    Calculates available shipping options for a list of items from a single merchant to a given address.
    V1: Matches country_code, then state_province_code (if provided in zone), then postal_code (if provided in zone).
    Assumes product weights are in kg.
    """
    calculated_options: List[CalculatedShippingOption] = []

    if not merchant_items:
        return []

    # 1. Calculate total weight and value of items for this merchant
    total_weight_kg = sum(item.weight_kg * item.quantity for item in merchant_items if item.weight_kg is not None)
    total_value = sum(item.price * item.quantity for item in merchant_items)

    logger.info(f"Calculating shipping for merchant {merchant_id}: Total Weight={total_weight_kg}kg, Total Value={total_value}")

    # 2. Fetch active shipping methods for the merchant
    active_methods_rows = await db_conn.fetch(
        """
        SELECT id, method_name
        FROM merchant_shipping_methods
        WHERE merchant_id = $1 AND is_active = TRUE
        ORDER BY id
        """,
        merchant_id
    )

    if not active_methods_rows:
        logger.info(f"No active shipping methods found for merchant {merchant_id}.")
        return []

    for method_row in active_methods_rows:
        shipping_method_id = method_row['id']
        method_name = method_row['method_name']
        logger.debug(f"Evaluating method: {method_name} (ID: {shipping_method_id})")

        # 3. Find matching shipping zones for the method and address
        # This query attempts to find the most specific matching zone location.
        # It prioritizes matches with state and postal code, then state only, then country only.
        # A more sophisticated system might use a point-based matching score.
        # Note: PostgreSQL's handling of NULL in UNIQUE constraints means multiple NULLs are allowed.
        # The COALESCE is used here to treat NULL in DB as a wildcard against a provided value,
        # and a provided NULL/empty value as matching a wildcard NULL in DB.

        # Normalize optional address parts to None if empty string for COALESCE logic
        norm_state_code = shipping_address.state_province_code if shipping_address.state_province_code and shipping_address.state_province_code.strip() else None
        norm_postal_code = shipping_address.postal_code if shipping_address.postal_code and shipping_address.postal_code.strip() else None

        matching_zones_query = """
            SELECT DISTINCT sz.id as zone_id, sz.zone_name
            FROM shipping_zones sz
            JOIN shipping_zone_locations szl ON sz.id = szl.shipping_zone_id
            WHERE sz.shipping_method_id = $1
              AND szl.country_code = $2
              AND (szl.state_province_code IS NULL OR szl.state_province_code = $3)
              AND (szl.postal_code_pattern IS NULL OR $4 ILIKE szl.postal_code_pattern OR $4 ~ szl.postal_code_pattern)
            ORDER BY sz.id
            -- This ordering doesn't guarantee "best match", needs more complex logic if overlapping zones are common.
            -- For V1, we might get multiple matching zones and evaluate rates for all.
        """
        # The postal_code_pattern matching might need to be more robust depending on patterns stored (e.g. wildcards, regex)
        # Using ILIKE for simple prefix/suffix wildcards, and ~ for basic regex.
        # If postal_code_pattern is intended for exact match, use =.
        # For now, assuming postal_code_pattern could be like '90*' or a regex.
        # If norm_postal_code is None, the ILIKE/regex match might behave unexpectedly if pattern is not also NULL.
        # A more precise way for postal codes if they are ranges or complex patterns might involve specific functions or more rows.
        # For simplicity, if norm_postal_code is None, we rely on the `szl.postal_code_pattern IS NULL` part of the OR for broader matches.
        # This part of the query is complex to make generic for all pattern types.
        # A simpler V1 might only use country and state.

        # Refined query for locations, trying to find the most specific match first
        # This is still a simplification. True "best match" zoning is complex.
        potential_zones_sql = """
            SELECT sz.id as zone_id, sz.zone_name,
                   (CASE WHEN szl.state_province_code IS NOT NULL THEN 2 ELSE 0 END) +
                   (CASE WHEN szl.postal_code_pattern IS NOT NULL THEN 1 ELSE 0 END) as match_specificity
            FROM shipping_zones sz
            JOIN shipping_zone_locations szl ON sz.id = szl.shipping_zone_id
            WHERE sz.shipping_method_id = $1 AND szl.country_code = $2
              AND (szl.state_province_code IS NULL OR szl.state_province_code = $3)
              AND (
                    szl.postal_code_pattern IS NULL OR
                    ($4 IS NOT NULL AND $4 ILIKE szl.postal_code_pattern) OR
                    ($4 IS NOT NULL AND $4 ~ szl.postal_code_pattern) OR
                    ($4 IS NULL AND szl.postal_code_pattern IS NULL)
                  )
            ORDER BY match_specificity DESC, sz.id
        """
        # This simplified postal matching: if user provides postal, pattern must match. If user doesn't, pattern must be null.

        zone_rows = await db_conn.fetch(
            potential_zones_sql,
            shipping_method_id,
            shipping_address.country_code,
            norm_state_code,
            norm_postal_code
        )

        if not zone_rows:
            logger.debug(f"No matching shipping zones found for method '{method_name}' to {shipping_address.country_code}/{norm_state_code or '*'}/{norm_postal_code or '*'}")
            continue

        # In V1, we might take the first most specific zone, or evaluate all applicable.
        # For simplicity, let's evaluate rates from all matched zones for this method.
        # A real system might only pick the *single* most specific zone for a given method.

        processed_zone_ids_for_this_method = set()

        for zone_row in zone_rows:
            zone_id = zone_row['zone_id']
            zone_name = zone_row['zone_name']

            if zone_id in processed_zone_ids_for_this_method:
                continue # Already processed rates for this zone (due to multiple location matches leading to same zone)
            processed_zone_ids_for_this_method.add(zone_id)

            logger.debug(f"Found matching zone: {zone_name} (ID: {zone_id}) for method '{method_name}'. Specificity: {zone_row['match_specificity']}")

            # 4. Fetch and evaluate rates for this zone
            rate_rows = await db_conn.fetch(
                "SELECT * FROM shipping_rates WHERE shipping_zone_id = $1 ORDER BY base_rate ASC", # Order by base_rate to show cheaper options first potentially
                zone_id
            )

            for rate_row in rate_rows:
                # Evaluate conditions
                if rate_row['condition_min_order_value'] is not None and total_value < rate_row['condition_min_order_value']:
                    continue
                if rate_row['condition_max_order_value'] is not None and total_value > rate_row['condition_max_order_value']:
                    continue
                if rate_row['condition_min_weight_kg'] is not None and total_weight_kg < rate_row['condition_min_weight_kg']:
                    continue
                if rate_row['condition_max_weight_kg'] is not None and total_weight_kg > rate_row['condition_max_weight_kg']:
                    continue

                final_cost = Decimal("0.00")
                if rate_row['is_free_shipping']:
                    final_cost = Decimal("0.00")
                else:
                    final_cost = rate_row['base_rate']
                    if rate_row['rate_per_kg'] is not None and total_weight_kg > 0:
                        final_cost += (rate_row['rate_per_kg'] * total_weight_kg)

                # Ensure cost is not negative and rounded
                final_cost = max(Decimal("0.00"), final_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

                calculated_options.append(CalculatedShippingOption(
                    shipping_method_id=shipping_method_id,
                    method_name=method_name,
                    zone_name=zone_name,
                    rate_name=rate_row['rate_name'],
                    cost=final_cost,
                    # est_delivery_days are not in shipping_rates table, would come from shipping_method or zone potentially
                    estimated_delivery_min_days=None, # Placeholder for V1
                    estimated_delivery_max_days=None, # Placeholder for V1
                    is_free_shipping=rate_row['is_free_shipping']
                ))
                logger.debug(f"Applicable rate for zone '{zone_name}': {rate_row['rate_name'] or 'Base Rate'}, Cost: {final_cost}")

    # Sort options by cost (cheapest first)
    calculated_options.sort(key=lambda opt: opt.cost)

    logger.info(f"Found {len(calculated_options)} shipping options for merchant {merchant_id} to {shipping_address.country_code}")
    return calculated_options

# Placeholder for product details fetching, assuming products table has weight_kg
# This would be more complex in reality, involving variant checks, etc.
async def get_item_details_for_checkout(
    db_conn: asyncpg.Connection,
    cart_items: List[Dict[str, Any]] # e.g. [{"product_id": "x", "variant_id": y, "quantity": z}]
) -> Dict[str, List[MerchantItemDetail]]:
    """
    Fetches product details (price, weight, merchant_id, name) for items in cart.
    Groups items by merchant_id.
    This is a simplified placeholder. A real version needs robust product/variant lookup.
    """
    # This function is a conceptual helper. The actual implementation will be in the router.
    pass
