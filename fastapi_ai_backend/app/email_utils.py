import logging

logger = logging.getLogger(__name__)

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
    Simulates sending an email. In a real implementation, this would integrate with an email service.
    """
    logger.info(f"--- SIMULATING EMAIL SEND ---")
    logger.info(f"To: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Body (Text): {body_text[:300]}...") # Log snippet
    logger.info(f"Body (HTML): {body_html[:300]}...") # Log snippet
    logger.info(f"--- END SIMULATING EMAIL SEND ---")

    # In a real scenario, you might return a status from the email service provider
    # For now, assume success.
    return True

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

    asyncio.run(test_emails())
