"""
AI Shopping Assistant Agent Proxy Router.
This router forwards requests to the dedicated agent service running in its own virtual environment.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, AsyncGenerator
import httpx
import json
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

router = APIRouter()

# Get agent service URL from environment or use default
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8001")

# Create an HTTP client for communicating with the agent service
http_client = httpx.AsyncClient(base_url=AGENT_SERVICE_URL, timeout=60.0)


class ShoppingAssistantRequest(BaseModel):
    """Request model for the AI Shopping Assistant."""
    query: str = Field(..., description="User's shopping query")
    conversation_history: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, 
        description="Previous conversation messages"
    )
    user_id: Optional[str] = Field(None, description="Authenticated user ID, if available")


async def forward_to_agent_service(endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Forward a request to the agent service.
    
    Args:
        endpoint: The endpoint to call on the agent service
        data: The request data to send
        
    Returns:
        The response from the agent service
    """
    try:
        response = await http_client.post(
            endpoint,
            json=data,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Agent service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error forwarding request to agent service: {str(e)}")


async def stream_from_agent_service(endpoint: str, data: Dict[str, Any]) -> AsyncGenerator[str, None]:
    """
    Stream a response from the agent service.
    
    Args:
        endpoint: The endpoint to call on the agent service
        data: The request data to send
        
    Yields:
        SSE formatted data from the agent service
    """
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{AGENT_SERVICE_URL}{endpoint}",
                json=data,
                headers={"Content-Type": "application/json"}
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        yield line + "\n\n"
    except httpx.HTTPStatusError as e:
        error_response = {
            "responseType": "error",
            "responseText": "Sorry, I encountered an error while processing your request. Please try again later.",
            "products": None,
            "error": f"Agent service error: {str(e)}",
            "done": True
        }
        yield f"data: {json.dumps(error_response)}\n\n"
    except httpx.RequestError as e:
        error_response = {
            "responseType": "error",
            "responseText": "Sorry, the AI Shopping Assistant is not available at the moment. Please try again later.",
            "products": None,
            "error": f"Agent service unavailable: {str(e)}",
            "done": True
        }
        yield f"data: {json.dumps(error_response)}\n\n"
    except Exception as e:
        error_response = {
            "responseType": "error",
            "responseText": "Sorry, I encountered an error while processing your request. Please try again later.",
            "products": None,
            "error": f"Error streaming from agent service: {str(e)}",
            "done": True
        }
        yield f"data: {json.dumps(error_response)}\n\n"


@router.post("/shopping-assistant-agent")
async def shopping_assistant_agent(request: ShoppingAssistantRequest):
    """
    Process a shopping assistant request by forwarding it to the agent service.
    """
    return await forward_to_agent_service("/shopping-assistant", request.model_dump())


@router.post("/shopping-assistant-agent/stream")
async def shopping_assistant_agent_stream(request: ShoppingAssistantRequest):
    """
    Process a shopping assistant request and return a streaming response from the agent service.
    """
    return StreamingResponse(
        stream_from_agent_service("/shopping-assistant/stream", request.model_dump()),
        media_type="text/event-stream"
    )


@router.get("/agent-health")
async def agent_health():
    """
    Check the health of the agent service.
    """
    try:
        response = await http_client.get("/health")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {
            "status": "error",
            "message": f"Agent service health check failed: {str(e)}",
            "agent_service_url": AGENT_SERVICE_URL
        }
