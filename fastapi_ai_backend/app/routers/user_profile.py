import logging
from typing import Optional, List # Added List
from fastapi import APIRouter, HTTPException, Depends, status, Response # Added Response
import asyncpg
from datetime import datetime, timezone # Added datetime, timezone
import secrets # For nonce generation

from app.models.user_profile_models import (
    UserProfileResponse, UserProfileUpdate,
    UserExportData, UserOrderData, UserStoreReviewData,
    AccountDeletionResponse, LinkWalletRequest, WalletChallengeResponse # Added new models
)
from app.security import hash_password, verify_wallet_signature # Corrected import path
from app.models.store_profile_models import StoreProfile # For merchant profile part of export
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id # For protected endpoints
from app.audit_utils import record_admin_audit_log # For logging deletion

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["User Profile Management"],
    # prefix will be set in main.py, e.g., /api/users
)

async def fetch_user_profile_by_id(user_id: str, conn: asyncpg.Connection) -> Optional[UserProfileResponse]:
    """Helper to fetch full user profile data by ID."""
    user_row = await conn.fetchrow(
        """
        SELECT id, email, full_name, role, wallet_address,
               email_verified, wallet_verified,
               created_at, updated_at, last_login_at
        FROM users WHERE id = $1
        """,
        user_id
    )
    if user_row:
        return UserProfileResponse(**dict(user_row))
    return None


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get My Profile",
    description="""
Retrieves the complete profile information for the currently authenticated user.
- **Protected Endpoint:** Requires authentication.
- Fetches user details such as email, full name, role, wallet information, and timestamps.
    """
)
async def get_current_user_profile(
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        user_profile = await fetch_user_profile_by_id(current_user_id, conn)
        if not user_profile:
            # This should ideally not happen if get_current_active_user_id worked,
            # as it implies the user was deleted mid-request or an inconsistency.
            logger.error(f"User profile not found for active user ID: {current_user_id}. Possible data inconsistency.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current user profile not found. Please try logging in again or contact support if the issue persists."
            )
        return user_profile
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch user profile.")
    # Connection release is handled by FastAPI's dependency injection if get_db_connection is a generator.
    # If not, it should be released in a finally block by the endpoint that acquired it.
    # The current get_db_connection in app.db is not a generator.
    # However, Depends(get_db_connection) should manage the resource if set up correctly in main.py's context.
    # For clarity and safety, if get_db_connection is not a context manager based dependency,
    # manual release in a finally block here would be more explicit for this direct usage pattern.
    # Let's assume for now the dependency injection handles it based on how it's used in other routers.

@router.put(
    "/me",
    response_model=UserProfileResponse,
    summary="Update My Profile",
    description="""
Updates the profile information for the currently authenticated user.
- **Protected Endpoint:** Requires authentication.
- Currently supports updating the `full_name`.
- Other fields in `UserProfileUpdate` model could be made updatable in the future.
- Returns the complete updated user profile.
    """
)
async def update_current_user_profile(
    profile_update_data: UserProfileUpdate,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        update_data = profile_update_data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided. Please provide at least one field to update (e.g., full_name)."
            )

        fields_to_update_in_query = {}
        # Process fields from UserProfileUpdate model
        if profile_update_data.full_name is not None:
            fields_to_update_in_query['full_name'] = profile_update_data.full_name
        
        if profile_update_data.email is not None:
            # Check if email is actually changing to avoid unnecessary verification reset
            current_email_row = await conn.fetchrow("SELECT email FROM users WHERE id = $1", current_user_id)
            if current_email_row and current_email_row['email'] != profile_update_data.email:
                fields_to_update_in_query['email'] = profile_update_data.email
                fields_to_update_in_query['email_verified'] = False # Reset verification status
            elif not current_email_row: # Should not happen if user exists
                 fields_to_update_in_query['email'] = profile_update_data.email
                 fields_to_update_in_query['email_verified'] = False

        if profile_update_data.password is not None:
            # Password should be hashed before storing
            # Assuming a utility function like `hash_password` exists
            try:
                fields_to_update_in_query['hashed_password'] = hash_password(profile_update_data.password)
                # If your system uses a separate salt column and hash_password doesn't include it:
                # fields_to_update_in_query['password_salt'] = generate_salt() # Example
            except Exception as e:
                logger.error(f"Password hashing failed for user {current_user_id}: {e}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing password update.")

        if not fields_to_update_in_query:
             # This check might need adjustment if all fields are optional and none are provided.
             # The initial check `if not update_data:` handles if the raw model_dump is empty.
             # This `if not fields_to_update_in_query:` checks if any *processed* fields are ready for DB.
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid or changed fields provided for update. You can update full_name, email, or password."
            )


        fields_to_update_in_query["updated_at"] = "NOW()" # Always update this

        set_clauses = []
        params = []
        param_idx = 1
        for field, value in fields_to_update_in_query.items():
            if field == "updated_at":
                set_clauses.append("updated_at = NOW()")
            else:
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1

        params.append(current_user_id) # For WHERE id = $N

        update_query_sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ${param_idx}"

        result = await conn.execute(update_query_sql, *params)

        if result == "UPDATE 0": # No rows updated, which means user_id was not found (should be caught by dependency)
            logger.error(f"Failed to update profile for user {current_user_id}, user not found during update operation.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found for update.")

        logger.info(f"Profile updated for user {current_user_id}. Fields: {list(fields_to_update_in_query.keys())}")

        # Fetch and return the updated profile
        updated_profile = await fetch_user_profile_by_id(current_user_id, conn)
        if not updated_profile: # Should not happen if update was successful
             logger.error(f"Failed to fetch updated profile for user {current_user_id} after update.")
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Profile updated, but failed to retrieve updated details.")

        return updated_profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update user profile.")



