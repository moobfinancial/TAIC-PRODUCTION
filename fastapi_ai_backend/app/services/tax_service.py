import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional
import asyncpg

from app.models.tax_models import MerchantTaxSettingsResponse # To potentially map DB row

logger = logging.getLogger(__name__)

async def calculate_tax_for_order(
    db_conn: asyncpg.Connection,
    merchant_id: str,
    order_subtotal: Decimal,
    shipping_cost: Decimal,
    shipping_address: Dict[str, Any] # Unused in V1 placeholder, but good for signature
) -> Decimal:
    """
    Calculates tax for an order based on the merchant's V1 tax settings.
    This is a V1 placeholder implementation.

    Args:
        db_conn: Active database connection.
        merchant_id: The ID of the merchant for whom to calculate tax.
        order_subtotal: The subtotal of the order (sum of item prices).
        shipping_cost: The shipping cost for the order.
        shipping_address: A dictionary containing shipping address details (e.g., country, state, postal_code).
                          This is NOT used in the V1 placeholder but included for future compatibility.

    Returns:
        The calculated tax amount as a Decimal. Returns Decimal("0.00") if no tax is applicable.
    """
    logger.info(f"V1 Tax Calculation: Initiating for merchant_id: {merchant_id}, subtotal: {order_subtotal}, shipping: {shipping_cost}")

    tax_settings_row = await db_conn.fetchrow(
        "SELECT collects_tax, default_tax_rate_percentage FROM merchant_tax_settings WHERE merchant_id = $1",
        merchant_id
    )

    if not tax_settings_row:
        logger.warning(f"V1 Tax Calculation: No tax settings found for merchant_id: {merchant_id}. Assuming no tax.")
        return Decimal("0.00")

    # In a real scenario, you might map to MerchantTaxSettingsResponse for cleaner access,
    # but direct dict access is also fine for this simple case.
    # tax_settings = MerchantTaxSettingsResponse(**dict(tax_settings_row))

    collects_tax = tax_settings_row['collects_tax']
    default_tax_rate_percentage = tax_settings_row['default_tax_rate_percentage']

    if not collects_tax or default_tax_rate_percentage is None or default_tax_rate_percentage <= Decimal("0"):
        logger.info(f"V1 Tax Calculation: Merchant {merchant_id} does not collect tax or rate is not set/invalid. Tax: 0.00")
        return Decimal("0.00")

    # V1: Assume shipping cost is taxable.
    taxable_amount = order_subtotal + shipping_cost

    tax_rate = default_tax_rate_percentage / Decimal("100")
    calculated_tax = taxable_amount * tax_rate

    # Standard rounding for currency (e.g., to 2 decimal places)
    quantizer = Decimal("0.01")
    rounded_tax = calculated_tax.quantize(quantizer, rounding=ROUND_HALF_UP)

    logger.info(f"V1 Tax Calculation: Merchant {merchant_id}, Taxable Amount: {taxable_amount}, Rate: {default_tax_rate_percentage}%, Calculated Tax: {rounded_tax}")

    # In a V2+, you would use shipping_address to determine regional tax rates,
    # potentially involving more complex lookups or third-party tax API calls.
    # For example:
    # if shipping_address.get('country_code') == 'US' and shipping_address.get('state_code') == 'CA':
    #     # Apply California specific tax rules...
    # else:
    #     # Use default or other rules...

    return rounded_tax

async def get_merchant_tax_settings_with_defaults(
    conn: asyncpg.Connection,
    merchant_id: str
) -> MerchantTaxSettingsResponse:
    """
    Fetches tax settings for a merchant. If no record exists,
    returns a MerchantTaxSettingsResponse with default values.
    """
    settings_row = await conn.fetchrow(
        "SELECT * FROM merchant_tax_settings WHERE merchant_id = $1",
        merchant_id
    )
    if settings_row:
        return MerchantTaxSettingsResponse(**dict(settings_row))
    else:
        # Return default response if no settings found
        return MerchantTaxSettingsResponse(
            merchant_id=merchant_id,
            collects_tax=False,
            default_tax_rate_percentage=None,
            tax_registration_id=None,
            notes=None,
            created_at=datetime.utcnow(), # Placeholder, not actually created
            updated_at=datetime.utcnow()  # Placeholder
        )
