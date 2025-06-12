import logging
import os
import resend # Import the Resend SDK

logger = logging.getLogger(__name__)

# --- Resend Configuration ---
# It's crucial that these environment variables are set where the application runs.
# RESEND_API_KEY: Your Resend API key.
# SENDER_EMAIL_ADDRESS: An email address verified with your Resend account (associated with a verified domain).
# Example: SENDER_EMAIL_ADDRESS="noreply@yourdomain.com"

resend.api_key = os.getenv("RESEND_API_KEY")
SENDER_EMAIL_ADDRESS = os.getenv("SENDER_EMAIL_ADDRESS", "noreply@example.com") # Default if not set

if not resend.api_key:
    logger.warning("RESEND_API_KEY environment variable not set. Real email sending will be disabled. Emails will only be logged.")
if SENDER_EMAIL_ADDRESS == "noreply@example.com" and resend.api_key:
    logger.warning("SENDER_EMAIL_ADDRESS is using the default 'noreply@example.com'. Ensure this is a verified sender address in Resend for emails to be delivered.")

# Base URL for frontend links
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")


# --- Email Templates ---

# Shopper Welcome Email
SHOPPER_WELCOME_SUBJECT = "Welcome to TAIC! Your Adventure Awaits!"

SHOPPER_WELCOME_TEXT_BODY = """
Hello {user_name},

Welcome to TAIC - The AI-Powered Crypto Commerce Marketplace!

We're thrilled to have you join our community. Get ready to explore a new era of online shopping where innovation meets convenience.

Here's what you can do on TAIC:
- Shop Unique Products: Discover a wide range of products from innovative merchants.
- Earn Crypto Rewards: Get TAIC Coin cashback on your purchases.
- AI Shopping Assistant: Let our AI help you find exactly what you're looking for.

Explore now: {homepage_url}

Happy Shopping!

The TAIC Team
"""

SHOPPER_WELCOME_HTML_BODY = """
<!DOCTYPE html>
<html>
<head>
    <title>Welcome to TAIC!</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
        .container {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; }}
        .header {{ font-size: 24px; font-weight: bold; color: #4A90E2; }}
        .content p {{ line-height: 1.6; }}
        .button {{
            display: inline-block; background-color: #4A90E2; color: #ffffff; padding: 10px 20px;
            text-decoration: none; border-radius: 5px; font-weight: bold;
        }}
        .footer {{ margin-top: 20px; font-size: 0.9em; color: #777; }}
    </style>
</head>
<body>
    <div class="container">
        <p class="header">Welcome to TAIC, {user_name}!</p>
        <div class="content">
            <p>We're thrilled to have you join our community. Get ready to explore a new era of online shopping where innovation meets convenience.</p>
            <p>Here's what you can do on TAIC:</p>
            <ul>
                <li><strong>Shop Unique Products:</strong> Discover a wide range of products from innovative merchants.</li>
                <li><strong>Earn Crypto Rewards:</strong> Get TAIC Coin cashback on your purchases.</li>
                <li><strong>AI Shopping Assistant:</strong> Let our AI help you find exactly what you're looking for.</li>
            </ul>
            <p>
                <a href="{homepage_url}" class="button">Explore TAIC Now</a>
            </p>
        </div>
        <div class="footer">
            <p>Happy Shopping!</p>
            <p>The TAIC Team</p>
        </div>
    </div>
</body>
</html>
"""

# Merchant Welcome Email
MERCHANT_WELCOME_SUBJECT = "Welcome to the TAIC Merchant Family!"

MERCHANT_WELCOME_TEXT_BODY = """
Hello {merchant_name},

Congratulations and welcome to the TAIC Merchant Family!

We're excited to partner with you to bring your products to a global audience through our AI-powered crypto commerce marketplace.

Key benefits of selling on TAIC:
- Global Reach: Access a diverse and growing customer base.
- AI-Powered Tools: Leverage our intelligent tools for product listing and insights.
- Crypto Payments: Embrace the future of commerce with seamless crypto transactions.

Get started by visiting your Merchant Dashboard: {merchant_dashboard_url}
Review our Merchant Documentation: {merchant_docs_url}

We look forward to your success on TAIC!

The TAIC Team
"""

