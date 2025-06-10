import logging
import sys
import traceback
import inspect
import typing # Keep the alias for other typing uses
from typing import Dict, Any, Optional, List # Ensure List is imported
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware
from .db import init_db_pool, close_db_pool # Updated import names
from .models.mcp_context import MCPContext, MCPServerInfo, MCPToolSchema
from pydantic import BaseModel
# Import the new product service agent
from app.agents.product_service_agent import product_service_mcp
# Keep existing product router for other API endpoints if needed, but MCP part will be from the new agent
from app.routers.products import router as products_router, ListProductsToolInput
# Import the new product variants router
from app.routers.product_variants import router as product_variants_router
# Import the new bulk operations router
from app.routers.bulk_operations import router as bulk_operations_router
# Import the new categories router
from app.routers.categories import router as categories_router
# Import the placeholder auth router
from app.routers.auth_placeholder import router as auth_placeholder_router
# Import the admin router
from app.routers.admin import router as admin_router
from app.agents.shopping_assistant_agent import shopping_assistant_mcp_server, UserQueryInput, ShoppingAssistantResponse
from app.models.product import Product

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load resources and connect to DB
    await init_db_pool() # Updated function call
    # The print statement is now inside init_db_pool
    yield
    # Release resources and close DB connection
    await close_db_pool() # Updated function call
    # The print statement is now inside close_db_pool

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
app.include_router(product_variants_router, prefix="/api", tags=["Product Variants"])
app.include_router(bulk_operations_router, prefix="/api/bulk", tags=["Bulk Operations"])
app.include_router(categories_router, prefix="/api/categories", tags=["Categories"])
app.include_router(auth_placeholder_router, prefix="/api/auth", tags=["Authentication (Placeholder)"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"]) # Add the admin router




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
            name=product_service_mcp.name, # Use the new agent
            instructions=product_service_mcp.instructions # Use the new agent
        )

        tools_schemas = []
        if hasattr(product_service_mcp, '_tool_manager'): # Use the new agent
            tool_manager_instance = product_service_mcp._tool_manager # Use the new agent
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
        # Ensure this function now correctly references the new product_service_mcp
        if not hasattr(product_service_mcp, '_tool_manager') or not hasattr(product_service_mcp._tool_manager, 'list_tools'): # Use new agent
            logger.error("Tool manager or list_tools method not found on product_service_mcp")
            raise HTTPException(status_code=500, detail="Server configuration error: Product service tool manager not available")

        tool_manager = product_service_mcp._tool_manager # Use new agent
        tool_object = None
        # The tool name in product_service_agent.py is 'get_all_products'
        for t_obj in tool_manager.list_tools(): # Renamed loop variable for clarity
            if t_obj.name == "get_all_products":
                tool_object = t_obj
                break
        
        if not tool_object:
            logger.error("Tool 'get_all_products' not found in new product service agent tool manager")
            raise HTTPException(status_code=404, detail="Tool 'get_all_products' not found")
            
        if not callable(tool_object.fn):
            logger.error(f"Tool function for 'get_all_products' from new agent is not callable: {tool_object.fn}")
            raise HTTPException(status_code=500, detail="Server configuration error: Product service tool function not callable")

        # The tool function in product_service_agent.py expects ToolContext and then the input model.
        # For a manual call like this, we might need to simulate a ToolContext or adapt the tool.
        # However, FastMCP's direct tool call mechanism (if this manual endpoint is trying to replicate it)
        # should handle context injection if the tool is part of the MCP server.
        # Let's assume for now the manual endpoint should directly call the function if possible,
        # or that the MCP server's call_tool mechanism is what's truly being tested by shopping_assistant.
        # The current tool in product_service_agent.py is:
        # async def get_all_products(ctx: ToolContext, tool_input: ListProductsToolInput) -> List[Product]:
        # This manual endpoint cannot easily provide `ToolContext`.
        # This manual endpoint might be less relevant if the shopping_assistant_agent directly calls the
        # FastMCP server's /call_tool/{tool_name} endpoint, which is the standard MCP way.
        # For now, I will make it call the tool function, but it will lack context.
        # This highlights a potential issue with how this manual endpoint is structured vs. the tool's signature.
        # A true MCP client call would go to app.mount("/mcp_product_service", product_service_mcp) endpoint.

        # TEMPORARY: To make this manual call work without full context, we'd typically
        # not have `ctx: ToolContext` in the tool or this manual call would need to be smarter.
        # Given the subtask is about getting the agents to talk, the inter-agent call is key.
        # This manual endpoint is for debugging/direct access.
        # The shopping_assistant_agent will call `/mcp_product_service/call_tool/get_all_products`,
        # and the `product_service_mcp` FastMCP instance will handle that, including context.
        # So, this manual endpoint should ideally also go through that, or be simplified.
        # For now, let's assume this manual endpoint is for a simplified test and might fail if ToolContext is strictly needed by the tool.
        # The tool in product_service_agent.py DOES use ToolContext.
        # This manual endpoint is thus incompatible without modification.
        # Option 1: Modify tool to make ctx Optional. Option 2: Remove this manual endpoint or mark as N/A.
        # Option 3: Try to simulate a basic context (not ideal).
        # Let's comment out the direct call for now as it's not the primary path for agent interaction.
        # The shopping assistant will use the proper /call_tool/ endpoint.
        # logger.info(f"Manually calling product service tool 'get_all_products' with input: {input_data}")
        # result = await tool_object.fn(None, input_data) # Passing None for context - LIKELY TO FAIL
        logger.warning("Manual endpoint call_get_all_products_manual is not fully compatible with ToolContext requirement. Use MCP call_tool endpoint for full functionality.")
        raise HTTPException(status_code=501, detail="Manual endpoint not fully compatible with tool signature requiring context. Use /mcp_product_service/call_tool/get_all_products for proper MCP calls.")

        # If the tool was defined without ToolContext, this would be:
        # result = await tool_object.fn(input_data)
        # logger.info(f"Product service tool 'get_all_products' returned successfully.") # Avoid logging potentially large list of products
        # return result
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
# The path "/mcp_product_service" should match PRODUCT_SERVICE_AGENT_MOUNT_PATH in shopping_assistant_agent.py
app.mount("/mcp_product_service", product_service_mcp)
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
