import pytest
import uuid
from datetime import timedelta
import secrets
from typing import Dict, Any, Optional, List

import asyncpg
from httpx import AsyncClient
from fastapi import status

from app.models.auth_models import (
    UserRegisterSchema, UserResponse,
    UserLoginSchema, TokenResponse,
    WalletLoginSchema, LinkWalletSchema, LinkEmailPasswordSchema
)
from app.security import create_access_token, hash_password, ACCESS_TOKEN_EXPIRE_MINUTES # For creating tokens for protected routes if needed
# We might need to import hash_password or other utils if we prepare data directly

# Assuming conftest.py provides 'client' (AsyncClient) and 'db_conn' (asyncpg.Connection) fixtures

@pytest.mark.asyncio
async def test_register_new_shopper_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test successful registration of a new SHOPPER."""
    user_email = f"test_shopper_{uuid.uuid4()}@example.com"
    user_username = f"test_shopper_user_{uuid.uuid4()}"
    user_data = {
        "username": user_username,
        "email": user_email,
        "password": "ValidPassword123!",
        "full_name": "Test Shopper User",
        "role": "SHOPPER"
        # business_name and business_description are not applicable for SHOPPER
    }

    response = await client.post("/api/auth/register", json=user_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["username"] == user_username
    assert response_data["email"] == user_email
    assert response_data["full_name"] == "Test Shopper User"
    assert response_data["role"] == "SHOPPER"
    assert response_data["is_active"] is True
    assert response_data["email_verified"] is False # Default for new registration
    assert "id" in response_data
    user_id = response_data["id"]
    # For SHOPPER, business_name and business_description should be None or not present
    assert response_data.get("business_name") is None
    assert response_data.get("business_description") is None


    # Verify user in DB (optional, but good for confirmation)
    db_user = await verbose_db_conn.fetchrow("SELECT id, email, role, username, business_name, business_description FROM users WHERE email = $1", user_email)
    assert db_user is not None
    assert str(db_user["id"]) == user_id
    assert db_user["username"] == user_username
    assert db_user["role"] == "SHOPPER"
    assert db_user["business_name"] is None
    assert db_user["business_description"] is None

    # Cleanup: Delete the created user
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_register_user_email_already_exists(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test registration attempt with an email that already exists."""
    existing_user_email = f"existing_user_{uuid.uuid4()}@example.com"
    existing_user_username = f"existing_username_{uuid.uuid4()}"
    existing_user_id = str(uuid.uuid4())
    # Create a user directly in DB for this test scenario
    await verbose_db_conn.execute(
        "INSERT INTO users (id, username, email, hashed_password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
        existing_user_id, existing_user_username, existing_user_email, "hashed_pw_placeholder", "SHOPPER"
    )

    user_data_for_conflict_attempt = {
        "username": f"new_username_conflict_test_{uuid.uuid4()}", # A different username for the attempt
        "email": existing_user_email, # This email already exists
        "password": "AnotherPassword123!",
        "full_name": "Another Test User",
        "role": "SHOPPER"
    }

    response = await client.post("/api/auth/register", json=user_data_for_conflict_attempt)

    assert response.status_code == status.HTTP_409_CONFLICT
    response_data = response.json()
    assert "detail" in response_data
    # The error message might be about email or username if both are sent and conflict.
    # Current endpoint checks email first, then username. So email conflict is expected here.
    assert f"User with email '{existing_user_email}' already exists." in response_data["detail"]
    # If we wanted to test username conflict, we'd use an existing username with a new email.

    # Cleanup: Delete the manually created user
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", existing_user_id)

