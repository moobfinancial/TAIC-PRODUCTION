# app/agents/ai_shopping_assistant_agent.py

from typing import List, Optional, Dict, Any, TypeVar, Generic # Added TypeVar, Any, Generic
from mcp.server.fastmcp.server import FastMCP, Context as MCPContext, ServerSession, Request # Changed ToolContext to Context as MCPContext, added ServerSession, Request

# Define type variables for the Context generic
ServerSessionT = TypeVar('ServerSessionT', bound=ServerSession)
RequestT = TypeVar('RequestT', bound=Request)

# Create a concrete context type with 2 type parameters
ToolContext = MCPContext[ServerSessionT, RequestT] if 'ServerSessionT' in locals() else Any
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Literal, Dict, Any
import asyncpg
from app.db import get_db_connection, release_db_connection

# Import the actual Product model from your project
# Assuming it's in app.models.product and named Product
from app.models.product import Product as AppProduct # Alias to avoid naming conflict

# --- Pydantic Models based on TypeScript Schemas ---

class ProductForAIModel(BaseModel):
    id: str = Field(..., description="This is the cj_product_id or primary product ID.")
    page_id: Optional[str] = Field(default=None, description="Simple ID for Next.js page routes.")
    name: str
    description: Optional[str] = None
    price: float
    imageUrl: Optional[HttpUrl] = None
    category: Optional[str] = None
    dataAiHint: Optional[str] = None

    class Config:
        from_attributes = True # To allow creating from ORM models

class ShoppingAssistantQueryInputModel(BaseModel):
    query: str = Field(..., description='The user query for product recommendations.')
    user_id: Optional[str] = Field(default=None, description="Authenticated user ID, if available.") # From FastApiRequestBody
    conversation_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Previous conversation messages.") # From FastApiRequestBody

class ShoppingAssistantResponseModel(BaseModel):
    responseType: Literal['clarification', 'products', 'no_results', 'error'] = Field(..., description="The type of response.")
    responseText: str = Field(..., description="The AI's conversational text to display.")
    products: Optional[List[ProductForAIModel]] = Field(default=None, description='A list of product recommendations.')
    clarificationMessage: Optional[str] = Field(default=None, description='Message asking for clarification.')

# --- Agent MCP Setup ---

ai_shopping_assistant_mcp = FastMCP(
    title="AI Shopping Assistant Agent",
    description="An AI agent to help users find products and get shopping assistance.",
    prefix="/ai_shopping_assistant" # This prefix will be part of the tool's endpoint
)

# --- Agent Class ---

