from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from pydantic_core import ValidationError as PydanticCoreValidationError
from typing import List, Optional, Dict, Any
import json
import logging
from datetime import datetime

# For existing cj_products logic
from mcp.server.fastmcp import FastMCP
from ..models.product import Product as CJProductModel # Aliasing to avoid confusion

from ..db import get_db_pool
# from app.auth.dependencies import get_current_active_user # Actual auth dependency
# from app.models.user import User as AuthUserModel # Actual user model for auth

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for 'products' table CRUD (internal) ---
class InternalProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    category_id: int
    image_url: Optional[str] = None # Tests use simple strings

class InternalProductCreate(InternalProductBase):
    pass

class InternalProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    category_id: Optional[int] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None

class InternalProductResponse(InternalProductBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Pydantic V2 style

class ProductSearchResponseModel(BaseModel):
    items: List[InternalProductResponse]

# --- End of Pydantic Schemas for 'products' table CRUD ---


# --- Pydantic Schemas for existing Tool Inputs (cj_products) ---
class ListProductsToolInput(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    class Config:
        extra = 'forbid'

class GetProductByIdToolInput(BaseModel):
    product_id: str # This is cj_product_id (string)
    class Config:
        extra = 'forbid'
# --- End of Pydantic Schemas for Tool Inputs ---

router = APIRouter(
    prefix="/products",
    # tags=["products"], # Original tag, can be split later
    responses={404: {"description": "Not found"}},
)

# --- Placeholder for Auth Dependency ---
class AuthUserModelPlaceholder(BaseModel): # Placeholder
    id: int
    username: str

async def get_current_active_user_placeholder() -> AuthUserModelPlaceholder:
    # logger.debug("Auth placeholder: Granting access to testuser")
    return AuthUserModelPlaceholder(id=1, username="testuser")
# --- End of Placeholder for Auth ---


# --- CRUD Endpoints for 'products' table (used by tests) ---

@router.post("/", response_model=InternalProductResponse, status_code=status.HTTP_201_CREATED, tags=["Internal Products CRUD"])
async def create_internal_product(
    product_in: InternalProductCreate,
    pool = Depends(get_db_pool),
    # current_user: AuthUserModelPlaceholder = Depends(get_current_active_user_placeholder) # Enable for auth
):
    query = """
        INSERT INTO products (name, description, price, category_id, image_url, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id, name, description, price, category_id, image_url, is_active, created_at, updated_at;
    """
    try:
        async with pool.acquire() as conn:
            cat_exists = await conn.fetchval("SELECT id FROM categories WHERE id = $1", product_in.category_id)
            if not cat_exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Category with id {product_in.category_id} not found.")

            created_row = await conn.fetchrow(
                query,
                product_in.name, product_in.description, product_in.price,
                product_in.category_id, product_in.image_url
            )
        if not created_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create product.")
        try:
            return InternalProductResponse.model_validate(dict(created_row))
        except PydanticCoreValidationError as e:
            logger.error(f"Pydantic validation error in create_internal_product: {e.errors(include_input=True, include_context=True)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal validation error during product creation.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating internal product: {e}")
        if "products_name_key" in str(e).lower():
             raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Product with name '{product_in.name}' already exists.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/search", response_model=ProductSearchResponseModel, tags=["Internal Products CRUD"])
async def search_internal_products(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    pool = Depends(get_db_pool)
):
    base_sql = "SELECT id, name, description, price, category_id, image_url, is_active, created_at, updated_at FROM products"
    conditions = ["is_active = TRUE"]
    params = []
    param_idx = 1

    if q:
        conditions.append(f"(name ILIKE ${param_idx} OR description ILIKE ${param_idx})")
        params.append(f"%{q}%")
        param_idx += 1
    if category_id is not None:
        conditions.append(f"category_id = ${param_idx}")
        params.append(category_id)
        param_idx += 1
    if min_price is not None:
        conditions.append(f"price >= ${param_idx}")
        params.append(min_price)
        param_idx += 1
    if max_price is not None:
        conditions.append(f"price <= ${param_idx}")
        params.append(max_price)
        param_idx += 1
    
    if conditions:
        base_sql += " WHERE " + " AND ".join(conditions)
    base_sql += " ORDER BY id;"

    try:
        async with pool.acquire() as conn:
            db_rows = await conn.fetch(base_sql, *params)
        
        products = []
        for row in db_rows:
            try:
                products.append(InternalProductResponse.model_validate(dict(row)))
            except PydanticCoreValidationError as e:
                logger.error(f"Pydantic validation error in search_internal_products for row {dict(row)}: {e.errors(include_input=True, include_context=True)}")
                # Decide whether to skip this product or fail the whole search
                # For now, let's allow search to continue but log the error, then raise a general error if any occurred.
                # This might need adjustment based on desired behavior.
                # If one bad row causes 500, then raise immediately:
                # raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal validation error during product search.")
        return ProductSearchResponseModel(items=products)
    except Exception as e:
        logger.error(f"Error searching internal products: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{product_id_int:int}", response_model=InternalProductResponse, tags=["Internal Products CRUD"])
async def get_internal_product_by_id(
    product_id_int: int,
    pool = Depends(get_db_pool)
):
    query = """
        SELECT id, name, description, price, category_id, image_url, is_active, created_at, updated_at
        FROM products WHERE id = $1;
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, product_id_int)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id {product_id_int} not found.")
    try:
        return InternalProductResponse.model_validate(dict(row))
    except PydanticCoreValidationError as e:
        logger.error(f"Pydantic validation error in get_internal_product_by_id for product ID {product_id_int}: {e.errors(include_input=True, include_context=True)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal validation error retrieving product details.")

@router.put("/{product_id_int:int}", response_model=InternalProductResponse, tags=["Internal Products CRUD"])
async def update_internal_product(
    product_id_int: int,
    product_update: InternalProductUpdate,
    pool = Depends(get_db_pool),
    # current_user: AuthUserModelPlaceholder = Depends(get_current_active_user_placeholder) # Enable for auth
):
    update_data = product_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    set_clauses = []
    query_params = []
    param_idx = 1
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ${param_idx}")
        query_params.append(value)
        param_idx += 1
    query_params.append(product_id_int)

    update_query = f"""
        UPDATE products SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${param_idx}
        RETURNING id, name, description, price, category_id, image_url, is_active, created_at, updated_at;
    """
    try:
        async with pool.acquire() as conn:
            # Check if product exists before attempting update
            exists = await conn.fetchval("SELECT id FROM products WHERE id = $1", product_id_int)
            if not exists:
                 raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id {product_id_int} not found.")

            if "category_id" in update_data and update_data["category_id"] is not None:
                cat_exists = await conn.fetchval("SELECT id FROM categories WHERE id = $1", update_data["category_id"])
                if not cat_exists:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Category with id {update_data['category_id']} not found.")
            
            updated_row = await conn.fetchrow(update_query, *query_params)
        if not updated_row: # Should be caught by initial existence check or raise DB error
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update product.")
        try:
            return InternalProductResponse.model_validate(dict(updated_row))
        except PydanticCoreValidationError as e:
            logger.error(f"Pydantic validation error in update_internal_product for product ID {product_id_int}: {e.errors(include_input=True, include_context=True)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal validation error during product update.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating internal product {product_id_int}: {e}")
        if "products_name_key" in str(e).lower() and "name" in update_data:
             raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Product with name '{update_data['name']}' already exists.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete("/{product_id_int:int}", status_code=status.HTTP_204_NO_CONTENT, tags=["Internal Products CRUD"])
async def delete_internal_product(
    product_id_int: int,
    pool = Depends(get_db_pool),
    # current_user: AuthUserModelPlaceholder = Depends(get_current_active_user_placeholder) # Enable for auth
):
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM products WHERE id = $1", product_id_int)
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id {product_id_int} not found.")
    return None


# --- Existing MCP Tool Definitions & Endpoints (for cj_products) ---
product_mcp_server = FastMCP(
    name="ProductService",
    title="TAIC Product Service",
    description="Provides tools to access and manage product information from the TAIC (CJ) catalog."
)

def _map_row_to_cj_product(row: Dict[str, Any]) -> CJProductModel: # Renamed for clarity
    image_url_db_val = row.get('image_url')
    final_image_url = None
    if image_url_db_val and isinstance(image_url_db_val, str):
        try:
            parsed_urls = json.loads(image_url_db_val)
            if isinstance(parsed_urls, list) and parsed_urls and isinstance(parsed_urls[0], str):
                final_image_url = parsed_urls[0]
            elif isinstance(parsed_urls, str):
                final_image_url = parsed_urls
        except json.JSONDecodeError:
            if not image_url_db_val.strip().startswith('['): # If not trying to be JSON, assume direct URL
                 final_image_url = image_url_db_val

    attributes_data = row.get('variants_json')
    final_attributes = None
    if attributes_data:
        parsed_variants_content = None
        if isinstance(attributes_data, str):
            try: parsed_variants_content = json.loads(attributes_data)
            except json.JSONDecodeError: logger.error(f"Failed to parse variants_json: {attributes_data}")
        else: parsed_variants_content = attributes_data
        if isinstance(parsed_variants_content, list) and parsed_variants_content and isinstance(parsed_variants_content[0], dict):
            final_attributes = parsed_variants_content[0]
        elif isinstance(parsed_variants_content, dict):
            final_attributes = parsed_variants_content
    
    return CJProductModel(
        id=str(row['cj_product_id']),
        page_id=str(row['page_id']),
        name=row['display_name'],
        description=row.get('display_description', ''),
        price=float(row['selling_price']) if row['selling_price'] is not None else 0.0,
        imageUrl=final_image_url,
        category=row['category_name'],
        merchantId="CJ Dropshipping",
        stockQuantity=100, # Placeholder
        attributes=final_attributes,
        dataAiHint=None # Placeholder
    )

@product_mcp_server.tool(name="get_all_cj_products", description="Retrieves CJ products.")
async def get_all_cj_products_tool(input_data: ListProductsToolInput, pool = Depends(get_db_pool)) -> Dict[str, List[CJProductModel]]:
    products: List[CJProductModel] = []
    base_query = """SELECT p.cj_product_id AS page_id, p.cj_product_id, p.display_name, p.display_description,
                           p.selling_price, p.image_url, c.name as category_name, p.variants_json
                    FROM cj_products p JOIN categories c ON p.platform_category_id = c.id"""
    conditions = ["p.is_active = TRUE"]
    query_params = []
    param_idx = 1
    if input_data.category:
        conditions.append(f"c.name ILIKE ${param_idx}"); query_params.append(f"%{input_data.category}%"); param_idx += 1
    if input_data.query:
        conditions.append(f"(p.display_name ILIKE ${param_idx} OR p.display_description ILIKE ${param_idx})")
        query_params.append(f"%{input_data.query}%"); param_idx += 1
    if conditions: base_query += " WHERE " + " AND ".join(conditions)
    try:
        async with pool.acquire() as conn:
            db_rows = await conn.fetch(base_query, *query_params)
            for row in db_rows: products.append(_map_row_to_cj_product(dict(row)))
    except Exception as e: logger.error(f"DB error in get_all_cj_products_tool: {e}"); raise HTTPException(status_code=500, detail=str(e))
    return {"output": products}

@product_mcp_server.tool(name="get_cj_product_details", description="Retrieves details for a specific CJ product.")
async def get_cj_product_details_tool(input_data: GetProductByIdToolInput, pool = Depends(get_db_pool)) -> CJProductModel:
    query = """SELECT p.cj_product_id AS page_id, p.cj_product_id, p.display_name, p.display_description,
                      p.selling_price, p.image_url, c.name as category_name, p.variants_json
               FROM cj_products p JOIN categories c ON p.platform_category_id = c.id
               WHERE p.cj_product_id = $1 AND p.is_active = TRUE;"""
    try:
        async with pool.acquire() as conn: row = await conn.fetchrow(query, input_data.product_id)
    except Exception as e: logger.error(f"DB error get_cj_product_details_tool: {e}"); raise HTTPException(status_code=500, detail=str(e))
    if not row: raise HTTPException(status_code=404, detail=f"CJ Product ID '{input_data.product_id}' not found.")
    return _map_row_to_cj_product(dict(row))

# Original REST endpoints for CJ Products (MCP Tools) - paths might need review if they conflict
@router.get("/cj/list", response_model=List[CJProductModel], summary="List all CJ products (REST via MCP tool)", tags=["CJ Products (MCP)"])
async def list_cj_products_rest_endpoint(query: Optional[str] = None, category: Optional[str] = None, pool = Depends(get_db_pool)):
    tool_input = ListProductsToolInput(query=query, category=category)
    # Manually pass pool to tool if it doesn't use Depends itself
    result_dict = await get_all_cj_products_tool(tool_input, pool=pool) 
    return result_dict.get("output", [])

@router.get("/cj/{cj_product_id:str}", response_model=CJProductModel, summary="Get CJ product by ID (REST via MCP tool)", tags=["CJ Products (MCP)"])
async def get_cj_product_by_id_rest_endpoint(cj_product_id: str, pool = Depends(get_db_pool)):
    tool_input = GetProductByIdToolInput(product_id=cj_product_id)
    # Manually pass pool to tool
    return await get_cj_product_details_tool(tool_input, pool=pool)

# Include MCP server router if you want its /context endpoint, etc.
# router.include_router(product_mcp_server.router, prefix="/mcp_tools") # Example prefix
