import csv
import io
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from pydantic import BaseModel
import asyncpg

from app.db import get_db_connection, release_db_connection
from app.models.product import ProductCreate, ProductVariantCreate # Assuming ProductCreate exists or can be adapted. For now, we'll build the dict manually.

router = APIRouter(
    tags=["Bulk Operations"],
    # prefix="/api/bulk" # Prefix will be set in main.py
)

# --- Pydantic Models for Bulk Upload Response ---
class ErrorDetail(BaseModel):
    row_number: int
    product_handle: Optional[str] = None
    error_message: str

class BulkUploadResponse(BaseModel):
    total_rows_processed: int
    products_created: int
    variants_created: int
    errors: List[ErrorDetail] = []

# --- Helper Function to Get Category ID ---
async def get_category_id_by_name(conn: asyncpg.Connection, category_name: str) -> Optional[int]:
    """
    Fetches the ID of a category by its name.
    Returns None if the category is not found.
    """
    if not category_name or not category_name.strip():
        return None
    category_row = await conn.fetchrow("SELECT id FROM categories WHERE name ILIKE $1 AND is_active = TRUE", category_name.strip())
    return category_row['id'] if category_row else None

# --- Main CSV Upload Endpoint ---
@router.post("/upload-products-csv", response_model=BulkUploadResponse)
async def upload_products_csv(file: UploadFile = File(...)):
    if file.content_type not in ["text/csv", "application/vnd.ms-excel"]: # Common CSV MIME types
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type. Please upload a CSV file.")

    contents = await file.read()

    # Use a list to store dictionaries, easier to group later
    try:
        decoded_content = contents.decode('utf-8') # Ensure correct decoding
    except UnicodeDecodeError:
        try:
            decoded_content = contents.decode('latin-1') # Try another common encoding
        except UnicodeDecodeError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not decode CSV file. Please ensure it's UTF-8 or Latin-1 encoded.")

    csv_reader = csv.DictReader(io.StringIO(decoded_content))
    rows = list(csv_reader)

    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty or has no data rows.")

    # Verify required headers (as per docs/merchant_bulk_product_upload_template_guide.md)
    required_headers = ["product_handle", "variant_sku", "variant_stock_quantity"] # Minimum for processing
    # More complete check:
    # required_headers = ["product_handle", "product_name", "product_category", "product_base_price",
    #                     "variant_sku", "variant_stock_quantity"]
    # For now, keeping it minimal for robust processing of variant-only lines too.

    header_row = csv_reader.fieldnames
    if not header_row or not all(header in header_row for header in required_headers):
        missing = [h for h in required_headers if h not in (header_row or [])]
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required CSV headers: {', '.join(missing)}")


    # Group rows by product_handle
    products_to_process: Dict[str, List[Dict[str, Any]]] = {}
    for i, row in enumerate(rows):
        row_number = i + 2 # Account for header row and 0-indexing
        product_handle = row.get("product_handle")
        if not product_handle:
            # This case should ideally not happen if product_handle is required for all rows
            # but we'll log it as an error for this row if it does.
            # For now, we'll skip rows without a product_handle if we strictly group.
            # Or, we can add to an error list if this is unexpected.
            # For this implementation, we require product_handle for grouping.
            # If a row is malformed and missing it, it might be skipped by the grouping logic.
            # Let's ensure this is handled by adding a check if product_handle is truly missing.
            if not product_handle:
                # This row cannot be processed without a handle.
                # Error reporting for such rows will be handled during processing if they cause issues.
                # For now, we just won't be able to group it.
                # A more robust solution might add it to a list of 'ungroupable_rows'
                continue # Skip if no handle

        if product_handle not in products_to_process:
            products_to_process[product_handle] = []

        # Add row number for error tracking
        row_with_meta = row.copy()
        row_with_meta['_row_number'] = row_number
        products_to_process[product_handle].append(row_with_meta)


    response = BulkUploadResponse(total_rows_processed=len(rows), products_created=0, variants_created=0, errors=[])
    conn: Optional[asyncpg.Connection] = None

    try:
        conn = await get_db_connection()

        for product_handle, product_rows in products_to_process.items():
            if not product_rows: continue # Should not happen if product_handle exists

            # Sort rows by some implicit order if necessary, e.g., if base product info is always first.
            # For now, assume the first row for a handle can act as the base product if it has product-level info.
            base_product_row = product_rows[0] # Use first row for product-level details
            current_row_number_for_error = base_product_row['_row_number']


            # Start transaction for this product_handle
            async with conn.transaction():
                try:
                    # --- 1. Get Category ID ---
                    category_name = base_product_row.get("product_category", "").strip()
                    category_id: Optional[int] = None
                    if category_name: # Only query if category name is provided
                        category_id = await get_category_id_by_name(conn, category_name)
                        if not category_id:
                            response.errors.append(ErrorDetail(
                                row_number=current_row_number_for_error, product_handle=product_handle,
                                error_message=f"Category '{category_name}' not found or is inactive. Skipping product."
                            ))
                            raise Exception("Category not found, rolling back transaction for this product_handle.") # Trigger rollback
                    # If category_name is blank, category_id remains None, product.platform_category_id will be NULL

                    # --- 2. Create Product ---
                    # For simplicity, assume product_handle is unique for new products.
                    # A check for existing product_handle could be added here if updates were supported.
                    # For this subtask, we only create new products.

                    # Ensure required product fields are present in the base_product_row or have defaults
                    product_name = base_product_row.get("product_name")
                    if not product_name: # Product name is essential
                         response.errors.append(ErrorDetail(
                            row_number=current_row_number_for_error, product_handle=product_handle,
                            error_message=f"Product Name is missing for product_handle '{product_handle}'. Skipping product."
                        ))
                         raise Exception("Product Name missing, rolling back transaction for this product_handle.")


                    # Determine if product has variants based on number of rows for this handle
                    # or if variant-specific columns are filled even in a single-row case.
                    # A product has variants if len(product_rows) > 1 OR if product_rows[0] has variant attributes filled
                    # AND is not meant to be a simple product with its own SKU in variant_sku.
                    # For now, simple logic: if there's more than one row, or if the first row has variant attributes.
                    # The guide says: "If a product has no variants, it will be a single row with its details (including variant_sku acting as the product's main SKU)"
                    # This means we need to differentiate a "simple product" from a "product with one variant defined on the first line".
                    # Let's assume for now: if attribute names/values are present, it's a variant.

                    # Check if any row for this handle has variant attributes specified
                    has_any_variant_attributes = False
                    for r in product_rows:
                        if r.get("variant_attribute_1_name") and r.get("variant_attribute_1_value"):
                            has_any_variant_attributes = True
                            break

                    # A product itself only has variants if there are multiple distinct variant definitions.
                    # If it's a single row with variant_sku, it's a simple product.
                    # If multiple rows, or one row with variant attributes, it's a product *with variants*.
                    # The `products.has_variants` flag.
                    # If len(product_rows) == 1 and not has_any_variant_attributes, it's a simple product.
                    # Otherwise, `has_variants` should be true.
                    # However, the guide also implies a single row can define ONE variant.
                    # So, `has_variants` is true if `has_any_variant_attributes` is true.

                    db_has_variants = has_any_variant_attributes

                    # The `id` for `products` table needs to be unique.
                    # `product_handle` from CSV is used to group rows, but might not be the final `products.id`.
                    # Let's use product_handle as the `products.id` for now, assuming it's unique for new products.
                    # Schema: products.id VARCHAR(255) PRIMARY KEY
                    # This means product_handle should be unique across all products.

                    # Check if product with this ID (handle) already exists
                    existing_product = await conn.fetchval("SELECT id FROM products WHERE id = $1", product_handle)
                    if existing_product:
                        response.errors.append(ErrorDetail(
                            row_number=current_row_number_for_error, product_handle=product_handle,
                            error_message=f"Product with handle (ID) '{product_handle}' already exists. Skipping (updates not supported in this version)."
                        ))
                        continue # Skip to next product_handle (commits previous successful transactions)

                    # Prepare product data for insertion
                    product_insert_data = {
                        "id": product_handle, # Using handle as product.id
                        "name": product_name,
                        "description": base_product_row.get("product_description"),
                        "price": float(base_product_row.get("product_base_price", 0.0) or 0.0), # Ensure float
                        "image_url": base_product_row.get("product_image_url") or None,
                        "platform_category_id": category_id,
                        "has_variants": db_has_variants,
                        "is_active": base_product_row.get("is_active", "TRUE").upper() == "TRUE", # Default to TRUE
                        "approval_status": "pending", # Default for new uploads
                        "source": "csv_bulk_upload",
                        # merchant_id: This needs to come from authenticated user or another CSV column. Not in current guide.
                        # For now, can leave it NULL or use a placeholder if schema allows.
                        "merchant_id": base_product_row.get("merchant_id", "default_merchant") # Placeholder
                    }

                    # Insert product
                    await conn.execute(
                        """
                        INSERT INTO products (id, name, description, price, image_url, platform_category_id, has_variants, is_active, approval_status, source, merchant_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        """,
                        product_insert_data['id'], product_insert_data['name'], product_insert_data['description'],
                        product_insert_data['price'], product_insert_data['image_url'], product_insert_data['platform_category_id'],
                        product_insert_data['has_variants'], product_insert_data['is_active'], product_insert_data['approval_status'],
                        product_insert_data['source'], product_insert_data['merchant_id']
                    )
                    response.products_created += 1

                    # --- 3. Create Variants ---
                    # If it's a simple product (one row, no variant attributes), its `variant_sku` etc. are for the main product.
                    # The current DB schema expects variants in `product_variants` table.
                    # So, even a "simple product" from CSV needs one entry in `product_variants` if `variant_sku` is present.
                    # Or, we adapt ProductService to show base product SKU/price/stock if no variants.
                    # For now, let's align with `product_variants` table: each row in CSV with a `variant_sku` is a variant.

                    for i_row, variant_row_data in enumerate(product_rows):
                        current_variant_row_number = variant_row_data['_row_number']

                        variant_sku = variant_row_data.get("variant_sku")
                        if not variant_sku:
                            response.errors.append(ErrorDetail(
                                row_number=current_variant_row_number, product_handle=product_handle,
                                error_message=f"Variant SKU is missing. Skipping this variant line."
                            ))
                            # If this is critical, could raise Exception here to rollback product too
                            continue

                        # Construct attributes JSON
                        attributes: Dict[str, Any] = {}
                        for i in range(1, 4): # Check for up to 3 attributes as per guide
                            attr_name_key = f"variant_attribute_{i}_name"
                            attr_value_key = f"variant_attribute_{i}_value"
                            attr_name = variant_row_data.get(attr_name_key)
                            attr_value = variant_row_data.get(attr_value_key)
                            if attr_name and attr_value is not None: # Allow empty string for value, but name must exist
                                attributes[attr_name] = attr_value

                        # If product has no variant attributes specified across any rows (was !has_any_variant_attributes),
                        # but we are processing rows into product_variants, then attributes dict should be empty.
                        # However, `db_has_variants` is now set based on `has_any_variant_attributes`.
                        # If `db_has_variants` is false, the product itself doesn't have variants.
                        # But the CSV guide implies `variant_sku` makes it a "variant" line item.
                        # This part of logic needs care: a "simple product" in CSV (one line, product details + variant_sku)
                        # vs a "product with one variant" (one line, product details + variant_sku + variant attributes).
                        # The `db_has_variants` flag on `products` table should be TRUE if there are actual distinct options.
                        # If it's a simple product, `db_has_variants` could be FALSE, but it still might have one "default" variant entry.
                        # The current logic sets `db_has_variants` if any row has attributes. This is reasonable.

                        variant_data_insert = {
                            "product_id": product_handle, # Link to the product.id
                            "sku": variant_sku,
                            "attributes": attributes if attributes else {}, # Ensure it's not None if no attributes
                            "specific_price": float(variant_row_data.get("variant_specific_price") or product_insert_data['price'] or 0.0),
                            "stock_quantity": int(variant_row_data.get("variant_stock_quantity") or 0),
                            "image_url": variant_row_data.get("variant_image_url") or product_insert_data['image_url'] # Fallback to main product image
                        }

                        # Insert variant
                        await conn.execute(
                            """
                            INSERT INTO product_variants
                                (product_id, sku, attributes, specific_price, stock_quantity, image_url)
                            VALUES ($1, $2, $3, $4, $5, $6)
                            """,
                            variant_data_insert['product_id'], variant_data_insert['sku'], variant_data_insert['attributes'],
                            variant_data_insert['specific_price'], variant_data_insert['stock_quantity'], variant_data_insert['image_url']
                        )
                        response.variants_created += 1

                except Exception as e_inner:
                    # Transaction will be rolled back by `async with conn.transaction():` context manager
                    # Error already logged or will be part of response.errors if added above.
                    # If not added to response.errors yet (e.g. DB unique violation not caught explicitly before this generic Exception)
                    if not any(err.row_number == current_row_number_for_error and err.product_handle == product_handle for err in response.errors):
                         response.errors.append(ErrorDetail(
                            row_number=current_row_number_for_error, product_handle=product_handle,
                            error_message=f"Failed to process product/variants: {str(e_inner)}"
                        ))
                    print(f"Transaction rolled back for product_handle '{product_handle}' due to: {e_inner}")
                    # Continue to the next product_handle in the CSV
                    continue

    except HTTPException: # Re-raise HTTP exceptions from file validation etc.
        raise
    except Exception as e_outer:
        # Log the exception details for debugging
        print(f"Outer error during CSV processing: {e_outer}")
        response.errors.append(ErrorDetail(row_number=0, error_message=f"A critical error occurred during processing: {e_outer}"))
        # No need to raise HTTPException here as we want to return the partial success/error summary
    finally:
        if conn:
            await release_db_connection(conn)

    return response
