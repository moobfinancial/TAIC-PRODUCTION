# Conceptual Migration Strategy: `cj_products` to Unified `products` Table

## 1. Objective

This document outlines the conceptual strategy and high-level steps for migrating product data from the legacy `cj_products` table into the enhanced, unified `products` table. The goal is to consolidate all product information into a single structure that supports various product sources (e.g., direct merchant uploads, CJ Dropshipping) and features like product variants.

## 2. Assumptions

*   The `products` table schema has been enhanced to include columns that can accommodate data currently in `cj_products` (e.g., `base_price`, `additional_image_urls`, `cashback_percentage`, `external_shipping_rules_id`, `original_source_data`). This was addressed in a previous schema update.
*   The `product_variants` table exists and is structured to store variant-specific information (SKU, attributes, price, stock, image).
*   For CJ products being migrated:
    *   `products.id` will be populated with the value from `cj_products.cj_product_id`. This makes `cj_product_id` the primary identifier for these products in the unified table.
    *   The existing `products.original_cj_product_id` column will become redundant for newly migrated items if this approach is taken and can be considered for removal *after* successful migration and data verification if it solely served this purpose. (Alternatively, if `products.id` were always a new UUID, then `original_cj_product_id` would store `cj_products.cj_product_id`. This document proceeds with the former assumption: `products.id` = `cj_products.cj_product_id` for migrated CJ items).
*   A mapping between `cj_products.platform_category_id` and existing, valid category IDs in the `categories` table is crucial. Any discrepancies must be resolved before or during migration.

## 3. Conceptual Migration Steps

This is a high-level outline. A detailed SQL script or ETL process would be developed based on these steps.

### 3.1. Preparation

1.  **Backup Database:** Perform a full backup of the database before starting any migration procedures.
2.  **Verify Schema Updates:** Confirm that the `products` table has all the necessary new columns as defined in the latest `schema.sql` (e.g., `base_price`, `additional_image_urls`, `cashback_percentage`, `external_shipping_rules_id`, `original_source_data`).
3.  **Category Audit & Mapping:**
    *   Ensure all `platform_category_id` values in `cj_products` reference valid entries in the `categories` table.
    *   Identify any missing categories and decide whether to create them, map them to existing ones, or flag affected CJ products for exclusion/manual review.
4.  **Develop Migration Scripts:** Create and thoroughly test SQL scripts or an ETL process for transformation and insertion.
5.  **Schedule Downtime (if necessary):** Depending on the volume of data and the migration approach (e.g., live vs. batch), schedule a maintenance window if live data consistency could be affected.

### 3.2. Data Migration (Iterate through `cj_products`)

For each row in the `cj_products` table:

1.  **Transform Core Product Data:**
    *   Map `cj_products` fields to the corresponding `products` table fields:
        *   `products.id` = `cj_products.cj_product_id`
        *   `products.name` = `cj_products.display_name`
        *   `products.description` = `cj_products.display_description`
        *   `products.price` = `cj_products.selling_price` (This is the main listed price)
        *   `products.base_price` = `cj_products.cj_base_price` (Nullable)
        *   `products.image_url` = `cj_products.image_url` (Main product image)
        *   `products.additional_image_urls` = `cj_products.additional_image_urls_json` (Ensure type compatibility JSONB <-> JSONB)
        *   `products.platform_category_id` = `cj_products.platform_category_id` (Assumes already validated)
        *   `products.is_active` = `cj_products.is_active` (Or a default, e.g., `TRUE`, if all migrated CJ products should be active by default, subject to review policy)
        *   `products.approval_status` = `'approved'` (This is a common assumption for imported CJ products, but might need adjustment based on platform policy, e.g., they could start as 'pending' for a quick review).
        *   `products.merchant_id` = A designated system-level `merchant_id` representing "CJ Dropshipping Source" (e.g., 'CJ_SYSTEM_MERCHANT_ID') or `NULL` if preferred and allowed by schema constraints on `products.merchant_id`. (Note: The `products` table's `merchant_id` conceptually links to `users.id` where `role='MERCHANT'`. A generic system user might be needed for this).
        *   `products.source` = `'CJ'` (Or the value from `cj_products.source` if it's more granular).
        *   `products.original_cj_product_id` = `cj_products.cj_product_id` (This becomes redundant if `products.id` *is* the `cj_product_id`, but can be kept for clarity during transition or if `products.id` is a new UUID). *Based on the assumption in section 2, this field might be omitted from the insert if `products.id` is already `cj_product_id`.* For safety during migration, it can be populated.
        *   `products.cashback_percentage` = `cj_products.cashback_percentage`
        *   `products.external_shipping_rules_id` = `cj_products.shipping_rules_id`
        *   `products.original_source_data` = `cj_products.cj_product_data_json` (Storing the raw JSON from CJ)
        *   `products.has_variants` = Determine this by checking if `cj_products.variants_json` is present, not NULL, and represents a non-empty list/object of variants.
        *   `products.admin_review_notes` = NULL (or a system note like "Migrated from cj_products table").
        *   `products.created_at` & `products.updated_at`: Can be set to the values from `cj_products.created_at` and `cj_products.updated_at` to preserve original timestamps, or `NOW()` if new timestamps are preferred for migrated records. Preserving original is often better.

2.  **Insert into `products` Table:**
    *   Execute the `INSERT` statement for the transformed product data.
    *   Handle potential conflicts (e.g., if a `cj_product_id` somehow already exists in `products.id` from a previous partial migration). An `ON CONFLICT DO UPDATE` or `ON CONFLICT DO NOTHING` clause might be needed depending on the desired idempotency of the script.

3.  **Transform and Insert Variants (if `cj_products.variants_json` exists and `products.has_variants` is TRUE):**
    *   Parse the `cj_products.variants_json` field (which is expected to be JSONB, possibly a list of variant objects).
    *   For each variant object found within `variants_json`:
        *   **Extract Variant Data:**
            *   `sku`: Extract from the CJ variant data (e.g., `variantSku`). This must be unique.
            *   `attributes`: Transform CJ's attribute representation (which could be a nested JSON object or a list of key/value pairs) into the `{"key": "value", ...}` format required for `product_variants.attributes` (JSONB).
            *   `specific_price`: Extract from CJ variant data (e.g., `variantSellPrice`). If not present, it might default to the main product price or be NULL.
            *   `stock_quantity`: Extract from CJ variant data (e.g., `variantStock`). Default to 0 if not present.
            *   `image_url`: Extract variant-specific image URL if available.
        *   **Insert into `product_variants` Table:**
            *   `product_id` = The `products.id` created in step 3.2.1 (which is `cj_products.cj_product_id`).
            *   `id` for `product_variants` is `SERIAL`, so it will be auto-generated.
            *   Populate other fields (`sku`, `attributes`, `specific_price`, `stock_quantity`, `image_url`).
        *   This step requires a robust JSON parsing and mapping logic tailored to the specific structure of `variants_json` in the `cj_products` table. Any errors during parsing of a single variant should be logged, and the process should decide whether to skip that variant or halt migration for that product.

### 3.3. Data Verification

1.  **Row Counts:** Compare the total number of rows in `cj_products` with the number of products inserted into the `products` table where `source = 'CJ'`.
2.  **Variant Counts:** For a sample of products, compare the number of variants in `cj_products.variants_json` with the number of rows inserted into `product_variants` for the corresponding `product_id`.
3.  **Spot-Checking Data:** Randomly select several migrated products and their variants (if any) and compare all mapped fields against the original `cj_products` data to ensure accuracy.
4.  **Check for Orphans:** Ensure no `product_variants` were created for `product_id`s that don't exist in the `products` table (should be prevented by FKs if implemented, but good to check).

### 3.4. Post-Migration Tasks

1.  **Update Application Logic:** Modify all parts of the backend application (e.g., Product Service Agent, Admin APIs, other services) that previously read from `cj_products` to now exclusively use the `products` and `product_variants` tables, filtering by `source = 'CJ'` where necessary to distinguish these products.
2.  **Thorough Testing:** Conduct comprehensive testing of all application features that rely on product data (product display, search, filtering, VTO, ordering, etc.) to ensure they work correctly with the unified data structure.
3.  **Performance Monitoring:** Monitor database performance after the migration, especially for queries involving the newly populated `products` and `product_variants` tables. Add or optimize indexes as needed.
4.  **Archive/Drop `cj_products` Table:** Once the migration is fully verified and the application is stable, the original `cj_products` table can be archived (e.g., renamed `cj_products_old_migration_YYYYMMDD`) and eventually dropped.
5.  **Review Redundant Columns:** If `products.id` now reliably stores `cj_products.cj_product_id` for migrated items, the `products.original_cj_product_id` column can be considered for removal after ensuring all dependencies on it are updated.

## 4. Error Handling and Rollback

*   The entire migration process should be designed with error handling and potential rollback strategies in mind.
*   Performing the migration in batches or within transactions where appropriate can help manage failures.
*   Extensive logging during the migration process is crucial for identifying and troubleshooting issues.

This conceptual strategy provides a roadmap. The actual implementation will require detailed scripting, thorough testing in a staging environment, and careful execution.