MERCHANT_WELCOME_HTML_BODY = """
<!DOCTYPE html>
<html>
<head>
    <title>Welcome, TAIC Merchant!</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
        .container {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; }}
        .header {{ font-size: 24px; font-weight: bold; color: #28A745; }} /* Green for merchants */
        .content p {{ line-height: 1.6; }}
        .button {{
            display: inline-block; background-color: #28A745; color: #ffffff; padding: 10px 20px;
            text-decoration: none; border-radius: 5px; font-weight: bold;
        }}
        .footer {{ margin-top: 20px; font-size: 0.9em; color: #777; }}
    </style>
</head>
<body>
    <div class="container">
        <p class="header">Welcome to the TAIC Merchant Family, {merchant_name}!</p>
        <div class="content">
            <p>We're excited to partner with you to bring your products to a global audience through our AI-powered crypto commerce marketplace.</p>
            <p>Key benefits of selling on TAIC:</p>
            <ul>
                <li><strong>Global Reach:</strong> Access a diverse and growing customer base.</li>
                <li><strong>AI-Powered Tools:</strong> Leverage our intelligent tools for product listing and insights.</li>
                <li><strong>Crypto Payments:</strong> Embrace the future of commerce with seamless crypto transactions.</li>
            </ul>
            <p>
                <a href="{merchant_dashboard_url}" class="button">Go to Merchant Dashboard</a>
            </p>
            <p>
                We also recommend reviewing our <a href="{merchant_docs_url}">Merchant Documentation</a> to make the most of your experience.
            </p>
        </div>
        <div class="footer">
            <p>We look forward to your success on TAIC!</p>
            <p>The TAIC Team</p>
        </div>
    </div>
</body>
</html>
"""

# --- Email Sending Utility ---

async def send_email_async(to_email: str, subject: str, body_html: str, body_text: str):
    """
    Sends an email using the Resend SDK if configured, otherwise logs the email content.
    """
    if not resend.api_key:
        logger.warning(f"Resend API key not configured. Skipping actual email send to {to_email} with subject: {subject}")
        logger.info(f"--- EMAIL CONTENT (SIMULATED SEND) ---")
        logger.info(f"To: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body (Text): {body_text[:300]}...")
        logger.info(f"Body (HTML): {body_html[:300]}...")
        logger.info(f"--- END SIMULATED EMAIL SEND ---")
        return False

    params = {
        "from": SENDER_EMAIL_ADDRESS,
        "to": [to_email], # Resend expects a list of recipients
        "subject": subject,
        "html": body_html,
        "text": body_text, # Optional, but good practice
        # Example of optional headers and tags:
        # "headers": {
        #     "X-Entity-Ref-ID": "some_internal_reference_id_if_needed"
        # },
        # "tags": [
        #     {"name": "email_type", "value": "transactional"}, # Customize based on email type
        # ]
    }

    try:
        email_response_obj = resend.Emails.send(params)
        # The response object from resend.Emails.send() is an instance of a class,
        # not a dictionary directly. Access its attributes like email_response_obj.id
        # For logging, it's safer to convert to dict if needed or access known attributes.
        # Example: email_id = email_response_obj.id
        # For now, let's assume it has a dictionary-like structure or a simple string representation for logging.
        # A more robust way for a Pydantic user: email_response = ResendEmailResponse(**email_response_obj.model_dump())
        # but we don't have that model here.

        # Assuming email_response_obj has an 'id' attribute for logging
        email_id = getattr(email_response_obj, 'id', 'N/A')
        logger.info(f"Email successfully sent via Resend to {to_email}. Subject: '{subject}'. Resend ID: {email_id}")
        return True
    except resend.exceptions.ResendError as e:
        logger.error(f"Failed to send email via Resend to {to_email}. Subject: '{subject}'. Error: {e}")
        return False
    except Exception as e: # Catch any other unexpected errors during the send call
        logger.error(f"An unexpected error occurred sending email via Resend to {to_email}. Subject: '{subject}'. Error: {e}")
        return False

