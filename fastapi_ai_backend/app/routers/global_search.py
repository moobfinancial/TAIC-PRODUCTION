import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status, Query
import asyncpg

from app.models.search_models import SearchResultItem, GlobalSearchResponse
from app.db import get_db_connection, release_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Global Search"],
    # Actual prefix will be /api/search (from main.py)
)

@router.get(
    "/",
    response_model=GlobalSearchResponse,
    summary="Perform Global Search",
    description="Searches across products, merchant stores, and categories based on a query string."
)
async def global_search(
    q: str = Query(..., min_length=1, description="The search query string."),
    limit_per_type: int = Query(5, ge=1, le=20, description="Maximum number of results to return for each entity type (products, stores, categories)."),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    results: List[SearchResultItem] = []
    counts: Dict[str, int] = {"products": 0, "merchant_stores": 0, "categories": 0}
    search_term = f"%{q}%" # For ILIKE

    try:
        # Search Products
        product_rows = await conn.fetch(
            """
            SELECT id, name, description, image_url
            FROM products
            WHERE (name ILIKE $1 OR description ILIKE $1)
            AND is_active = TRUE AND approval_status = 'approved'
            LIMIT $2
            """,
            search_term, limit_per_type
        )
        for row in product_rows:
            results.append(SearchResultItem(
                type="product",
                id=row['id'],
                name=row['name'],
                description=row['description'],
                url=f"/products/{row['id']}", # Conceptual frontend URL
                image_url=row['image_url']
            ))
        counts["products"] = len(product_rows)

        # Search Merchant Stores
        store_rows = await conn.fetch(
            """
            SELECT merchant_id, store_name, store_description, logo_url, store_slug
            FROM merchant_store_profiles
            WHERE store_name ILIKE $1 OR store_description ILIKE $1
            LIMIT $2
            """,
            search_term, limit_per_type
        )
        for row in store_rows:
            results.append(SearchResultItem(
                type="merchant_store",
                id=row['merchant_id'],
                name=row['store_name'],
                description=row['store_description'],
                url=f"/store/{row['store_slug']}", # Conceptual frontend URL
                image_url=row['logo_url']
            ))
        counts["merchant_stores"] = len(store_rows)

        # Search Categories
        category_rows = await conn.fetch(
            """
            SELECT id, name, description
            FROM categories
            WHERE (name ILIKE $1 OR description ILIKE $1)
            AND is_active = TRUE
            LIMIT $2
            """,
            search_term, limit_per_type
        )
        for row in category_rows:
            results.append(SearchResultItem(
                type="category",
                id=str(row['id']), # ID is int in DB, model expects str
                name=row['name'],
                description=row['description'],
                url=f"/categories/{row['id']}", # Conceptual frontend URL
                # Categories don't have a dedicated image_url in current schema
            ))
        counts["categories"] = len(category_rows)

        # Note: Results are currently ordered by type (all products, then all stores, then all categories).
        # A more sophisticated ranking/mixing of results would require more complex logic or a dedicated search index.

        return GlobalSearchResponse(query=q, results=results, counts=counts)

    except Exception as e:
        logger.error(f"Error during global search for query '{q}': {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Don't want to expose raw error details usually, but for debugging in dev it can be helpful.
        # In prod, a generic "Search failed" message is better.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during the search operation."
        )
    finally:
        if conn: # conn might not be assigned if get_db_connection itself fails.
            await release_db_connection(conn)
