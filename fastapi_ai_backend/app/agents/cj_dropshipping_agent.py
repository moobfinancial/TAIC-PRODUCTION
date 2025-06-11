import logging
import json
from typing import List, Optional, Dict, Any

from fastapi import HTTPException, status
from fastapi_mcp import FastMCP, ToolContext
import asyncpg
from typing import Set # Added Set

from app.models.cj_product_models import (
    CJProductDetailRequest,
    CJProductStockRequest, CJProductStockStatus, VariantStockInfo,
    CJProductShippingRequest, CJProductShippingInfo # Added Shipping models
)
from app.models.product import Product, ProductVariant # Using the main Product model for response
from app.db import get_db_connection, release_db_connection

logger = logging.getLogger(__name__)

cj_dropshipping_mcp_server = FastMCP(
    name="CJDropshippingService",
    title="TAIC CJ Dropshipping Service",
    description="An AI agent that interacts with CJ Dropshipping product data stored locally.",
    version="0.1.0"
)

@cj_dropshipping_mcp_server.tool(
    name="get_cj_product_details",
    description="Retrieves detailed information for a specific CJ Dropshipping product from the local database.",
    input_model=CJProductDetailRequest,
    output_model=Product
)
async def get_cj_product_details(ctx: ToolContext, request_data: CJProductDetailRequest) -> Product:
    logger.info(f"Received request for CJ Product ID: {request_data.cj_product_id}")

    conn: Optional[asyncpg.Connection] = None
    try:
        conn = await get_db_connection()

        query = """
            SELECT
                p.cj_product_id,
                p.display_name,
                p.display_description,
                p.selling_price,
                p.platform_category_id,
                c.name as category_name,
                p.image_url,
                p.variants_json, -- This contains variant info from CJ
                p.source,
                p.is_active,
                p.cj_base_price,
                p.additional_image_urls_json
                -- Assuming other fields for the main `Product` model might be defaulted or not applicable here
            FROM cj_products p
            LEFT JOIN categories c ON p.platform_category_id = c.id
            WHERE p.cj_product_id = $1
        """

        row = await conn.fetchrow(query, request_data.cj_product_id)

        if not row:
            logger.warning(f"CJ Product with ID '{request_data.cj_product_id}' not found in cj_products table.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CJ Product not found.")

        product_data = dict(row)

        # Map cj_products fields to our unified Product model fields
        product_id = product_data.get('cj_product_id')

        has_variants_flag = False
        variant_attribute_names_set: Set[str] = set() # Use a set to store unique attribute names
        calculated_stock_quantity = 0 # Default stock

        variants_json_data = product_data.get('variants_json')
        if variants_json_data:
            logger.debug(f"Processing variants_json for CJ Product ID {product_id}. Type: {type(variants_json_data)}")
            if isinstance(variants_json_data, str):
                try:
                    variants_json_data = json.loads(variants_json_data)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse variants_json string for CJ Product ID {product_id}. Content: {variants_json_data}")
                    variants_json_data = []

            if isinstance(variants_json_data, list) and len(variants_json_data) > 0:
                has_variants_flag = True
                temp_stock_sum = 0
                for cj_variant in variants_json_data:
                    if not isinstance(cj_variant, dict):
                        logger.warning(f"Skipping non-dict item in variants_json for CJ Product {product_id}: {cj_variant}")
                        continue

                    # Extract attribute names
                    # CJ variant attributes might be a list of dicts like [{"name": "Color", "value": "Red"}, ...]
                    # or a direct dict like {"Color": "Red", ...}. We need to handle this.
                    # The common `ProductVariant` model uses `Dict[str, Any]`.
                    # For `variant_attribute_names` we just need the keys.

                    # Assuming CJ `attributes` is a dict like {"Color": "Red", "Size": "M"}
                    # Or it could be a list of attributes like [{"attributeName": "Color", "attributeValue": "Red"}]
                    # Let's try to infer from a common CJ structure if 'attributes' key exists.
                    # A more robust solution would require knowing the exact CJ variants_json structure.

                    variant_attrs = cj_variant.get('attributes') # Placeholder name for CJ attribute field
                    if isinstance(variant_attrs, dict):
                        for attr_name in variant_attrs.keys():
                            variant_attribute_names_set.add(str(attr_name).strip())
                    elif isinstance(variant_attrs, list): # e.g. [{"name": "Color", "value": "Red"}]
                        for attr_item in variant_attrs:
                            if isinstance(attr_item, dict) and 'name' in attr_item:
                                variant_attribute_names_set.add(str(attr_item['name']).strip())
                    # If 'attributes' is not a dict or list, or not present, we might look for known CJ keys like 'variantName'
                    # Example: if variantName is "Red,S", split and try to infer attribute names.
                    # This part is highly dependent on the actual variants_json structure.
                    # For now, focusing on a simple dict or list of dicts under 'attributes' key.
                    # If 'attributes' key is not found, try to get names from other common variant fields.
                    if not variant_attrs:
                        # Fallback: Check for common individual attribute keys if 'attributes' is not structured as expected
                        # This is highly speculative and depends on CJ's JSON structure.
                        for potential_attr_key in cj_variant.keys():
                            if "name" in potential_attr_key.lower() or "type" in potential_attr_key.lower() or "option" in potential_attr_key.lower():
                                 # This is too broad, needs specific CJ structure knowledge.
                                 # For now, we will rely on a top-level 'attributes' field in each variant object.
                                 pass

                    # Sum stock
                    try:
                        variant_stock = cj_variant.get('variantStock') # Assuming key name from previous iteration
                        if variant_stock is not None:
                            temp_stock_sum += int(variant_stock)
                    except (ValueError, TypeError):
                        logger.warning(f"Could not parse stock for a variant of CJ Product {product_id}. Variant data: {cj_variant}")

                calculated_stock_quantity = temp_stock_sum
            elif not isinstance(variants_json_data, list):
                 logger.warning(f"variants_json for CJ Product ID {product_id} is not a list as expected after parsing. Type: {type(variants_json_data)}")

        if not variant_attribute_names_set and has_variants_flag and isinstance(variants_json_data, list) and variants_json_data:
            # If it has variants but we couldn't find attribute names via an 'attributes' key,
            # try to infer from the first variant's top-level keys (excluding known ones like price/stock/sku).
            logger.debug(f"Attempting to infer attribute names from first variant keys for CJ Product {product_id}")
            first_variant_keys = set(variants_json_data[0].keys())
            known_non_attr_keys = {'variantsku', 'variantsellprice', 'variantstock', 'variantimage', 'variantid', 'productid'} # lowercase
            for key in first_variant_keys:
                if key.lower() not in known_non_attr_keys and not isinstance(variants_json_data[0][key], (dict, list)):
                    variant_attribute_names_set.add(key.strip())


        product_response = Product(
            id=str(product_id),
            name=product_data.get('display_name', 'N/A'),
            description=product_data.get('display_description'),
            price=float(product_data.get('selling_price', 0.0)),
            category=product_data.get('category_name'),
            image_url=product_data.get('image_url'),
            has_variants=has_variants_flag,
            variants=[], # Per subtask decision, this remains empty for CJ products for now
            variant_attribute_names=sorted(list(variant_attribute_names_set)), # Populate this new field
            source=str(product_data.get('source', 'CJ')),
            approval_status="approved",
            merchant_id="CJ_DROPSHIPPING_MERCHANT",
            stock_quantity=calculated_stock_quantity, # Use summed stock
            original_cj_product_id=str(product_id)
        )

        logger.info(f"Successfully fetched and mapped CJ Product ID: {request_data.cj_product_id}. Has Variants: {has_variants_flag}. Attribute Names: {product_response.variant_attribute_names}. Stock: {calculated_stock_quantity}")
        return product_response

    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except asyncpg.exceptions.UndefinedTableError:
        logger.critical("CRITICAL: 'cj_products' or 'categories' table does not exist. CJ Product detail retrieval failed.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Product data system is temporarily unavailable.")
    except Exception as e:
        logger.error(f"Unexpected error fetching CJ Product ID {request_data.cj_product_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while fetching product details.")
    finally:
        if conn:
            await release_db_connection(conn)

