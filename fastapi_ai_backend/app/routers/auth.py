import logging
import uuid
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
from datetime import timedelta, timezone # For token expiry and NOW()
import uuid # For generating user ID for new wallet users

from ..models.auth_models import (
    UserRegisterSchema, UserResponse,
    UserLoginSchema, TokenResponse,
    WalletLoginSchema, LinkWalletSchema, LinkEmailPasswordSchema
)
from ..db import get_db_connection, release_db_connection
from ..security import hash_password, verify_password, create_access_token, verify_wallet_signature
from ..email_utils import send_shopper_welcome_email, send_merchant_welcome_email # For potential future verification email
from ..dependencies import get_current_active_user_id # For protected endpoint

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Authentication & Authorization"],
    # prefix will be set in main.py, e.g., /api/auth
)

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User (Email/Password)",
    description="""
Register a new user (shopper or merchant) by providing an email, password, and optionally a full name and role.
- A unique user ID will be generated.
- The provided password will be securely hashed before storage.
- The new user record will be inserted into the `users` database table.
- A welcome email will be sent to the user based on their specified role (SHOPPER or MERCHANT).
- If the email already exists, a 409 Conflict error will be returned.
    """
)
async def register_user(user_in: UserRegisterSchema):
    conn: Optional[asyncpg.Connection] = None
    try:
        conn = await get_db_connection()

        # Check if email already exists
        existing_user_email = await conn.fetchval("SELECT email FROM users WHERE email = $1", user_in.email)
        if existing_user_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email '{user_in.email}' already exists."
            )

        # Check if username already exists
        existing_user_username = await conn.fetchval("SELECT username FROM users WHERE username = $1", user_in.username)
        if existing_user_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with username '{user_in.username}' already exists."
            )

        # Generate UUID for user ID
        user_id = str(uuid.uuid4())

        # Hash the password
        hashed_pw = hash_password(user_in.password)
        # Salt is handled by passlib and stored within the hash itself

        # Insert new user
        # Note: `password_salt` column is not used when passlib stores salt within the hash.
        # `wallet_address`, `wallet_verified`, `last_login_at` will be NULL or their defaults.
        # `email_verified` defaults to FALSE. `is_active` defaults to TRUE.

        query = """
            INSERT INTO users (id, username, email, hashed_password, full_name, role, business_name, business_description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING id, username, email, full_name, role, business_name, business_description, is_active, email_verified, created_at, wallet_address, wallet_verified, last_login_at
        """

        created_user_row = await conn.fetchrow(
            query,
            user_id,
            user_in.username,
            user_in.email,
            hashed_pw,
            user_in.full_name,
            user_in.role, # Already validated by Pydantic model
            user_in.business_name,
            user_in.business_description
        )

        if not created_user_row:
            logger.error(f"Failed to insert new user with email: {user_in.email}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User registration failed due to an internal error."
            )

        logger.info(f"User '{created_user_row['email']}' (ID: {created_user_row['id']}) registered successfully as '{created_user_row['role']}'.")

        # Send Welcome Email
        try:
            user_name_for_email = user_in.full_name if user_in.full_name else user_in.username

            if created_user_row['role'] == 'SHOPPER':
                email_sent = await send_shopper_welcome_email(
                    to_email=created_user_row['email'],
                    user_name=user_name_for_email
                )
            elif created_user_row['role'] == 'MERCHANT':
                # For merchant, use business_name if available, otherwise username or email.
                merchant_display_name = user_in.business_name if user_in.business_name else user_name_for_email
                email_sent = await send_merchant_welcome_email(
                    to_email=created_user_row['email'],
                    merchant_name=merchant_display_name
                )
            else: # Should not happen due to Pydantic validation
                email_sent = False
                logger.warning(f"User {created_user_row['id']} has unknown role '{created_user_row['role']}', no welcome email sent.")

            if email_sent:
                logger.info(f"Welcome email successfully simulated for {created_user_row['email']}.")
            else:
                logger.warning(f"Welcome email simulation reported failure for {created_user_row['email']} (role: {created_user_row['role']}).")

        except Exception as email_exc:
            logger.error(f"Error sending welcome email to {created_user_row['email']}: {str(email_exc)}")
            # Do not fail the registration if only email sending fails.
            # The user is already created in the DB.

        # Convert DB row to dict for manipulation
        user_data_dict = dict(created_user_row)

        # Ensure 'id' is a string
        if isinstance(user_data_dict.get('id'), uuid.UUID):
            user_data_dict['id'] = str(user_data_dict['id'])

        # The RETURNING clause is now more comprehensive.
        # UserResponse expects: id, username, email, full_name, role, business_name, business_description, 
        # is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at
        # Ensure all these are present or have defaults if not in created_user_row
        user_data_dict.setdefault('username', created_user_row.get('username')) # Should be there from RETURNING
        user_data_dict.setdefault('business_name', created_user_row.get('business_name')) # Should be there
        user_data_dict.setdefault('business_description', created_user_row.get('business_description')) # Should be there
        user_data_dict.setdefault('wallet_address', created_user_row.get('wallet_address')) # Now in RETURNING
        user_data_dict.setdefault('wallet_verified', created_user_row.get('wallet_verified', False)) # Now in RETURNING
        user_data_dict.setdefault('last_login_at', created_user_row.get('last_login_at')) # Now in RETURNING
        # is_active and email_verified should also be in created_user_row from the RETURNING clause.

        return UserResponse(**user_data_dict)

    except asyncpg.exceptions.UniqueViolationError as e:
        logger.warning(f"Unique violation during user registration for user {user_in.username} / email {user_in.email}: {e}")
        # Determine if it's email or username conflict based on error details if possible, or give generic.
        # For now, a more generic message, or rely on the prior specific checks.
        if 'users_email_key' in str(e).lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"An account with email '{user_in.email}' already exists.")
        elif 'users_username_key' in str(e).lower(): # Assuming 'users_username_key' is the constraint name
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"An account with username '{user_in.username}' already exists.")
        elif 'users_wallet_address_key' in str(e).lower():
             raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This wallet address is already associated with an account.")
        else:
            # Generic if specific constraint not identified
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A unique constraint was violated during registration (e.g., email, username, or wallet already exists). Please check your details.")
    except asyncpg.exceptions.UndefinedTableError as e:
        logger.critical(f"Database table 'users' or related might be missing. Error: {e}")
        raise HTTPException(status_code=500, detail="Server configuration error: User database not found.")
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Unexpected error during user registration for {user_in.email}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during registration."
        )
    finally:
        if conn:
            await release_db_connection(conn)