async def send_shopper_welcome_email(to_email: str, user_name: str, homepage_url: str = "http://localhost:3000"): # Assuming default homepage URL
    """
    Sends the shopper welcome email.
    """
    subject = SHOPPER_WELCOME_SUBJECT
    text_body = SHOPPER_WELCOME_TEXT_BODY.format(user_name=user_name, homepage_url=homepage_url)
    html_body = SHOPPER_WELCOME_HTML_BODY.format(user_name=user_name, homepage_url=homepage_url)

    return await send_email_async(to_email, subject, html_body, text_body)

async def send_merchant_welcome_email(
    to_email: str,
    merchant_name: str,
    merchant_dashboard_url: str = "http://localhost:3000/merchant/dashboard", # Placeholder
    merchant_docs_url: str = "http://localhost:3000/docs/merchants" # Placeholder
):
    """
    Sends the merchant welcome email.
    """
    subject = MERCHANT_WELCOME_SUBJECT
    text_body = MERCHANT_WELCOME_TEXT_BODY.format(
        merchant_name=merchant_name,
        merchant_dashboard_url=merchant_dashboard_url,
        merchant_docs_url=merchant_docs_url
    )
    html_body = MERCHANT_WELCOME_HTML_BODY.format(
        merchant_name=merchant_name,
        merchant_dashboard_url=merchant_dashboard_url,
        merchant_docs_url=merchant_docs_url
    )

    return await send_email_async(to_email, subject, html_body, text_body)

# --- Order Confirmation (Shopper) ---
ORDER_CONFIRMATION_SHOPPER_SUBJECT = "Your TAIC Order #{order_id} is Confirmed!"
ORDER_CONFIRMATION_SHOPPER_TEXT_BODY = """
Hello {user_name},

Thank you for your order!

Your order #{order_id} has been confirmed and is being processed.
Order Total: {currency_symbol}{total_amount}
Shipping Address: {shipping_address}

You can view your order details here: {order_url}

We'll notify you once your order has shipped.

Thanks for shopping with TAIC!
The TAIC Team
"""
ORDER_CONFIRMATION_SHOPPER_HTML_BODY = """
<!DOCTYPE html><html><head><title>Order Confirmed!</title></head><body>
<p>Hello {user_name},</p>
<p>Thank you for your order! Your order <strong>#{order_id}</strong> has been confirmed and is being processed.</p>
<p><strong>Order Total:</strong> {currency_symbol}{total_amount}</p>
<p><strong>Shipping Address:</strong><br>{shipping_address}</p>
<p><a href="{order_url}">View Your Order</a></p>
<p>We'll notify you once your order has shipped.</p>
<p>Thanks for shopping with TAIC!<br>The TAIC Team</p>
</body></html>
"""

async def send_order_confirmation_email(to_email: str, order_details: dict, user_name: str):
    subject = ORDER_CONFIRMATION_SHOPPER_SUBJECT.format(order_id=order_details.get("id", "N/A"))
    # Basic formatting for address dict for text email
    shipping_addr_parts = [
        order_details.get("shipping_address", {}).get("line1", ""),
        order_details.get("shipping_address", {}).get("line2", ""),
        order_details.get("shipping_address", {}).get("city", ""),
        order_details.get("shipping_address", {}).get("state", ""),
        order_details.get("shipping_address", {}).get("postal_code", ""),
        order_details.get("shipping_address", {}).get("country", "")
    ]
    shipping_address_text = ", ".join(filter(None, shipping_addr_parts))
    # Basic formatting for HTML (replace newlines with <br>)
    shipping_address_html = "<br>".join(filter(None, shipping_addr_parts))


    text_body = ORDER_CONFIRMATION_SHOPPER_TEXT_BODY.format(
        user_name=user_name,
        order_id=order_details.get("id", "N/A"),
        currency_symbol=order_details.get("currency_symbol", "$"),
        total_amount=order_details.get("total_amount", "0.00"),
        shipping_address=shipping_address_text,
        order_url=order_details.get("order_url", "#")
    )
    html_body = ORDER_CONFIRMATION_SHOPPER_HTML_BODY.format(
        user_name=user_name,
        order_id=order_details.get("id", "N/A"),
        currency_symbol=order_details.get("currency_symbol", "$"),
        total_amount=order_details.get("total_amount", "0.00"),
        shipping_address=shipping_address_html,
        order_url=order_details.get("order_url", "#")
    )
    return await send_email_async(to_email, subject, html_body, text_body)

