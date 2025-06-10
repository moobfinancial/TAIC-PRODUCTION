# Email Integration Points for Welcome Notifications

This document outlines where the email sending utilities defined in `fastapi_ai_backend/app/email_utils.py` should be integrated for sending welcome emails upon user and merchant registration.

## Background

The `email_utils.py` module provides the following key functions:
- `send_shopper_welcome_email(to_email: str, user_name: str, ...)`
- `send_merchant_welcome_email(to_email: str, merchant_name: str, ...)`

These functions simulate sending emails and include pre-defined templates for welcome messages.

## Identifying Registration Endpoints

As of the last review, dedicated user (shopper) and merchant registration REST API endpoints within the `fastapi_ai_backend/app/routers/` directory were not identified. The existing routers are:
- `bulk_operations.py`
- `product_variants.py`
- `products.py`

It is suspected that user and merchant registration might be handled by:
1.  **Next.js API Routes:** Directly within the Next.js frontend's backend, potentially in files like `src/app/api/auth/register/route.ts` for shoppers and `src/app/api/merchant/auth/register/route.ts` for merchants.
2.  **A separate authentication service** not part of this specific FastAPI application.
3.  **Endpoints yet to be implemented** within the FastAPI backend.

## Proposed Integration Strategy (Assuming FastAPI Endpoints)

If and when user and merchant registration endpoints are implemented or identified within the `fastapi_ai_backend` (e.g., in a hypothetical `fastapi_ai_backend/app/routers/auth.py`), the integration should occur as follows:

### 1. Shopper Registration Endpoint (Example: `POST /api/auth/register`)

```python
# Hypothetical content of fastapi_ai_backend/app/routers/auth.py

from fastapi import APIRouter, HTTPException, status, Depends
# ... other necessary imports ...
from app.db import get_db_connection, release_db_connection # Example
from app.models.user import UserCreate, UserResponse # Example Pydantic models
from app.email_utils import send_shopper_welcome_email # Import the email utility
import asyncpg

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_shopper(user_in: UserCreate):
    conn = None
    try:
        conn = await get_db_connection()

        # --- Begin User Creation Logic ---
        # Example: Check for existing user
        existing_user = await conn.fetchrow("SELECT email FROM users WHERE email = $1", user_in.email)
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

        # Example: Hash password (implementation not shown)
        hashed_password = f"hashed_{user_in.password}" # Replace with actual hashing

        # Example: Insert new user into database
        created_user_row = await conn.fetchrow(
            "INSERT INTO users (email, hashed_password, full_name, created_at, updated_at) " # Assuming table structure
            "VALUES ($1, $2, $3, NOW(), NOW()) "
            "RETURNING id, email, full_name, created_at, updated_at", # Adjust returned fields as per UserResponse
            user_in.email, hashed_password, user_in.full_name
        )

        if not created_user_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user.")
        # --- End User Creation Logic ---

        # --- Send Welcome Email ---
        try:
            # Assuming user_in.full_name or similar is available for personalization
            user_name_for_email = user_in.full_name if user_in.full_name else user_in.email
            email_sent = await send_shopper_welcome_email(
                to_email=created_user_row['email'],
                user_name=user_name_for_email
            )
            if not email_sent:
                # Log the email sending failure but don't fail the registration
                print(f"Warning: Failed to send welcome email to {created_user_row['email']}")
        except Exception as email_exc:
            # Log the email sending failure
            print(f"Error sending welcome email to {created_user_row['email']}: {email_exc}")
        # --- End Send Welcome Email ---

        # Adapt UserResponse instantiation as per actual model
        return UserResponse(**dict(created_user_row))

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during shopper registration: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            await release_db_connection(conn)

```

### 2. Merchant Registration Endpoint (Example: `POST /api/merchant/register`)

A similar integration pattern would apply to the merchant registration endpoint. After successfully creating the merchant record in the database:

```python
# ... (inside merchant registration endpoint logic) ...

# --- Send Merchant Welcome Email ---
try:
    # Assuming merchant_in.store_name or similar is available
    merchant_name_for_email = merchant_in.store_name if merchant_in.store_name else created_merchant_row['email']
    email_sent = await send_merchant_welcome_email(
        to_email=created_merchant_row['email'], # Or merchant contact email
        merchant_name=merchant_name_for_email
        # merchant_dashboard_url and merchant_docs_url can be passed if available, otherwise defaults are used
    )
    if not email_sent:
        # Log the email sending failure
        print(f"Warning: Failed to send merchant welcome email to {created_merchant_row['email']}")
except Exception as email_exc:
    # Log the email sending failure
    print(f"Error sending merchant welcome email to {created_merchant_row['email']}: {email_exc}")
# --- End Send Merchant Welcome Email ---

# ... return merchant registration response ...
```

## Alternative Integration (If Registration is in Next.js API Routes)

If user/merchant creation is handled exclusively by Next.js API routes that directly interact with the database:

1.  **Option A: Create a FastAPI Email Service Endpoint:**
    *   Expose a new internal FastAPI endpoint (e.g., `/api/internal/send-notification`).
    *   The Next.js API route, after creating a user/merchant in the DB, would make an HTTP POST request to this FastAPI endpoint.
    *   The FastAPI endpoint would then use `email_utils.py` to send the appropriate email. This keeps email logic centralized in Python.
    *   This endpoint would need to be secured (e.g., internal network access only, or an API key).

2.  **Option B: Replicate Email Logic in TypeScript:**
    *   Re-implement email template formatting and sending logic directly within the Next.js TypeScript API routes.
    *   This might involve using a TypeScript email library (e.g., Nodemailer, SendGrid/Mailgun SDKs).
    *   This approach decentralizes the notification logic.

**Recommendation:**
Option A (FastAPI Email Service Endpoint) is generally preferred if aiming to keep notification logic consolidated within the Python backend, especially if other types of notifications are planned for the future.

## Conclusion

The `email_utils.py` module is ready for use. The primary challenge is locating or implementing the user/merchant registration logic within the FastAPI backend. Once these points are clear, the integration involves importing the relevant sender function and calling it post-successful user/merchant creation, with appropriate error handling for the email sending step.
