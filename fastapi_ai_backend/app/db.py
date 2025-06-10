import asyncpg
import os
from dotenv import load_dotenv
from typing import Optional, cast

load_dotenv()

# Primary connection method: Use DATABASE_URL if set
DATABASE_URL = os.getenv("POSTGRES_URL")

# Fallback to individual components if DATABASE_URL is not set
DB_USER = os.getenv("DB_USER", "taic_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "taic_pass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "taic_dev_db")

POOL: Optional[asyncpg.Pool] = None

async def init_db_pool():
    """
    Initializes the database connection pool.
    Uses DATABASE_URL if set, otherwise falls back to individual DB components.
    """
    global POOL
    if POOL is not None:
        print("Database pool already initialized.")
        return

    dsn = DATABASE_URL
    if not dsn:
        if not all([DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME]):
            raise ValueError(
                "Either POSTGRES_URL or all individual DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME "
                "environment variables must be set."
            )
        dsn = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    try:
        POOL = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10) # Added min/max_size
        # Test connection
        async with POOL.acquire() as connection:
            db_time = await connection.fetchval('SELECT NOW()')
            print(f"Database connection pool initialized. DB time: {db_time}")
    except Exception as e:
        print(f"Error initializing database pool: {e}")
        POOL = None # Ensure pool is None if initialization failed
        raise # Re-raise the exception to make startup fail if DB is not available

async def close_db_pool():
    """
    Closes the database connection pool.
    """
    global POOL
    if POOL:
        await POOL.close()
        POOL = None
        print("Database connection pool closed.")

async def get_db_connection() -> asyncpg.Connection:
    """
    Acquires a database connection from the pool.
    Ensures pool is initialized.
    """
    global POOL # Added global POOL to ensure it's accessed correctly
    if POOL is None:
        print("Database pool not initialized. Attempting to initialize now...")
        await init_db_pool()
        if POOL is None: # Check again after attempt
             raise ConnectionError("Failed to initialize database pool. Cannot acquire connection.")
    # The cast is to satisfy mypy that POOL.acquire() will not be called on None
    # because init_db_pool() would have raised an error if POOL remained None.
    return await cast(asyncpg.Pool, POOL).acquire()


async def release_db_connection(connection: asyncpg.Connection):
    """
    Releases a database connection back to the pool.
    """
    global POOL # Added global POOL
    if POOL and connection:
        # Check if the connection is not closed before releasing
        if not connection.is_closed():
            await cast(asyncpg.Pool, POOL).release(connection)
        else:
            # If connection is already closed, do not attempt to release.
            # This might happen if there was an error that closed the connection.
            # The pool will handle creating new connections as needed.
            pass

# For direct pool access if needed by some libraries or advanced scenarios, though get_db_connection is preferred
async def get_db_pool() -> asyncpg.Pool:
    """
    Returns the initialized database pool.
    Ensures pool is initialized.
    """
    global POOL # Added global POOL
    if POOL is None:
        print("Database pool not initialized. Attempting to initialize now...")
        await init_db_pool()
        if POOL is None: # Check again
            raise ConnectionError("Failed to initialize database pool. Cannot get pool.")
    return cast(asyncpg.Pool, POOL)

# Example usage (optional, for direct testing of this module)
if __name__ == "__main__":
    import asyncio

    async def main():
        await init_db_pool()

        conn = None
        try:
            conn = await get_db_connection()
            # Example query
            result = await conn.fetchrow("SELECT $1::TEXT || ' ' || $2::TEXT AS greeting;", "Hello", "AsyncPG")
            print(result['greeting'])

            # Test fetching multiple rows
            users = await conn.fetch("SELECT generate_series(1,3) as id, 'User ' || generate_series(1,3) as name;")
            for user in users:
                print(f"ID: {user['id']}, Name: {user['name']}")

        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            if conn:
                await release_db_connection(conn)
            await close_db_pool()

    asyncio.run(main())