# --- Order Shipped (Shopper) ---
ORDER_SHIPPED_SHOPPER_SUBJECT = "Your TAIC Order #{order_id} Has Shipped!"
ORDER_SHIPPED_SHOPPER_TEXT_BODY = """
Hello {user_name},

Good news! Your TAIC order #{order_id} has shipped.

Items Shipped:
{shipped_items_summary}

Carrier: {carrier_name}
Tracking Number: {tracking_number}
Track your package: {tracking_url}

Estimated Delivery: {estimated_delivery_date}

Thanks for shopping with TAIC!
The TAIC Team
"""
ORDER_SHIPPED_SHOPPER_HTML_BODY = """
<!DOCTYPE html><html><head><title>Order Shipped!</title></head><body>
<p>Hello {user_name},</p>
<p>Good news! Your TAIC order <strong>#{order_id}</strong> has shipped.</p>
<p><strong>Items Shipped:</strong><br>{shipped_items_summary_html}</p>
<p><strong>Carrier:</strong> {carrier_name}</p>
<p><strong>Tracking Number:</strong> {tracking_number}</p>
<p><a href="{tracking_url}">Track Your Package</a></p>
<p>Estimated Delivery: {estimated_delivery_date}</p>
<p>Thanks for shopping with TAIC!<br>The TAIC Team</p>
</body></html>
"""

async def send_order_shipped_email(to_email: str, order_details: dict, tracking_info: dict, user_name: str):
    subject = ORDER_SHIPPED_SHOPPER_SUBJECT.format(order_id=order_details.get("id", "N/A"))
    # Example: shipped_items_summary could be a string list: "- Product A (Qty: 1)\n- Product B (Qty: 2)"
    # For HTML, replace \n with <br>
    shipped_items_text = tracking_info.get("shipped_items_summary", "Details not available.")
    shipped_items_html = shipped_items_text.replace("\n", "<br>")

    text_body = ORDER_SHIPPED_SHOPPER_TEXT_BODY.format(
        user_name=user_name,
        order_id=order_details.get("id", "N/A"),
        shipped_items_summary=shipped_items_text,
        carrier_name=tracking_info.get("carrier_name", "N/A"),
        tracking_number=tracking_info.get("tracking_number", "N/A"),
        tracking_url=tracking_info.get("tracking_url", "#"),
        estimated_delivery_date=tracking_info.get("estimated_delivery_date", "N/A")
    )
    html_body = ORDER_SHIPPED_SHOPPER_HTML_BODY.format(
        user_name=user_name,
        order_id=order_details.get("id", "N/A"),
        shipped_items_summary_html=shipped_items_html,
        carrier_name=tracking_info.get("carrier_name", "N/A"),
        tracking_number=tracking_info.get("tracking_number", "N/A"),
        tracking_url=tracking_info.get("tracking_url", "#"),
        estimated_delivery_date=tracking_info.get("estimated_delivery_date", "N/A")
    )
    return await send_email_async(to_email, subject, html_body, text_body)

