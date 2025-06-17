import os
from dotenv import load_dotenv
import pytest_asyncio

# Load environment variables from .env file
# Make sure .env is in the same directory as this conftest.py or specify path
load_dotenv()

from fastapi.testclient import TestClient
import asyncpg
import asyncio
from typing import AsyncGenerator

from fastapi_ai_backend.app.main import app
from fastapi_ai_backend.app.db import POOL
from fastapi_ai_backend.app.security import hash_password

# Override the database URL for testing
# The tests will use the DATABASE_URL environment variable.
# Make sure it's set to your test database, e.g., 
# export DATABASE_URL="postgresql://user:password@localhost:5432/test_db"

# Import TestClient for httpx.AsyncClient
from httpx import AsyncClient, ASGITransport

@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Client fixture for making HTTP requests to the app
@pytest_asyncio.fixture(scope="module")
async def client(test_db: asyncpg.Pool) -> AsyncGenerator[AsyncClient, None]:
    """An httpx.AsyncClient instance for testing the FastAPI app."""
    # The test_db fixture ensures the app.state.pool is set correctly
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture(scope="module")
async def test_db():
    """Fixture to provide a test database connection from an environment variable."""
    test_dsn = os.getenv("DATABASE_URL")
    if not test_dsn:
        raise ValueError("DATABASE_URL environment variable not set. Please set it to your test database URL.")

    # This pool is for the fixture's setup/teardown (creating tables, etc.)
    # It will also be yielded for tests to use directly if they type-hint it.
    fixture_pool = await asyncpg.create_pool(
        dsn=test_dsn,
        min_size=1,
        max_size=5,
        timeout=30
    )

    # Manage the global POOL used by application code (e.g. db_ops.py)
    global POOL
    original_global_pool = POOL
    POOL = fixture_pool

    # Manage app.state.pool used by TestClient via app instance
    original_app_state_pool = app.state.pool if hasattr(app.state, 'pool') else None
    app.state.pool = fixture_pool

    try:
        async with fixture_pool.acquire() as conn:
            # Ensure a clean slate: drop and recreate tables.
            # This is safer in a module-scoped fixture.
            # If privilege errors persist, this user needs DDL rights or a dedicated test DB.
            await conn.execute("DROP TABLE IF EXISTS product_variants CASCADE;")
            await conn.execute("DROP TABLE IF EXISTS products CASCADE;")
            await conn.execute("DROP TABLE IF EXISTS categories CASCADE;")
            await conn.execute("DROP TABLE IF EXISTS users CASCADE;")
            
            await conn.execute("""
                CREATE TABLE categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    slug VARCHAR(100) UNIQUE NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            await conn.execute("""
                CREATE TABLE products (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    price DECIMAL(10, 2) NOT NULL,
                    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                    stock_quantity INTEGER NOT NULL DEFAULT 0,
                    image_url TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    has_variants BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
                    updated_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                );
            """)
            await conn.execute("""
                CREATE TABLE users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE, -- Made nullable
                    username VARCHAR(50) UNIQUE,
                    hashed_password VARCHAR(255), -- Made nullable for wallet-only users initially
                    full_name VARCHAR(255),
                    role VARCHAR(50) NOT NULL DEFAULT 'SHOPPER' CHECK (role IN ('SHOPPER', 'MERCHANT', 'ADMIN')),
                    wallet_address VARCHAR(255) UNIQUE,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_superuser BOOLEAN DEFAULT FALSE,
                    email_verified BOOLEAN DEFAULT FALSE,
                    wallet_verified BOOLEAN DEFAULT FALSE,
                    last_login_at TIMESTAMP WITH TIME ZONE NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            await conn.execute("""
                CREATE TABLE product_variants (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                    attributes JSONB NOT NULL,
                    sku VARCHAR(100) UNIQUE,
                    specific_price DECIMAL(10, 2) DEFAULT NULL, -- Can be NULL if base product price is used
                    stock_quantity INTEGER DEFAULT 0,
                    image_url VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Insert initial seed data
            try:
                await conn.execute("""
                    INSERT INTO categories (name, slug, description) VALUES 
                        ('Electronics', 'electronics', 'Electronic devices'),
                        ('Clothing', 'clothing', 'Clothing items')
                    ON CONFLICT (slug) DO NOTHING;
                """)
                await conn.execute("""
                    INSERT INTO products (name, description, price, category_id, image_url, is_active, has_variants) VALUES
                        ('Wireless Headphones', 'High-quality wireless headphones with noise cancellation.', 99.99, 
                         (SELECT id FROM categories WHERE slug = 'electronics'), 'https://example.com/images/headphones.jpg', TRUE, TRUE),
                        ('T-Shirt', 'Comfortable cotton t-shirt.', 19.99,
                         (SELECT id FROM categories WHERE slug = 'clothing'), 'https://example.com/images/tshirt.jpg', TRUE, TRUE)
                    ON CONFLICT (name) DO NOTHING;
                """)
                test_password = "testpassword"
                hashed_password = hash_password(test_password)
                await conn.execute("""
                    INSERT INTO users (email, hashed_password, full_name, role, is_active, is_superuser, email_verified, wallet_verified)
                    VALUES ('test@example.com', $1, 'Test User', 'SHOPPER', true, false, true, false) -- Assuming test user has verified email
                    ON CONFLICT (email) DO NOTHING;
                """, hashed_password)
                await conn.execute("""
                    INSERT INTO product_variants (product_id, attributes, sku, specific_price, stock_quantity, image_url) VALUES
                        ((SELECT id FROM products WHERE name = 'Wireless Headphones'), '{"Color": "Black"}', 'WH-BLK-001', NULL, 50, '/images/headphones_black.jpg'),
                        ((SELECT id FROM products WHERE name = 'Wireless Headphones'), '{"Color": "White"}', 'WH-WHT-001', 104.99, 30, '/images/headphones_white.jpg'), -- Assuming base price 99.99 + 5.00 specific
                        ((SELECT id FROM products WHERE name = 'T-Shirt'), '{"Size": "M"}', 'TS-M-001', NULL, 100, '/images/tshirt_m.jpg'),
                        ((SELECT id FROM products WHERE name = 'T-Shirt'), '{"Size": "L"}', 'TS-L-001', NULL, 80, '/images/tshirt_l.jpg'),
                        ((SELECT id FROM products WHERE name = 'T-Shirt'), '{"Size": "M", "Color": "Red"}', 'TS-RED-M-001', 21.99, 20, '/images/tshirt_red_m.jpg') -- Assuming base price 19.99 + 2.00 specific
                    ON CONFLICT (sku) DO NOTHING;
                """)
                await conn.execute("COMMIT;")
            except Exception as e:
                print(f"Error inserting initial seed data: {e}")
                # Not raising here to allow tests to run even if seeding fails, 
                # as some tests might not depend on this specific seed data.
                # However, this indicates a potential problem.

        yield fixture_pool # Provide the pool to tests

        # Post-yield cleanup (after all tests in the module have run)
        print("\npytest_conftest: test_db fixture - Post-yield cleanup starting (TRUNCATE tables)...")
        # Truncate tables to leave a clean state for the next module or session, 
        # without requiring DROP privileges for this specific step.
        try:
            async with fixture_pool.acquire() as conn:
                print("pytest_conftest: test_db fixture - Acquired connection for TRUNCATE.")
                await conn.execute("TRUNCATE TABLE products, categories, users, product_variants CASCADE;")
                print("pytest_conftest: test_db fixture - TRUNCATE successful.")
        except Exception as e:
            print(f"pytest_conftest: test_db fixture - ERROR during TRUNCATE: {e!r}")
            # Optionally re-raise if TRUNCATE failure should stop tests hard
        finally:
            print("pytest_conftest: test_db fixture - Connection for TRUNCATE (if acquired) released by 'async with'.")
        print("pytest_conftest: test_db fixture - Post-yield cleanup finished.")
            
    finally:
        print("\npytest_conftest: test_db fixture - Starting 'finally' block for teardown...")
        # Restore original global POOL
        print("pytest_conftest: test_db fixture - Restoring global POOL...")
        POOL = original_global_pool
        print("pytest_conftest: test_db fixture - Global POOL restored.")
        
        # Restore original app.state.pool
        print("pytest_conftest: test_db fixture - Restoring app.state.pool...")
        if original_app_state_pool:
            app.state.pool = original_app_state_pool
        elif hasattr(app.state, 'pool'):
            delattr(app.state, 'pool')
        print("pytest_conftest: test_db fixture - app.state.pool restored.")
        
        # Close the fixture's pool
        print("pytest_conftest: test_db fixture - Attempting to close fixture_pool...")
        try:
            await asyncio.wait_for(fixture_pool.close(), timeout=10.0)
            print("pytest_conftest: test_db fixture - fixture_pool closed successfully.")
        except asyncio.TimeoutError:
            print("pytest_conftest: test_db fixture - ERROR: Timed out waiting for fixture_pool to close. Connections likely leaked.")
            raise # Important to re-raise to fail the test session
        except Exception as e:
            print(f"pytest_conftest: test_db fixture - ERROR: Exception during fixture_pool.close(): {e!r}")
            raise
        print("pytest_conftest: test_db fixture - 'finally' block teardown complete.")

from fastapi_ai_backend.app.db import get_verbose_db_connection_from_pool # Added for verbose_db_conn

@pytest_asyncio.fixture(scope="function")
async def verbose_db_conn(test_db: asyncpg.Pool, request) -> AsyncGenerator[asyncpg.Connection, None]:
    """Fixture to provide a single DB connection with verbose logging for a test function."""
    context_name = f"Test: {request.node.name}"
    async with get_verbose_db_connection_from_pool(test_db, context_name=context_name) as conn:
        yield conn



@pytest_asyncio.fixture(scope="function")
async def auth_client(client: AsyncClient) -> AsyncClient:
    """Fixture to provide an authenticated test client"""
    # Login to get token
    login_data = {
        "email": "test@example.com",
        "password": "testpassword"
    }
    
    # Note: Update this endpoint based on your actual auth endpoint
    response = await client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200, f"Login failed: {response.text}"
    
    token = response.json().get("access_token")
    assert token is not None, "No access token in login response"
    
    # Set the authorization header
    client.headers["Authorization"] = f"Bearer {token}"
    try:
        yield client
    finally:
        print("\npytest_conftest: auth_client fixture - Teardown (post-yield) starting...")
        # Teardown: remove the header (good practice, though TestClient instances are usually fresh)
        if "Authorization" in client.headers:
            del client.headers["Authorization"]
            print("pytest_conftest: auth_client fixture - Authorization header removed.")
        print("pytest_conftest: auth_client fixture - Teardown complete.")

# Add any other common fixtures below

if __name__ == "__main__":
    # This allows running the tests directly with Python
    import sys
    import pytest
    sys.exit(pytest.main(sys.argv[1:]))
