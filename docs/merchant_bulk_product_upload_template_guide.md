# Merchant Bulk Product Upload CSV Template Guide

## 1. Introduction

This guide outlines the CSV (Comma Separated Values) template format for merchants to bulk upload products to the platform. The bulk upload feature allows for efficient creation and updating of multiple products at once, including products with multiple variants (e.g., different sizes, colors).

Adhering to this template ensures that product information is processed correctly.

## 2. File Format

*   **File Type:** CSV (Comma Separated Values)
*   **Encoding:** UTF-8 (Recommended to ensure proper handling of special characters)
*   **Delimiter:** Comma (`,`)
*   **Headers:** The first row of the CSV file must contain the column headers as defined below.

## 3. Columns Definition

The following table details each column required or optional in the CSV file.

| Column Header                | Required?                                           | Data Type     | Description                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `product_handle`             | **Required**                                        | Text          | A unique identifier for a base product. All rows for the same product (base product information + all its variants) must share the same `product_handle`. Case-sensitive. |
| `product_name`               | Required for new product                            | Text          | Name of the product. Only needs to be specified once per `product_handle`, typically on the first row representing that product.                                           |
| `product_description`        | Optional                                            | Text          | Description of the product. HTML is not supported in this field. Only needs to be specified once per `product_handle`.                                                      |
| `product_category`           | Required for new product                            | Text          | Name of the category the product belongs to (e.g., "Apparel", "Electronics > Audio"). Only needs to be specified once per `product_handle`.                                |
| `product_base_price`         | Required if no variants or if variants use modifiers | Numeric (X.YY)| The base price of the product. If a product has variants, this price can be overridden by `variant_specific_price`.                                                     |
| `product_image_url`          | Optional                                            | URL Text      | URL for the main product image. Only needs to be specified once per `product_handle`.                                                                                      |
| `variant_sku`                | **Required** (for each variant/simple product)      | Text          | Unique Stock Keeping Unit (SKU) for the product or product variant. Must be unique across all products and variants.                                                        |
| `variant_specific_price`     | Optional (Required if variant has its own price)    | Numeric (X.YY)| The specific sale price for this particular variant. If blank and `product_base_price` is set, this variant will inherit the `product_base_price`.                         |
| `variant_stock_quantity`     | **Required**                                        | Integer       | Stock quantity for this specific variant.                                                                                                                                  |
| `variant_image_url`          | Optional                                            | URL Text      | URL for an image specific to this variant. Overrides `product_image_url` for this variant if provided.                                                                      |
| `variant_attribute_1_name`   | Optional                                            | Text          | Name of the first variant attribute (e.g., "Size", "Color"). Consistent naming is crucial for grouping options.                                                              |
| `variant_attribute_1_value`  | Optional (Required if `_name` is present)           | Text          | Value of the first variant attribute (e.g., "Small", "Medium", "Red", "Blue").                                                                                             |
| `variant_attribute_2_name`   | Optional                                            | Text          | Name of the second variant attribute (e.g., "Color", "Material").                                                                                                          |
| `variant_attribute_2_value`  | Optional (Required if `_name` is present)           | Text          | Value of the second variant attribute (e.g., "Red", "Blue", "Cotton", "Polyester").                                                                                        |
| `variant_attribute_3_name`   | Optional                                            | Text          | Name of the third variant attribute.                                                                                                                                     |
| `variant_attribute_3_value`  | Optional (Required if `_name` is present)           | Text          | Value of the third variant attribute.                                                                                                                                    |
| `is_active`                  | Optional                                            | Boolean (TRUE/FALSE) | Set to TRUE if the product/variant should be immediately active upon upload. Defaults to FALSE (pending review/manual activation) if not specified.                  |

**Note:** You can extend this by adding more attribute columns (e.g., `variant_attribute_4_name`, `variant_attribute_4_value`) as needed, following the same pattern.

## 4. How to List Products and Variants