@cj_dropshipping_mcp_server.tool(
    name="get_cj_product_stock",
    description="Retrieves stock information for a specific CJ Dropshipping product, either overall or for a specific SKU.",
    input_model=CJProductStockRequest,
    output_model=CJProductStockStatus
)
async def get_cj_product_stock(ctx: ToolContext, request_data: CJProductStockRequest) -> CJProductStockStatus:
    logger.info(f"Received stock request for CJ Product ID: {request_data.cj_product_id}, SKU: {request_data.sku}")

    conn: Optional[asyncpg.Connection] = None
    try:
        conn = await get_db_connection()

        # Fetch only variants_json and other necessary fields for stock, not full product details unless needed
        product_data_row = await conn.fetchrow(
            "SELECT cj_product_id, variants_json FROM cj_products WHERE cj_product_id = $1",
            request_data.cj_product_id
        )

        if not product_data_row:
            logger.warning(f"CJ Product with ID '{request_data.cj_product_id}' not found for stock check.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CJ Product not found for stock check.")

        variants_json_data = product_data_row.get('variants_json')
        parsed_variants: List[Dict[str, Any]] = []

        if isinstance(variants_json_data, str):
            try:
                parsed_variants = json.loads(variants_json_data)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse variants_json for CJ Product ID {request_data.cj_product_id}. Content: {variants_json_data}")
                # Fall through with empty parsed_variants
        elif isinstance(variants_json_data, list):
            parsed_variants = variants_json_data

        if not isinstance(parsed_variants, list): # Double check after potential parsing
            logger.warning(f"variants_json for CJ Product ID {request_data.cj_product_id} is not a list after parsing. Type: {type(parsed_variants)}")
            parsed_variants = []


        # If a specific SKU is requested
        if request_data.sku:
            found_sku = False
            for variant in parsed_variants:
                if isinstance(variant, dict) and variant.get('variantSku') == request_data.sku:
                    try:
                        stock_level = int(variant.get('variantStock', 0))
                    except (ValueError, TypeError):
                        stock_level = 0
                        logger.warning(f"Could not parse stock for SKU {request_data.sku} in CJ Product {request_data.cj_product_id}. Variant data: {variant}")

                    status_text = "In Stock" if stock_level > 0 else "Out of Stock"
                    if stock_level > 0 and stock_level <= 5: # Example threshold for low stock
                        status_text = "Low Stock"

                    return CJProductStockStatus(
                        cj_product_id=request_data.cj_product_id,
                        requested_sku=request_data.sku,
                        specific_sku_stock_level=stock_level,
                        status_text=status_text
                    )
            # SKU not found in variants
            return CJProductStockStatus(
                cj_product_id=request_data.cj_product_id,
                requested_sku=request_data.sku,
                specific_sku_stock_level=0, # Or None, depending on desired representation
                status_text="SKU Not Found"
            )
        else:
            # Overall stock / all variant stocks requested
            if not parsed_variants: # No variants in JSON or JSON was empty/invalid
                # CJ products usually have variants; if not, stock info might be missing or on a main product level (not typical for CJ schema)
                return CJProductStockStatus(
                    cj_product_id=request_data.cj_product_id,
                    overall_stock_level=0, # Assuming 0 if no variant data
                    status_text="Stock Information Not Available or Product Has No Variants Defined in JSON"
                )

            variant_stock_details: List[VariantStockInfo] = []
            total_stock = 0
            all_out_of_stock = True
            any_in_stock = False

            for variant in parsed_variants:
                if not isinstance(variant, dict): continue
                sku = variant.get('variantSku', f"unknown_sku_{len(variant_stock_details)}")
                try:
                    stock_level = int(variant.get('variantStock', 0))
                except (ValueError, TypeError):
                    stock_level = 0
                    logger.warning(f"Could not parse stock for SKU {sku} in CJ Product {request_data.cj_product_id}. Variant data: {variant}")

                variant_stock_details.append(VariantStockInfo(sku=sku, stock_level=stock_level))
                total_stock += stock_level
                if stock_level > 0:
                    any_in_stock = True
                    all_out_of_stock = False

            status_text = "Multiple Variants - See Details"
            if not any_in_stock and all_out_of_stock:
                status_text = "All Variants Out of Stock"
            elif len(parsed_variants) == 1 and any_in_stock: # Single variant product
                 status_text = "In Stock" if total_stock > 0 else "Out of Stock"
                 if total_stock > 0 and total_stock <= 5 : status_text = "Low Stock"


            return CJProductStockStatus(
                cj_product_id=request_data.cj_product_id,
                overall_stock_level=total_stock,
                variant_stock=variant_stock_details,
                status_text=status_text
            )

    except HTTPException:
        raise
    except asyncpg.exceptions.UndefinedTableError:
        logger.critical("CRITICAL: 'cj_products' table does not exist for stock check.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Product data system is temporarily unavailable for stock check.")
    except Exception as e:
        logger.error(f"Unexpected error fetching stock for CJ Product ID {request_data.cj_product_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while fetching product stock.")
    finally:
        if conn:
            await release_db_connection(conn)

