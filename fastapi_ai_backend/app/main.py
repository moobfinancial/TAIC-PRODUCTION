import logging
import sys
import traceback
import inspect
import typing # Keep the alias for other typing uses
from typing import Dict, Any, Optional, List # Ensure List is imported
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware
from .db import create_pool, close_pool
from .models.mcp_context import MCPContext, MCPServerInfo, MCPToolSchema
from pydantic import BaseModel
from app.routers.products import product_mcp_server, router as products_router, ListProductsToolInput
from app.agents.shopping_assistant_agent import shopping_assistant_mcp_server, UserQueryInput, ShoppingAssistantResponse
from app.models.product import Product

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load resources and connect to DB
    await create_pool()
    print("--- Application startup: Database pool created ---")
    yield
    # Release resources and close DB connection
    await close_pool()
    print("--- Application shutdown: Database pool closed ---")

app = FastAPI(lifespan=lifespan,
    title="TAIC AI Shopping Assistant Backend",
    description="Backend services for the TAIC AI Shopping Assistant, including product catalog, MCP tools, and AI agent functionalities.",
    version="0.1.0",
)

# CORS Middleware Configuration
# Origins to allow. Use "*" for all origins (development), 
# or specify your frontend origin(s) in production (e.g., ["http://localhost:3000", "https://your-frontend.com"])
origins = [
    "http://localhost:3000", # Default Next.js dev port
    "http://localhost:9002", # Port mentioned in shopping-assistant.ts NEXT_PUBLIC_APP_URL fallback
    "*" # Allow all for broader development, but be more specific in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)


app.include_router(products_router, prefix="/api", tags=["Products"])




def get_pydantic_schema(type_hint_value: typing.Any) -> typing.Optional[typing.Dict[str, typing.Any]]:
    """
    If the type_hint_value is a Pydantic model, return its JSON schema.
    Otherwise, return None.
    Handles Optional types and lists of Pydantic models.
    """
    # Get the actual type, resolving Optional or List wrappers
    actual_type = type_hint_value
    origin_type = typing.get_origin(actual_type)

    if origin_type is typing.Union: # Handles Optional[Model] which is Union[Model, NoneType]
        # Filter out NoneType and take the first remaining argument
        args = [arg for arg in typing.get_args(actual_type) if arg is not type(None)]
        if args:
            actual_type = args[0]
        else:
            return None # Should not happen for Optional[Model] if Model is present
    elif origin_type is list or origin_type is typing.List: # Handles List[Model]
        args = typing.get_args(actual_type)
        if args:
            # We are interested in the schema of the item within the list
            # For MCP, the schema is usually for the item, not the list itself directly in input/output_schema
            # However, if the tool truly expects a list, the schema should reflect that.
            # For now, let's assume we want the schema of the item type if it's a Pydantic model.
            # This might need adjustment based on how MCP expects list schemas.
            item_type = args[0]
            if isinstance(item_type, type) and issubclass(item_type, BaseModel) and hasattr(item_type, "model_json_schema"):
                 # For a List[PydanticModel], the schema is typically an array with items of PydanticModel's schema
                return {"type": "array", "items": item_type.model_json_schema()}
            else: # List of non-Pydantic types, or complex nesting not handled here
                return None 
    
    # Check if the (potentially unwrapped) actual_type is a Pydantic model
    if isinstance(actual_type, type) and issubclass(actual_type, BaseModel) and hasattr(actual_type, "model_json_schema"):
        return actual_type.model_json_schema()
    
    return None



@app.get("/mcp_product_service/custom_context", response_model=MCPContext, tags=["MCP"], summary="Get Custom MCP Context for Product Service")
async def get_product_mcp_context():
    # print("Attempting to generate MCP context...", file=sys.stderr) # Commented out for cleaner logs
    try:
        server_info = MCPServerInfo(
            name=product_mcp_server.name,
            instructions=product_mcp_server.instructions
        )

        tools_schemas = []
        if hasattr(product_mcp_server, '_tool_manager'):
            tool_manager_instance = product_mcp_server._tool_manager
            if hasattr(tool_manager_instance, 'list_tools'):
                list_of_tool_objects = tool_manager_instance.list_tools()
                for tool_object in list_of_tool_objects:
                    input_schema_json = None
                    output_schema_json = None
                
                    target_fn = tool_object.fn 
                    # Resolve type hints for the target function. 
                    # For robust forward reference resolution, it's best if models are imported in the module where target_fn is defined.
                    try:
                        type_hints = typing.get_type_hints(target_fn, include_extras=True)
                    except Exception as e:
                        # print(f"Warning: Could not resolve type hints for {tool_object.name}: {e}", file=sys.stderr) # Keep for potential future debugging
                        type_hints = {}

                    sig = inspect.signature(target_fn)
                    
                    # Input schema from the first parameter's type hint
                    if sig.parameters:
                        first_param_name = list(sig.parameters.keys())[0]
                        if first_param_name in type_hints:
                            input_schema_json = get_pydantic_schema(type_hints[first_param_name])
                        elif sig.parameters[first_param_name].annotation is not inspect.Parameter.empty:
                            # Fallback if get_type_hints didn't resolve it but annotation exists
                            input_schema_json = get_pydantic_schema(sig.parameters[first_param_name].annotation)

                    # Output schema from the return type hint
                    if 'return' in type_hints:
                        output_schema_json = get_pydantic_schema(type_hints['return'])
                    elif sig.return_annotation is not inspect.Signature.empty:
                        # Fallback if get_type_hints didn't resolve it but annotation exists
                        output_schema_json = get_pydantic_schema(sig.return_annotation)
                    
                    tools_schemas.append(MCPToolSchema(
                        name=tool_object.name, # Use the name from the tool object
                        description=tool_object.description,
                        inputSchema=input_schema_json,
                        outputSchema=output_schema_json
                    ))
        
        context_data = MCPContext(server=server_info, tools=tools_schemas)
        # print("MCP Context generated successfully.", file=sys.stderr) # Commented out for cleaner logs
        return context_data
    except Exception as e:
        print(f"ERROR in get_product_mcp_context: {type(e).__name__}: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Internal server error generating MCP context: {str(e)}")

@app.get("/mcp_shopping_assistant_service/custom_context", response_model=MCPContext, tags=["MCP"], summary="Get Custom MCP Context for Shopping Assistant Service")
async def get_shopping_assistant_mcp_context():
    # print("Attempting to generate Shopping Assistant MCP context...", file=sys.stderr)
    try:
        server_info = MCPServerInfo(
            name=shopping_assistant_mcp_server.name,
            instructions=shopping_assistant_mcp_server.instructions,
        )

        tools_schemas = []
        if hasattr(shopping_assistant_mcp_server, '_tool_manager'):
            tool_manager_instance = shopping_assistant_mcp_server._tool_manager
            if hasattr(tool_manager_instance, 'list_tools'):
                list_of_tool_objects = tool_manager_instance.list_tools()
                for tool_object in list_of_tool_objects:
                    input_schema_json = None
                    output_schema_json = None
                    
                    target_fn = tool_object.fn
                    try:
                        type_hints = typing.get_type_hints(target_fn, include_extras=True)
                    except Exception as e:
                        # print(f"Warning: Could not resolve type hints for {tool_object.name}: {e}", file=sys.stderr)
                        type_hints = {}

                    sig = inspect.signature(target_fn)
                    params = sig.parameters

                    if params:
                        first_param_name = next(iter(params))
                        if first_param_name in type_hints:
                            input_schema_json = get_pydantic_schema(type_hints[first_param_name])
                    
                    if 'return' in type_hints:
                        output_schema_json = get_pydantic_schema(type_hints['return'])

                    tools_schemas.append(MCPToolSchema(
                        name=tool_object.name,
                        description=tool_object.description,
                        inputSchema=input_schema_json,
                        outputSchema=output_schema_json
                    ))
        
        context_data = MCPContext(server=server_info, tools=tools_schemas)
        # print("Shopping Assistant MCP Context generated successfully.", file=sys.stderr)
        return context_data
    except Exception as e:
        print(f"ERROR in get_shopping_assistant_mcp_context: {type(e).__name__}: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Internal server error in Shopping Assistant MCP context generation: {str(e)}")

# --- Manually Exposed MCP Tool Endpoints ---

@app.post("/mcp_product_service/call_tool/get_all_products", tags=["MCP Product Service Tools"], summary="Manually call get_all_products tool")
async def call_get_all_products_manual(input_data: ListProductsToolInput):
    try:
        if not hasattr(product_mcp_server, '_tool_manager') or not hasattr(product_mcp_server._tool_manager, 'list_tools'):
            logger.error("Tool manager or list_tools method not found on product_mcp_server")
            raise HTTPException(status_code=500, detail="Server configuration error: Product service tool manager not available")

        tool_manager = product_mcp_server._tool_manager
        tool_object = None
        for t in tool_manager.list_tools():
            # The tool name in products.py is 'get_all_products' not 'get_all_products_tool'
            if t.name == "get_all_products": 
                tool_object = t
                break
        
        if not tool_object:
            logger.error("Tool 'get_all_products' not found in product service tool manager")
            raise HTTPException(status_code=404, detail="Tool 'get_all_products' not found")
            
        if not callable(tool_object.fn):
            logger.error(f"Tool function for 'get_all_products' is not callable: {tool_object.fn}")
            raise HTTPException(status_code=500, detail="Server configuration error: Product service tool function not callable")

        logger.info(f"Manually calling product service tool 'get_all_products' with input: {input_data}")
        result = await tool_object.fn(input_data)
        logger.info(f"Product service tool 'get_all_products' returned successfully.") # Avoid logging potentially large list of products
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error manually calling product service tool 'get_all_products': {type(e).__name__} - {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calling product service tool 'get_all_products': {str(e)}")


@app.post("/mcp_shopping_assistant_service/call_tool/process_user_query", response_model=ShoppingAssistantResponse, tags=["MCP Shopping Assistant Tools"], summary="Manually call process_user_query tool")
async def call_process_user_query_manual(input_data: UserQueryInput):
    try:
        if not hasattr(shopping_assistant_mcp_server, '_tool_manager') or not hasattr(shopping_assistant_mcp_server._tool_manager, 'list_tools'):
            logger.error("Tool manager or list_tools method not found on shopping_assistant_mcp_server")
            raise HTTPException(status_code=500, detail="Server configuration error: Tool manager not available")

        tool_manager = shopping_assistant_mcp_server._tool_manager
        tool_object = None
        for t in tool_manager.list_tools():
            if t.name == "process_user_query": # Ensure this matches the registered tool name
                tool_object = t
                break
        
        if not tool_object:
            logger.error("Tool 'process_user_query' not found in tool manager")
            raise HTTPException(status_code=404, detail="Tool 'process_user_query' not found")
            
        if not callable(tool_object.fn):
            logger.error(f"Tool function for 'process_user_query' is not callable: {tool_object.fn}")
            raise HTTPException(status_code=500, detail="Server configuration error: Tool function not callable")

        # The tool function is async
        logger.info(f"Manually calling tool 'process_user_query' with input: {input_data}")
        result = await tool_object.fn(input_data)
        logger.info(f"Tool 'process_user_query' returned: {result}")
        return result
    except HTTPException: # Re-raise HTTPException to preserve status code and detail
        raise
    except Exception as e:
        logger.error(f"Error manually calling tool 'process_user_query': {type(e).__name__} - {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calling tool 'process_user_query': {str(e)}")

# Mount the MCP server applications
app.mount("/mcp_product_service", product_mcp_server)
app.mount("/mcp_shopping_assistant_service", shopping_assistant_mcp_server)


@app.get("/", tags=["Root"], summary="Root path of the API")
async def read_root():
    """
    Root endpoint providing a welcome message.
    """
    return {"message": "Welcome to the TAIC AI Shopping Assistant Backend API"}

@app.get("/health", tags=["Health"], summary="Health check endpoint")
async def health_check():
    """
    Health check endpoint.
    """
    return {"status": "ok"}
