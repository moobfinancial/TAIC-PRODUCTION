import logging
import json
from typing import Optional, Dict, Any
import asyncpg
from datetime import datetime # Not strictly needed for query, but good for type hints if returning data

logger = logging.getLogger(__name__)

async def record_admin_audit_log(
    db_conn: asyncpg.Connection,
    admin_username: str, # In a real app, this would come from authenticated user context
    action: str,
    target_entity_type: Optional[str] = None,
    target_entity_id: Optional[str] = None, # Changed to str to match product_id type and general usage
    details: Optional[Dict[str, Any]] = None
):
    """
    Records an administrative action in the admin_audit_log table.

    Args:
        db_conn: Active database connection.
        admin_username: The username of the admin performing the action.
        action: A string describing the action performed (e.g., "product_approved").
        target_entity_type: Optional type of the entity being acted upon (e.g., "product").
        target_entity_id: Optional ID of the entity being acted upon.
        details: Optional dictionary containing additional context about the action.
    """
    query = """
        INSERT INTO admin_audit_log (admin_username, action, target_entity_type, target_entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
    """
    # Ensure details is None or a JSON string for the database
    details_jsonb = json.dumps(details) if details is not None else None

    try:
        await db_conn.execute(
            query,
            admin_username,
            action,
            target_entity_type,
            target_entity_id,
            details_jsonb # Pass the serialized JSON string or None
        )
        logger.info(
            f"Admin audit log recorded: Admin='{admin_username}', Action='{action}', "
            f"Target='{target_entity_type}:{target_entity_id}', Details='{details_jsonb if details else '{}'}'"
        )
    except asyncpg.exceptions.UndefinedTableError:
        logger.error(
            "CRITICAL: 'admin_audit_log' table does not exist. Audit logging failed. "
            "Please ensure database schema is up to date."
        )
        # Depending on policy, you might re-raise this or just log it.
        # For now, just log and allow the original operation to proceed if possible.
    except Exception as e:
        logger.error(
            f"Failed to record admin audit log for action '{action}' by '{admin_username}'. Error: {e}"
        )
        # Also log details that failed to be recorded for potential manual recovery/investigation
        logger.error(
            f"Failed audit log data: Target='{target_entity_type}:{target_entity_id}', Details='{details_jsonb if details else '{}'}'"
        )
        # Do not re-raise here to prevent the original admin action from failing if only logging fails.
        # The success of the primary operation is more important.

# Example usage (for testing this module directly - requires DB setup)
# if __name__ == "__main__":
#     import asyncio
#     from app.db import init_db_pool, get_db_connection, release_db_connection, close_db_pool

#     async def main():
#         await init_db_pool()
#         conn = None
#         try:
#             conn = await get_db_connection()
#             async with conn.transaction(): # Use transaction for testing inserts
#                 await record_admin_audit_log(
#                     db_conn=conn,
#                     admin_username="test_admin",
#                     action="test_action_logged",
#                     target_entity_type="test_entity",
#                     target_entity_id="test_id_123",
#                     details={"reason": "This is a test log entry.", "value_changed": "from A to B"}
#                 )
#                 print("Test audit log entry attempted.")

#                 # Example of an entry without details or target_entity
#                 await record_admin_audit_log(
#                     db_conn=conn,
#                     admin_username="system_task",
#                     action="system_cleanup_initiated"
#                 )
#                 print("Test audit log entry (system) attempted.")
#                 # To actually commit, the transaction would need to exit successfully.
#                 # For a real test, you might want to query the table after this.
#                 # await conn.execute("ROLLBACK") # Or commit if you want to keep test data
#         except Exception as e:
#             print(f"An error occurred during test: {e}")
#         finally:
#             if conn:
#                 await release_db_connection(conn)
#             await close_db_pool()

#     asyncio.run(main())