@cj_dropshipping_mcp_server.tool(
    name="get_cj_product_shipping_info",
    description="Retrieves estimated shipping information for a specific CJ Dropshipping product to a destination country. This data is based on stored information and may not be real-time.",
    input_model=CJProductShippingRequest,
    output_model=CJProductShippingInfo
)
async def get_cj_product_shipping_info(ctx: ToolContext, request_data: CJProductShippingRequest) -> CJProductShippingInfo:
    logger.info(f"Received shipping info request for CJ Product ID: {request_data.cj_product_id}, SKU: {request_data.sku}, Country: {request_data.destination_country}")

    conn: Optional[asyncpg.Connection] = None
    try:
        conn = await get_db_connection()

        # Fetch cj_product_data_json which might contain some general shipping info
        # We don't have specific structured shipping data per country/SKU in cj_products table yet.
        # This tool will primarily return placeholder or very high-level info from the JSON if available.
        product_json_data_row = await conn.fetchrow(
            "SELECT cj_product_id, cj_product_data_json FROM cj_products WHERE cj_product_id = $1",
            request_data.cj_product_id
        )

        if not product_json_data_row:
            logger.warning(f"CJ Product with ID '{request_data.cj_product_id}' not found for shipping info check.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CJ Product not found for shipping info check.")

        cj_product_data = product_json_data_row.get('cj_product_data_json')
        if isinstance(cj_product_data, str):
            try:
                cj_product_data = json.loads(cj_product_data)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse cj_product_data_json for CJ Product ID {request_data.cj_product_id}. Content: {cj_product_data}")
                cj_product_data = {} # Treat as empty if parsing fails

        if not isinstance(cj_product_data, dict):
            cj_product_data = {} # Ensure it's a dict

        # --- Placeholder Logic / Heuristic Parsing ---
        # This section is highly dependent on the actual structure of cj_product_data_json.
        # We are looking for common keys that *might* indicate shipping.
        # For this iteration, we'll mostly return placeholder data as specific structured shipping
        # data per destination is usually obtained via real-time API calls to CJ.

        shipping_method_name = cj_product_data.get('defaultShippingMethodName') # Example hypothetical key
        est_min_days, est_max_days, ship_cost, currency = None, None, None, None

        # Example: Try to find a 'logistics' or 'shippingDetails' array/object
        logistics_info = cj_product_data.get('logistics', [])
        if not isinstance(logistics_info, list): logistics_info = [logistics_info] # if it's a single object

        found_country_specific_info = False
        if logistics_info:
            for logistic_option in logistics_info:
                if isinstance(logistic_option, dict):
                    # Check if this option is for the requested country (highly speculative)
                    if str(logistic_option.get('countryCode', '')).upper() == request_data.destination_country or \
                       str(logistic_option.get('country', '')).upper() == request_data.destination_country:

                        shipping_method_name = logistic_option.get('logisticsName', shipping_method_name)

                        # Try to parse delivery times (e.g., "8-15 days")
                        delivery_time_str = logistic_option.get('deliveryTime')
                        if isinstance(delivery_time_str, str) and '-' in delivery_time_str:
                            parts = delivery_time_str.replace("days","").strip().split('-')
                            try:
                                est_min_days = int(parts[0])
                                est_max_days = int(parts[1])
                            except ValueError:
                                logger.warning(f"Could not parse delivery_time_str: {delivery_time_str}")

                        # Try to parse shipping cost
                        cost_str = logistic_option.get('logisticsPrice') # or 'shippingFee' etc.
                        if cost_str is not None:
                            try:
                                ship_cost = float(cost_str)
                                currency = logistic_option.get('currency', 'USD') # Assume USD if not specified
                            except ValueError:
                                logger.warning(f"Could not parse shipping cost: {cost_str}")
                        found_country_specific_info = True
                        break # Found first match for country

        message = "Estimated shipping details based on stored data."
        if not found_country_specific_info or not all([est_min_days, est_max_days, ship_cost is not None]):
            # Fallback to general placeholders if specific data for country not found or incomplete
            shipping_method_name = shipping_method_name or "Standard Shipping (Placeholder)"
            est_min_days = est_min_days or 7
            est_max_days = est_max_days or 21
            ship_cost = ship_cost if ship_cost is not None else 0.00 # Default to 0.00 if not found
            currency = currency or "USD"
            message = "Placeholder shipping information. Actual shipping may vary. For precise details, real-time API call to CJ Dropshipping would be needed."
            if request_data.sku:
                 message += f" (Note: SKU-specific shipping for {request_data.sku} not yet detailed in this placeholder response)."

        logger.info(f"Shipping info for CJ Product {request_data.cj_product_id} to {request_data.destination_country}: {shipping_method_name}, {est_min_days}-{est_max_days} days, Cost: {ship_cost} {currency}")

        return CJProductShippingInfo(
            cj_product_id=request_data.cj_product_id,
            requested_sku=request_data.sku,
            destination_country=request_data.destination_country,
            shipping_method_name=shipping_method_name,
            estimated_delivery_min_days=est_min_days,
            estimated_delivery_max_days=est_max_days,
            shipping_cost=ship_cost,
            currency=currency,
            message=message
        )

    except HTTPException:
        raise
    except asyncpg.exceptions.UndefinedTableError:
        logger.critical("CRITICAL: 'cj_products' table does not exist for shipping info check.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Product data system is temporarily unavailable for shipping info check.")
    except Exception as e:
        logger.error(f"Unexpected error fetching shipping for CJ Product ID {request_data.cj_product_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Return a generic "not available" response for general errors, rather than 500, to indicate data issue.
        return CJProductShippingInfo(
            cj_product_id=request_data.cj_product_id,
            requested_sku=request_data.sku,
            destination_country=request_data.destination_country,
            message=f"Could not retrieve shipping information due to an unexpected error: {str(e)}"
        )
    finally:
        if conn:
            await release_db_connection(conn)

# Example of how to run this agent standalone for testing (if needed)
# if __name__ == "__main__":
#     # Ensure DB is running and schema.sql includes cj_products and categories.
#     # Populate cj_products with some test data.
#     # Example: INSERT INTO categories (name) VALUES ('Electronics');
#     # INSERT INTO cj_products (cj_product_id, display_name, selling_price, platform_category_id, source)
#     # VALUES ('CJTEST001', 'Test CJ Gadget', 25.99, (SELECT id FROM categories WHERE name='Electronics'), 'CJ');
#
#     # from app.db import init_db_pool, close_db_pool
#     # import asyncio
#     # async def main_test():
#     #     await init_db_pool()
#     #     mock_ctx = ToolContext(mcp_server=cj_dropshipping_mcp_server, tool_name="get_cj_product_details")
#     #     test_req = CJProductDetailRequest(cj_product_id="CJTEST001") # Use an ID from your test data
#     #     try:
#     #         product_details = await get_cj_product_details(mock_ctx, test_req)
#     #         print("Fetched Product Details:")
#     #         print(product_details.model_dump_json(indent=2))
#     #     except HTTPException as http_e:
#     #         print(f"HTTP Exception: {http_e.status_code} - {http_e.detail}")
#     #     except Exception as e:
#     #         print(f"General Exception: {e}")
#     #     finally:
#     #         await close_db_pool()
#     # asyncio.run(main_test())