# --- New Order Received (Merchant) ---
NEW_ORDER_MERCHANT_SUBJECT = "New Order Received on TAIC: #{order_id}"
NEW_ORDER_MERCHANT_TEXT_BODY = """
Hello {merchant_name},

You've received a new order on TAIC!

Order ID: #{order_id}
Customer Name: {customer_name} (User ID: {customer_user_id})
Order Total: {currency_symbol}{total_amount}

Items in this order:
{order_items_summary}

Shipping Address:
{shipping_address}

Please process this order via your Merchant Dashboard: {merchant_order_url}

The TAIC Team
"""
NEW_ORDER_MERCHANT_HTML_BODY = """
<!DOCTYPE html><html><head><title>New Order Received!</title></head><body>
<p>Hello {merchant_name},</p>
<p>You've received a new order on TAIC: <strong>#{order_id}</strong></p>
<p><strong>Customer:</strong> {customer_name} (User ID: {customer_user_id})</p>
<p><strong>Order Total:</strong> {currency_symbol}{total_amount}</p>
<p><strong>Items in this order:</strong><br>{order_items_summary_html}</p>
<p><strong>Shipping Address:</strong><br>{shipping_address_html}</p>
<p><a href="{merchant_order_url}">View and Process Order</a></p>
<p>The TAIC Team</p>
</body></html>
"""

async def send_new_order_to_merchant_email(to_email: str, order_details: dict, merchant_name: str):
    subject = NEW_ORDER_MERCHANT_SUBJECT.format(order_id=order_details.get("id", "N/A"))
    shipping_addr_parts = [
        order_details.get("shipping_address", {}).get("line1", ""),
        order_details.get("shipping_address", {}).get("line2", ""),
        order_details.get("shipping_address", {}).get("city", ""),
        order_details.get("shipping_address", {}).get("state", ""),
        order_details.get("shipping_address", {}).get("postal_code", ""),
        order_details.get("shipping_address", {}).get("country", "")
    ]
    shipping_address_text = ", ".join(filter(None, shipping_addr_parts))
    shipping_address_html = "<br>".join(filter(None, shipping_addr_parts))

    order_items_text = order_details.get("order_items_summary", "Details not available.")
    order_items_html = order_items_text.replace("\n", "<br>")

    text_body = NEW_ORDER_MERCHANT_TEXT_BODY.format(
        merchant_name=merchant_name,
        order_id=order_details.get("id", "N/A"),
        customer_name=order_details.get("customer_info", {}).get("name", "N/A"),
        customer_user_id=order_details.get("customer_info", {}).get("user_id", "N/A"),
        currency_symbol=order_details.get("currency_symbol", "$"),
        total_amount=order_details.get("total_amount", "0.00"),
        order_items_summary=order_items_text,
        shipping_address=shipping_address_text,
        merchant_order_url=order_details.get("merchant_order_url", "#")
    )
    html_body = NEW_ORDER_MERCHANT_HTML_BODY.format(
        merchant_name=merchant_name,
        order_id=order_details.get("id", "N/A"),
        customer_name=order_details.get("customer_info", {}).get("name", "N/A"),
        customer_user_id=order_details.get("customer_info", {}).get("user_id", "N/A"),
        currency_symbol=order_details.get("currency_symbol", "$"),
        total_amount=order_details.get("total_amount", "0.00"),
        order_items_summary_html=order_items_html,
        shipping_address_html=shipping_address_html,
        merchant_order_url=order_details.get("merchant_order_url", "#")
    )
    return await send_email_async(to_email, subject, html_body, text_body)

# --- Low Stock Warning (Merchant) ---
LOW_STOCK_MERCHANT_SUBJECT = "Low Stock Warning for {product_name}"
LOW_STOCK_MERCHANT_TEXT_BODY = """
Hello {merchant_name},

This is an alert that your product '{product_name}' (Variant: {variant_sku_or_attributes}) is running low on stock.

Current Stock Level: {current_stock_level}
Low Stock Threshold: {low_stock_threshold}

Please update your inventory soon to avoid running out of stock.
Manage Product: {product_management_url}

The TAIC Team
"""
LOW_STOCK_MERCHANT_HTML_BODY = """
<!DOCTYPE html><html><head><title>Low Stock Warning</title></head><body>
<p>Hello {merchant_name},</p>
<p>This is an alert that your product '<strong>{product_name}</strong>' (Variant: {variant_sku_or_attributes_html}) is running low on stock.</p>
<p><strong>Current Stock Level:</strong> {current_stock_level}</p>
<p><em>Low Stock Threshold:</em> {low_stock_threshold}</p>
<p>Please update your inventory soon to avoid running out of stock: <a href="{product_management_url}">Manage Product</a></p>
<p>The TAIC Team</p>
</body></html>
"""

