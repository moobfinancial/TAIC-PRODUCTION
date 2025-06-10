from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import asyncpg

from app.security import verify_token # Assuming verify_token is in security.py
from app.db import get_db_connection, release_db_connection # Assuming these are your DB utils
from app.models.auth_models import UserResponse # For type hinting user data, if needed

# OAuth2PasswordBearer is pointed to the token URL (login endpoint)
# This tells FastAPI how the client should get the token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # Adjust tokenUrl if your login path is different

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

    if db_user is None:
        raise credentials_exception # User ID from token not found in DB

    if not db_user['is_active']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    return str(db_user['id']) # Return user ID as string

# Example of a dependency that returns the full user model (optional)
# async def get_current_active_user(token: str = Depends(oauth2_scheme), conn: asyncpg.Connection = Depends(get_db_connection)) -> UserResponse:
#     user_id = await get_current_active_user_id(token=token, conn=conn) # Reuse the ID getter
#     # Fetch full user details for UserResponse model
#     # This assumes UserResponse fields match your users table structure or you map them appropriately
#     user_data_row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
#     if not user_data_row: # Should not happen if get_current_active_user_id passed
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found after ID verification.")
#     return UserResponse(**dict(user_data_row))
