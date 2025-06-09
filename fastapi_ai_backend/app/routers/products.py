from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import logging

from mcp.server.fastmcp import FastMCP # Correct import for MCP SDK
from app.db import get_db_pool
from ..models.product import Product

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for Tool Inputs ---
class ListProductsToolInput(BaseModel):
    """Input schema for listing products tool."""
    query: Optional[str] = None
    category: Optional[str] = None
    # limit: Optional[int] = 10 # Future: for pagination
    # offset: Optional[int] = 0 # Future: for pagination
    class Config:
        extra = 'forbid'

class GetProductByIdToolInput(BaseModel):
    """Input schema for getting a product by its ID."""
    product_id: str
    class Config:
        extra = 'forbid'

# --- End of Pydantic Schemas for Tool Inputs ---

router = APIRouter(
    prefix="/products",
    tags=["products"],
    responses={404: {"description": "Not found"}},
)

# Create an MCP server instance for product tools
product_mcp_server = FastMCP(
    name="ProductService", 
    title="TAIC Product Service", 
    description="Provides tools to access and manage product information from the TAIC catalog."
)

def _map_row_to_product(row: Dict[str, Any]) -> Product:
    """Helper function to map a database row (dict) to a Product Pydantic model."""
    
    # Handle imageUrl (expected to be a JSON string array of URLs in the DB)
    image_url_db_val = row.get('image_url')
    final_image_url = None
    if image_url_db_val and isinstance(image_url_db_val, str):
        try:
            # Attempt to parse it as a JSON list
            parsed_urls = json.loads(image_url_db_val)
            if isinstance(parsed_urls, list) and parsed_urls:
                # Take the first URL if the list is not empty
                if isinstance(parsed_urls[0], str):
                    final_image_url = parsed_urls[0]
                else:
                    logger.warning(f"First element in image_url list is not a string for product {row.get('cj_product_id')}: {parsed_urls[0]}")
            elif isinstance(parsed_urls, str): # If it was a JSON string that decoded to a single string URL
                final_image_url = parsed_urls
            else:
                logger.warning(f"Parsed image_url for product {row.get('cj_product_id')} is not a non-empty list or a direct string: {parsed_urls}")
        except json.JSONDecodeError:
            # If it's not valid JSON, maybe it's a direct URL string already.
            # Pydantic's HttpUrl will validate. If it's not a valid URL, Pydantic will raise an error.
            # We only log if it looked like it was trying to be JSON (e.g. starts with '[') but failed.
            if image_url_db_val.strip().startswith('['):
                logger.error(f"Failed to parse image_url JSON string for product {row.get('cj_product_id')}: {image_url_db_val}")
            else: # Assume it's a direct URL string
                final_image_url = image_url_db_val
    elif image_url_db_val: # If it's not a string but not None (e.g. if DB somehow returns non-string)
         logger.warning(f"image_url for product {row.get('cj_product_id')} is not a string: {type(image_url_db_val)}. Value: {image_url_db_val}")

    # Handle attributes from variants_json (expected to be a list of variant dicts)
    attributes_data = row.get('variants_json')
    final_attributes = None
    if attributes_data:
        parsed_variants_content = None
        if isinstance(attributes_data, str):
            try:
                parsed_variants_content = json.loads(attributes_data)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse variants_json string for product {row.get('cj_product_id')}: {attributes_data}")
        else: # Assuming it's already parsed by asyncpg (e.g., from JSONB to dict/list)
            parsed_variants_content = attributes_data

        if isinstance(parsed_variants_content, list):
            if parsed_variants_content and isinstance(parsed_variants_content[0], dict):
                final_attributes = parsed_variants_content[0]  # Take the first variant's attributes
            elif not parsed_variants_content:
                logger.info(f"variants_json for product {row.get('cj_product_id')} parsed to an empty list.")
            else:
                logger.warning(f"First item in parsed variants_json list for product {row.get('cj_product_id')} is not a dict: {type(parsed_variants_content[0])}")
        elif isinstance(parsed_variants_content, dict):
            final_attributes = parsed_variants_content # It's already a single dict of attributes
        elif parsed_variants_content is not None:
            logger.warning(f"variants_json for product {row.get('cj_product_id')} parsed to an unexpected type: {type(parsed_variants_content)}")

    return Product(
        id=str(row['cj_product_id']), # This is the long CJ-specific ID
        page_id=str(row['page_id']), # This is the simple ID for Next.js page routes
        name=row['display_name'],
        description=row.get('display_description', ''),
        price=float(row['selling_price']) if row['selling_price'] is not None else 0.0,
        imageUrl=final_image_url, # This will be None or a string URL for Pydantic HttpUrl to validate
        category=row['category_name'],
        merchantId="CJ Dropshipping", # Hardcoded as per plan
        stockQuantity=100, # Placeholder as per plan
        attributes=final_attributes, # This will be None or a dict
        dataAiHint=None # Placeholder as per plan
    )

