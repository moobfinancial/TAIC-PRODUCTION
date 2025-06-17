import pytest
import asyncpg
from httpx import AsyncClient

from app.agents.ai_shopping_assistant_agent import ShoppingAssistantQueryInputModel, ShoppingAssistantResponseModel

@pytest.mark.asyncio
async def test_process_user_query_returns_products(
    client: AsyncClient, test_db: asyncpg.Pool # test_db fixture ensures DB is initialized and seeded
):
    """Test that a query for existing products returns a 'products' response type with items."""
    query_input = ShoppingAssistantQueryInputModel(query="Headphones")

    response = await client.post(
        "/mcp_shopping_assistant_service/call_tool/process_user_query",
        json=query_input.model_dump()
    )

    assert response.status_code == 200
    
    response_data = ShoppingAssistantResponseModel.model_validate(response.json())
    
    assert response_data.responseType == "products"
    assert response_data.products is not None
    assert len(response_data.products) > 0
    # Check if a known product is in the results
    found_headphones = False
    for product in response_data.products:
        if "Headphones" in product.name:
            found_headphones = True
            break
    assert found_headphones, "Expected 'Wireless Headphones' to be in the results"

@pytest.mark.asyncio
async def test_process_user_query_no_results(
    client: AsyncClient, test_db: asyncpg.Pool
):
    """Test that a query for non-existent products returns a 'no_results' response type."""
    query_input = ShoppingAssistantQueryInputModel(query="Unobtainium Widget XZ")

    response = await client.post(
        "/mcp_shopping_assistant_service/call_tool/process_user_query",
        json=query_input.model_dump()
    )

    assert response.status_code == 200
    response_data = ShoppingAssistantResponseModel.model_validate(response.json())
    
    assert response_data.responseType == "no_results"
    assert response_data.products is None or len(response_data.products) == 0
    assert "couldn't find any matching products" in response_data.responseText.lower()

@pytest.mark.asyncio
async def test_process_user_query_clarification(
    client: AsyncClient, test_db: asyncpg.Pool
):
    """Test that a vague query returns a 'clarification' response type."""
    # The agent's current logic for clarification is based on query length (less than 3 words)
    query_input = ShoppingAssistantQueryInputModel(query="red")

    response = await client.post(
        "/mcp_shopping_assistant_service/call_tool/process_user_query",
        json=query_input.model_dump()
    )

    assert response.status_code == 200
    response_data = ShoppingAssistantResponseModel.model_validate(response.json())
    
    assert response_data.responseType == "clarification"
    assert response_data.products is None or len(response_data.products) == 0
    assert "could you tell me more" in response_data.responseText.lower()
    assert response_data.clarificationMessage is not None