@router.get(
    "/me/link-wallet-challenge",
    response_model=WalletChallengeResponse,
    summary="Get Challenge for Wallet Linking",
    description="""
Generates a unique nonce that the user's wallet must sign to prove ownership
when linking a new wallet address.
- **Protected Endpoint:** Requires authentication.
- **Note on Nonce Security:** For production, this nonce should be stored server-side
  (e.g., in a cache like Redis with a short TTL, associated with the user_id) and
  verified during the link-wallet step to prevent misuse or replay attacks.
  The current implementation returns it directly for simplicity, relying on the client to pass it back.
    """
)
async def get_wallet_link_challenge(
    current_user_id: str = Depends(get_current_active_user_id) # Ensures user is authenticated
):
    try:
        nonce = secrets.token_hex(16) # Generate a 32-character hex nonce
        # In a production system, you would store this nonce associated with current_user_id
        # e.g., await cache.set(f"link_wallet_nonce:{current_user_id}:{nonce}", "valid", expire=300) # 5 min expiry, store nonce itself or a flag
        logger.info(f"Generated link wallet challenge nonce for user {current_user_id}.")
        return WalletChallengeResponse(nonce=nonce)
    except Exception as e:
        logger.error(f"Error generating wallet link challenge for user {current_user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate wallet link challenge.")


