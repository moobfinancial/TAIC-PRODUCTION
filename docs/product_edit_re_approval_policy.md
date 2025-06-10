# Product Edit & Re-Approval Policy

## 1. Policy Objective

To maintain a high standard of quality, accuracy, and appropriateness for all products listed on the TAIC platform, even after their initial approval. This policy ensures that significant modifications to already approved products undergo a re-review process before being publicly visible again.

## 2. Scope of Edits Requiring Re-Approval

When a merchant edits a product or its variants that has an existing `approval_status` of 'approved', the following types of changes will automatically trigger the re-approval workflow. For the initial implementation of this policy, most data field changes are considered significant enough to warrant a re-review.

**Product-Level Changes:**

*   **Product Name:** Any change to the product's name.
*   **Product Description:** Any substantial change to the product's description (e.g., more than minor typo correction).
*   **Primary Images (`image_url`):** Changes or additions to the main product images.
*   **Product Category (`platform_category_id`):** Changes to the assigned product category.
*   **Base Price (`price`):** Any change to the base price of the product, especially if the product does not have variants or if variants derive their price from it.
*   **Data AI Hint (`data_ai_hint`):** Changes to this field, as it may affect AI interactions or product discoverability in unintended ways.
*   **Source (`source`):** While less common for merchants to edit, changes to this could indicate a fundamental shift in the product's origin or nature.

**Product Variant-Level Changes (for any variant associated with an approved product):**

*   **Addition of New Variants:** When a new variant is added to an existing approved product.
*   **Variant SKU (`sku`):** Any change to a variant's SKU.
*   **Variant Attributes (`attributes`):** Any changes to the attribute key-value pairs (e.g., changing "Color": "Red" to "Color": "Crimson", or "Size": "S" to "Size": "Small", or adding/removing attributes like "Material").
*   **Variant Specific Price (`specific_price`):** Any change to the price of a specific variant.
*   **Variant Image URL (`image_url`):** Changes or additions to variant-specific images.

**Fields Potentially Not Requiring Re-Approval (or subject to lighter review - for future consideration):**

*   **Minor Typo Corrections:** Small, inconsequential typo fixes in the description, if detectable or if the merchant can flag the edit as such. (Current Policy: Assume re-approval for simplicity).
*   **Stock Quantity Updates (`stock_quantity` for variants, or for base product if no variants):** Routine updates to inventory levels are generally operational and should not require full re-approval unless changes are exceptionally drastic and might indicate a different underlying product or issue. (Current Policy: Assume re-approval if other significant fields are changed simultaneously; standalone stock updates might bypass this in a more mature system).
*   **Merchant ID (`merchant_id`):** This is typically system-assigned or set upon product creation and not usually editable by merchants in a way that affects product content review.
*   **Original CJ Product ID (`original_cj_product_id`):** Similar to merchant ID, this is usually a static reference.

**Default Stance:** For the initial implementation, any modification by a merchant to the above-listed sensitive fields of an 'approved' product or its variants will trigger the re-approval process.

## 3. Re-Approval Workflow

**3.1. Automatic Status Change:**

*   When a merchant submits an edit to an 'approved' product that falls under the "Scope of Edits Requiring Re-Approval":
    *   The product's `approval_status` in the `products` table will be automatically changed to **'pending'**. (Alternatively, a more specific status like 'pending_edit_review' could be used if the system needs to differentiate these from brand new 'pending' products).
    *   The product's `is_active` status in the `products` table will be automatically changed to **`FALSE`**.

**3.2. Effect of Status Change:**

*   Setting `is_active` to `FALSE` immediately unpublishes the product from the live marketplace, making it temporarily unavailable for browsing or purchase by shoppers.
*   The product remains in the merchant's dashboard but is marked as pending review.

**3.3. Admin Notification (Conceptual System Feature):**

*   The system should ideally generate a notification for the admin team (e.g., via an admin dashboard alert, email, or internal messaging system) indicating that a previously approved product (Product ID: [ID], Name: [Name]) has been modified and requires re-review.

**3.4. Admin Re-Review Process:**

*   Administrators will use the product review interface (e.g., by filtering for products with `approval_status = 'pending'` in their admin dashboard or via an API like `GET /api/admin/products-for-review?status=pending`).
*   Admins will review the changes made by the merchant. They should be able to see the previous vs. current values for key fields (this requires data versioning or audit logging, which is a separate advanced feature).
*   Based on the review, the admin can:
    *   **Approve:** Set `approval_status` to 'approved'. The admin (or system, based on policy) can then set `is_active` back to `TRUE`.
    *   **Reject:** Keep `approval_status` as 'rejected' (or change it to 'rejected' if it was 'pending_edit_review'). `is_active` remains `FALSE`. The admin should provide reasons for rejection in the `admin_review_notes` field.

**3.5. Product Reactivation:**

*   If the admin approves the edited product:
    *   The `approval_status` is set to 'approved'.
    *   The `is_active` flag can be set to `TRUE` either by the admin manually as part of the approval action or automatically by the system upon approval if the policy dictates immediate re-publishing. For initial simplicity, admin action to set `is_active` is acceptable.

## 4. Merchant Communication (Conceptual)

*   **Upon Edit Submission:** When a merchant submits an edit that triggers re-approval, the system should clearly inform them (e.g., via a UI message in the merchant dashboard) that their changes require administrative review and the product will be temporarily unpublished.
*   **Upon Review Completion:** Merchants should be notified (e.g., via email or dashboard notification) once the re-review is complete, whether the changes were approved (and product republished) or rejected (with reasons and next steps, if any).

## 5. Implementation Notes for Future Development

This policy has direct implications for the backend API endpoints that handle product and product variant updates.

*   **Product Update Endpoint(s):** (e.g., `PUT /api/products/{product_id}`)
*   **Product Variant Update Endpoint(s):** (e.g., `PUT /api/variants/{variant_id}` or an endpoint that updates variants in batch for a product)
*   **Product Variant Creation Endpoint (for existing products):** (e.g., `POST /api/products/{product_id}/variants`)

When these endpoints receive a request to modify an already 'approved' product or its variants:
1.  **Fetch Current Status:** The endpoint must first fetch the current `approval_status` and `is_active` status of the main product.
2.  **Identify Significant Edits:** If the current `approval_status` is 'approved', the endpoint logic must compare the incoming update data with the existing data to determine if any fields within the "Scope of Edits Requiring Re-Approval" are being changed.
3.  **Trigger Re-Approval Workflow:**
    *   If a significant edit is detected, the endpoint must:
        *   Set `products.approval_status` to 'pending' (or 'pending_edit_review').
        *   Set `products.is_active` to `FALSE`.
4.  **Save Changes:** Proceed with saving the actual data modifications (e.g., updating name, description, price, variant attributes) to the `products` and/or `product_variants` tables. This should happen irrespective of whether re-approval is triggered, so the merchant's changes are saved but just not live until re-approved.
5.  **Database Transactions:** All these operations (checking status, updating status flags, saving data changes) should occur within a single database transaction to ensure atomicity.

**Considerations for `admin_review_notes`:**
*   When a product is set to 'pending' due to an edit, the `admin_review_notes` could be cleared or appended with a system note like "Product automatically set to pending review due to merchant edit on [timestamp]."

This policy establishes a clear framework. The technical implementation will require careful coding in the respective API endpoints to enforce these rules.