async def send_low_stock_warning_email(to_email: str, product_details: dict, merchant_name: str):
    subject = LOW_STOCK_MERCHANT_SUBJECT.format(product_name=product_details.get("name", "N/A"))
    variant_info = product_details.get("variant_sku", product_details.get("variant_attributes_summary", "N/A"))
    text_body = LOW_STOCK_MERCHANT_TEXT_BODY.format(
        merchant_name=merchant_name,
        product_name=product_details.get("name", "N/A"),
        variant_sku_or_attributes=variant_info,
        current_stock_level=product_details.get("current_stock_level", 0),
        low_stock_threshold=product_details.get("low_stock_threshold", 5), # Example threshold
        product_management_url=product_details.get("product_management_url", "#")
    )
    html_body = LOW_STOCK_MERCHANT_HTML_BODY.format(
        merchant_name=merchant_name,
        product_name=product_details.get("name", "N/A"),
        variant_sku_or_attributes_html=variant_info, # Assuming simple string for HTML too
        current_stock_level=product_details.get("current_stock_level", 0),
        low_stock_threshold=product_details.get("low_stock_threshold", 5),
        product_management_url=product_details.get("product_management_url", "#")
    )
    return await send_email_async(to_email, subject, html_body, text_body)

# --- New Customer Message (Merchant) ---
NEW_MESSAGE_MERCHANT_SUBJECT = "New Customer Message Received on TAIC"
NEW_MESSAGE_MERCHANT_TEXT_BODY = """
Hello {merchant_name},

You have received a new message from a customer on TAIC.

Message Preview:
"{message_preview}..."

View the full conversation and reply here:
{conversation_link}

Please respond promptly to maintain good customer service.

The TAIC Team
"""
NEW_MESSAGE_MERCHANT_HTML_BODY = """
<!DOCTYPE html><html><head><title>New Customer Message</title></head><body>
<p>Hello {merchant_name},</p>
<p>You have received a new message from a customer on TAIC.</p>
<p><strong>Message Preview:</strong></p>
<blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px;">
  <em>"{message_preview}..."</em>
</blockquote>
<p><a href="{conversation_link}">View Full Conversation & Reply</a></p>
<p>Please respond promptly to maintain good customer service.</p>
<p>The TAIC Team</p>
</body></html>
"""

async def send_new_customer_message_email(to_email: str, message_preview: str, conversation_link: str, merchant_name: str):
    subject = NEW_MESSAGE_MERCHANT_SUBJECT
    text_body = NEW_MESSAGE_MERCHANT_TEXT_BODY.format(
        merchant_name=merchant_name,
        message_preview=message_preview,
        conversation_link=conversation_link
    )
    html_body = NEW_MESSAGE_MERCHANT_HTML_BODY.format(
        merchant_name=merchant_name,
        message_preview=message_preview,
        conversation_link=conversation_link
    )
    return await send_email_async(to_email, subject, html_body, text_body)


# --- Placeholder Templates & Functions ---

