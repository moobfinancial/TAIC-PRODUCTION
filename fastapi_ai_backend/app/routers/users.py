from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.db import get_db_connection
from app.schemas import UserPublic
from app.dependencies import get_current_active_user

router = APIRouter()

@router.get("/me", response_model=UserPublic, tags=["Users"])
async def read_users_me(
    current_user: Any = Depends(get_current_active_user)
) -> Any:
    """
    Get current authenticated user.
    """
    # The get_current_active_user dependency already returns the user model instance
    # We just need to ensure it's returned in the UserPublic schema format
    # Pydantic will handle the conversion if the fields match or are configured
    return current_user