@router.post(
    "/link-email-password",
    response_model=UserResponse,
    summary="Link Email/Password to Authenticated Account",
    description="""
Allows a currently authenticated user (e.g., one who signed up via wallet and has a JWT)
to link an email address and password to their existing account.

- **Protected Endpoint:** Requires a valid JWT for an existing user.
- Checks if an email is already linked to the authenticated user's account; if so, returns an error.
- Checks if the new email address is already in use by *another* user; if so, returns a conflict error.
- Securely hashes the new password.
- Updates the user's record with the new email, hashed password, and sets `email_verified` to `False`.
- A full name can also be provided to update the user's profile if it wasn't set previously or is empty.
- Triggers a conceptual email verification flow (actual email sending is separate).
    """
)
async def link_email_password_to_account(
    link_data: LinkEmailPasswordSchema,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    try:
        # 1. Fetch current user's record to check current email status
        # Fetch all fields needed for UserResponse as well, as we return it.
        user_record = await conn.fetchrow(
            "SELECT id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE id = $1",
            current_user_id
        )
        # get_current_active_user_id ensures user exists and is active.
        if not user_record:
             logger.error(f"User {current_user_id} not found in link_email_password, despite token validation.")
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authenticated user not found.")

        if user_record['email']:
            logger.warning(f"User {current_user_id} attempted to link email {link_data.email} but an email ({user_record['email']}) is already linked.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An email is already linked to this account. To change it, please use the 'update email' feature (not yet implemented) or contact support.",
            )

        # 2. Check if the new email is already in use by ANOTHER user
        other_user_with_email = await conn.fetchrow(
            "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2",
            link_data.email, current_user_id
        )
        if other_user_with_email:
            logger.warning(f"User {current_user_id} attempted to link email {link_data.email} which is already used by user {other_user_with_email['id']}.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already registered by another user.",
            )

        # 3. Hash the new password
        hashed_new_password = hash_password(link_data.password)

        # 4. Prepare fields for update
        update_fields_dict = {
            "email": link_data.email,
            "hashed_password": hashed_new_password,
            "email_verified": False,
        }
        if link_data.full_name and (user_record['full_name'] is None or user_record['full_name'].strip() == ""):
            update_fields_dict["full_name"] = link_data.full_name

        set_clauses = [f"{field} = ${i+1}" for i, field in enumerate(update_fields_dict.keys())]
        params = list(update_fields_dict.values())

        set_clauses.append("updated_at = NOW()")

        params.append(current_user_id)

        # 5. Update user record
        update_query_sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ${len(params)}"

        # We need to fetch all fields for UserResponse after update
        updated_user_row_dict = await conn.fetchrow(
            update_query_sql + " RETURNING id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at",
            *params
        )

        if not updated_user_row_dict:
            logger.error(f"Failed to link email/password for user {current_user_id}. No rows returned after update.")
            raise HTTPException(status_code=500, detail="Failed to link email and password to your account.")

        logger.info(f"Email {link_data.email} and password successfully linked to user {current_user_id}.")

        # 6. Conceptual: Trigger Email Verification Flow
        logger.info(f"TODO: Trigger email verification flow for user {current_user_id} and email {link_data.email}")

        # Convert DB row to dict for manipulation
        user_data_dict = dict(updated_user_row_dict)

        # Ensure 'id' is a string
        if isinstance(user_data_dict.get('id'), uuid.UUID):
            user_data_dict['id'] = str(user_data_dict['id'])
        
        # The RETURNING clause for this update is comprehensive and should cover all UserResponse fields:
        # RETURNING id, username, email, full_name, role, business_name, business_description, 
        #           is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at
        # Ensure all these are present or have defaults if not in updated_user_row_dict
        user_data_dict.setdefault('username', updated_user_row_dict.get('username'))
        user_data_dict.setdefault('business_name', updated_user_row_dict.get('business_name'))
        user_data_dict.setdefault('business_description', updated_user_row_dict.get('business_description'))

        return UserResponse(**user_data_dict)

    except HTTPException:
        raise
    except asyncpg.exceptions.UniqueViolationError:
        logger.error(f"Email linking failed for user {current_user_id} due to unique violation for email {link_data.email} (should have been caught earlier).")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email address may already be in use.")
    except Exception as e:
        logger.error(f"Unexpected error during email/password linking for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred while linking your email and password.")

@router.post("/link-wallet", response_model=UserResponse)
async def link_wallet_to_account(
    link_data: LinkWalletSchema,
    current_user_id: str = Depends(get_current_active_user_id), # Protected route
    conn: asyncpg.Connection = Depends(get_db_connection) # Get DB connection from dependency
):
    """
    Links a wallet address to the authenticated user's account after verifying signature.
    Assumes one wallet per account; prevents linking if another wallet is already present
    or if the target wallet is already linked to another user.
    """
    try:
        # 1. Verify Signature for the wallet being linked
        is_signature_valid = verify_wallet_signature(
            wallet_address=link_data.wallet_address,
            original_message=link_data.original_message,
            signed_message=link_data.signed_message
        )
        if not is_signature_valid:
            logger.warning(f"Wallet linking attempt failed for user {current_user_id}: Invalid signature for address {link_data.wallet_address}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, # 400 as it's a client-side signature issue
                detail="Invalid wallet signature or wallet address provided for linking.",
            )

        normalized_link_wallet_address = link_data.wallet_address.lower()

        # 2. Check if this wallet address is already linked to ANOTHER user
        other_user_with_wallet = await conn.fetchrow(
            "SELECT id FROM users WHERE LOWER(wallet_address) = $1 AND id != $2",
            normalized_link_wallet_address, current_user_id
        )
        if other_user_with_wallet:
            logger.warning(f"User {current_user_id} attempted to link wallet {normalized_link_wallet_address} already associated with user {other_user_with_wallet['id']}.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This wallet address is already linked to another account.",
            )

        # 3. Fetch current user's record to check their existing wallet status
        # Fetch all fields needed for UserResponse as well
        user_record = await conn.fetchrow(
             "SELECT id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE id = $1",
            current_user_id
        )
        # get_current_active_user_id already confirms user exists and is active, but fetching again for all fields.
        if not user_record:
            # Should not happen if get_current_active_user_id is working correctly
            logger.error(f"User {current_user_id} not found during wallet linking process, despite token validation.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authenticated user not found.")

        current_normalized_user_wallet = user_record['wallet_address'].lower() if user_record['wallet_address'] else None

        if current_normalized_user_wallet == normalized_link_wallet_address:
            # Wallet is already linked to this account. If not verified, verify it.
            if not user_record['wallet_verified']:
                await conn.execute("UPDATE users SET wallet_verified = TRUE, updated_at = NOW() WHERE id = $1", current_user_id)
                logger.info(f"Wallet {normalized_link_wallet_address} re-verified for user {current_user_id}.")
                # Re-fetch for updated response
                user_record = await conn.fetchrow("SELECT id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE id = $1", current_user_id)
            else:
                logger.info(f"Wallet {normalized_link_wallet_address} already linked and verified for user {current_user_id}.")
            # Ensure all UserResponse fields are present
            user_data_dict = dict(user_record)
            user_data_dict.setdefault('username', user_data_dict.get('username'))
            user_data_dict.setdefault('business_name', user_data_dict.get('business_name'))
            user_data_dict.setdefault('business_description', user_data_dict.get('business_description'))
            return UserResponse(**user_data_dict)

        if current_normalized_user_wallet and current_normalized_user_wallet != normalized_link_wallet_address:
            logger.warning(f"User {current_user_id} attempted to link new wallet {normalized_link_wallet_address} but already has wallet {current_normalized_user_wallet} linked.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account already has a different wallet linked. Please unlink it first if you wish to add a new one.",
            )

        # 4. Update user record with new wallet address and set as verified
        updated_user_row = await conn.fetchrow(
            """
            UPDATE users
            SET wallet_address = $1, wallet_verified = TRUE, updated_at = NOW()
            WHERE id = $2
            RETURNING id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at
            """,
            normalized_link_wallet_address, # Storing normalized address
            current_user_id
        )

        if not updated_user_row:
             logger.error(f"Failed to update user {current_user_id} with new wallet {normalized_link_wallet_address}")
             raise HTTPException(status_code=500, detail="Failed to link wallet to your account.")

        logger.info(f"Wallet {normalized_link_wallet_address} successfully linked to user {current_user_id}.")
        # Ensure all UserResponse fields are present
        user_data_dict = dict(updated_user_row)
        user_data_dict.setdefault('username', user_data_dict.get('username'))
        user_data_dict.setdefault('business_name', user_data_dict.get('business_name'))
        user_data_dict.setdefault('business_description', user_data_dict.get('business_description'))
        return UserResponse(**user_data_dict)

    except HTTPException:
        raise
    except asyncpg.exceptions.UniqueViolationError:
        # This case should be caught by the check for other_user_with_wallet, but as a failsafe.
        logger.error(f"Wallet linking failed for user {current_user_id} due to unique violation for wallet {link_data.wallet_address}.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This wallet address may already be in use by another account.")
    except Exception as e:
        logger.error(f"Unexpected error during wallet linking for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred while linking your wallet.")
    # No finally block for releasing conn, as it's handled by FastAPI's Depends for get_db_connection
    # if get_db_connection is a generator based dependency. If not, it should be released.
    # Current get_db_connection directly acquires. This endpoint relies on FastAPI to manage the connection
    # provided by Depends(get_db_connection). For this pattern to work safely without manual release here,
    # get_db_connection should be a generator: `async def get_db_connection(): conn = await acquire(); try: yield conn; finally: await release(conn)`
    # Assuming for now that get_db_connection used with Depends is handled correctly by FastAPI or a higher-level middleware.
    # For safety in this specific router, if get_db_connection isn't a generator, manual release would be needed.
    # Given the project structure, let's assume Depends(get_db_connection) is fine.

# This is the duplicate /link-email-password route that needs to be removed.
# The SEARCH block will encompass this entire function.
# The REPLACE block will be empty, effectively deleting it.

@router.post(
    "/login-wallet",
    response_model=TokenResponse,
    summary="Login or Register with Wallet Signature",
    description="""
Authenticates a user using a crypto wallet signature, or registers a new user if the wallet is not yet known.
- Requires the wallet address, an original message, and the EIP-191 compliant signature of that message.
- Verifies the signature against the provided wallet address.
- If the wallet address (normalized to lowercase) exists in the `users` table and the user is active:
    - Updates `last_login_at` and ensures `wallet_verified` is true.
    - Issues a JWT access token containing user ID, role, wallet address, and email (if available).
- If the wallet address does not exist:
    - Creates a new user record with the provided wallet address (normalized to lowercase).
    - Sets a default role (e.g., 'SHOPPER'), marks the user as active and `wallet_verified` as true.
    - Issues a JWT access token.
- Returns a 401 Unauthorized error for invalid signatures.
- Returns a 403 Forbidden error if an existing user account is inactive.
    """
)
async def login_or_register_with_wallet(login_data: WalletLoginSchema):
    conn: Optional[asyncpg.Connection] = None
    try:
        # 1. Verify Signature
        # Note: Ethereum addresses might have checksums (mixed case) but are fundamentally case-insensitive.
        # Storing and comparing as lowercase is a common practice for robustness.
        # The verify_wallet_signature function already handles lowercase comparison.
        is_signature_valid = verify_wallet_signature(
            wallet_address=login_data.wallet_address,
            original_message=login_data.original_message,
            signed_message=login_data.signed_message
        )

        if not is_signature_valid:
            logger.warning(f"Wallet login attempt failed: Invalid signature for address {login_data.wallet_address}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature or wallet address.",
                headers={"WWW-Authenticate": "Bearer"}, # Though Bearer might not be strictly relevant for signature schemes
            )

        conn = await get_db_connection()

        # For querying, consider using LOWER() on wallet_address if it's stored with mixed case from various sources.
        # For this example, assuming direct match or that addresses are stored consistently (e.g. checksummed or lowercase).
        # The users table schema has wallet_address UNIQUE.
        # It's good practice to store them normalized (e.g. all lowercase, or all checksummed via web3.to_checksum_address).
        # Let's assume for query we use LOWER() for robustness, and schema stores them consistently.
        normalized_wallet_address = login_data.wallet_address.lower() # Normalize for lookup and potential storage

        user_record = await conn.fetchrow(
            "SELECT id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE LOWER(wallet_address) = $1",
            normalized_wallet_address
        )

        user_id: str
        user_role: str
        user_email: Optional[str] = None

        if user_record:
            # --- User Exists ---
            logger.info(f"Existing user found for wallet address: {normalized_wallet_address}, ID: {user_record['id']}")
            if not user_record['is_active']:
                logger.warning(f"Wallet login attempt failed: User {normalized_wallet_address} is inactive.")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is inactive. Please contact support.",
                )
            db_user_id_uuid = user_record['id'] # This is uuid.UUID
            user_id_for_token = str(db_user_id_uuid) # For JWT and logging
            user_role = user_record['role']
            user_email = user_record['email']

            update_fields_to_set = ["last_login_at = NOW()", "updated_at = NOW()"]
            if not user_record['wallet_verified']:
                update_fields_to_set.append("wallet_verified = TRUE")
            
            set_clause_string = ", ".join(update_fields_to_set)
            update_query = f"UPDATE users SET {set_clause_string} WHERE id = $1"
            
            logger.info(f"Attempting to update user. ID for query: {db_user_id_uuid}, Type of ID: {type(db_user_id_uuid)}")
            await conn.execute(
                update_query,
                db_user_id_uuid # Pass the UUID object directly
            )
            logger.info(f"Updated user {user_id_for_token}: set {{set_clause_string}}") # Use double curly braces for literal curly brace in f-string

            # Ensure user_id variable (used later for token) is the string version
            user_id = user_id_for_token


        else:
            # --- New User - Register with Wallet ---
            logger.info(f"New user registration with wallet address: {normalized_wallet_address}")
            user_id = str(uuid.uuid4())
            user_role = 'SHOPPER' # Default role for new wallet sign-ups

            # Store the normalized (e.g., lowercase) wallet address or checksummed version.
            # For this example, using the normalized_wallet_address.
            insert_query = """
                INSERT INTO users (id, wallet_address, role, is_active, wallet_verified, last_login_at, created_at, updated_at)
                VALUES ($1, $2, $3, TRUE, TRUE, NOW(), NOW(), NOW())
                RETURNING id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at
            """
            # Note: email, hashed_password, password_salt, full_name will be NULL
            new_user_row = await conn.fetchrow(
                insert_query,
                user_id,
                normalized_wallet_address, # Storing normalized address
                user_role
            )
            if not new_user_row:
                logger.error(f"Failed to create new user with wallet: {normalized_wallet_address}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Wallet user registration failed due to an internal error."
                )
            user_email = new_user_row['email'] # Will be None
            logger.info(f"New user created with ID: {user_id} for wallet: {normalized_wallet_address}")
            # No welcome email here as we don't have an email address.

        # Create access token
        token_data = {
            "sub": user_id,
            "role": user_role,
            "wallet_address": normalized_wallet_address # Include wallet_address in token
        }
        if user_email: # Only include email in token if it exists
            token_data["email"] = user_email

        access_token = create_access_token(data=token_data)

        # Fetch final user details to ensure all fields are current for UserResponse
        final_user_details_row = await conn.fetchrow(
            "SELECT id, username, email, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE id = $1",
            user_id # user_id is a string here
        )

        if not final_user_details_row:
            logger.error(f"Critical: Could not retrieve full details for user {user_id} after login/registration for TokenResponse.")
            # This should ideally not happen if user was just found/created and updated.
            # Fallback to minimal user info if absolutely necessary, or raise error.
            # For now, raising an error as this indicates a problem.
            raise HTTPException(status_code=500, detail="Failed to retrieve complete user details after login.")

        user_data_for_response = dict(final_user_details_row)
        # Ensure string ID for Pydantic model
        if isinstance(user_data_for_response.get('id'), uuid.UUID):
            user_data_for_response['id'] = str(user_data_for_response['id'])
        
        # Ensure all expected fields for UserResponse are present, providing defaults if necessary
        # Most should come from the comprehensive SELECT query.
        user_data_for_response.setdefault('username', final_user_details_row.get('username'))
        user_data_for_response.setdefault('email', final_user_details_row.get('email'))
        user_data_for_response.setdefault('full_name', final_user_details_row.get('full_name'))
        user_data_for_response.setdefault('role', final_user_details_row.get('role')) # Should always exist
        user_data_for_response.setdefault('business_name', final_user_details_row.get('business_name'))
        user_data_for_response.setdefault('business_description', final_user_details_row.get('business_description'))
        user_data_for_response.setdefault('is_active', final_user_details_row.get('is_active', True))
        user_data_for_response.setdefault('email_verified', final_user_details_row.get('email_verified', False))
        user_data_for_response.setdefault('wallet_address', final_user_details_row.get('wallet_address', normalized_wallet_address)) # Use normalized_wallet_address as fallback
        user_data_for_response.setdefault('wallet_verified', final_user_details_row.get('wallet_verified', True)) # Verified in this flow
        user_data_for_response.setdefault('created_at', final_user_details_row.get('created_at'))
        user_data_for_response.setdefault('last_login_at', final_user_details_row.get('last_login_at'))

        user_response_obj = UserResponse(**user_data_for_response)

        logger.info(f"User (Wallet: {normalized_wallet_address}, ID: {user_id}) logged in/registered successfully. Token and UserResponse prepared.")
        return TokenResponse(access_token=access_token, token_type="bearer", user=user_response_obj)

    except asyncpg.exceptions.UniqueViolationError as e:
        # This could happen if, somehow, a wallet address record was created by another process
        # between the initial check and the insert attempt (highly unlikely with proper unique constraints and checks).
        logger.error(f"Wallet login/registration failed due to unique violation for address {login_data.wallet_address}: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This wallet address is already registered or a conflict occurred."
        )
    except asyncpg.exceptions.UndefinedTableError as e:
        logger.critical(f"Wallet login failed: Database table 'users' or related might be missing. Error: {e}")
        raise HTTPException(status_code=500, detail="Server configuration error: Login service unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during wallet login/registration for {login_data.wallet_address}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during wallet login/registration."
        )
    finally:
        if conn:
            await release_db_connection(conn)

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with Email/Password",
    description="""
Authenticates an existing user with their email and password.
- Retrieves the user record by email.
- Verifies the provided password against the stored secure hash.
- If authentication is successful and the user account is active:
    - Updates the user's `last_login_at` timestamp in the database.
    - Issues a JWT access token containing user ID, email, and role.
- Returns a 401 Unauthorized error for incorrect credentials or if the user is not found.
- Returns a 403 Forbidden error if the user account is marked as inactive.
    """
)
async def login_for_access_token(login_data: UserLoginSchema, conn: asyncpg.Connection = Depends(get_db_connection)):
    try:
    # Retrieve user by email
    # Ensure all necessary fields for token and checks are fetched
        user_record = await conn.fetchrow(
            "SELECT id, username, email, hashed_password, full_name, role, business_name, business_description, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at, is_superuser FROM users WHERE email = $1",
            login_data.email
        )

        if not user_record:
            logger.warning(f"Login attempt failed: User not found for email {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )


        if not user_record['is_active']:
            logger.warning(f"Login attempt failed: User {login_data.email} is inactive.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, # Using 403 for inactive user
                detail="Account is inactive. Please contact support.",
            )

        # Verify password
        if not verify_password(login_data.password, user_record['hashed_password']):
            logger.warning(f"Login attempt failed: Invalid password for user {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.", # Keep generic for security
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Update last_login_at
        try:
            await conn.execute("UPDATE users SET last_login_at = NOW() WHERE id = $1", user_record['id'])
            logger.info(f"Updated last_login_at for user {user_record['id']}")
        except Exception as e_update_login:
            logger.error(f"Failed to update last_login_at for user {user_record['id']} due to: {e_update_login}")

        if not updated_user_details_row:
            logger.error(f"Failed to update last_login_at or retrieve user details for {user_record['email']} after login.")
            # Fallback or raise error - for now, we'll proceed but log critically
            # This ideally shouldn't happen if the user was just authenticated.
            # Consider raising an HTTPException if this is critical path for accurate response data.
            # For now, we'll use the initially fetched user_record for token, but log this issue.
            # This means UserResponse might have slightly stale last_login_at if this fetch fails.
            # However, TokenResponse now requires a full UserResponse, so we must have these details.
            raise HTTPException(status_code=500, detail="Failed to finalize login process.")

        # Create access token
        token_data = {
            "sub": str(updated_user_details_row['id']),
            "email": updated_user_details_row['email'],
            "role": updated_user_details_row['role']
        }
        if updated_user_details_row.get('wallet_address'):
            token_data['wallet_address'] = updated_user_details_row['wallet_address']

        access_token = create_access_token(data=token_data)

        user_data_for_response = dict(updated_user_details_row)
        if isinstance(user_data_for_response.get('id'), uuid.UUID):
            user_data_for_response['id'] = str(user_data_for_response['id'])
        
        # Ensure all expected fields for UserResponse are present
        user_data_for_response.setdefault('username', updated_user_details_row.get('username'))
        user_data_for_response.setdefault('business_name', updated_user_details_row.get('business_name'))
        user_data_for_response.setdefault('business_description', updated_user_details_row.get('business_description'))
        user_data_for_response.setdefault('is_active', updated_user_details_row.get('is_active', True))
        user_data_for_response.setdefault('email_verified', updated_user_details_row.get('email_verified', False))
        user_data_for_response.setdefault('wallet_verified', updated_user_details_row.get('wallet_verified', False))
        user_data_for_response.setdefault('created_at', updated_user_details_row.get('created_at'))
        # last_login_at is fresh from RETURNING

        user_response_obj = UserResponse(**user_data_for_response)

        logger.info(f"User {updated_user_details_row['email']} (ID: {updated_user_details_row['id']}) logged in successfully. Token and UserResponse prepared.")
        return TokenResponse(access_token=access_token, token_type="bearer", user=user_response_obj)

    except asyncpg.exceptions.UndefinedTableError as e:
        logger.critical(f"Login failed: Database table 'users' or related might be missing. Error: {e}")
        raise HTTPException(status_code=500, detail="Server configuration error: Login service unavailable.")
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login for {login_data.email}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login."
        )
    finally:
        if conn:
            await release_db_connection(conn)
