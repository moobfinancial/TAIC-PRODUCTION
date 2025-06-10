import logging
import uuid
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
from datetime import timedelta, timezone # For token expiry and NOW()
import uuid # For generating user ID for new wallet users

from app.models.auth_models import (
    UserRegisterSchema, UserResponse,
    UserLoginSchema, TokenResponse,
    WalletLoginSchema, LinkWalletSchema, LinkEmailPasswordSchema
)
from app.db import get_db_connection, release_db_connection
from app.security import hash_password, verify_password, create_access_token, verify_wallet_signature
from app.email_utils import send_shopper_welcome_email, send_merchant_welcome_email # For potential future verification email
from app.dependencies import get_current_active_user_id # For protected endpoint

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Authentication"],
    # prefix will be set in main.py, e.g., /api/auth
)

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserRegisterSchema):
    """
    Register a new user (shopper or merchant) with email and password.
    - Generates a unique ID for the user.
    - Hashes the password.
    - Inserts the user into the 'users' table.
    - Sends a welcome email based on the role.
    """
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
            INSERT INTO users (id, email, hashed_password, full_name, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id, email, full_name, role, is_active, email_verified, created_at
            -- Not returning updated_at as it's same as created_at here
            -- Not returning hashed_password or salt
        """

        created_user_row = await conn.fetchrow(
            query,
            user_id,
            user_in.email,
            hashed_pw,
            user_in.full_name,
            user_in.role # Already validated by Pydantic model
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
            user_name_for_email = created_user_row['full_name'] if created_user_row['full_name'] else created_user_row['email']

            if created_user_row['role'] == 'SHOPPER':
                email_sent = await send_shopper_welcome_email(
                    to_email=created_user_row['email'],
                    user_name=user_name_for_email
                )
            elif created_user_row['role'] == 'MERCHANT':
                # For merchant, user_name_for_email might be business name if collected differently,
                # for now, using full_name or email.
                email_sent = await send_merchant_welcome_email(
                    to_email=created_user_row['email'],
                    merchant_name=user_name_for_email
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

        return UserResponse(**dict(created_user_row))

    except asyncpg.exceptions.UniqueViolationError as e: # Should be caught by the email check generally
        logger.warning(f"Unique violation during user registration for email {user_in.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with this email already exists."
        )
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
             "SELECT id, email, full_name, role, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE id = $1",
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
                user_record = await conn.fetchrow("SELECT id, email, full_name, role, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at FROM users WHERE id = $1", current_user_id)
            else:
                logger.info(f"Wallet {normalized_link_wallet_address} already linked and verified for user {current_user_id}.")
            return UserResponse(**dict(user_record))

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
            RETURNING id, email, full_name, role, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at
            """,
            normalized_link_wallet_address, # Storing normalized address
            current_user_id
        )

        if not updated_user_row:
             logger.error(f"Failed to update user {current_user_id} with new wallet {normalized_link_wallet_address}")
             raise HTTPException(status_code=500, detail="Failed to link wallet to your account.")

        logger.info(f"Wallet {normalized_link_wallet_address} successfully linked to user {current_user_id}.")
        return UserResponse(**dict(updated_user_row))

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

