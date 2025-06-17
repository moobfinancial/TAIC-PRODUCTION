from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import asyncpg
import uuid # Added import

from app.security import verify_token # Assuming verify_token is in security.py
from app.db import get_db_connection, release_db_connection # Assuming these are your DB utils
from app.models.auth_models import UserResponse # For type hinting user data, if needed

# OAuth2PasswordBearer is pointed to the token URL (login endpoint)
# This tells FastAPI how the client should get the token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # Adjust tokenUrl if your login path is different
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_active_user_id(token: str = Depends(oauth2_scheme), conn: asyncpg.Connection = Depends(get_db_connection)) -> str:
    """
    Dependency to get the current active user's ID from a JWT token.
    1. Verifies the JWT token.
    2. Extracts user ID (from 'sub' claim).
    3. Fetches user from DB by ID.
    4. Checks if user is active.
    Returns the user ID if all checks pass.
    Raises HTTPException otherwise.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token, credentials_exception) # verify_token already raises credentials_exception on JWTError

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        # This case should ideally be caught by verify_token if 'sub' is mandatory,
        # but as a safeguard or if verify_token is generic.
        raise credentials_exception

    # User ID is present in token, now fetch user from DB to check if active
    db_user = None
    try:
        # Assuming 'users' table and 'id' and 'is_active' columns exist
        db_user = await conn.fetchrow("SELECT id, is_active FROM users WHERE id = $1", user_id)
    except Exception as e: # Catch potential DB errors
        # Log the DB error
        print(f"Error fetching user from DB in get_current_active_user_id: {e}") # Replace with proper logging
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify user status; database query failed."
        )
    # finally: # Connection release is handled by FastAPI's Depends for get_db_connection if properly implemented
    #     if conn: # This conn is passed in, not created here. Release should be handled by the caller of get_db_connection in endpoint.
    #         await release_db_connection(conn) # This is incorrect. Depends handles this.

    if not db_user or not db_user['is_active']:
        raise credentials_exception

    return user_id


async def get_optional_current_user_id(token: Optional[str] = Depends(oauth2_scheme_optional)) -> Optional[str]:
    """
    Dependency to get the current user's ID from an optional JWT token.

    - If no token is provided (e.g., anonymous user), returns None.
    - If a token is provided, it's verified.
    - If the token is valid, the user ID ('sub') is returned.
    - If the token is present but invalid (e.g., expired, bad signature), it raises a 401 Unauthorized error.
    """
    if token is None:
        return None # No token provided, so no user ID

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(token, credentials_exception)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            # This should ideally be caught by verify_token, but as a safeguard.
            raise credentials_exception
        return user_id
    except HTTPException as e:
        # Re-raise the exception from verify_token (e.g., 401 Unauthorized)
        raise e

async def get_current_active_user(token: str = Depends(oauth2_scheme), conn: asyncpg.Connection = Depends(get_db_connection)) -> UserResponse:
    """
    Dependency to get the current active user's full UserResponse object.
    1. Verifies JWT, gets user ID (via get_current_active_user_id which also checks activity).
    2. Fetches full user details from DB.
    3. Returns UserResponse object.
    Raises HTTPException if token is invalid, user not found, or user inactive.
    """
    user_id = await get_current_active_user_id(token=token, conn=conn) # This already handles token validation and active status check
    
    # Fetch full user details for UserResponse model
    query = """
        SELECT id, username, email, full_name, role, business_name, business_description, is_active, email_verified, 
               wallet_address, wallet_verified, created_at, last_login_at
        FROM users
        WHERE id = $1
    """
    db_user_details = await conn.fetchrow(query, user_id)

    if not db_user_details:
        # This should ideally not happen if get_current_active_user_id passed,
        # but as a safeguard against race conditions or unexpected DB states.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User details not found after token validation."
        )

    # Convert UUID to string if necessary for Pydantic model
    user_data = dict(db_user_details)
    if isinstance(user_data.get('id'), uuid.UUID):
        user_data['id'] = str(user_data['id'])

    return UserResponse(**user_data)
