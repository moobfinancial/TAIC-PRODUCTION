import logging
from fastapi import APIRouter, HTTPException, Depends, status
import asyncpg
from decimal import Decimal # For handling database decimal types accurately

from app.models.admin_models import DashboardStats
from app.db import get_db_connection, release_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Admin - Dashboard Data"],
    # prefix="/api/admin/dashboard" # Prefix will be set in main.py
    # TODO: Add dependencies=[Depends(get_current_admin_user)] for actual auth
)

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """
    Retrieve aggregated statistics for the Admin Dashboard.
    Gracefully handles errors for individual stats, returning 0 or default if a query fails.
    """
    conn: Optional[asyncpg.Connection] = None
    stats = DashboardStats() # Initialize with defaults

    try:
        conn = await get_db_connection()

        # Total Shoppers
        try:
            total_shoppers_val = await conn.fetchval("SELECT COUNT(id) FROM users WHERE role = 'SHOPPER'")
            stats.total_shoppers = total_shoppers_val if total_shoppers_val is not None else 0
        except (asyncpg.exceptions.UndefinedTableError, asyncpg.exceptions.UndefinedColumnError) as e:
            logger.warning(f"Could not fetch total shoppers (table/column missing: users.role): {e}")
            stats.total_shoppers = 0 # Default on error
        except Exception as e:
            logger.error(f"Error fetching total shoppers: {e}")
            stats.total_shoppers = 0 # Default on other errors

        # Total Merchants
        try:
            total_merchants_val = await conn.fetchval("SELECT COUNT(id) FROM users WHERE role = 'MERCHANT'")
            stats.total_merchants = total_merchants_val if total_merchants_val is not None else 0
        except (asyncpg.exceptions.UndefinedTableError, asyncpg.exceptions.UndefinedColumnError) as e:
            logger.warning(f"Could not fetch total merchants (table/column missing: users.role): {e}")
            stats.total_merchants = 0
        except Exception as e:
            logger.error(f"Error fetching total merchants: {e}")
            stats.total_merchants = 0

        # Products Pending Approval
        try:
            products_pending_val = await conn.fetchval("SELECT COUNT(id) FROM products WHERE approval_status = 'pending'")
            stats.products_pending_approval = products_pending_val if products_pending_val is not None else 0
        except (asyncpg.exceptions.UndefinedTableError, asyncpg.exceptions.UndefinedColumnError) as e:
            logger.warning(f"Could not fetch products pending approval (table/column missing: products.approval_status): {e}")
            stats.products_pending_approval = 0
        except Exception as e:
            logger.error(f"Error fetching products pending approval: {e}")
            stats.products_pending_approval = 0

        # Total Sales Volume
        try:
            # COALESCE ensures 0.0 is returned if SUM is NULL (no completed orders)
            # Explicitly cast to float after fetching, as SUM(DECIMAL) might return Decimal
            total_sales_volume_val = await conn.fetchval("SELECT COALESCE(SUM(amount), 0.0) FROM orders WHERE status = 'completed'")
            stats.total_sales_volume = float(total_sales_volume_val) if total_sales_volume_val is not None else 0.0
        except (asyncpg.exceptions.UndefinedTableError, asyncpg.exceptions.UndefinedColumnError) as e:
            logger.warning(f"Could not fetch total sales volume (table/column missing: orders.amount/status): {e}")
            stats.total_sales_volume = 0.0
        except Exception as e:
            logger.error(f"Error fetching total sales volume: {e}")
            stats.total_sales_volume = 0.0

        # New Users Last 30 Days (Shoppers and Merchants)
        try:
            new_users_val = await conn.fetchval(
                "SELECT COUNT(id) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"
            )
            stats.new_users_last_30_days = new_users_val if new_users_val is not None else 0
        except (asyncpg.exceptions.UndefinedTableError, asyncpg.exceptions.UndefinedColumnError) as e:
            logger.warning(f"Could not fetch new users (table/column missing: users.created_at): {e}")
            stats.new_users_last_30_days = 0
        except Exception as e:
            logger.error(f"Error fetching new users: {e}")
            stats.new_users_last_30_days = 0

        return stats

    except Exception as e_outer:
        # This would catch errors like failure to get DB connection
        logger.error(f"A critical error occurred while fetching dashboard stats: {e_outer}")
        # Return stats with defaults if connection failed partway or initially
        # If conn was never established, stats is already default.
        # If it was established but failed later, partial stats might be there, but better to indicate broader failure.
        # For simplicity, if we reach here, it implies a more general issue than individual query fails.
        # However, individual query errors are handled to return default for that stat.
        # This outer catch is for things like DB connection failure itself.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to retrieve some or all dashboard statistics due to a server error: {e_outer}"
        )
    finally:
        if conn:
            await release_db_connection(conn)
