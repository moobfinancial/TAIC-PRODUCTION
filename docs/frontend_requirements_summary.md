# Frontend Requirements Summary

This document outlines the necessary frontend development tasks to complement the implemented backend features and APIs.

**## I. Shopper Frontend Requirements**

1.  **Product Discovery & Viewing:**
    *   **Product Listing Pages (e.g., `/products`, category pages):**
        *   Display products fetched from `/api/products` (and potentially `/api/products/cj` or global search).
        *   Implement client-side UI for **Advanced Product Filtering** (price, attributes) using data from the Product Service Agent (via Shopping Assistant or direct API if Product Service has REST).
        *   Display **cashback percentage** information on product cards if applicable.
    *   **Product Detail Pages (e.g., `/products/{id}`):**
        *   Display full product details, including all images (from `image_url` and `additional_image_urls`).
        *   **Product Variants:**
            *   Clearly display available variants (e.g., size, color dropdowns or swatches based on `product.variants` and `product.variant_attribute_names`).
            *   Update price, SKU, image, and stock status dynamically when a variant is selected.
            *   Allow adding a specific variant to the cart.
        *   Display **cashback percentage** and potential earned amount.
        *   Display **Special Delivery Instructions** section if user is logged in and viewing an address (though this is more checkout-related).
        *   **User Social Sharing Buttons.**
        *   (VTO) Trigger for Virtual Try-On (using `VTOModal.tsx` - needs integration with product data).
    *   **Service Display:** UI to list and view services, including their `custom_attributes`.
    *   **Global Search UI:** Implement a search bar that calls `/api/search` and displays categorized results (Products, Merchant Stores, Categories).