*   **Product Grouping:** Products and their variants are grouped together using the `product_handle` column. All rows with the same `product_handle` belong to the same core product.
*   **Base Product Information:**
    *   The first row for a given `product_handle` is typically used to specify the main product details like `product_name`, `product_description`, `product_category`, `product_base_price`, and `product_image_url`. These values only need to be stated once for each `product_handle`.
    *   If a product has no variants (it's a "simple" product), all its details, including SKU, price, and stock, will be on this single row. The `variant_sku` will act as the main product SKU, `variant_specific_price` as its price, and `variant_stock_quantity` as its stock.
*   **Variant Rows:**
    *   Each subsequent row with the same `product_handle` defines a specific variant of that product.
    *   Each variant row **must** have a unique `variant_sku`.
    *   It should also specify `variant_specific_price` (if different from `product_base_price`), `variant_stock_quantity`, and any variant-specific attributes (`variant_attribute_X_name` and `variant_attribute_X_value`).
    *   If `variant_specific_price` is left blank for a variant, it will inherit the price from `product_base_price`.
    *   If `product_name`, `product_description`, etc., are filled in for variant rows, the values from the first row for that `product_handle` will typically take precedence during processing, but it's cleanest to leave them blank for variant-specific rows.
*   **Variant Attributes:**
    *   Use the `variant_attribute_X_name` and `variant_attribute_X_value` columns to define the characteristics that differentiate variants (e.g., Size=Small, Color=Blue).
    *   For a "T-Shirt" product with `product_handle` "tee001":
        *   One variant might have `variant_attribute_1_name` = "Size", `variant_attribute_1_value` = "M".
        *   Another variant of the same T-shirt might have `variant_attribute_1_name` = "Size", `variant_attribute_1_value` = "L".
        *   If it also varies by color, you would use `variant_attribute_2_name` = "Color" and then the corresponding `variant_attribute_2_value` for each size/color combination.

## 5. Example CSV Data

Below are examples of how to structure your CSV data.

**Example 1: Product with Multiple Variants (T-Shirt)**

```csv
product_handle,product_name,product_description,product_category,product_base_price,product_image_url,variant_sku,variant_specific_price,variant_stock_quantity,variant_image_url,variant_attribute_1_name,variant_attribute_1_value,variant_attribute_2_name,variant_attribute_2_value,is_active
tshirt-classic-blue,Classic Blue T-Shirt,"A comfortable 100% cotton t-shirt.",Apparel,25.00,http://example.com/images/tshirt-blue-main.jpg,TSCB-BLU-S,25.00,50,http://example.com/images/tshirt-blue-s.jpg,Size,S,Color,Blue,TRUE
tshirt-classic-blue,,,,,,TSCB-BLU-M,25.00,100,,Size,M,Color,Blue,TRUE
tshirt-classic-blue,,,,,,TSCB-BLU-L,25.00,75,,Size,L,Color,Blue,TRUE
tshirt-classic-red,Classic Red T-Shirt,"A comfortable 100% cotton t-shirt.",Apparel,25.00,http://example.com/images/tshirt-red-main.jpg,TSCB-RED-S,,30,http://example.com/images/tshirt-red-s.jpg,Size,S,Color,Red,TRUE
tshirt-classic-red,,,,,,TSCB-RED-M,,60,,Size,M,Color,Red,TRUE
```
*In the `tshirt-classic-red` example, `variant_specific_price` is blank for SKU `TSCB-RED-S` and `TSCB-RED-M`, so they would use the `product_base_price` of 25.00.*

**Example 2: Simple Product (No Variants) (Mug)**

```csv
product_handle,product_name,product_description,product_category,product_base_price,product_image_url,variant_sku,variant_specific_price,variant_stock_quantity,variant_image_url,variant_attribute_1_name,variant_attribute_1_value,variant_attribute_2_name,variant_attribute_2_value,is_active
mug-coffee-logo,Company Logo Coffee Mug,"11oz ceramic mug with company logo.",Home Goods,,http://example.com/images/mug-logo.jpg,MUG-LOGO-STD,15.99,200,,,Coffee Mug,,TRUE
```
*In this case, `product_base_price` is left blank because `variant_specific_price` defines the price for the single product offering. Alternatively, `product_base_price` could be 15.99 and `variant_specific_price` could be blank or also 15.99.*

**Example 3: Product with one variant type (e.g. Size only)**
```csv
product_handle,product_name,product_description,product_category,product_base_price,product_image_url,variant_sku,variant_specific_price,variant_stock_quantity,variant_image_url,variant_attribute_1_name,variant_attribute_1_value,variant_attribute_2_name,variant_attribute_2_value,is_active
jeans-regular-fit,Regular Fit Jeans,"Classic regular fit denim jeans.",Apparel,49.99,http://example.com/images/jeans-main.jpg,JRF-30W-32L,49.99,25,,Waist,30,Inseam,32,TRUE
jeans-regular-fit,,,,,,JRF-32W-32L,49.99,30,,Waist,32,Inseam,32,TRUE
jeans-regular-fit,,,,,,JRF-34W-33L,52.50,15,,Waist,34,Inseam,33,TRUE
```
*Note in the jeans example, `variant_attribute_1_name` is "Waist" and `variant_attribute_2_name` is "Inseam" to represent the two key sizing attributes for jeans.*

This structure allows for a clear and organized way to define products and their variants in a single CSV file. Please ensure your CSV file strictly follows these column definitions and formatting rules.
---

*Self-correction: Added an `is_active` column as this is common and useful for bulk uploads. Clarified that `product_handle` is case-sensitive. Added a third example for jeans with two attributes (Waist/Inseam) to better illustrate attribute usage.*
*Self-correction 2: In Example 1, the second product `tshirt-classic-red` should also have its name on its first variant line, or the `product_handle` should be the same as the blue one if it's just a color variant of the *same* product. I've adjusted it to be a distinct `product_handle` for "Classic Red T-Shirt" to illustrate how two different products (each with variants) would look in the same file. If they were variants of the *same* "Classic T-Shirt" product, the `product_handle` would be the same, and "Color" would be the primary distinguishing attribute, with `product_name` only on the very first line for that handle.*
*Self-correction 3: Corrected Example 1 for `tshirt-classic-red` to have `product_name` on its first variant line. Also, for `tshirt-classic-blue`, the `product_name` should be consistent. The provided example shows two distinct products: "Classic Blue T-Shirt" and "Classic Red T-Shirt". If the intention was for "Red" to be a color variant of "Classic T-Shirt", then `product_handle` would be the same, e.g., "tshirt-classic", and `product_name` would be "Classic T-Shirt". The current example is fine for showing two separate products. I will refine example 1 to show one product with two variant types (size and color) for clarity, and adjust example 2 to be more distinct.*

Revising Example 1 for clarity:
```csv
product_handle,product_name,product_description,product_category,product_base_price,product_image_url,variant_sku,variant_specific_price,variant_stock_quantity,variant_image_url,variant_attribute_1_name,variant_attribute_1_value,variant_attribute_2_name,variant_attribute_2_value,is_active
tshirt-unisex-crew,Unisex Crewneck T-Shirt,"Soft and durable cotton crewneck. Available in multiple sizes and colors.",Apparel,20.00,http://example.com/images/tshirt-crew-main.jpg,TSHRT-CREW-S-BLK,22.00,50,http://example.com/images/tshirt-crew-s-blk.jpg,Size,S,Color,Black,TRUE
tshirt-unisex-crew,,,,,,TSHRT-CREW-M-BLK,22.00,100,,Size,M,Color,Black,TRUE
tshirt-unisex-crew,,,,,,TSHRT-CREW-L-BLK,22.00,75,,Size,L,Color,Black,TRUE
tshirt-unisex-crew,,,,,,TSHRT-CREW-S-WHT,,45,http://example.com/images/tshirt-crew-s-wht.jpg,Size,S,Color,White,TRUE
tshirt-unisex-crew,,,,,,TSHRT-CREW-M-WHT,,80,,Size,M,Color,White,TRUE
tshirt-unisex-crew,,,,,,TSHRT-CREW-L-WHT,22.50,60,,Size,L,Color,White,TRUE
```
*This revised Example 1 now shows a single product "Unisex Crewneck T-Shirt" (`tshirt-unisex-crew`) with variants based on both Size and Color. The `variant_specific_price` for `TSHRT-CREW-S-WHT` and `TSHRT-CREW-M-WHT` are blank, meaning they would inherit the `product_base_price` of $20.00. `TSHRT-CREW-L-WHT` has a specific price of $22.50.*

Final check of column descriptions and example consistency. The `product_base_price` vs `variant_specific_price` logic is important. Added a note about `is_active` defaulting to FALSE. The examples now better reflect the intended structure.
