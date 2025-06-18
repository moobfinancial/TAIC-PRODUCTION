"""
AI Shopping Assistant router with SSE streaming support.
This router integrates with the MCP server to provide streaming AI-powered shopping assistance.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, AsyncGenerator
import json
import asyncio

from ..mcp.server import get_mcp_server
from ..db import get_db_connection, release_db_connection

router = APIRouter()

class ShoppingAssistantRequest(BaseModel):
    """Request model for the AI Shopping Assistant."""
    query: str = Field(..., description="User's shopping query")
    conversation_history: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, 
        description="Previous conversation messages"
    )
    user_id: Optional[str] = Field(None, description="Authenticated user ID, if available")


class ProductResponse(BaseModel):
    """Model for product data in the response."""
    id: str
    name: str
    description: Optional[str] = None
    price: float
    imageUrl: Optional[str] = None
    category: Optional[str] = None
    dataAiHint: Optional[str] = None


async def stream_shopping_assistant_response(request: ShoppingAssistantRequest) -> AsyncGenerator[str, None]:
    """
    Generate a streaming response for the AI Shopping Assistant.
    """
    try:
        mcp_server = get_mcp_server()
        
        # Format the conversation history for the MCP server
        messages = []
        
        # Add previous conversation messages if available
        if request.conversation_history:
            for msg in request.conversation_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                messages.append({"role": role, "content": content})
        
        # Add the current user query
        messages.append({"role": "user", "content": request.query})
        
        # Initial response data
        response_data = {
            "responseType": "thinking",
            "responseText": "",
            "products": None,
            "done": False
        }
        
        # Send initial thinking state
        yield f"data: {json.dumps(response_data)}\n\n"
        await asyncio.sleep(0.1)  # Small delay to ensure client receives the initial state
        
        # Call the MCP server to generate a streaming response
        async for chunk in mcp_server.astream(messages=messages):
            if not chunk.choices or not chunk.choices[0].delta:
                continue
                
            delta = chunk.choices[0].delta
            
            # Update response text if content is provided
            if delta.content:
                response_data["responseText"] += delta.content
                response_data["responseType"] = "in_progress"
                yield f"data: {json.dumps(response_data)}\n\n"
        
        # After streaming is complete, process any tool calls to extract product data
        products_data = []
        
        # Get the final response to check for tool calls
        mcp_response = await mcp_server.agenerate(messages=messages)
        if mcp_response and mcp_response.choices and mcp_response.choices[0].message:
            tool_calls = mcp_response.choices[0].message.tool_calls or []
            
            for tool_call in tool_calls:
                if tool_call.function.name == "search_products":
                    try:
                        # If we have a search_products tool call, let's fetch actual products from the database
                        args = json.loads(tool_call.function.arguments)
                        query = args.get("query", "")
                        category = args.get("category", None)
                        price_min = args.get("price_min", None)
                        price_max = args.get("price_max", None)
                        limit = args.get("limit", 10)
                        
                        # Connect to the database and fetch products
                        conn = await get_db_connection()
                        try:
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
                            
                            # Convert the database results to product objects
                            for row in results:
                                products_data.append(ProductResponse(
                                    id=str(row['id']),
                                    name=row['name'],
                                    description=row['description'],
                                    price=float(row['price']),
                                    imageUrl=row['image_url'],
                                    category=row['category'],
                                    dataAiHint=row['data_ai_hint']
                                ).dict())
                        finally:
                            await release_db_connection(conn)
                    except Exception as e:
                        print(f"Error processing search_products tool call: {str(e)}")
        
        # Final response with products if available
        if products_data:
            response_data["responseType"] = "products"
            response_data["products"] = products_data
        elif "could you tell me more" in response_data["responseText"].lower() or "could you provide more details" in response_data["responseText"].lower():
            response_data["responseType"] = "clarification"
        else:
            response_data["responseType"] = "no_results"
            
        response_data["done"] = True
        yield f"data: {json.dumps(response_data)}\n\n"
        
    except Exception as e:
        print(f"Error in streaming shopping assistant: {str(e)}")
        error_response = {
            "responseType": "error",
            "responseText": "Sorry, I encountered an error while processing your request. Please try again later.",
            "products": None,
            "error": str(e),
            "done": True
        }
        yield f"data: {json.dumps(error_response)}\n\n"


@router.post("/shopping-assistant/stream")
async def shopping_assistant_stream(request: ShoppingAssistantRequest):
    """
    Process a shopping assistant request and return a streaming response with AI-generated content and product recommendations.
    """
    return StreamingResponse(
        stream_shopping_assistant_response(request),
        media_type="text/event-stream"
    )
