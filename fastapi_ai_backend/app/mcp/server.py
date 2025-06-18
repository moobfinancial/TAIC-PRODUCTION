"""
MCP server for the AI Shopping Assistant.
This module creates and configures the FastApiMCP server with the necessary tools.
"""
import httpx
from fastapi_mcp import FastApiMCP, AuthConfig
from fastapi import Request, FastAPI
from typing import List, Dict, Any, Optional

from .tools import mcp_tools

# Create an HTTP client for the MCP server to use when making requests to the API
http_client = httpx.AsyncClient(base_url="http://localhost:8000")

# Configure authentication for the MCP server
auth_config = AuthConfig(
    # We'll keep auth simple for now, but this can be expanded later
    # to use JWT tokens or other authentication methods
    enabled=False,
    issuer="http://localhost:8070",  # Add issuer URL to satisfy validation
    dependencies=[]  # Empty list of dependencies is valid
)

# Create a FastAPI app instance to pass to FastApiMCP
fastapi_app = FastAPI(
    title="AI Shopping Assistant",
    description="MCP server for the AI Shopping Assistant",
    version="0.1.0"
)

# Create the MCP server
mcp_server = FastApiMCP(
    fastapi=fastapi_app,  # Required positional argument
    auth_config=auth_config,
    http_client=http_client,
    describe_all_responses=True,
)

# Register all tools with the MCP server
# FastApiMCP likely uses a different API for tool registration
# Let's try accessing the fastapi app directly
for tool in mcp_tools:
    # Create a simple function to handle the tool execution
    async def tool_handler(request: Request, tool_obj=tool):
        return await tool_obj.execute(request)
    
    # Register the tool handler with the FastAPI app
    fastapi_app.post(
        f"/tools/{tool.name}",
        name=tool.name,
        description=tool.description
    )(tool_handler)

# System prompt for the AI Shopping Assistant
SYSTEM_PROMPT = """
You are an AI Shopping Assistant for the TAIC (Transformative AI Commerce) platform.
Your role is to help users find products they're looking for and provide helpful shopping advice.

When users ask about products, use the search_products tool to find relevant items.
If users want to browse categories, use the get_categories tool to show available product categories.

Always be friendly, concise, and helpful. Focus on understanding the user's needs and providing
relevant product recommendations. If you can't find exactly what they're looking for,
suggest alternatives or ask clarifying questions.

Remember that all prices are in TAIC cryptocurrency. When mentioning prices, always include "TAIC"
after the amount (e.g., "10.99 TAIC").

If a user asks about something unrelated to shopping or the TAIC platform, politely redirect
the conversation back to shopping-related topics.
"""

# FastApiMCP doesn't have a configure method
# We'll need to find another way to set the system prompt
# For now, we'll store it as an attribute that can be accessed later
mcp_server.system_prompt = SYSTEM_PROMPT

def get_mcp_server() -> FastApiMCP:
    """Get the MCP server instance."""
    return mcp_server
