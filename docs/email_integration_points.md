# Email Integration Points

This document outlines where different email notifications, defined in `app/email_utils.py`, should be triggered within the TAIC platform's backend logic.

## 1. User Account Related Emails

### 1.1. Shopper Welcome Email
*   **Function:** `send_shopper_welcome_email`
*   **Trigger Point:** After a new user successfully registers with the `SHOPPER` role.
*   **Location:** `app/routers/auth.py` in the `/register` endpoint.
*   **Status:** Implemented and Integrated.

### 1.2. Merchant Welcome Email
*   **Function:** `send_merchant_welcome_email`
*   **Trigger Point:** After a new user successfully registers with the `MERCHANT` role.
*   **Location:** `app/routers/auth.py` in the `/register` endpoint.
*   **Status:** Implemented and Integrated.

### 1.3. Password Reset Email (Future)
*   **Function:** (To be created, e.g., `send_password_reset_email`)
*   **Trigger Point:** When a user requests a password reset.
*   **Location:** A new endpoint in `app/routers/auth.py` for initiating password resets.
*   **Status:** Pending implementation.

### 1.4. Email Verification Email (Future)
*   **Function:** (To be created, e.g., `send_email_verification_email`)
*   **Trigger Point:** After user registration or when a user changes their email address.
*   **Location:** `app/routers/auth.py` (on registration, on email change via user profile).
*   **Status:** Pending implementation.

## 2. Order Related Emails (Shopper)

### 2.1. Order Confirmation
*   **Function:** `send_order_confirmation_email`
*   **Trigger Point:** After an order is successfully placed and payment is confirmed.
*   **Location:** Within the order creation/checkout finalization logic (e.g., in an `OrderService` or after successful payment processing callback).
*   **Status:** Function and templates implemented in `email_utils.py`. Integration into order logic is pending.

### 2.2. Order Shipped
*   **Function:** `send_order_shipped_email`
*   **Trigger Point:** When an order's status is updated to 'shipped', or when a shipment record with tracking information is created for an order.
*   **Location:** Within the order management logic where shipping updates occur (e.g., in an admin panel order update endpoint, or a merchant order fulfillment endpoint).
*   **Status:** Function and templates implemented in `email_utils.py`. Integration into order/shipping logic is pending.

### 2.3. Order Delivered
*   **Function:** (To be created, e.g., `send_order_delivered_email`)
*   **Trigger Point:** When an order's status is updated to 'delivered' (either manually by an admin/merchant or via carrier webhook).
*   **Location:** Order management logic for status updates.
*   **Status:** Placeholder templates in `email_utils.py`. Function and integration pending.

### 2.4. Refund Processed
*   **Function:** (To be created, e.g., `send_refund_processed_email`)
*   **Trigger Point:** After a refund for an order has been successfully processed by the payment gateway or admin.
*   **Location:** Refund processing logic (e.g., in an admin panel or payment service callback).
*   **Status:** Placeholder templates in `email_utils.py`. Function and integration pending.

## 3. Merchant Specific Emails

### 3.1. New Order Received
*   **Function:** `send_new_order_to_merchant_email`
*   **Trigger Point:** When a new order containing products from a specific merchant is successfully placed and confirmed.
*   **Location:** Order creation/checkout finalization logic, after splitting the order by merchant (if applicable).
*   **Status:** Function and templates implemented in `email_utils.py`. Integration into order logic is pending.

### 3.2. Low Stock Warning
*   **Function:** `send_low_stock_warning_email`
*   **Trigger Point:** When a product variant's `stock_quantity` is updated and falls below a merchant-defined (or system-defined) threshold.
*   **Location:** Inventory update logic (e.g., after an order reduces stock, or in a merchant product update endpoint).
*   **Status:** Function and templates implemented in `email_utils.py`. Integration into inventory logic is pending.

### 3.3. New Customer Message
*   **Function:** `send_new_customer_message_email`
*   **Trigger Point:** When a new message is successfully saved in a conversation, and the recipient is a merchant.
*   **Location:** `app/routers/messaging.py` in the `POST /conversations/{conversation_id}/messages` endpoint (after saving the message and identifying the recipient is a merchant who is not the sender).
*   **Status:** Function and templates implemented in `email_utils.py`. Integration into messaging logic is pending.

### 3.4. Payout Sent
*   **Function:** (To be created, e.g., `send_payout_sent_email`)
*   **Trigger Point:** After a payout to a merchant has been successfully processed.
*   **Location:** Merchant payout processing logic (likely an admin-triggered or automated batch process).
*   **Status:** Placeholder templates in `email_utils.py`. Function and integration pending.

### 3.5. Product Approved/Rejected (Future)
*   **Function:** (To be created)
*   **Trigger Point:** When an admin approves or rejects a merchant's submitted product.
*   **Location:** `app/routers/admin.py` in the product review endpoint.
*   **Status:** Pending implementation.

## 4. Pioneer Program Emails (Future)

### 4.1. Application Received Confirmation
*   **Function:** (To be created)
*   **Trigger Point:** After a user successfully submits a Pioneer Program application.
*   **Location:** `app/routers/pioneer_applications.py` in the `/apply` endpoint.
*   **Status:** Pending implementation.

### 4.2. Application Status Update
*   **Function:** (To be created)
*   **Trigger Point:** When an admin updates the status of a Pioneer Program application.
*   **Location:** `app/routers/admin.py` in the pioneer application status update endpoint.
*   **Status:** Pending implementation.
