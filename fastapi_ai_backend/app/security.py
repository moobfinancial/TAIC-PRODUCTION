from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# For Wallet Signature Verification
from eth_account.messages import encode_defunct, defunct_hash_message
from eth_account import Account
import logging

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password_with_salt: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password_with_salt)

# --- JWT Token Handling ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-for-jwt-replace-this-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

if SECRET_KEY == "your-super-secret-key-for-jwt-replace-this-in-production":
    logger.warning("WARNING: Using default JWT_SECRET_KEY. This is insecure and should be changed for production.")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a new JWT access token.
    The 'sub' (subject) claim in the token is typically the user ID or username.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    to_encode.update({"iat": datetime.now(timezone.utc)})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception: Exception) -> Optional[Dict[str, Any]]:
    """
    Verifies a JWT token.
    If valid, returns the payload (claims) as a dictionary.
    If invalid, raises the provided credentials_exception.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWTError during token verification: {e}")
        raise credentials_exception

# --- Wallet Signature Verification ---
def verify_wallet_signature(wallet_address: str, original_message: str, signed_message: str) -> bool:
    """
    Verifies an EIP-191 signed message (personal_sign style).
    Compares the recovered address with the provided wallet_address.
    """
    try:
        # EIP-191 prepends "\x19Ethereum Signed Message:\n" + len(message) before hashing
        # encode_defunct handles this prepending.
        message_hash_bytes = defunct_hash_message(text=original_message) # Correctly use defunct_hash_message

        recovered_address = Account.recover_hash(message_hash_bytes, signature=signed_message)

        # Compare addresses (case-insensitive for Ethereum, though checksum is common)
        return recovered_address.lower() == wallet_address.lower()
    except ValueError as ve: # Handles issues like malformed signature
        logger.error(f"ValueError during signature recovery (e.g., malformed signature): {ve}")
        return False
    except Exception as e:
        logger.error(f"An unexpected error occurred during wallet signature verification: {e}")
        return False


# Example Usage (for direct testing of this module)
if __name__ == "__main__":
    logger.setLevel(logging.INFO)
    logging.basicConfig()

    # Password Hashing Examples
    plain_pw = "TestPassword123!"
    hashed_pw = hash_password(plain_pw)
    logger.info(f"Plain Password: {plain_pw}")
    logger.info(f"Hashed Password: {hashed_pw}")
    logger.info(f"Verification (correct): {verify_password(plain_pw, hashed_pw)}")
    logger.info(f"Verification (incorrect): {verify_password('WrongPassword!', hashed_pw)}")
    logger.info("-" * 30)

    # JWT Token Examples
    user_data_for_token = {"sub": "user123", "role": "SHOPPER", "custom_claim": "example_value"}
    custom_expiry = timedelta(minutes=1)
    access_token = create_access_token(data=user_data_for_token, expires_delta=custom_expiry)
    logger.info(f"Generated Access Token (expires in 1 min): {access_token}")

    class MockHTTPException(Exception):
        def __init__(self, detail): self.detail = detail
        def __str__(self): return self.detail
    credentials_exception_for_test = MockHTTPException(detail="Could not validate credentials (simulated)")

    try:
        payload = verify_token(access_token, credentials_exception_for_test)
        logger.info(f"Token Verification (valid): Payload = {payload}")
    except MockHTTPException as e:
        logger.error(f"Token Verification (valid) failed unexpectedly: {e}")
    logger.info("-" * 30)

    # Wallet Signature Example (requires a real signature to test fully)
    # This is a conceptual test as we don't have a real wallet signing here.
    test_wallet_address = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" # Example address
    test_original_message = "Sign this message to log in to TAIC: 1678886400000" # Example message with timestamp
    # A real signature would be a long hex string starting with 0x...
    test_fake_signature = "0xthisisafakesignatureexample000000000000000000000000000000000000000"

    logger.info("Wallet Signature Verification Example (with fake signature):")
    is_signature_valid = verify_wallet_signature(test_wallet_address, test_original_message, test_fake_signature)
    logger.info(f"Is signature valid (fake signature)? {is_signature_valid}") # Expected: False

    # To test Account.recover_message properly, one would need a message signed by a known private key.
    # For example:
    # from eth_account import Account
    # from eth_account.messages import encode_defunct
    # private_key = "YOUR_PRIVATE_KEY_HEX"  # Keep this secure and never hardcode in real apps
    # acct = Account.from_key(private_key)
    # message_text = "Hello Web3"
    # signable_message = encode_defunct(text=message_text)
    # signed_object = acct.sign_message(signable_message)
    # signature_hex = signed_object.signature.hex()
    # print(f"Address: {acct.address}, Message: '{message_text}', Signature: {signature_hex}")
    # print(f"Verification with own signature: {verify_wallet_signature(acct.address, message_text, signature_hex)}")

    logger.info("\nNote: Full JWT expiration test requires waiting. Wallet signature test uses a fake signature.")
