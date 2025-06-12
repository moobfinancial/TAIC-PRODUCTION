import psycopg2
import psycopg2.extras # For RealDictCursor
import os
import json
import logging
import sys
from decimal import Decimal, InvalidOperation
from dotenv import load_dotenv # To load .env file for local development

# --- Configuration ---
load_dotenv() # Load environment variables from .env file if present

DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432") # Default PostgreSQL port

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# --- Main Migration Logic ---
def migrate_data():
    if not all([DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT]):
        logger.error("Database connection parameters are not fully configured. Please set DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT environment variables.")
        sys.exit(1)

    conn = None
    processed_cj_products = 0
    migrated_new_products = 0
    skipped_existing_products = 0
    migrated_new_variants = 0
    skipped_existing_variants = 0
    error_count = 0

    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        logger.info("Successfully connected to the database.")

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM cj_products ORDER BY cj_product_id;")
            cj_products_rows = cur.fetchall()

            logger.info(f"Found {len(cj_products_rows)} products in cj_products table to process.")

            for cj_row in cj_products_rows:
                processed_cj_products += 1
                cj_product_id = cj_row['cj_product_id']
                logger.info(f"Processing CJ Product ID: {cj_product_id} (Display Name: {cj_row['display_name']})")

                try:
                    with conn.cursor() as product_transaction_cur: # New cursor for transaction
                        # --- Product Transformation ---
                        product_id = cj_product_id # Use cj_product_id as the new products.id

                        try:
                            price = Decimal(cj_row['selling_price']) if cj_row['selling_price'] is not None else Decimal('0.00')
                            base_price = Decimal(cj_row['cj_base_price']) if cj_row['cj_base_price'] is not None else None
                            cashback = Decimal(cj_row['cashback_percentage']) if cj_row['cashback_percentage'] is not None else Decimal('0.00')
                        except (InvalidOperation, TypeError) as e:
                            logger.error(f"Error converting price/cashback for CJ Product ID {cj_product_id}: {e}. Skipping product.")
                            error_count +=1
                            continue # Skip to next cj_product

                        # Determine has_variants
                        has_variants_flag = False
                        variants_data = []
                        if cj_row.get('variants_json'):
                            try:
                                # variants_json might be a string that needs parsing, or already a list/dict
                                if isinstance(cj_row['variants_json'], str):
                                    variants_data = json.loads(cj_row['variants_json'])
                                elif isinstance(cj_row['variants_json'], (list, dict)): # Directly use if already list/dict
                                    variants_data = cj_row['variants_json']

                                if isinstance(variants_data, list) and len(variants_data) > 0:
                                    # Check if variants have meaningful attributes beyond just a single default entry
                                    if len(variants_data) > 1:
                                        has_variants_flag = True
                                    elif len(variants_data) == 1:
                                        # Check if the single variant has distinct attributes or is just a default representation
                                        # This logic depends on how CJ structures single-item-as-variant
                                        # For now, if variants_json has items, assume it implies variants.
                                        # A more robust check might look for actual attribute fields.
                                        # Example: if any variant_data.get('attributeKey') exists
                                        first_variant = variants_data[0]
                                        for key in first_variant: # Crude check for attribute-like keys
                                            if 'attribute' in key.lower() and first_variant.get(key):
                                                has_variants_flag = True
                                                break
                                        if not has_variants_flag and first_variant.get('variantSku'): # If it has an SKU, treat as variant
                                            has_variants_flag = True


                            except json.JSONDecodeError as e:
                                logger.warning(f"Could not parse variants_json for CJ Product ID {cj_product_id}: {e}. Assuming no structured variants.")
                                variants_data = [] # Ensure variants_data is a list
                            except TypeError as e:
                                logger.warning(f"TypeError processing variants_json for CJ Product ID {cj_product_id}: {e}. Value: {cj_row['variants_json']}. Assuming no structured variants.")
                                variants_data = []


                        # --- Insert into `products` table ---
                        insert_product_sql = """
                            INSERT INTO products (
                                id, name, description, price, base_price, image_url,
                                additional_image_urls, platform_category_id, is_active,
                                approval_status, merchant_id, source, original_cj_product_id,
                                cashback_percentage, external_shipping_rules_id,
                                original_source_data, has_variants
                                -- created_at, updated_at will use DB defaults
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )
                            ON CONFLICT (id) DO NOTHING;
                        """
                        # Using %s placeholders, psycopg2 will handle quoting.
                        # JSONB fields (additional_image_urls, original_source_data) are passed as is (Python dict/list or valid JSON string).
                        # psycopg2 handles dict/list to JSONB conversion.

                        product_values = (
                            product_id,
                            cj_row['display_name'],
                            cj_row['display_description'],
                            price,
                            base_price,
                            cj_row['image_url'],
                            cj_row['additional_image_urls_json'], # Already JSONB-like from DB
                            cj_row['platform_category_id'],
                            cj_row['is_active'] if cj_row['is_active'] is not None else False,
                            'approved', # Assumption for migrated CJ products
                            None,       # merchant_id - None for CJ sourced
                            'CJ',
                            cj_product_id, # original_cj_product_id
                            cashback,
                            cj_row['shipping_rules_id'],
                            cj_row['cj_product_data_json'], # Already JSONB-like
                            has_variants_flag
                        )

                        product_transaction_cur.execute(insert_product_sql, product_values)

                        if product_transaction_cur.rowcount > 0:
                            migrated_new_products += 1
                            logger.info(f"Inserted new product: {product_id} (CJ ID: {cj_product_id})")
                        else:
                            skipped_existing_products += 1
                            logger.info(f"Skipped existing product: {product_id} (CJ ID: {cj_product_id})")

                        # --- Variant Transformation & Insertion ---
                        if has_variants_flag and isinstance(variants_data, list):
                            for variant_entry in variants_data:
                                if not isinstance(variant_entry, dict):
                                    logger.warning(f"Skipping non-dict variant entry for CJ product {cj_product_id}: {variant_entry}")
                                    continue

                                variant_sku = variant_entry.get('variantSku')
                                if not variant_sku: # SKU is critical for product_variants.sku UNIQUE constraint
                                    logger.warning(f"Skipping variant for CJ product {cj_product_id} due to missing SKU. Data: {variant_entry}")
                                    error_count +=1
                                    continue

                                # Construct attributes JSONB object from various possible CJ structures
                                attributes_map = {}
                                # Common pattern: "attribute": "Color:Red;Size:M" or list of {"attrName": "Color", "attrValue": "Red"}
                                # Another pattern: "propertyList": [{"propertyName": "Color", "propertyValue": "Red"}]
                                # Yet another: "attributes": "Color:Red", "Size:M" as direct keys (less common)
                                # Most complex seen: "productKeyFeatures": [{"featureKey":"Color", "featureValue":"Red"}, ...]
                                # Assuming a structure like:
                                # [{"attribute":"Color:Red;Size:Large"}, {"attribute":"Material:Cotton"}] -> need to parse 'attribute' string
                                # OR [{"attrName":"Color", "attrValue":"Red"}, {"attrName":"Size", "attrValue":"Large"}]
                                # OR direct keys like "Color": "Red", "Size": "Large" in variant_entry
                                # For this script, let's assume `variant_entry` might have keys like `Color`, `Size` directly,
                                # or a list under a key like `attributesList` or `propertyList`.
                                # A simple heuristic:
                                cj_attributes_field = variant_entry.get('attributes') # Example key, might be 'propertyList', 'productKeyFeatures' etc.

                                if isinstance(cj_attributes_field, list): # e.g. [{"attrName":"Color", "attrValue":"Red"}]
                                    for attr_item in cj_attributes_field:
                                        if isinstance(attr_item, dict):
                                            name_key = attr_item.get('attrName') or attr_item.get('propertyName') or attr_item.get('featureKey')
                                            value_key = attr_item.get('attrValue') or attr_item.get('propertyValue') or attr_item.get('featureValue')
                                            if name_key and value_key is not None:
                                                attributes_map[str(name_key)] = str(value_key)
                                elif isinstance(cj_attributes_field, str): # e.g. "Color:Red;Size:M"
                                    try:
                                        pairs = cj_attributes_field.split(';')
                                        for pair in pairs:
                                            if ':' in pair:
                                                key, value = pair.split(':', 1)
                                                attributes_map[key.strip()] = value.strip()
                                    except Exception as e_attr_parse:
                                        logger.warning(f"Could not parse attributes string '{cj_attributes_field}' for SKU {variant_sku}: {e_attr_parse}")
                                else: # Try to pick common attribute keys if not in a structured list
                                    for key, value in variant_entry.items():
                                        if key.lower() in ['color', 'size', 'material', 'style', 'type'] and value:
                                            attributes_map[key.capitalize()] = str(value)

                                # Fallback if attributes_map is still empty but there were attribute-like keys
                                # This part is highly dependent on the actual structure of `variants_json`
                                # For now, we'll rely on the above heuristic or a predefined key like 'attributes'.
                                # If `attributes_map` is empty, it will be stored as `{}`.

                                try:
                                    variant_price_str = variant_entry.get('variantSellPrice') or variant_entry.get('variantPrice')
                                    variant_price = Decimal(variant_price_str) if variant_price_str is not None else price # Fallback to main product price

                                    variant_stock_str = variant_entry.get('variantStock') or variant_entry.get('inventory')
                                    variant_stock = int(variant_stock_str) if variant_stock_str is not None and str(variant_stock_str).isdigit() else 0

                                except (InvalidOperation, TypeError, ValueError) as e_var_price_stock:
                                    logger.error(f"Error converting price/stock for variant SKU {variant_sku} (CJ Product ID {cj_product_id}): {e_var_price_stock}. Skipping variant.")
                                    error_count +=1
                                    continue

                                insert_variant_sql = """
                                    INSERT INTO product_variants (
                                        product_id, sku, attributes, specific_price,
                                        stock_quantity, image_url
                                        -- created_at, updated_at will use DB defaults
                                    ) VALUES (%s, %s, %s, %s, %s, %s)
                                    ON CONFLICT (sku) DO NOTHING;
                                """
                                # Using sku as conflict target as it's UNIQUE in product_variants

                                variant_values = (
                                    product_id,
                                    variant_sku,
                                    json.dumps(attributes_map) if attributes_map else '{}', # Ensure valid JSON for DB
                                    variant_price,
                                    variant_stock,
                                    variant_entry.get('variantImage') or cj_row['image_url'] # Fallback to main image
                                )
                                product_transaction_cur.execute(insert_variant_sql, variant_values)
                                if product_transaction_cur.rowcount > 0:
                                    migrated_new_variants += 1
                                else:
                                    skipped_existing_variants +=1

                        conn.commit() # Commit transaction for this product and its variants
                        logger.info(f"Successfully processed and committed product and variants for CJ Product ID: {cj_product_id}")

                except Exception as e_trans:
                    conn.rollback() # Rollback for this specific product
                    logger.error(f"Transaction rolled back for CJ Product ID {cj_product_id} due to error: {e_trans}")
                    error_count += 1
                    # Log traceback for unexpected errors
                    import traceback
                    logger.error(traceback.format_exc())


    except psycopg2.Error as e:
        logger.error(f"Database error: {e}")
        error_count +=1
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        error_count +=1
        import traceback
        logger.error(traceback.format_exc())
    finally:
        if conn:
            conn.close()
            logger.info("Database connection closed.")

    logger.info("--- Migration Summary ---")
    logger.info(f"Total CJ Products Processed: {processed_cj_products}")
    logger.info(f"New Products Migrated: {migrated_new_products}")
    logger.info(f"Skipped Existing Products: {skipped_existing_products}")
    logger.info(f"New Variants Migrated: {migrated_new_variants}")
    logger.info(f"Skipped Existing Variants: {skipped_existing_variants}")
    logger.info(f"Errors Encountered (preventing product/variant migration): {error_count}")
    logger.info("--- End of Migration ---")

if __name__ == "__main__":
    logger.info("Starting CJ Products to Unified Products migration script...")
    migrate_data()
    logger.info("Migration script finished.")
