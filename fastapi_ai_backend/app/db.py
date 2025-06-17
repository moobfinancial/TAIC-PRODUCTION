import asyncpg
import os
from dotenv import load_dotenv
from typing import Optional, cast

load_dotenv()

# Primary connection method: Use DATABASE_URL if set
DATABASE_URL = os.getenv("DATABASE_URL")

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

from contextlib import asynccontextmanager # Add this import if not already present at the top
from typing import AsyncGenerator # Add this import if not already present at the top

@asynccontextmanager
async def get_verbose_db_connection(context_name: str = "UnknownContext") -> AsyncGenerator[asyncpg.Connection, None]:
    """
    Acquires a database connection from the global POOL with verbose logging,
    and ensures it's released. To be used with 'async with'.
    """
    global POOL
    if POOL is None:
        print(f"DB Context [{context_name}]: Global POOL is None. Attempting to initialize.")
        await init_db_pool()
        if POOL is None:
            raise ConnectionError(f"DB Context [{context_name}]: Failed to initialize global database pool.")

    current_pool = cast(asyncpg.Pool, POOL)
    connection: Optional[asyncpg.Connection] = None
    conn_id_str = 'N/A'
    try:
        free_before = current_pool.get_freesize()
        size_before = current_pool.get_size()
        print(f"DB Context [{context_name}]: Acquiring connection from global pool {current_pool} (ID: {id(current_pool)}). Pool state: Size={size_before}, Free={free_before}")
        
        connection = await current_pool.acquire()
        conn_id_str = str(id(connection))
        
        free_after_acquire = current_pool.get_freesize()
        print(f"DB Context [{context_name}]: Acquired connection {connection} (ID: {conn_id_str}) from global pool {current_pool} (ID: {id(current_pool)}). Pool free: {free_after_acquire}")
        
        yield connection
        
        print(f"DB Context [{context_name}]: Returned from yield for connection {connection} (ID: {conn_id_str}).")
    except Exception as e:
        print(f"DB Context [{context_name}]: Exception with connection {connection} (ID: {conn_id_str}): {e!r}")
        raise
    finally:
        if connection:
            if not connection.is_closed():
                free_before_release = current_pool.get_freesize()
                print(f"DB Context [{context_name}]: Releasing connection {connection} (ID: {conn_id_str}) to global pool {current_pool} (ID: {id(current_pool)}). Pool free before release: {free_before_release}")
                
                await current_pool.release(connection)
                
                free_after_release = current_pool.get_freesize()
                print(f"DB Context [{context_name}]: Released connection {connection} (ID: {conn_id_str}) to global pool {current_pool} (ID: {id(current_pool)}). Pool free after release: {free_after_release}")
            else:
                print(f"DB Context [{context_name}]: Connection {connection} (ID: {conn_id_str}) was already closed. Not releasing explicitly.")
        else:
            print(f"DB Context [{context_name}]: No connection was acquired from global pool, nothing to release.")

@asynccontextmanager
async def get_verbose_db_connection_from_pool(pool_to_use: asyncpg.Pool, context_name: str = "UnknownContext") -> AsyncGenerator[asyncpg.Connection, None]:
    """
    Acquires a database connection from a *specific* POOL with verbose logging,
    and ensures it's released. To be used with 'async with'. For tests.
    """
    if pool_to_use is None:
        raise ValueError(f"DB Context [{context_name}]: Provided pool_to_use is None.")

    connection: Optional[asyncpg.Connection] = None
    conn_id_str = 'N/A'
    try:
        free_before = pool_to_use._queue.qsize()
        size_before = pool_to_use.get_size()
        print(f"DB Context [{context_name}]: Acquiring connection from specific pool {pool_to_use} (ID: {id(pool_to_use)}). Pool state: Size={size_before}, Free={free_before}")
        
        connection = await pool_to_use.acquire()
        conn_id_str = str(id(connection))
        
        free_after_acquire = pool_to_use._queue.qsize()
        print(f"DB Context [{context_name}]: Acquired connection {connection} (ID: {conn_id_str}) from specific pool {pool_to_use} (ID: {id(pool_to_use)}). Pool free: {free_after_acquire}")
        
        yield connection
        
        print(f"DB Context [{context_name}]: Returned from yield for connection {connection} (ID: {conn_id_str}).")
    except Exception as e:
        print(f"DB Context [{context_name}]: Exception with connection {connection} (ID: {conn_id_str}): {e!r}")
        raise
    finally:
        if connection:
            if not connection.is_closed():
                free_before_release = pool_to_use._queue.qsize()
                print(f"DB Context [{context_name}]: Releasing connection {connection} (ID: {conn_id_str}) to specific pool {pool_to_use} (ID: {id(pool_to_use)}). Pool free before release: {free_before_release}")
                
                await pool_to_use.release(connection)
                
                free_after_release = pool_to_use._queue.qsize()
                print(f"DB Context [{context_name}]: Released connection {connection} (ID: {conn_id_str}) to specific pool {pool_to_use} (ID: {id(pool_to_use)}). Pool free after release: {free_after_release}")
            else:
                print(f"DB Context [{context_name}]: Connection {connection} (ID: {conn_id_str}) was already closed. Not releasing explicitly.")
        else:
            print(f"DB Context [{context_name}]: No connection was acquired from specific pool, nothing to release.")

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