# Order Delivered (Shopper)
ORDER_DELIVERED_SHOPPER_SUBJECT = "Your TAIC Order #{order_id} Has Been Delivered!"
ORDER_DELIVERED_SHOPPER_TEXT_BODY = """
Hello {user_name},

Great news! Your TAIC order #{order_id} has been delivered.
We hope you enjoy your purchase! Consider leaving a review for the product(s) and the store.

View your order: {order_url}
Leave a review: {review_link} (Conceptual)

Thanks for shopping with TAIC!
The TAIC Team
"""
ORDER_DELIVERED_SHOPPER_HTML_BODY = """
<!DOCTYPE html><html><head><title>Order Delivered!</title></head><body>
<p>Hello {user_name},</p>
<p>Great news! Your TAIC order <strong>#{order_id}</strong> has been delivered.</p>
<p>We hope you enjoy your purchase! Consider leaving a review for the products and the store.</p>
<p><a href="{order_url}">View Your Order</a> | <a href="{review_link}">Leave a Review</a></p>
<p>Thanks for shopping with TAIC!<br>The TAIC Team</p>
</body></html>
"""
async def send_order_delivered_email(to_email: str, order_details: dict, user_name: str):
    order_id = order_details.get("id", "N/A")
    subject = ORDER_DELIVERED_SHOPPER_SUBJECT.format(order_id=order_id)
    order_url = order_details.get("order_url", f"{FRONTEND_BASE_URL}/shopper/orders/{order_id}")
    review_link = f"{FRONTEND_BASE_URL}/shopper/orders/{order_id}/review" # Conceptual

    text_body = ORDER_DELIVERED_SHOPPER_TEXT_BODY.format(user_name=user_name, order_id=order_id, order_url=order_url, review_link=review_link)
    html_body = ORDER_DELIVERED_SHOPPER_HTML_BODY.format(user_name=user_name, order_id=order_id, order_url=order_url, review_link=review_link)
    return await send_email_async(to_email, subject, html_body, text_body)

# Refund Processed (Shopper)
REFUND_PROCESSED_SHOPPER_SUBJECT = "Refund Processed for TAIC Order #{order_id}"
REFUND_PROCESSED_SHOPPER_TEXT_BODY = """
Hello {user_name},

A refund for your TAIC order #{order_id} has been processed.
Refund Amount: {currency_symbol}{refund_amount}

Please allow a few business days for this to reflect in your account.
If you have any questions, please contact support or view your order: {order_url}

The TAIC Team
"""
REFUND_PROCESSED_SHOPPER_HTML_BODY = """
<!DOCTYPE html><html><head><title>Refund Processed</title></head><body>
<p>Hello {user_name},</p>
<p>A refund for your TAIC order <strong>#{order_id}</strong> has been processed.</p>
<p><strong>Refund Amount:</strong> {currency_symbol}{refund_amount}</p>
<p>Please allow a few business days for this to reflect in your account.</p>
<p>If you have any questions, please contact support or <a href="{order_url}">view your order</a>.</p>
<p>The TAIC Team</p>
</body></html>
"""
async def send_refund_processed_email(to_email: str, order_details: dict, refund_amount: str, user_name: str):
    order_id = order_details.get("id", "N/A")
    currency_symbol = order_details.get("currency_symbol", "$")
    subject = REFUND_PROCESSED_SHOPPER_SUBJECT.format(order_id=order_id)
    order_url = order_details.get("order_url", f"{FRONTEND_BASE_URL}/shopper/orders/{order_id}")

    text_body = REFUND_PROCESSED_SHOPPER_TEXT_BODY.format(user_name=user_name, order_id=order_id, refund_amount=refund_amount, currency_symbol=currency_symbol, order_url=order_url)
    html_body = REFUND_PROCESSED_SHOPPER_HTML_BODY.format(user_name=user_name, order_id=order_id, refund_amount=refund_amount, currency_symbol=currency_symbol, order_url=order_url)
    return await send_email_async(to_email, subject, html_body, text_body)