class AIShoppingAssistantAgent:
    def __init__(self):
        # In a real scenario, you might inject a database session or product service here
        pass

    def _transform_product_to_product_for_ai(self, product: AppProduct) -> ProductForAIModel:
        """Transforms the application's Product model to the ProductForAIModel."""
        return ProductForAIModel(
            id=product.id, # Assuming AppProduct.id is the primary identifier like cj_product_id or main ID
            page_id=product.page_id, # Assuming AppProduct has a page_id field
            name=product.name,
            description=product.description,
            price=product.price,
            imageUrl=product.image_url,
            category=product.category,
            dataAiHint=product.data_ai_hint
        )

    async def _internal_keyword_product_search(self, keywords: str) -> List[AppProduct]:
        """Internal method to search products by keywords from the database."""
        print(f"AI Shopping Assistant (Internal): Searching products with keywords: {keywords} from database")
        
        conn: Optional[asyncpg.Connection] = None
        fetched_app_products: List[AppProduct] = []

        try:
            conn = await get_db_connection()
            search_term = f"%{keywords}%"

            # Assuming 'is_active' column exists in 'products' table as seen in product_service_agent
            # Assuming 'platform_category_id' links products to categories table which has 'name'
            # Assuming 'page_id' exists in 'products' table for ProductForAIModel
            sql_query = """
                SELECT
                    p.id, p.name, p.description, p.price, p.image_url,
                    c.name as category,  -- Mapped to AppProduct.category
                    p.page_id,           -- For AppProduct and subsequently ProductForAIModel
                    p.approval_status, p.merchant_id, p.has_variants,
                    p.source, p.original_cj_product_id, p.data_ai_hint,
                    p.stock_quantity, p.stock_status_text, p.variant_attribute_names
                    -- p.shipping_info is complex and not directly used by ProductForAIModel, so omitted for now
                FROM products p
                LEFT JOIN categories c ON p.platform_category_id = c.id
                WHERE p.approval_status = 'approved'
                  AND p.is_active = TRUE  -- Assuming this column exists and is boolean
                  AND (p.name ILIKE $1 OR p.description ILIKE $1)
                ORDER BY p.name -- Basic ordering
                LIMIT 50; -- Limit results to avoid overwhelming the AI or user
            """
            
            db_records = await conn.fetch(sql_query, search_term)

            for record_dict in db_records:
                # Convert asyncpg.Record to a dictionary if it's not already easily unpackable
                # AppProduct.from_orm will try to map, ensure all fields are present or optional
                # The 'variants' field in AppProduct defaults to empty list, which is fine here.
                # 'shipping_info' is also optional.
                try:
                    product_data = dict(record_dict)
                    # Pydantic V2 uses model_validate, V1 uses parse_obj
                    # Assuming Pydantic V2+ for model_validate
                    app_product = AppProduct.model_validate(product_data)
                    fetched_app_products.append(app_product)
                except Exception as e:
                    print(f"Error mapping record to AppProduct: {product_data} - Error: {e}")
                    # Continue to next record if one fails

        except Exception as e:
            print(f"Database error in _internal_keyword_product_search: {e}")
            # Optionally re-raise or handle as appropriate for your error strategy
        finally:
            if conn:
                await release_db_connection(conn)
        
        return fetched_app_products

    async def process_user_query_tool_impl(
        self,
        ctx: ToolContext[ShoppingAssistantQueryInputModel, ShoppingAssistantResponseModel],
        input_data: ShoppingAssistantQueryInputModel
    ) -> ShoppingAssistantResponseModel:
        """Processes the user's query, searches for products, and formulates a response."""
        
        # _internal_keyword_product_search now returns List[AppProduct]
        found_app_products: List[AppProduct] = await self._internal_keyword_product_search(input_data.query)
        
        # Transform to List[ProductForAIModel] for the response
        products_for_ai_model: List[ProductForAIModel] = [
            self._transform_product_to_product_for_ai(p) for p in found_app_products
        ]

        if products_for_ai_model:
            return ShoppingAssistantResponseModel(
                responseType='products',
                responseText=f"I found some items based on your query for '{input_data.query}':",
                products=products_for_ai_model
            )
        else:
            # Simplified logic: if query is short, ask for clarification, else no_results
            # Real implementation would use LLM or more sophisticated logic here
            if len(input_data.query.split()) < 3: # Arbitrary threshold for 'vagueness'
                clarification_text = f"I couldn't find anything specific for '{input_data.query}'. Could you tell me more about what you're looking for? Perhaps a product type, brand, or feature?"
                return ShoppingAssistantResponseModel(
                    responseType='clarification',
                    responseText=clarification_text,
                    clarificationMessage=clarification_text
                )
            else:
                return ShoppingAssistantResponseModel(
                    responseType='no_results',
                    responseText=f"I searched for '{input_data.query}' but couldn't find any matching products right now. Would you like to try a different search?"
                )

# Instantiate the agent
shopping_assistant_agent_instance = AIShoppingAssistantAgent()

# Register the main tool with the MCP instance
@ai_shopping_assistant_mcp.tool(
    name="process_user_query", # This will be part of the endpoint: /ai_shopping_assistant/process_user_query
    description="Processes a user's shopping query, searches for products, and returns recommendations or asks for clarification."
    # input_model and output_model are inferred from type hints by FastMCP
)
async def process_user_query(
    ctx: ToolContext[ShoppingAssistantQueryInputModel, ShoppingAssistantResponseModel],
    input_data: ShoppingAssistantQueryInputModel
) -> ShoppingAssistantResponseModel:
    """MCP Tool: Processes a user's shopping query."""
    return await shopping_assistant_agent_instance.process_user_query_tool_impl(ctx, input_data)

# To make the agent's MCP instance available for mounting in main.py
def get_ai_shopping_assistant_mcp():
    return ai_shopping_assistant_mcp