@pytest.mark.asyncio
async def test_register_user_username_already_exists(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test registration attempt with a username that already exists."""
    existing_user_username = f"existing_username_{uuid.uuid4()}"
    # Use a unique email for the initially created user to ensure we're testing username conflict, not email.
    initial_user_email = f"initial_email_for_username_test_{uuid.uuid4()}@example.com"
    existing_user_id = str(uuid.uuid4())

    # Create a user directly in DB with the username we want to cause a conflict with
    await verbose_db_conn.execute(
        "INSERT INTO users (id, username, email, hashed_password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
        existing_user_id, existing_user_username, initial_user_email, "hashed_pw_placeholder", "SHOPPER"
    )

    # Prepare data for the registration attempt that should conflict on username
    conflicting_user_data = {
        "username": existing_user_username,  # This username already exists
        "email": f"new_email_for_username_conflict_{uuid.uuid4()}@example.com", # A new, unique email
        "password": "PasswordForConflict123!",
        "full_name": "Conflict Test User",
        "role": "SHOPPER"
    }

    response = await client.post("/api/auth/register", json=conflicting_user_data)

    assert response.status_code == status.HTTP_409_CONFLICT
    response_data = response.json()
    assert "detail" in response_data
    assert f"User with username '{existing_user_username}' already exists." in response_data["detail"]

    # Cleanup: Delete the manually created user
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", existing_user_id)

@pytest.mark.asyncio
async def test_register_new_merchant_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test successful registration of a new MERCHANT."""
    user_email = f"test_merchant_{uuid.uuid4()}@example.com"
    user_username = f"test_merchant_user_{uuid.uuid4()}"
    business_name_val = f"Test Biz {uuid.uuid4()}"
    business_desc_val = "A great test business."

    user_data = {
        "username": user_username,
        "email": user_email,
        "password": "ValidPassword123!",
        "full_name": "Test Merchant Inc.", # Can be same as business_name or different
        "role": "MERCHANT",
        "business_name": business_name_val, # Required for MERCHANT
        "business_description": business_desc_val # Optional
    }

    response = await client.post("/api/auth/register", json=user_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["username"] == user_username
    assert response_data["email"] == user_email
    assert response_data["full_name"] == "Test Merchant Inc."
    assert response_data["role"] == "MERCHANT"
    assert response_data["business_name"] == business_name_val
    assert response_data["business_description"] == business_desc_val
    assert response_data["is_active"] is True
    assert "id" in response_data
    user_id = response_data["id"]

    # Verify user in DB
    db_user = await verbose_db_conn.fetchrow("SELECT id, email, role, username, business_name, business_description FROM users WHERE email = $1", user_email)
    assert db_user is not None
    assert str(db_user["id"]) == user_id
    assert db_user["username"] == user_username
    assert db_user["role"] == "MERCHANT"
    assert db_user["business_name"] == business_name_val
    assert db_user["business_description"] == business_desc_val

    # Cleanup: Delete the created user
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_payload, expected_detail_contains",
    [
        # Original test cases
        ({"email": "not-an-email", "password": "Pass123!", "role": "SHOPPER"}, "value is not a valid email address"),
        ({"password": "Pass123!", "role": "SHOPPER"}, "Field required" ), # Missing email
        ({"email": f"missing_pass_{uuid.uuid4()}@example.com", "role": "SHOPPER"}, "Field required"), # Missing password
        ({"email": f"missing_role_{uuid.uuid4()}@example.com", "password": "Pass123!"}, "Field required"), # Missing role
        ({"email": f"invalid_role_{uuid.uuid4()}@example.com", "password": "Pass123!", "role": "INVALID_ROLE"}, "Invalid role. Must be one of: SHOPPER, MERCHANT"),
        
        # New test cases for username and business_name
        ({"email": f"missing_username_{uuid.uuid4()}@example.com", "password": "Pass123!", "role": "SHOPPER"}, "Field required"), # Missing username
        
        # Test case for MERCHANT without required business_name
        ({"username": f"merchant_no_bizname_{uuid.uuid4()}", "email": f"merchant_missing_bizname_{uuid.uuid4()}@example.com", 
          "password": "Pass123!", "role": "MERCHANT"}, "business_name is required for MERCHANT role"),
        
        # Test for username too long (over 50 characters as per schema)
        ({"username": "a" * 51, "email": f"username_too_long_{uuid.uuid4()}@example.com", 
          "password": "Pass123!", "role": "SHOPPER"}, "ensure this value has at most 50 characters"),
    ]
)
async def test_register_user_invalid_input(client: AsyncClient, invalid_payload: Dict[str, Any], expected_detail_contains: str):
    """Test registration with various invalid input data."""
    response = await client.post("/api/auth/register", json=invalid_payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    response_data = response.json()
    assert "detail" in response_data
    # For Pydantic v2, detail is a list of error objects.
    # We'll check if any error message contains the expected substring.
    assert any(expected_detail_contains.lower() in error_item.get("msg", "").lower() for error_item in response_data["detail"])

# --- Tests for /login endpoint ---

@pytest.mark.asyncio
async def test_login_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test successful login for an active user with correct credentials."""
    user_email = f"login_success_{uuid.uuid4()}@example.com"
    user_username = f"login_success_user_{uuid.uuid4()}"
    password = "StrongPassword123!"
    hashed_pw = hash_password(password)
    user_id = str(uuid.uuid4())
    full_name = "Login Test User"

    # Create user directly in DB with username field
    await verbose_db_conn.execute(
        "INSERT INTO users (id, username, email, hashed_password, full_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())",
        user_id, user_username, user_email, hashed_pw, full_name, "SHOPPER"
    )

    login_data = {"email": user_email, "password": password}
    response = await client.post("/api/auth/login", json=login_data)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert "access_token" in response_data
    assert response_data["token_type"] == "bearer"
    
    # Verify the embedded user object (new TokenResponse structure)
    assert "user" in response_data
    user_response = response_data["user"]
    assert user_response["id"] == user_id
    assert user_response["email"] == user_email
    assert user_response["username"] == user_username
    assert user_response["full_name"] == full_name
    assert user_response["role"] == "SHOPPER"
    assert user_response["business_name"] is None  # SHOPPER has no business_name
    assert user_response["business_description"] is None  # SHOPPER has no business_description
    assert user_response["is_active"] is True

    # Verify last_login_at was updated (optional, but good practice)
    db_user = await verbose_db_conn.fetchrow("SELECT last_login_at FROM users WHERE id = $1", user_id)
    assert db_user is not None
    assert db_user["last_login_at"] is not None

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_login_incorrect_password(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test login attempt with incorrect password."""
    user_email = f"login_fail_pass_{uuid.uuid4()}@example.com"
    password = "CorrectPassword123!"
    hashed_pw = hash_password(password)
    user_id = str(uuid.uuid4())

    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user_id, user_email, hashed_pw, "SHOPPER"
    )

    login_data = {"email": user_email, "password": "WrongPassword!"}
    response = await client.post("/api/auth/login", json=login_data)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    response_data = response.json()
    assert "detail" in response_data
    assert response_data["detail"] == "Incorrect email or password."

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_login_non_existent_email(client: AsyncClient):
    """Test login attempt with an email that does not exist."""
    non_existent_email = f"non_existent_{uuid.uuid4()}@example.com"
    login_data = {"email": non_existent_email, "password": "anyPassword123"}

    response = await client.post("/api/auth/login", json=login_data)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED # As per current auth.py logic
    response_data = response.json()
    assert "detail" in response_data
    assert response_data["detail"] == "Incorrect email or password."

@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test login attempt for an inactive user account."""
    user_email = f"inactive_user_{uuid.uuid4()}@example.com"
    password = "PasswordForInactive123!"
    hashed_pw = hash_password(password)
    user_id = str(uuid.uuid4())

    # Create user as inactive
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())",
        user_id, user_email, hashed_pw, "SHOPPER"
    )

    login_data = {"email": user_email, "password": password}
    response = await client.post("/api/auth/login", json=login_data)

    assert response.status_code == status.HTTP_403_FORBIDDEN # User is inactive
    response_data = response.json()
    assert "detail" in response_data
    assert response_data["detail"] == "Account is inactive. Please contact support."

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)


# --- Tests for /login-wallet endpoint ---

@pytest.mark.asyncio
async def test_login_with_existing_wallet_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test successful login with an existing, verified wallet."""
    wallet_address = f"0x{secrets.token_hex(20)}".lower() # Example wallet address, normalized
    user_id = str(uuid.uuid4())
    user_username = f"wallet_user_{uuid.uuid4()}"
    full_name = "Wallet Test User"
    original_message = "Sign this message to login"
    signed_message = "0x" + "a" * 130

    # Create user with this wallet including the username field
    await verbose_db_conn.execute(
        "INSERT INTO users (id, username, wallet_address, wallet_verified, full_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, TRUE, $4, $5, TRUE, NOW(), NOW())",
        user_id, user_username, wallet_address, full_name, "SHOPPER"
    )

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True)

    login_data = {
        "wallet_address": wallet_address,
        "original_message": original_message,
        "signed_message": signed_message
    }
    response = await client.post("/api/auth/login-wallet", json=login_data)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert "access_token" in response_data
    assert response_data["token_type"] == "bearer"
    
    # Verify the embedded user object (new TokenResponse structure)
    assert "user" in response_data
    user_response = response_data["user"]
    assert user_response["id"] == user_id
    assert user_response["username"] == user_username
    assert user_response["full_name"] == full_name
    assert user_response["role"] == "SHOPPER"
    assert user_response["wallet_address"] == wallet_address
    assert user_response["wallet_verified"] is True
    assert user_response["business_name"] is None  # SHOPPER has no business_name
    assert user_response["business_description"] is None  # SHOPPER has no business_description
    assert user_response["is_active"] is True

    # Verify last_login_at was updated
    db_user = await verbose_db_conn.fetchrow("SELECT last_login_at FROM users WHERE id = $1", user_id)
    assert db_user is not None
    assert db_user["last_login_at"] is not None

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_register_and_login_with_new_wallet_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test successful registration and login with a new wallet."""
    wallet_address = f"0x{secrets.token_hex(20)}".lower()
    original_message = "Sign this message to register and login"
    signed_message = "0x" + "e" * 130

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True)

    login_data = {
        "wallet_address": wallet_address,
        "original_message": original_message,
        "signed_message": signed_message
    }
    response = await client.post("/api/auth/login-wallet", json=login_data)

    assert response.status_code == status.HTTP_200_OK # Or 201 if registration part is emphasized, but 200 for login is fine
    response_data = response.json()
    assert "access_token" in response_data
    
    # Verify the embedded user object (new TokenResponse structure)
    assert "user" in response_data
    user_response = response_data["user"]
    assert "id" in user_response  # We don't know the ID beforehand
    assert user_response["wallet_address"] == wallet_address
    assert user_response["wallet_verified"] is True
    assert user_response["role"] == "SHOPPER"
    assert user_response["is_active"] is True
    assert user_response["business_name"] is None  # SHOPPER has no business_name
    assert user_response["business_description"] is None  # SHOPPER has no business_description
    
    # Most importantly, check that a username was auto-generated
    assert user_response["username"] is not None
    assert len(user_response["username"]) > 0
    
    # Get the user ID for cleanup
    user_id = user_response["id"]

    # Verify new user was created in DB with all required fields
    db_user = await verbose_db_conn.fetchrow("SELECT id, username, role, wallet_verified, is_active, business_name, business_description FROM users WHERE wallet_address = $1", wallet_address)
    assert db_user is not None
    assert db_user["username"] is not None  # Auto-generated username should exist
    assert db_user["role"] == "SHOPPER" # Default role on new wallet registration
    assert db_user["wallet_verified"] is True
    assert db_user["is_active"] is True
    assert db_user["business_name"] is None
    assert db_user["business_description"] is None
    
    # Verify username in response matches DB
    assert user_response["username"] == db_user["username"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_login_wallet_invalid_signature(client: AsyncClient, mocker):
    """Test login/registration attempt with an invalid wallet signature."""
    wallet_address = f"0x{secrets.token_hex(20)}".lower()
    original_message = "Some message"
    signed_message = "0x" + "b" * 130  # Was mock_invalid_signature

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=False)

    login_data = {
        "wallet_address": wallet_address,
        "original_message": original_message,
        "signed_message": signed_message
    }
    response = await client.post("/api/auth/login-wallet", json=login_data)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    response_data = response.json()
    assert "detail" in response_data
    assert response_data["detail"] == "Invalid signature or wallet address."

@pytest.mark.asyncio
async def test_login_wallet_inactive_user(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test login attempt with an existing wallet but for an inactive user."""
    wallet_address = f"0x{secrets.token_hex(20)}".lower()
    user_id = str(uuid.uuid4())
    original_message = "Sign this message"
    signed_message = "0x" + "c" * 130  # Was mock_signature_for_inactive

    # Create inactive user with this wallet
    await verbose_db_conn.execute(
        "INSERT INTO users (id, wallet_address, wallet_verified, role, is_active, created_at, updated_at) VALUES ($1, $2, TRUE, $3, FALSE, NOW(), NOW())",
        user_id, wallet_address, "SHOPPER"
    )

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True) # Signature is valid

    login_data = {
        "wallet_address": wallet_address,
        "original_message": original_message,
        "signed_message": signed_message
    }
    response = await client.post("/api/auth/login-wallet", json=login_data)

    assert response.status_code == status.HTTP_403_FORBIDDEN # As per auth.py logic for inactive wallet user
    response_data = response.json()
    assert "detail" in response_data
    assert "Account is inactive." in response_data["detail"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)


