# Notification Service Catalog

This document outlines the types of notifications managed and sent by the TAIC Platform's Notification Service. For email notifications, corresponding templates and sender functions are (or will be) available in `app/email_utils.py`.

## I. Shopper Notifications

### 1. Welcome Email (Shopper)
*   **Recipient:** Shopper
*   **Description:** Sent after a new shopper successfully registers on the platform.
*   **Trigger Event:** User registration with 'SHOPPER' role.
*   **Status:** Implemented (`send_shopper_welcome_email`).

### 2. Order Confirmation (Shopper)
*   **Recipient:** Shopper
*   **Description:** Confirms a new order has been successfully placed. Includes order summary, total amount, and shipping address.
*   **Trigger Event:** Successful order creation and payment confirmation.
*   **Status:** Templates and sender function (`send_order_confirmation_email`) to be implemented.

### 3. Order Shipped (Shopper)
*   **Recipient:** Shopper
*   **Description:** Informs the shopper that their order (or part of it) has been shipped. Includes details of shipped items, tracking number, and carrier.
*   **Trigger Event:** Order status changes to 'shipped' or a new shipment record is created for the order.
*   **Status:** Templates and sender function (`send_order_shipped_email`) to be implemented.

### 4. Order Delivered (Shopper)
*   **Recipient:** Shopper
*   **Description:** Informs the shopper that their order has been marked as delivered. May include a request for review.
*   **Trigger Event:** Order status changes to 'delivered'.
*   **Status:** Placeholder templates and sender function to be considered for future implementation.

### 5. Refund Processed (Shopper)
*   **Recipient:** Shopper
*   **Description:** Confirms that a refund for an order (or part of it) has been processed. Includes refund amount and original order reference.
*   **Trigger Event:** Successful processing of a refund transaction.
*   **Status:** Placeholder templates and sender function to be considered for future implementation.

## II. Merchant Notifications

### 1. Welcome Email (Merchant)
*   **Recipient:** Merchant
*   **Description:** Sent after a new merchant successfully registers on the platform.
*   **Trigger Event:** User registration with 'MERCHANT' role.
*   **Status:** Implemented (`send_merchant_welcome_email`).

### 2. New Order Received (Merchant)
*   **Recipient:** Merchant
*   **Description:** Notifies the merchant about a new order received for their products. Includes order details and customer information (shipping).
*   **Trigger Event:** Successful order placement containing products from the merchant.
*   **Status:** Templates and sender function (`send_new_order_to_merchant_email`) to be implemented.

### 3. Low Stock Warning (Merchant)
*   **Recipient:** Merchant
*   **Description:** Alerts the merchant when a product variant's stock quantity falls below a predefined threshold.
*   **Trigger Event:** Inventory update logic detects stock level for a variant has crossed the low stock threshold. (Thresholds might be configurable per product or globally).
*   **Status:** Templates and sender function (`send_low_stock_warning_email`) to be implemented.

### 4. New Customer Message (Merchant)
*   **Recipient:** Merchant
*   **Description:** Notifies the merchant of a new message received from a shopper/user via the on-platform messaging center. Includes a preview of the message and a link to the conversation.
*   **Trigger Event:** A new message is successfully saved in a conversation where the merchant is a participant, and the sender is not the merchant themselves.
*   **Status:** Templates and sender function (`send_new_customer_message_email`) to be implemented.

### 5. Payout Sent (Merchant)
*   **Recipient:** Merchant
*   **Description:** Informs the merchant that a payout of their account balance has been processed and sent. Includes payout amount and destination.
*   **Trigger Event:** Successful processing of a merchant payout.
*   **Status:** Placeholder templates and sender function to be considered for future implementation.

## III. Other Notifications (Future Considerations)

*   **Password Reset Request:** (User - Shopper/Merchant)
*   **Email Verification:** (User - Shopper/Merchant)
*   **Product Approved/Rejected:** (Merchant)
*   **Pioneer Program Application Status Update:** (Applicant)
*   **Platform Announcements:** (All Users / Specific Roles)
*   **Promotional Emails:** (Shoppers - with opt-in)
*   **Abandoned Cart Reminders:** (Shoppers)
*   **Review Request Emails:** (Shoppers - after delivery)
*   **New Product Listing Alerts (for subscribed shoppers):** (Shoppers)
*   **Dispute Resolution Updates:** (Shopper/Merchant)
*   **Subscription Renewal Reminders:** (User - Shopper/Merchant, if applicable)
*   **Account Security Alerts (e.g., new login detected):** (User - Shopper/Merchant)
