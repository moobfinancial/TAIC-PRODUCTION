"""
MCP tools for the AI Shopping Assistant.
These tools are used by the AI Shopping Assistant to interact with the product service.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from mcp import Tool

from ..models.product import Product
from ..db import get_db_connection, release_db_connection
import asyncpg


class ProductSearchInput(BaseModel):
    """Input model for the product search tool."""
    query: str = Field(..., description="The search query for products")
    category: Optional[str] = Field(None, description="Optional category filter")
    price_min: Optional[float] = Field(None, description="Minimum price filter")
    price_max: Optional[float] = Field(None, description="Maximum price filter")
    limit: Optional[int] = Field(20, description="Maximum number of results to return")


class ProductSearchOutput(BaseModel):
    """Output model for the product search tool."""
    products: List[Product] = Field(default_factory=list, description="List of products matching the search criteria")
    total_count: int = Field(..., description="Total number of products matching the search criteria")


class SearchProductsTool(Tool):
    """Tool for searching products based on query and filters."""
    name: str = "search_products"
    description: str = "Search for products based on keywords, category, and price range"
    inputSchema: dict = ProductSearchInput.model_json_schema()
    
    async def _arun(self, query: str, category: Optional[str] = None, 
                   price_min: Optional[float] = None, price_max: Optional[float] = None,
                   limit: int = 20) -> str:
        """
        Search for products based on the provided criteria.
        
        Args:
            query: Search keywords
            category: Optional category filter
            price_min: Optional minimum price
            price_max: Optional maximum price
            limit: Maximum number of results to return
            
        Returns:
            A formatted string with the search results
        """
        conn = None
        try:
            conn = await get_db_connection()
            
            # Build the SQL query
            sql_select = """
                SELECT 
                    p.id, p.name, p.description, p.price, p.image_url,
                    c.name as category, p.data_ai_hint, p.stock_quantity
                FROM products p
                LEFT JOIN categories c ON p.platform_category_id = c.id
                WHERE p.approval_status = 'approved' AND p.is_active = TRUE
            """
            
            params = []
            param_idx = 1
            
            # Add search query condition
            if query:
                sql_select += f" AND (p.name ILIKE ${param_idx} OR p.description ILIKE ${param_idx})"
                params.append(f"%{query}%")
                param_idx += 1
                
            # Add category filter
            if category:
                sql_select += f" AND c.name ILIKE ${param_idx}"
                params.append(f"%{category}%")
                param_idx += 1
                
            # Add price filters
            if price_min is not None:
                sql_select += f" AND p.price >= ${param_idx}"
                params.append(price_min)
                param_idx += 1
                
            if price_max is not None:
                sql_select += f" AND p.price <= ${param_idx}"
                params.append(price_max)
                param_idx += 1
                
            # Add ordering and limit
            sql_select += " ORDER BY p.name ASC"
            sql_select += f" LIMIT ${param_idx}"
            params.append(limit)
            
            # Execute the query
            results = await conn.fetch(sql_select, *params)
            
            # Count total matching products (without limit)
            count_sql = """
                SELECT COUNT(*) 
                FROM products p
                LEFT JOIN categories c ON p.platform_category_id = c.id
                WHERE p.approval_status = 'approved' AND p.is_active = TRUE
            """
            
            # Add the same conditions as the main query (except LIMIT)
            count_params = []
            count_param_idx = 1
            
            if query:
                count_sql += f" AND (p.name ILIKE ${count_param_idx} OR p.description ILIKE ${count_param_idx})"
                count_params.append(f"%{query}%")
                count_param_idx += 1
                
            if category:
                count_sql += f" AND c.name ILIKE ${count_param_idx}"
                count_params.append(f"%{category}%")
                count_param_idx += 1
                
            if price_min is not None:
                count_sql += f" AND p.price >= ${count_param_idx}"
                count_params.append(price_min)
                count_param_idx += 1
                
            if price_max is not None:
                count_sql += f" AND p.price <= ${count_param_idx}"
                count_params.append(price_max)
                count_param_idx += 1
                
            total_count = await conn.fetchval(count_sql, *count_params)
            
            # Format the results
            if not results:
                return f"No products found matching '{query}'."
            
            products_text = "\n\n".join([
                f"**{row['name']}**\n"
                f"Price: {row['price']} TAIC\n"
                f"Category: {row['category'] or 'Uncategorized'}\n"
                f"Description: {row['description'][:100]}..." if row['description'] and len(row['description']) > 100 
                else f"Description: {row['description'] or 'No description available'}"
                for row in results
            ])
            
            return f"Found {total_count} products matching '{query}'. Here are the top {len(results)} results:\n\n{products_text}"
            
        except Exception as e:
            print(f"Error in search_products tool: {str(e)}")
            return f"An error occurred while searching for products: {str(e)}"
        finally:
            if conn:
                await release_db_connection(conn)


class GetCategoriesInput(BaseModel):
    """Input model for the get categories tool."""
    parent_id: Optional[int] = Field(None, description="Optional parent category ID to filter by")


class GetCategoriesOutput(BaseModel):
    """Output model for the get categories tool."""
    categories: List[Dict[str, Any]] = Field(..., description="List of categories")


class GetCategoriesTool(Tool):
    """Tool for retrieving product categories."""
    name: str = "get_categories"
    description: str = "Get a list of product categories, optionally filtered by parent category"
    inputSchema: dict = GetCategoriesInput.model_json_schema()
    
    async def _arun(self, parent_id: Optional[int] = None) -> str:
        """
        Get a list of product categories.
        
        Args:
            parent_id: Optional parent category ID to filter by
            
        Returns:
            A formatted string with the categories
        """
        conn = None
        try:
            conn = await get_db_connection()
            
            sql = """
                SELECT id, name, slug, description, parent_category_id
                FROM categories
            """
            
            params = []
            if parent_id is not None:
                sql += " WHERE parent_category_id = $1"
                params.append(parent_id)
                
            sql += " ORDER BY name ASC"
            
            results = await conn.fetch(sql, *params)
            
            if not results:
                return "No categories found."
                
            categories_text = "\n".join([
                f"• {row['name']}" + (f" - {row['description']}" if row['description'] else "")
                for row in results
            ])
            
            return f"Available categories:\n\n{categories_text}"
            
        except Exception as e:
            print(f"Error in get_categories tool: {str(e)}")
            return f"An error occurred while retrieving categories: {str(e)}"
        finally:
            if conn:
                await release_db_connection(conn)


# List of all tools to be registered with the MCP server
mcp_tools = [
    SearchProductsTool(),
    GetCategoriesTool(),
]
