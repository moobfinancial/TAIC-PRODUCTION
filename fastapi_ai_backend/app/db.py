import asyncpg
import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

DATABASE_URL = os.getenv("POSTGRES_URL")

pool: Optional[asyncpg.Pool] = None

async def create_pool():
    global pool
    if not DATABASE_URL:
        raise ValueError("POSTGRES_URL environment variable not set.")
    pool = await asyncpg.create_pool(DATABASE_URL)
    # You can test the connection here if you want, e.g., by fetching the current time
    async with pool.acquire() as connection:
        db_time = await connection.fetchval('SELECT NOW()')
        print(f"Database connection pool created. DB time: {db_time}")

async def close_pool():
    global pool
    if pool:
        await pool.close()
        print("Database connection pool closed.")

async def get_db_pool() -> asyncpg.Pool:
    if pool is None:
        # This is a fallback, ideally pool is created at app startup
        # In a real app, you might want to raise an error or handle this more gracefully
        # if the pool isn't initialized as expected.
        print("Warning: Database pool accessed before explicit creation. Creating now.")
        await create_pool()
    return pool