2.  **User Authentication & Account Management:**
    *   **Registration Page (`/register`):**
        *   Forms for Email/Password registration (calling `POST /api/auth/register`).
    *   **Login Page (`/login`):**
        *   Forms for Email/Password login (calling `POST /api/auth/login` to get JWT).
        *   UI for Wallet-based login (interacting with user's wallet for message signing, then calling `POST /api/auth/login-wallet`).
    *   **User Dashboard (`/account` or `/dashboard`):**
        *   **Profile Management (`/account/profile`):**
            *   Display user profile information (from `GET /api/users/me`).
            *   Form to update `full_name` (calling `PUT /api/users/me`).
        *   **Account Linking (`/account/security` or similar):**
            *   UI for an email-based user to link a wallet (sign message, call `POST /api/auth/link-wallet`).
            *   UI for a wallet-based user to link an email/password (form, call `POST /api/auth/link-email-password`).
        *   **Address Book (`/account/addresses`):**
            *   List addresses (from `GET /api/users/me/addresses`).
            *   Forms to Add/Edit addresses, including all **Special Delivery Instruction** fields (calling `POST /api/users/me/addresses/`, `PUT /api/users/me/addresses/{address_id}`).
            *   Ability to set/change default address (calling `POST /api/users/me/addresses/{address_id}/set-default` or via PUT).
            *   Ability to delete addresses (calling `DELETE /api/users/me/addresses/{address_id}`).
        *   **Data Portability (`/account/data`):**
            *   Button to trigger data export (calling `GET /api/users/me/export-data` and handling JSON file download).
        *   **Account Deletion (`/account/security`):**
            *   UI for requesting account deletion, with appropriate warnings (calling `DELETE /api/users/me/delete-account`).
        *   (Order History, Wishlist, TAIC Token Balance/Cashback History - these need their own backend APIs first if not covered by basic profile).

3.  **Shopping Cart & Checkout:**
    *   **Cart Page (`/cart`):** Display items, allow quantity updates, show subtotals.
    *   **Checkout Flow:**
        *   Address selection (using saved addresses or adding new, including Special Delivery Instructions).
        *   Call `POST /api/checkout/calculate-totals` with cart items and selected shipping address to get shipping options, taxes, and grand total.
        *   Display shipping options for user to select.
        *   Display calculated taxes and final total.
        *   (Payment integration - Stripe, Crypto - this is a large separate piece).
        *   (Order placement - calling a real order creation API that uses the calculated totals and selected shipping).

4.  **AI Interactions:**
    *   **AI Shopping Assistant UI (`/ai-assistant`):** Interface to chat with the Shopping Assistant (FastAPI agent).
    *   **Gift Recommendation UI:**
        *   Integrate with AI Shopping Assistant or provide a dedicated UI that calls the Genkit flow (`/api/ai/product-ideas` with `generatorMode='gift'`).
        *   Input fields for recipient details (age, gender, interests, occasion, budget), free-text query, optional image upload.
        *   Display generated gift suggestions and any linked products.
    *   **AI Agent Feedback:** UI elements (e.g., thumbs up/down, simple forms) to submit feedback on AI recommendations (calling `POST /api/ai/feedback`).
    *   **Virtual Try-On (VTO):**
        *   `VTOModal.tsx` needs to be fully integrated:
            *   User image upload (calling `/api/upload-image` - Next.js API route).
            *   Trigger VTO generation by calling `/api/virtual-try-on` (Next.js API route that calls the Genkit VTO flow).
            *   Display generated VTO image.
        *   UI for user controls related to VTO data privacy (e.g., deleting their VTO images if `vto_images` table is used by the Genkit flow).

5.  **Merchant Interaction:**
    *   **Merchant Store Pages (`/store/{slug}`):** Public page to view a merchant's profile and listed products (data from `GET /api/merchant/store-profile/slug/{slug}` and product listings).
    *   **Store Reviews:** Display store reviews on merchant store pages. Allow authenticated shoppers to submit reviews for a store (calling `POST /api/stores/{merchant_id}/reviews`).
    *   **On-Platform Messaging Center (Shopper View):**
        *   UI to list conversations (`GET /api/messaging/conversations`).
        *   UI to view messages within a conversation (`GET /api/messaging/conversations/{id}/messages`).
        *   UI to send messages (`POST /api/messaging/conversations/{id}/messages` or `POST /api/messaging/conversations` to start new).

**## II. Merchant Frontend Requirements (Merchant Portal)**

1.  **Product Management:**
    *   **List Products:** View their own products with status (pending, approved, rejected).
    *   **Create Product:** Form to create new base products. (Needs new merchant API for product creation - this API does not exist yet).
    *   **Update Product (`PUT /api/merchant/products/{id}`):** Form to edit product details (name, description, price, category, images, **cashback percentage**). UI should indicate if changes will trigger re-approval.
    *   **Manage Variants (using `/api/merchant/products/{product_id}/variants` and `/api/merchant/variants/{variant_id}`):**
        *   UI to add new variants to a product.
        *   UI to edit existing variants (SKU, attributes, price, stock, image).
        *   UI to delete variants.
    *   **Bulk Upload:** UI to upload CSV file for products/variants (calling `POST /api/bulk/upload-products-csv`). Display progress and results/errors.

2.  **Store Profile Management (`/merchant/dashboard/store-profile`):**
    *   Form to create/update their store profile (name, description, logo, banner, custom settings) using `POST /api/merchant/store-profile` (which is an UPSERT).
    *   View current profile using `GET /api/merchant/store-profile/mine`.

3.  **Shipping Management (`/merchant/dashboard/shipping`):**
    *   UI for CRUD operations on:
        *   Shipping Methods (calling `/api/merchant/shipping/methods/...`).
        *   Shipping Zones (calling `/api/merchant/shipping/methods/{id}/zones/...` and `/api/merchant/shipping/zones/{id}...`).
        *   Shipping Zone Locations (calling `/api/merchant/shipping/zones/{id}/locations/...` and `/api/merchant/shipping/locations/{id}...`).
        *   Shipping Rates (calling `/api/merchant/shipping/zones/{id}/rates/...` and `/api/merchant/shipping/rates/{id}...`).

4.  **Tax Settings (`/merchant/dashboard/tax`):**
    *   UI to manage their tax settings (collects_tax, default_tax_rate_percentage, tax_registration_id) using `GET` and `PUT` on `/api/merchant/tax/settings`.

5.  **Order Management:** (Needs dedicated merchant order view APIs)
    *   View orders containing their products.
    *   Update order status for their items (e.g., mark as shipped, provide tracking - this needs specific APIs and workflow).

6.  **Messaging Center (Merchant View):**
    *   UI to list/view conversations and send/receive messages with shoppers. (Uses `/api/messaging/...` endpoints).

7.  **Pioneer Program (If Merchant is a Pioneer):**
    *   **Deliverables Section (`/merchant/dashboard/pioneer`):**
        *   List their assigned deliverables (from `GET /api/pioneer/me/deliverables`).
        *   UI to submit deliverables (form with `submission_content` field, calling `PUT /api/pioneer/me/deliverables/{id}/submit`).

8.  **(Future) Merchant Financial Dashboard.**
9.  **(Future) Promotions & Discount Engine UI.**

**## III. Admin Frontend Requirements (Admin Portal)**

1.  **Dashboard (`/admin/dashboard`):**
    *   Display key platform statistics (total shoppers, merchants, products pending, sales volume, new users) using data from `GET /api/admin/dashboard/stats`.
    *   Quick access panels/widgets and improved navigation.

2.  **Product Management:**
    *   **Product Approval Queue (`/admin/products/review`):**
        *   List products with 'pending' status (from `GET /api/admin/products-for-review?status=pending`).
        *   Interface to view product details (including variants).
        *   Buttons to Approve or Reject products (calling `POST /api/admin/products/{id}/review`), including fields for `admin_review_notes` and `cashback_percentage`.
    *   View all products with filters for status.

3.  **Category Management (`/admin/categories`):**
    *   UI for CRUD operations on categories (calling `/api/categories/...`).
    *   Specific UI to manage `category_type` ('PRODUCT' vs 'SERVICE') and `custom_attributes` for service categories.

4.  **User Management (Basic):** (Needs dedicated admin user management APIs - e.g., list users, view details, activate/deactivate).
    *   List users (shoppers, merchants).
    *   View user details.
    *   Ability to activate/deactivate users.

5.  **Merchant Management (Basic):** (Needs dedicated admin merchant management APIs - e.g., list merchants, view store profiles).
    *   List merchants.
    *   View merchant details, store profile.

6.  **CJ Dropshipping Admin Features:**
    *   The existing `src/app/admin/cj-browse/page.tsx` for browsing and importing products. Ensure it uses the admin API key and calls `/api/admin/cj/import-product` and `/api/admin/cj/cj-categories-route`.
    *   Interface to manage status of imported CJ products (using general product review queue or a dedicated one if needed).

7.  **Order Management (`/admin/orders`):**
    *   List all orders with filtering (by status, user) using `GET /api/admin/orders`.
    *   View detailed order information (including items) using `GET /api/admin/orders/{id}`.
    *   Interface to update order status (e.g., mark as shipped, delivered, refunded) using `PUT /api/admin/orders/{id}/status`, including fields for tracking number, carrier, refund amount.

8.  **Pioneer Program Management (`/admin/pioneer-applications`):**
    *   List applications with filters (status, tier) using `GET /api/admin/pioneer-applications`.
    *   View individual application details using `GET /api/admin/pioneer-applications/{id}`.
    *   Update application status and internal notes using `PUT /api/admin/pioneer-applications/{id}/status`.
    *   **Deliverable Management (nested under an application view):**
        *   Assign new deliverables (`POST /api/admin/pioneer-applications/{app_id}/deliverables`).
        *   List assigned deliverables (`GET /api/admin/pioneer-applications/{app_id}/deliverables`).
        *   Update/review submitted deliverables (`PUT /api/admin/pioneer-deliverables/{del_id}`).
        *   Delete deliverables (`DELETE /api/admin/pioneer-deliverables/{del_id}`).

9.  **Audit Log Viewer (`/admin/audit-logs`):**
    *   Interface to view admin audit logs with pagination and filtering using `GET /api/admin/audit-logs`.

This list is comprehensive and should provide a good starting point for frontend planning and development.
