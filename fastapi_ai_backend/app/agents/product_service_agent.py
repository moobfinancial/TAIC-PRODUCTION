from typing import List, Optional, Dict, Any, TypeVar, Generic
from pydantic import BaseModel, HttpUrl
from mcp.server.fastmcp.server import FastMCP, Context as MCPContext, ServerSession, Request

# Define type variables for the Context generic
ServerSessionT = TypeVar('ServerSessionT', bound=ServerSession)
RequestT = TypeVar('RequestT', bound=Request)

# Create a concrete context type with 2 type parameters
ToolContext = MCPContext[ServerSessionT, RequestT] if 'ServerSessionT' in locals() else Any
from ..models.product import Product, ProductVariant, ListProductsToolInput
from ..models.category import CategoryInfo # Added for the new tool
from ..db import get_db_connection, release_db_connection
import asyncpg
import json # For handling JSONB parameters

# Initialize the FastMCP server for the Product Service
product_service_mcp = FastMCP(
    name="ProductService",
    description="MCP server for managing and retrieving product information.",
    version="0.1.0",
)

@product_service_mcp.tool(
    name="get_all_products",
    description="Retrieves a list of all available products from the database, optionally filtered by various criteria including price range and attributes."
)
async def get_all_products(tool_input: ListProductsToolInput, ctx: Optional[ToolContext] = None) -> List[Product]:
    """
    MCP Tool to get a list of products from the database.
    Filters by query, category, price range, and variant attributes.
    Fetches variants for products that have them.
    """
    print(f"[ProductService] Received call to get_all_products with input: {tool_input.model_dump_json(indent=2)}")

    conn: Optional[asyncpg.Connection] = None
    fetched_products: List[Product] = []

    try:
        conn = await get_db_connection()

        sql_select_clause = """
            SELECT DISTINCT
                p.id, p.name, p.description, p.price, p.image_url,
                c.name as category_name,
                p.platform_category_id,
                p.approval_status, p.merchant_id, p.has_variants,
                p.source, p.original_cj_product_id,
                p.is_active, p.data_ai_hint
        """
        # Using LEFT JOIN for categories, so products without a category are still included (category_name will be NULL)
        sql_from_clause = " FROM products p LEFT JOIN categories c ON p.platform_category_id = c.id"

        # Initialize WHERE conditions and parameters for dynamic query building
        sql_where_conditions = ["p.approval_status = 'approved'", "p.is_active = TRUE"]
        params = []
        param_idx = 1 # For positional parameters $1, $2, ...

        if tool_input.query:
            sql_where_conditions.append(f"(p.name ILIKE ${param_idx} OR p.description ILIKE ${param_idx})")
            params.append(f"%{tool_input.query}%")
            param_idx += 1

        if tool_input.category:
            sql_where_conditions.append(f"c.name ILIKE ${param_idx}")
            params.append(f"%{tool_input.category}%")
            param_idx += 1

        # Price filtering
        price_conditions = []
        if tool_input.price_min is not None:
            price_conditions.append(f"p.price >= ${param_idx}")
            params.append(tool_input.price_min)
            param_idx += 1
        if tool_input.price_max is not None:
            price_conditions.append(f"p.price <= ${param_idx}")
            params.append(tool_input.price_max)
            param_idx += 1

        if price_conditions:
            # Condition for products without variants
            no_variants_price_filter = f"(p.has_variants = FALSE AND {' AND '.join(price_conditions)})"

            # Condition for products with variants (checking their specific_price)
            # Re-adjust parameter indices for the subquery if price_min/max are used
            variant_price_subquery_conditions = []
            sub_params_for_variants_price = []
            if tool_input.price_min is not None:
                variant_price_subquery_conditions.append(f"pv.specific_price >= ${param_idx}")
                params.append(tool_input.price_min)
                sub_params_for_variants_price.append(tool_input.price_min) # these params are for the main query already
                param_idx +=1
            if tool_input.price_max is not None:
                variant_price_subquery_conditions.append(f"pv.specific_price <= ${param_idx}")
                params.append(tool_input.price_max)
                sub_params_for_variants_price.append(tool_input.price_max) # these params are for the main query already
                param_idx += 1

            # Need to construct the EXISTS subquery carefully with its own parameter indexing if they were different
            # However, since we append all params to one list, the main query's param_idx is sufficient.
            # The parameters for the subquery are already added to the main `params` list.
            # We need to make sure the dollar signs in the subquery correctly map to these.
            # The current approach of incrementing param_idx globally for all params added to the `params` list is correct.

            # Let's re-think the parameter indexing for the subquery to be sure.
            # The main params list is [..., query_param, category_param, price_min_param_for_no_variants, price_max_param_for_no_variants, price_min_param_for_variants, price_max_param_for_variants, attr_filter_param]
            # The `price_conditions` used `param_idx` which was already incremented past query/category.
            # The variant subquery also needs to use `param_idx` that corresponds to the correct price_min/max in the `params` list.

            # Simplified logic: if price filters are present, apply them.
            # The $ indices in the subquery need to match the positions in the *overall* params list.

            # Let's build the subquery price conditions using fresh param indices for clarity within the subquery string,
            # but add the actual values to the main `params` list and use the main `param_idx`.

            variant_price_filter_parts = []
            if tool_input.price_min is not None:
                variant_price_filter_parts.append(f"pv.specific_price >= ${param_idx - (2 if tool_input.price_max is not None else 1)}") # Correctly reference earlier param
            if tool_input.price_max is not None:
                variant_price_filter_parts.append(f"pv.specific_price <= ${param_idx - 1}") # Correctly reference earlier param

            if variant_price_filter_parts:
                 has_variants_price_filter = f"""
                    (p.has_variants = TRUE AND EXISTS (
                        SELECT 1 FROM product_variants pv
                        WHERE pv.product_id = p.id AND {' AND '.join(variant_price_filter_parts)}
                    ))
                """
                 # Combine no_variants and has_variants price filters with OR
                 sql_where_conditions.append(f"({no_variants_price_filter} OR {has_variants_price_filter})")


        # Attribute filtering (only for products with variants)
        if tool_input.attributes_filter:
            # attributes_filter is Dict[str, str]. Convert to JSON string for query.
            # PostgreSQL's @> operator expects a JSONB on the right side.
            attributes_json_str = json.dumps(tool_input.attributes_filter)
            sql_where_conditions.append(f"""
                (p.has_variants = TRUE AND EXISTS (
                    SELECT 1 FROM product_variants pv
                    WHERE pv.product_id = p.id AND pv.attributes @> ${param_idx}::jsonb
                ))
            """)
            params.append(attributes_json_str)
            param_idx += 1

        # Construct final query
        sql_query = sql_select_clause + sql_from_clause
        if sql_where_conditions:
            sql_query += " WHERE " + " AND ".join(sql_where_conditions)
        sql_query += " ORDER BY p.name ASC"

        print(f"[ProductService] Executing product query: {sql_query} with params: {params}")
        db_product_rows = await conn.fetch(sql_query, *params)

        for row_data in db_product_rows:
            product_dict = dict(row_data)
            product_dict['category'] = product_dict.pop('category_name', None)
            product_dict['stock_quantity'] = 0 # Default, will be updated by variants if they exist

            product_variants_list: List[ProductVariant] = []
            if product_dict.get('has_variants'):
                variant_sql = """
                    SELECT id, product_id, sku, attributes, specific_price, stock_quantity, image_url
                    FROM product_variants
                    WHERE product_id = $1 ORDER BY id ASC
                """
                # No need to re-apply attribute/price filters here for variants,
                # as the main query already ensures the product matches.
                # We fetch all variants of a matched product.
                db_variant_rows = await conn.fetch(variant_sql, product_dict['id'])
                current_product_total_stock = 0
                for var_row in db_variant_rows:
                    variant_dict = dict(var_row)
                    product_variants_list.append(ProductVariant(**variant_dict))
                    current_product_total_stock += variant_dict.get('stock_quantity', 0)
                product_dict['stock_quantity'] = current_product_total_stock

            product_dict['variants'] = product_variants_list
            fetched_products.append(Product(**product_dict))

        print(f"[ProductService] Returning {len(fetched_products)} products from database.")
        return fetched_products

    except Exception as e:
        print(f"[ProductService] Error fetching products from database: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        if conn:
            await release_db_connection(conn)


@product_service_mcp.tool(
    name="list_all_categories",
    description="Retrieves a list of all available product categories."
)
async def list_all_categories(ctx: Optional[ToolContext] = None) -> List[CategoryInfo]:
    """
    MCP Tool to get a list of all categories from the database.
    """
    print(f"[ProductService] Received call to list_all_categories")

    conn: Optional[asyncpg.Connection] = None
    fetched_categories: List[CategoryInfo] = []

    try:
        conn = await get_db_connection()

        sql_query = """
            SELECT id, name, slug, description, parent_category_id
            FROM categories
            ORDER BY name ASC;
        """

        print(f"[ProductService] Executing category query: {sql_query}")
        db_category_rows = await conn.fetch(sql_query)

        for row_data in db_category_rows:
            category_dict = dict(row_data)
            fetched_categories.append(CategoryInfo(**category_dict))

        print(f"[ProductService] Returning {len(fetched_categories)} categories from database.")
        return fetched_categories

    except Exception as e:
        print(f"[ProductService] Error fetching categories from database: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        if conn:
            await release_db_connection(conn)

# Example Test Code (Commented out, can be used for direct testing if needed)
# if __name__ == "__main__":
#     import asyncio
#     from app.db import init_db_pool, close_db_pool

#     async def main_test():
#         # ... (test setup) ...
#         # Example with new filters:
#         # test_input_price_range = ListProductsToolInput(price_min=20.0, price_max=30.0)
#         # test_input_attributes = ListProductsToolInput(attributes_filter={"color": "Red", "size": "S"})
#         # ... (call get_all_products) ...
#         # ... (cleanup) ...
#     asyncio.run(main_test())