# --- MCP Tool Definitions --- (These will also serve the REST endpoints)

@product_mcp_server.tool(
    name="get_all_products",
    description="Retrieves a list of all available products from the catalog. Can be filtered by query or category."
)
async def get_all_products_tool(input_data: ListProductsToolInput) -> Dict[str, List[Product]]:
    """MCP Tool: Retrieves all products, with optional filtering."""
    pool = await get_db_pool()
    products: List[Product] = []

    base_query = """
        SELECT
            p.cj_product_id AS page_id,
            p.cj_product_id,
            p.display_name,
            p.display_description,
            p.selling_price,
            p.image_url,
            c.name as category_name,
            p.variants_json
        FROM
            cj_products p
        JOIN
            categories c ON p.platform_category_id = c.id
    """
    conditions = ["p.is_active = TRUE"]
    query_params = []
    param_idx = 1

    if input_data.category:
        conditions.append(f"c.name ILIKE ${param_idx}")
        query_params.append(f"%{input_data.category}%")
        param_idx += 1
    
    if input_data.query:
        conditions.append(f"(p.display_name ILIKE ${param_idx} OR p.display_description ILIKE ${param_idx})")
        query_params.append(f"%{input_data.query}%")
        param_idx += 1

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)
    
    # Future: Add LIMIT and OFFSET for pagination using input_data.limit and input_data.offset
    # base_query += f" ORDER BY p.created_at DESC LIMIT ${param_idx} OFFSET ${param_idx+1}"
    # query_params.extend([input_data.limit, input_data.offset])

    try:
        async with pool.acquire() as conn:
            db_rows = await conn.fetch(base_query, *query_params)
            for row in db_rows:
                products.append(_map_row_to_product(dict(row)))
    except Exception as e:
        logger.error(f"Database error in get_all_products_tool: {e}")
        # Depending on policy, could raise HTTPException or return empty list
        # For now, let agent handle empty list if DB fails, or rely on global error handlers
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return {"output": products}

@product_mcp_server.tool(
    name="get_product_details",
    description="Retrieves detailed information for a specific product using its unique ID."
)
async def get_product_details_tool(input_data: GetProductByIdToolInput) -> Product:
    """MCP Tool: Retrieves a specific product by its ID."""
    pool = await get_db_pool()
    query = """
        SELECT
            p.cj_product_id AS page_id,
            p.cj_product_id,
            p.display_name,
            p.display_description,
            p.selling_price,
            p.image_url,
            c.name as category_name,
            p.variants_json
        FROM
            cj_products p
        JOIN
            categories c ON p.platform_category_id = c.id
        WHERE p.cj_product_id = $1 AND p.is_active = TRUE;
    """
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, input_data.product_id)
    except Exception as e:
        logger.error(f"Database error in get_product_details_tool for ID {input_data.product_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    if not row:
        raise HTTPException(status_code=404, detail=f"Product with ID '{input_data.product_id}' not found or not active.")
    
    return _map_row_to_product(dict(row))

# --- REST API Endpoints --- (Now using the MCP tools' logic)

@router.get("/", response_model=List[Product], summary="List all products (REST)")
async def list_products_rest_endpoint(query: Optional[str] = None, category: Optional[str] = None):
    """
    Retrieve a list of all available products. (REST API Endpoint)
    Supports optional query and category filtering.
    """
    tool_input = ListProductsToolInput(query=query, category=category)
    return await get_all_products_tool(tool_input)

@router.get("/{product_id}", response_model=Product, summary="Get product by ID (REST)")
async def get_product_by_id_rest_endpoint(product_id: str):
    """
    Retrieve a specific product by its ID. (REST API Endpoint)
    """
    tool_input = GetProductByIdToolInput(product_id=product_id)
    return await get_product_details_tool(tool_input)