# --- Tests for /link-email-password (Protected Endpoint) ---

@pytest.mark.asyncio
async def test_link_email_password_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test successfully linking an email/password to an authenticated account (e.g., wallet-first user)."""
    user_id = str(uuid.uuid4())
    wallet_address = f"0x{secrets.token_hex(20)}".lower()
    new_email = f"linkable_email_{uuid.uuid4()}@example.com"
    new_password = "LinkMeUp123!"

    # Create a user (e.g., wallet-first, no email/password yet)
    await verbose_db_conn.execute(
        "INSERT INTO users (id, wallet_address, wallet_verified, role, is_active, created_at, updated_at) VALUES ($1, $2, TRUE, $3, TRUE, NOW(), NOW())",
        user_id, wallet_address, "SHOPPER"
    )

    # Generate token for this user
    access_token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    link_data = {
        "email": new_email,
        "password": new_password,
        "full_name": "Linked Full Name"
    }
    response = await client.post("/api/auth/link-email-password", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["email"] == new_email
    assert response_data["full_name"] == "Linked Full Name"
    assert response_data["id"] == user_id
    assert response_data["email_verified"] is False # Should be false until verified

    # Verify in DB
    db_user = await verbose_db_conn.fetchrow("SELECT email, hashed_password, full_name, email_verified FROM users WHERE id = $1", user_id)
    assert db_user["email"] == new_email
    assert db_user["hashed_password"] is not None # Password should be hashed and stored
    assert db_user["full_name"] == "Linked Full Name"
    assert db_user["email_verified"] is False

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_link_email_password_account_already_has_email(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test attempt to link email/password when the authenticated account already has an email."""
    user_id = str(uuid.uuid4())
    existing_email = f"current_email_{uuid.uuid4()}@example.com"

    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user_id, existing_email, hash_password("OldPass123"), "SHOPPER"
    )

    access_token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    link_data = {"email": f"new_try_{uuid.uuid4()}@example.com", "password": "NewPass123!"}
    response = await client.post("/api/auth/link-email-password", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "An email is already linked to this account" in response.json()["detail"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_link_email_password_new_email_already_used_by_other(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    """Test attempt to link an email that is already used by another user."""
    # User 1: The one trying to link (e.g., wallet-first)
    user1_id = str(uuid.uuid4())
    await verbose_db_conn.execute(
        "INSERT INTO users (id, wallet_address, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, TRUE, NOW(), NOW())",
        user1_id, f"0x{secrets.token_hex(20)}".lower(), "SHOPPER"
    )
    user1_token = create_access_token(data={"sub": user1_id})
    user1_headers = {"Authorization": f"Bearer {user1_token}"}

    # User 2: Already has the email that User 1 wants to link
    user2_id = str(uuid.uuid4())
    email_in_use = f"taken_email_{uuid.uuid4()}@example.com"
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user2_id, email_in_use, hash_password("User2Pass"), "MERCHANT"
    )

    link_data = {"email": email_in_use, "password": "User1NewPass"}
    response = await client.post("/api/auth/link-email-password", json=link_data, headers=user1_headers)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert "This email address is already registered by another user" in response.json()["detail"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1 OR id = $2", user1_id, user2_id)

@pytest.mark.asyncio
async def test_link_email_password_unauthenticated(client: AsyncClient):
    """Test attempt to link email/password without authentication token."""
    link_data = {"email": f"no_auth_{uuid.uuid4()}@example.com", "password": "NoAuthPass"}
    response = await client.post("/api/auth/link-email-password", json=link_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED # Depends on oauth2_scheme auto_error=True

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_payload, expected_detail_part",
    [
        ({"email": "not-a-valid-email", "password": "ValidPass123!"}, "value is not a valid email address"),
        ({"password": "ValidPass123!"}, "Field required"), # Missing email
        ({"email": f"good_email_{uuid.uuid4()}@example.com"}, "Field required"), # Missing password
    ]
)
async def test_link_email_password_invalid_input(client: AsyncClient, verbose_db_conn: asyncpg.Connection, invalid_payload: Dict[str, Any], expected_detail_part: str):
    """Test linking email/password with invalid input data (authenticated)."""
    user_id = str(uuid.uuid4())
    await verbose_db_conn.execute(
        "INSERT INTO users (id, role, is_active, created_at, updated_at) VALUES ($1, $2, TRUE, NOW(), NOW())",
        user_id, "SHOPPER"
    )
    token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post("/api/auth/link-email-password", json=invalid_payload, headers=headers)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    response_data = response.json()
    assert any(expected_detail_part.lower() in error_item.get("msg", "").lower() for error_item in response_data["detail"])

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)


# --- Tests for /link-wallet (Protected Endpoint) ---

@pytest.mark.asyncio
async def test_link_wallet_successful(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test successfully linking a wallet to an authenticated (e.g., email-first) account."""
    user_id = str(uuid.uuid4())
    user_email = f"link_wallet_user_{uuid.uuid4()}@example.com"
    new_wallet_address = f"0x{secrets.token_hex(20)}".lower()
    original_message = "Sign to link this wallet"
    signed_message = "0x" + "d" * 130  # Was mock_signature_for_link

    # Create user (e.g., email-first, no wallet yet)
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user_id, user_email, hash_password("Password123"), "SHOPPER"
    )

    access_token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True)

    link_data = {
        "wallet_address": new_wallet_address,
        "original_message": original_message,
        "signed_message": signed_message
    }
    response = await client.post("/api/auth/link-wallet", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["wallet_address"].lower() == new_wallet_address
    assert response_data["wallet_verified"] is True
    assert response_data["id"] == user_id

    # Verify in DB
    db_user = await verbose_db_conn.fetchrow("SELECT wallet_address, wallet_verified FROM users WHERE id = $1", user_id)
    assert db_user["wallet_address"].lower() == new_wallet_address
    assert db_user["wallet_verified"] is True

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_link_wallet_account_already_has_different_wallet(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test attempt to link a new wallet when account already has a different one."""
    user_id = str(uuid.uuid4())
    user_email = f"user_with_wallet_{uuid.uuid4()}@example.com"
    existing_wallet = f"0x{secrets.token_hex(20)}".lower()

    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, wallet_address, wallet_verified, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, $5, TRUE, NOW(), NOW())",
        user_id, user_email, hash_password("Password123"), existing_wallet, "SHOPPER"
    )
    access_token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    mocker.patch("fastapi_ai_backend.app.security.verify_wallet_signature", return_value=True) # Signature assumed valid to test linking logic

    new_wallet_to_link = f"0x{secrets.token_hex(20)}".lower()
    link_data = {
        "wallet_address": new_wallet_to_link,
        "original_message": "msg",
        "signed_message": "0x" + "c" * 130  # Was sig
    }
    response = await client.post("/api/auth/link-wallet", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Your account already has a different wallet linked." in response.json()["detail"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_link_wallet_new_wallet_already_used_by_other(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test attempt to link a wallet already used by another user."""
    # User 1: Trying to link the wallet
    user1_id = str(uuid.uuid4())
    user1_email = f"user1_linking_{uuid.uuid4()}@example.com"
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user1_id, user1_email, hash_password("User1Pass"), "SHOPPER"
    )
    user1_token = create_access_token(data={"sub": user1_id})
    user1_headers = {"Authorization": f"Bearer {user1_token}"}

    # User 2: Already has the wallet
    user2_id = str(uuid.uuid4())
    wallet_in_use = f"0x{secrets.token_hex(20)}".lower()
    await verbose_db_conn.execute(
        "INSERT INTO users (id, wallet_address, wallet_verified, role, is_active, created_at, updated_at) VALUES ($1, $2, TRUE, $3, TRUE, NOW(), NOW())",
        user2_id, wallet_in_use, "MERCHANT"
    )

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True) # Signature is valid

    link_data = {
        "wallet_address": wallet_in_use,
        "original_message": "msg",
        "signed_message": "0x" + "c" * 130  # Was sig
    }
    response = await client.post("/api/auth/link-wallet", json=link_data, headers=user1_headers)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert "This wallet address is already linked to another account." in response.json()["detail"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1 OR id = $2", user1_id, user2_id)

@pytest.mark.asyncio
async def test_link_wallet_invalid_signature(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test linking wallet with an invalid signature."""
    user_id = str(uuid.uuid4())
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user_id, f"user_bad_sig_{uuid.uuid4()}@example.com", hash_password("Pass"), "SHOPPER"
    )
    token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {token}"}

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=False) # Invalid signature

    link_data = {
        "wallet_address": f"0x{secrets.token_hex(20)}".lower(),
        "original_message": "msg",
        "signed_message": "0x" + "b" * 130
    }
    response = await client.post("/api/auth/link-wallet", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_400_BAD_REQUEST # As per auth.py logic
    assert "Invalid wallet signature or wallet address provided for linking." in response.json()["detail"]

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_link_wallet_unauthenticated(client: AsyncClient):
    """Test attempt to link wallet without authentication token."""
    link_data = {
        "wallet_address": f"0x{secrets.token_hex(20)}".lower(),
        "original_message": "msg",
        "signed_message": "0x" + "c" * 130  # Was sig
    }
    response = await client.post("/api/auth/link-wallet", json=link_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.asyncio
async def test_link_wallet_same_wallet_already_linked_and_verified(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test linking the same wallet that is already linked and verified (should be idempotent)."""
    user_id = str(uuid.uuid4())
    wallet_address = f"0x{secrets.token_hex(20)}".lower()
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, wallet_address, wallet_verified, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, $5, TRUE, NOW(), NOW())",
        user_id, f"idempotent_user_{uuid.uuid4()}@example.com", hash_password("Pass"), wallet_address, "SHOPPER"
    )
    token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {token}"}

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True)

    link_data = {
        "wallet_address": wallet_address, # Same wallet
        "original_message": "msg",
        "signed_message": "0x" + "c" * 130  # Was sig
    }
    response = await client.post("/api/auth/link-wallet", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["wallet_address"].lower() == wallet_address
    assert response_data["wallet_verified"] is True # Still true

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_link_wallet_same_wallet_linked_not_verified(client: AsyncClient, verbose_db_conn: asyncpg.Connection, mocker):
    """Test linking the same wallet that is linked but not verified (should verify it)."""
    user_id = str(uuid.uuid4())
    wallet_address = f"0x{secrets.token_hex(20)}".lower()
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, wallet_address, wallet_verified, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, FALSE, $5, TRUE, NOW(), NOW())", # wallet_verified is FALSE
        user_id, f"verify_now_user_{uuid.uuid4()}@example.com", hash_password("Pass"), wallet_address, "SHOPPER"
    )
    token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {token}"}

    mocker.patch("fastapi_ai_backend.app.routers.auth.verify_wallet_signature", return_value=True)

    link_data = {
        "wallet_address": wallet_address, # Same wallet
        "original_message": "msg",
        "signed_message": "0x" + "c" * 130  # Was sig
    }
    response = await client.post("/api/auth/link-wallet", json=link_data, headers=headers)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["wallet_address"].lower() == wallet_address
    assert response_data["wallet_verified"] is True # Should now be true

    db_user = await verbose_db_conn.fetchrow("SELECT wallet_verified FROM users WHERE id = $1", user_id)
    assert db_user["wallet_verified"] is True

    # Cleanup
    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)