@router.post(
    "/me/link-wallet",
    response_model=UserProfileResponse,
    summary="Link Wallet to Account",
    description="""
Links a new wallet address to the currently authenticated user's account after
verifying ownership via a signed nonce.
- **Protected Endpoint:** Requires authentication.
- The user must first obtain a nonce from the `/me/link-wallet-challenge` endpoint,
  sign it with the private key of the wallet they wish to link, and submit the
  wallet address, the original nonce, and the signature.
- **Nonce Verification:** The provided nonce should be validated. In a robust system,
  this means checking against a securely stored, unexpired nonce previously issued to this user.
    """
)
async def link_wallet_to_account(
    link_request: LinkWalletRequest,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # --- Nonce Validation (Simplified) ---
        # A robust implementation would fetch a stored nonce for current_user_id and compare.
        # It would also ensure the nonce is single-use (e.g., delete after successful use or check against a used list).
        # For this version, we rely on the client sending back the exact nonce it received.
        # This step is more about ensuring the client isn't making up a nonce if we weren't storing it.
        if not link_request.nonce or len(link_request.nonce) != 32: # Basic check if nonce looks like what we generate
            logger.warning(f"Potentially invalid nonce format provided by user {current_user_id} for wallet linking.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid challenge format. Please request a new one.")

        # --- Signature Verification ---
        message_to_verify = link_request.nonce
        try:
            # Ensure verify_wallet_signature can handle potential checksum variations in wallet_address if necessary
            is_signature_valid = verify_wallet_signature(
                wallet_address=link_request.wallet_address,
                original_message=message_to_verify,
                signature=link_request.signature
            )
        except Exception as sig_e:
            logger.error(f"Signature verification process failed for user {current_user_id}, wallet {link_request.wallet_address}: {sig_e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signature verification failed. Ensure the message was signed correctly or wallet address is correct.")

        if not is_signature_valid:
            logger.warning(f"Invalid signature for wallet linking attempt by user {current_user_id} for wallet {link_request.wallet_address}.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature. Wallet ownership could not be verified.")

        # --- Check if wallet is already linked to another active user ---
        # Consider if a wallet linked to a now-inactive user should be re-linkable.
        # For now, checking against any user.
        existing_user_with_wallet = await conn.fetchval(
            "SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1) AND id != $2",
            link_request.wallet_address, current_user_id
        )
        if existing_user_with_wallet:
            logger.warning(f"Wallet {link_request.wallet_address} is already linked to another user ({existing_user_with_wallet}). User {current_user_id} attempted to link it.")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This wallet address is already associated with another account.")

        # --- Update User's Wallet Information ---
        update_query = """
            UPDATE users
            SET wallet_address = $1, wallet_verified = TRUE, updated_at = NOW()
            WHERE id = $2
        """
        result = await conn.execute(update_query, link_request.wallet_address, current_user_id)

        if result == "UPDATE 0":
            logger.error(f"Failed to link wallet for user {current_user_id}, user not found during update operation.") # Should be caught by dependency
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found for wallet linking.")

        # If using server-side nonce storage, invalidate/delete the nonce here:
        # await cache.delete(f"link_wallet_nonce:{current_user_id}:{link_request.nonce}")

        logger.info(f"Wallet {link_request.wallet_address} successfully linked to user {current_user_id}.")

        updated_profile = await fetch_user_profile_by_id(current_user_id, conn)
        if not updated_profile:
            logger.error(f"Failed to fetch updated profile for user {current_user_id} after wallet linking.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Wallet linked, but failed to retrieve updated profile.")
        
        return updated_profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking wallet for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not link wallet to account.")


@router.get(
    "/me/export-data",
    response_model=UserExportData,
    summary="Export My Data",
    description="""
Exports all personal data associated with the currently authenticated user.
- **Protected Endpoint:** Requires authentication.
- The exported data includes:
    - Core user profile information.
    - History of orders placed by the user.
    - Store reviews written by the user.
    - Merchant-specific data (store profile, product count) if the user has a 'MERCHANT' role.
- The response will be a JSON file attachment.
- **Note on `orders.user_id`:** There's a known schema mismatch where `orders.user_id` is INTEGER while `users.id` is VARCHAR. The query attempts a cast, which is inefficient and may fail if IDs are not compatible. A schema migration for `orders.user_id` to VARCHAR is recommended.
    """
)
async def export_user_data(
    response: Response, # Inject Response object to set headers
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # 1. Fetch core user profile
        user_profile = await fetch_user_profile_by_id(current_user_id, conn)
        if not user_profile: # Should be caught by dependency, but defensive check
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

        # 2. Fetch user's order history
        orders_data: List[UserOrderData] = []
        # TODO: Critical - orders.user_id is INTEGER in schema, users.id is VARCHAR.
        # This query will likely FAIL or return incorrect results without schema change or complex casting/joining.
        # For this subtask, attempting a cast, but this highlights a schema mismatch.
        # Assuming current_user_id (from JWT 'sub') is a string UUID.
        # If orders.user_id was meant to store an integer ID that also exists on users table,
        # then get_current_active_user_id should return that, or a mapping is needed.
        # For now, let's try to cast orders.user_id to TEXT for comparison. This is inefficient.
        # A better fix is to make orders.user_id VARCHAR(255) REFERENCES users(id).
        try:
            order_rows = await conn.fetch(
                "SELECT id, amount, currency, status, created_at FROM orders WHERE user_id::TEXT = $1 ORDER BY created_at DESC",
                current_user_id
            )
            # If current_user_id could be an integer string:
            # order_rows = await conn.fetch(
            #     "SELECT id, amount, currency, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
            #     int(current_user_id) # This would fail if current_user_id is not an int string
            # )
            for row in order_rows:
                orders_data.append(UserOrderData(**dict(row)))
        except ValueError: # If current_user_id cannot be cast to int for the above commented out query
            logger.error(f"User ID {current_user_id} is not an integer, cannot directly query orders.user_id (INTEGER). Schema migration needed for orders.user_id.")
        except Exception as e_orders:
            logger.error(f"Error fetching orders for user {current_user_id}: {e_orders}")
            # Continue, return empty orders list for export

        # 3. Fetch store reviews written by the user
        reviews_data: List[UserStoreReviewData] = []
        try:
            review_rows = await conn.fetch(
                """SELECT id, merchant_id, rating, review_title, review_text, created_at
                   FROM store_reviews WHERE reviewer_id = $1 ORDER BY created_at DESC""",
                current_user_id
            )
            for row in review_rows:
                reviews_data.append(UserStoreReviewData(**dict(row)))
        except Exception as e_reviews:
            logger.error(f"Error fetching reviews by user {current_user_id}: {e_reviews}")
            # Continue, return empty reviews list

        # 4. If user is a merchant, fetch merchant-specific data
        merchant_profile_data: Optional[StoreProfile] = None
        merchant_products_count: Optional[int] = None
        if user_profile.role == 'MERCHANT':
            try:
                # Fetch merchant store profile
                merchant_profile_row = await conn.fetchrow(
                    "SELECT * FROM merchant_store_profiles WHERE merchant_id = $1",
                    current_user_id
                )
                if merchant_profile_row:
                    merchant_profile_data = StoreProfile(**dict(merchant_profile_row))

                # Fetch count of products listed by merchant
                products_count_val = await conn.fetchval(
                    "SELECT COUNT(id) FROM products WHERE merchant_id = $1",
                    current_user_id
                )
                merchant_products_count = products_count_val if products_count_val is not None else 0
            except Exception as e_merchant:
                logger.error(f"Error fetching merchant data for user {current_user_id}: {e_merchant}")
                # Continue, return None for merchant data

        # 5. Assemble export data
        export_data = UserExportData(
            profile=user_profile,
            orders=orders_data,
            store_reviews_written=reviews_data,
            merchant_profile=merchant_profile_data,
            merchant_products_listed_count=merchant_products_count,
            export_generated_at=datetime.now(timezone.utc)
        )

        # Set headers for file download
        response.headers["Content-Disposition"] = f"attachment; filename=taic_user_data_export_{current_user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"

        return export_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting data for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not export user data.")

@router.delete(
    "/me/delete-account",
    response_model=AccountDeletionResponse,
    summary="Delete My Account",
    description="""
Initiates the process of deleting the currently authenticated user's account.
- **Protected Endpoint:** Requires authentication.
- This is a "soft delete" and anonymization process:
    - The user's `is_active` flag is set to `False`.
    - Personally Identifiable Information (PII) such as email, full name, and wallet address are anonymized or nulled in the `users` table.
    - Password fields are cleared.
    - An audit log entry is recorded for this action.
- **Important:** This action is generally considered irreversible from the user's perspective. Data recovery might only be possible through administrative database backups.
- The `anonymized_at` timestamp is recorded. If the `anonymized_at` column is missing (schema issue), the endpoint will return an error.
- Further data handling for related records (orders, reviews, merchant data) is a more complex process and may be handled separately or by background tasks.
    """
)
async def delete_my_account(
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # Fetch user to confirm it's active before attempting anonymization
        user_to_delete = await conn.fetchrow("SELECT id, email, role, is_active FROM users WHERE id = $1", current_user_id)
        if not user_to_delete: # Should be caught by get_current_active_user_id
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if not user_to_delete['is_active']: # If somehow became inactive after token was issued
            # Or, if already marked for deletion, inform the user.
             return AccountDeletionResponse(
                message="Account is already inactive or marked for deletion.",
                status="already_inactive"
            )

        anonymized_email = f"deleted_user_{current_user_id}@example.com"
        anonymized_full_name = "Deleted User"

        update_fields = {
            "is_active": False,
            "email": anonymized_email, # Anonymize email
            "full_name": anonymized_full_name, # Anonymize name
            "hashed_password": None, # Remove password
            "password_salt": None, # Remove salt (though passlib stores it in hash)
            "wallet_address": None, # Remove wallet
            "wallet_verified": False,
            "email_verified": False, # Mark email as unverified as it's now a placeholder
            "updated_at": "NOW()",
            "anonymized_at": "NOW()" # Conceptual column, assumed to exist
        }

        set_clauses = []
        params = []
        param_idx = 1
        for field, value in update_fields.items():
            if value == "NOW()":
                set_clauses.append(f"{field} = NOW()")
            else:
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1

        params.append(current_user_id) # For WHERE id = $N

        update_query_sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ${param_idx}"

        await conn.execute(update_query_sql, *params)
        logger.info(f"User account {current_user_id} marked as inactive and PII fields anonymized/nulled.")

        # Log this action to admin audit log
        # Using current_user_id as 'admin_username' for self-deletion context
        audit_details = {
            "anonymized_fields": ["email", "full_name", "hashed_password", "wallet_address"],
            "original_email": user_to_delete['email'], # Log original email for audit if needed
            "status": "soft_deleted_and_anonymized"
        }
        try:
            await record_admin_audit_log(
                db_conn=conn,
                admin_username=f"user_self_delete:{current_user_id}", # Indicate self-action
                action="user_self_delete_request_processed",
                target_entity_type="user",
                target_entity_id=current_user_id,
                details=audit_details
            )
        except Exception as audit_e:
            logger.error(f"Failed to record audit log for self-deletion of user {current_user_id}: {audit_e}")
            # Non-critical for the user response if audit log fails here

        # TODO: Add comments regarding related data handling:
        # - Orders: Typically kept for financial records, user_id might be anonymized or disassociated if required by strict privacy.
        # - Store Reviews: reviewer_id could be set to NULL, reviewer_name to "Anonymous User".
        # - Merchant Data: If user is a MERCHANT, their store_profile and products require a separate, more complex offboarding.
        #   This might involve deactivating products, unlinking from merchant_id, or queuing for admin review.
        #   For this endpoint, we are only handling the 'users' table record.

        return AccountDeletionResponse(
            message="Your account has been marked for deletion, and associated personal information has been anonymized. This process may take some time to fully complete across all services.",
            status="deletion_initiated"
        )

    except asyncpg.exceptions.UndefinedColumnError as e_col:
        if "anonymized_at" in str(e_col).lower():
            logger.error(f"Schema missing 'anonymized_at' column in 'users' table for user deletion: {e_col}")
            # Fallback: proceed without setting anonymized_at if column is missing
            # This is a temporary measure; schema should be updated.
            # Re-run logic without anonymized_at (this is complex to do cleanly here without repeating code)
            # For now, just raise a specific error indicating schema issue for this field.
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Account deletion process partially failed due to a server configuration issue (missing 'anonymized_at' field). Please contact support.")
        logger.error(f"Database schema error during account deletion for user {current_user_id}: {e_col}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="A database configuration error occurred.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting account for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not process account deletion request.")
