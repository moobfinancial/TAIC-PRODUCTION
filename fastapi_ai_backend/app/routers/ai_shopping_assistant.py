"""
AI Shopping Assistant router for handling shopping assistant requests.
This router integrates with the MCP server to provide AI-powered shopping assistance.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from ..mcp.server import get_mcp_server
from ..db import get_db_connection, release_db_connection
import json

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


class ShoppingAssistantResponse(BaseModel):
    """Response model for the AI Shopping Assistant."""
    responseType: str = Field(..., description="Type of response (products, clarification, no_results, error)")
    responseText: str = Field(..., description="AI's conversational response text")
    products: Optional[List[ProductResponse]] = Field(None, description="List of product recommendations")
    clarificationMessage: Optional[str] = Field(None, description="Message asking for clarification")


@router.post("/shopping-assistant", response_model=ShoppingAssistantResponse)
async def shopping_assistant(request: ShoppingAssistantRequest):
    """
    Process a shopping assistant request and return AI-generated response with product recommendations.
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
        
        # Call the MCP server to generate a response
        mcp_response = await mcp_server.agenerate(messages=messages)
        
        # Parse the MCP response
        if not mcp_response or not mcp_response.choices or not mcp_response.choices[0].message:
            raise HTTPException(status_code=500, detail="Failed to generate response from MCP server")
        
        ai_message = mcp_response.choices[0].message.content
        
        # Default response with no products
        response = ShoppingAssistantResponse(
            responseType="no_results",
            responseText=ai_message,
            products=None
        )
        
        # Process any tool calls to extract product data
        products_data = []
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
                            ))
                    finally:
                        await release_db_connection(conn)
                        
                    # Set response type to products if we found any
                    if products_data:
                        response.responseType = "products"
                        response.products = products_data
                except Exception as e:
                    print(f"Error processing search_products tool call: {str(e)}")
        
        # Check if the response is asking for clarification
        if not products_data and ("could you tell me more" in ai_message.lower() or "could you provide more details" in ai_message.lower()):
            response.responseType = "clarification"
            response.clarificationMessage = ai_message
        
        return response
        
    except Exception as e:
        print(f"Error in shopping_assistant endpoint: {str(e)}")
        return ShoppingAssistantResponse(
            responseType="error",
            responseText=f"An error occurred while processing your request. Please try again later.",
            products=None
        )