# --- Tests for /api/users/me (Protected Endpoint) ---

@pytest.mark.asyncio
async def test_read_users_me_success(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    user_id = str(uuid.uuid4())
    email = f"me_user_{uuid.uuid4()}@example.com"
    full_name = "Me User Full Name"
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())",
        user_id, email, hash_password("ValidPass123!"), full_name, "SHOPPER"
    )
    access_token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    response = await client.get("/api/users/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == email
    assert data["id"] == user_id
    assert data["full_name"] == full_name
    assert data["is_active"] is True
    assert "hashed_password" not in data # Ensure sensitive info isn't returned

    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_read_users_me_invalid_token_format(client: AsyncClient):
    headers = {"Authorization": "Bearer invalidtokenstring"}
    response = await client.get("/api/users/me", headers=headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    # Detail might vary based on FastAPI's exact handling of malformed JWTs before our custom logic
    # assert "Invalid token" in response.json()["detail"] or "Not authenticated" in response.json()["detail"]

@pytest.mark.asyncio
async def test_read_users_me_expired_token(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    user_id = str(uuid.uuid4())
    email = f"expired_token_user_{uuid.uuid4()}@example.com"
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())",
        user_id, email, hash_password("Pass123"), "SHOPPER"
    )
    expired_access_token = create_access_token(
        data={"sub": user_id}, expires_delta=timedelta(minutes=- (ACCESS_TOKEN_EXPIRE_MINUTES + 5))
    )
    headers = {"Authorization": f"Bearer {expired_access_token}"}

    response = await client.get("/api/users/me", headers=headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Could not validate credentials"

    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_read_users_me_no_token(client: AsyncClient):
    response = await client.get("/api/users/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Not authenticated"

@pytest.mark.asyncio
async def test_read_users_me_inactive_user(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    user_id = str(uuid.uuid4())
    email = f"inactive_user_{uuid.uuid4()}@example.com"
    await verbose_db_conn.execute(
        "INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())",
        user_id, email, hash_password("Pass123"), "SHOPPER"
    )
    access_token = create_access_token(data={"sub": user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    response = await client.get("/api/users/me", headers=headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED # Inactive user check in dependency
    assert response.json()["detail"] == "Could not validate credentials"

    await verbose_db_conn.execute("DELETE FROM users WHERE id = $1", user_id)

@pytest.mark.asyncio
async def test_read_users_me_user_not_found_in_db(client: AsyncClient):
    non_existent_user_id = str(uuid.uuid4())
    access_token = create_access_token(data={"sub": non_existent_user_id})
    headers = {"Authorization": f"Bearer {access_token}"}

    response = await client.get("/api/users/me", headers=headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Could not validate credentials" # From get_current_user logic