# Payout Sent (Merchant)
PAYOUT_SENT_MERCHANT_SUBJECT = "Your Payout from TAIC Has Been Sent!"
PAYOUT_SENT_MERCHANT_TEXT_BODY = """
Hello {merchant_name},

Your payout of {currency_symbol}{payout_amount} has been processed and sent to your designated account/wallet.

You can view your payout history here: {payout_details_link}

Thank you for being a valued TAIC merchant!
The TAIC Team
"""
PAYOUT_SENT_MERCHANT_HTML_BODY = """
<!DOCTYPE html><html><head><title>Payout Sent!</title></head><body>
<p>Hello {merchant_name},</p>
<p>Your payout of <strong>{currency_symbol}{payout_amount}</strong> has been processed and sent to your designated account/wallet.</p>
<p>You can view your payout history <a href='{payout_details_link}'>here</a>.</p>
<p>Thank you for being a valued TAIC merchant!<br>The TAIC Team</p>
</body></html>
"""
async def send_payout_sent_email(to_email: str, payout_details: dict, merchant_name: str):
    currency_symbol = payout_details.get("currency_symbol", "$")
    payout_amount = payout_details.get("amount", "0.00")
    payout_details_link = f"{FRONTEND_BASE_URL}/merchant/payouts" # Example link

    subject = PAYOUT_SENT_MERCHANT_SUBJECT
    text_body = PAYOUT_SENT_MERCHANT_TEXT_BODY.format(merchant_name=merchant_name, payout_amount=payout_amount, currency_symbol=currency_symbol, payout_details_link=payout_details_link)
    html_body = PAYOUT_SENT_MERCHANT_HTML_BODY.format(merchant_name=merchant_name, payout_amount=payout_amount, currency_symbol=currency_symbol, payout_details_link=payout_details_link)
    return await send_email_async(to_email, subject, html_body, text_body)


# Example usage (for testing this module directly)
if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)

    async def test_emails():
        print("Testing Shopper Welcome Email...")
        shopper_success = await send_shopper_welcome_email("shopper@example.com", "Test Shopper")
        print(f"Shopper email sent (simulated): {shopper_success}\n")

        print("Testing Merchant Welcome Email...")
        merchant_success = await send_merchant_welcome_email("merchant@example.com", "Test Merchant Store")
        print(f"Merchant email sent (simulated): {merchant_success}\n")

        # Test new emails
        sample_order = {
            "id": "12345XYZ",
            "total_amount": "49.99",
            "currency_symbol": "$",
            "shipping_address": {"line1": "123 Main St", "city": "Anytown", "state": "CA", "postal_code": "90210", "country": "US"},
            "order_url": "http://localhost:3000/orders/12345XYZ",
            "order_items_summary": "- Product A (SKU: PA001) Qty: 1\n- Product B (SKU: PB002) Qty: 2",
            "customer_info": {"name": "Test Shopper", "user_id": "shopper_user_id"},
            "merchant_order_url": "http://localhost:3000/merchant/orders/12345XYZ"
        }
        sample_tracking = {
            "shipped_items_summary": "- Product A (SKU: PA001) Qty: 1",
            "carrier_name": "TAIC Shipping Co.",
            "tracking_number": "TS123456789",
            "tracking_url": "http://localhost:3000/track/TS123456789",
            "estimated_delivery_date": "October 30, 2023"
        }
        sample_product = {
            "name": "Super Widget X",
            "variant_sku": "SWX-RED-LG",
            "variant_attributes_summary": "Color: Red, Size: Large",
            "current_stock_level": 3,
            "low_stock_threshold": 5,
            "product_management_url": "http://localhost:3000/merchant/products/prod_widget_x"
        }

        print("Testing Order Confirmation Email...")
        await send_order_confirmation_email("shopper_confirm@example.com", sample_order, "Test Confirm Shopper")

        print("\nTesting Order Shipped Email...")
        await send_order_shipped_email("shopper_shipped@example.com", sample_order, sample_tracking, "Test Shipped Shopper")

        print("\nTesting New Order to Merchant Email...")
        await send_new_order_to_merchant_email("merchant_neworder@example.com", sample_order, "Test Merchant Store Inc.")

        print("\nTesting Low Stock Warning Email...")
        await send_low_stock_warning_email("merchant_lowstock@example.com", sample_product, "Test Merchant Store Inc.")

        print("\nTesting New Customer Message Email...")
        await send_new_customer_message_email(
            "merchant_newmessage@example.com",
            "I was wondering if you offer gift wrapping for the Super Widget X?",
            "http://localhost:3000/merchant/messages/convo_abc123",
            "Test Merchant Store Inc."
        )

    asyncio.run(test_emails())