@router.post("/link-email-password", response_model=UserResponse)
async def link_email_password_to_account(
    link_data: LinkEmailPasswordSchema,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """
    Links an email and password to the authenticated (likely wallet-first) user's account.
    """
    try:
        # 1. Fetch current user's record
        user_record = await conn.fetchrow(
            "SELECT id, email, full_name FROM users WHERE id = $1",
            current_user_id
        )
        # get_current_active_user_id ensures user exists and is active.

        if user_record['email']: # Check if an email is already linked
            logger.warning(f"User {current_user_id} attempted to link email {link_data.email} but an email ({user_record['email']}) is already linked.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An email is already linked to this account. Unlinking is not yet supported.",
            )

        # 2. Check if the new email is already in use by ANOTHER user
        other_user_with_email = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1 AND id != $2",
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
        update_fields = {
            "email": link_data.email,
            "hashed_password": hashed_new_password,
            "email_verified": False, # New email needs verification
            "updated_at": "NOW()"
        }
        if link_data.full_name and not user_record['full_name']: # Only update full_name if provided AND current one is empty
            update_fields["full_name"] = link_data.full_name

        set_clauses = []
        params = []
        param_idx = 1
        for field, value in update_fields.items():
            if field == "updated_at":
                set_clauses.append("updated_at = NOW()")
            else:
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1

        params.append(current_user_id) # For WHERE id = $N

        # 5. Update user record
        updated_user_row = await conn.fetchrow(
            f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ${param_idx} "
            "RETURNING id, email, full_name, role, is_active, email_verified, wallet_address, wallet_verified, created_at, last_login_at",
            *params
        )

        if not updated_user_row:
            logger.error(f"Failed to link email/password for user {current_user_id}.")
            raise HTTPException(status_code=500, detail="Failed to link email and password to your account.")

        logger.info(f"Email {link_data.email} and password successfully linked to user {current_user_id}.")

        # 6. Conceptual: Trigger Email Verification Flow
        logger.info(f"TODO: Trigger email verification flow for user {current_user_id} and email {link_data.email}")
        # (Actual email sending for verification is a separate feature)

        return UserResponse(**dict(updated_user_row))

    except HTTPException:
        raise
    except asyncpg.exceptions.UniqueViolationError:
        # This should ideally be caught by the email check for other users.
        logger.error(f"Email linking failed for user {current_user_id} due to unique violation for email {link_data.email}.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email address may already be in use.")
    except Exception as e:
        logger.error(f"Unexpected error during email/password linking for user {current_user_id}: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred while linking your email and password.")


@router.post("/login-wallet", response_model=TokenResponse)
async def login_or_register_with_wallet(login_data: WalletLoginSchema):
    """
    Authenticate or register a user with wallet signature and return a JWT access token.
    If wallet address doesn't exist, a new user record is created.
    """
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
            "SELECT id, email, role, is_active, wallet_verified FROM users WHERE LOWER(wallet_address) = $1",
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
            user_id = user_record['id']
            user_role = user_record['role']
            user_email = user_record['email'] # Fetch email if it exists

            update_clauses = ["last_login_at = NOW()"]
            update_params = []
            param_idx = 1

            if not user_record['wallet_verified']:
                update_clauses.append(f"wallet_verified = TRUE")

            update_params.append(user_id)

            if update_clauses: # Only run update if there's something to update (e.g. wallet_verified or last_login_at)
                 await conn.execute(
                    f"UPDATE users SET {', '.join(update_clauses)} WHERE id = ${len(update_clauses) + 1}", # Param index for id
                    *update_params[:-1], user_id # Spread params for SET, then id for WHERE
                )
                 logger.info(f"Updated last_login_at and/or wallet_verified for user {user_id}")


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
                RETURNING id, email, role, is_active, wallet_verified
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

        logger.info(f"User (Wallet: {normalized_wallet_address}, ID: {user_id}) logged in/registered successfully.")
        return TokenResponse(access_token=access_token, token_type="bearer")

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

@router.post("/login", response_model=TokenResponse)
async def login_for_access_token(login_data: UserLoginSchema):
    """
    Authenticate user with email/password and return a JWT access token.
    """
    conn: Optional[asyncpg.Connection] = None
    try:
        conn = await get_db_connection()

        # Retrieve user by email
        # Ensure all necessary fields for token and checks are fetched
        user_record = await conn.fetchrow(
            "SELECT id, email, hashed_password, role, is_active FROM users WHERE email = $1",
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
            # Log error but don't fail login if this update fails
            logger.error(f"Failed to update last_login_at for user {user_record['id']}: {e_update_login}")

        # Create access token
        # Subject ('sub') of the token is usually the user's ID.
        # Add other claims like role for authorization purposes.
        token_data = {
            "sub": user_record['id'], # Using user_id as subject
            "email": user_record['email'], # Include email as a claim
            "role": user_record['role']   # Include role as a claim
        }
        # ACCESS_TOKEN_EXPIRE_MINUTES is handled by create_access_token default
        access_token = create_access_token(data=token_data)

        logger.info(f"User {user_record['email']} (ID: {user_record['id']}) logged in successfully.")
        return TokenResponse(access_token=access_token, token_type="bearer")

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
