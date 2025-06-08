import psycopg2
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor # To get results as dictionaries
from contextlib import contextmanager
from fastapi import HTTPException, Depends
from typing import Iterator, Any
from ..core.config import settings # Use relative import

db_pool = None

def initialize_db_pool():
    global db_pool
    if db_pool is None: # Ensure pool is initialized only once
        try:
            print(f"Attempting to create database connection pool with DSN: {settings.DATABASE_URL}")
            db_pool = SimpleConnectionPool(minconn=1, maxconn=20, dsn=settings.DATABASE_URL)

            # Test connection on startup
            conn_test = db_pool.getconn()
            print("Successfully connected to the database via pool for initial test.")
            db_pool.putconn(conn_test)
            print("Database connection pool initialized successfully.")
        except Exception as e:
            print(f"FATAL: Failed to connect to the database and initialize pool: {e}")
            # In a real app, you might want to exit or have a retry mechanism
            # For now, db_pool will remain None, and get_db will raise errors.
            db_pool = None

# Call initialization when this module is loaded.
# This is a simple way to ensure it runs on app startup.
# For more complex apps, consider explicit startup events in FastAPI (main.py).
initialize_db_pool()

@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    if db_pool is None:
        print("ERROR: Database pool is not initialized.")
        raise HTTPException(status_code=503, detail="Database service unavailable. Pool not initialized.")

    connection = None
    try:
        connection = db_pool.getconn()
        yield connection
    except psycopg2.Error as e: # Catch psycopg2 specific errors
        print(f"Database connection error (psycopg2.Error): {e}")
        # Depending on the error, you might want to rollback if a transaction was started
        # For a simple getconn, rollback might not be applicable here yet.
        raise HTTPException(status_code=503, detail=f"Database connection error: {e}")
    except Exception as e:
        print(f"Unexpected error getting database connection: {e}")
        raise HTTPException(status_code=503, detail=f"Unexpected database connection error: {e}")
    finally:
        if connection:
            db_pool.putconn(connection)

# FastAPI dependency to get a database cursor
def get_db() -> Iterator[psycopg2.extensions.cursor]:
    try:
        with get_db_connection() as conn:
            # Using RealDictCursor to get results as dictionaries (column_name: value)
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                yield cursor
            conn.commit() # Commit changes made during the request using this cursor
    except HTTPException: # Re-raise HTTPExceptions from get_db_connection
        raise
    except psycopg2.Error as db_err: # Catch psycopg2 specific errors during cursor/commit
        print(f"Database operation error (psycopg2.Error in get_db): {db_err}")
        # Attempt to rollback if connection was established and an error occurred
        # This is a simplistic rollback; complex transactions need careful handling in services/routes
        if 'conn' in locals() and conn:
            try:
                conn.rollback()
                print("Transaction rolled back due to error.")
            except Exception as rb_err:
                print(f"Error during rollback: {rb_err}")
        raise HTTPException(status_code=500, detail=f"Database operation error: {db_err}")
    except Exception as e:
        print(f"Unhandled error in get_db dependency: {e}")
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {e}")

# Example usage (for testing, can be removed or put in a test file)
# async def test_db_connection(db_cursor: psycopg2.extensions.cursor = Depends(get_db)):
#     try:
#         db_cursor.execute("SELECT 1 AS test_col;")
#         result = db_cursor.fetchone()
#         if result and result['test_col'] == 1:
#             return {"status": "Database connection successful", "result": result}
#         else:
#             raise HTTPException(status_code=500, detail="Database connection test failed.")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"DB test error: {str(e)}")
