import pytest
import asyncpg
from fastapi import status # Add this import
from httpx import AsyncClient

# Models will be imported from app.models.product by the router, tests interact with API contracts

# These product IDs are assumed based on the seed data in conftest.py
# Product 'Wireless Headphones' is expected to have ID 1
# Product 'T-Shirt' is expected to have ID 2
TEST_PRODUCT_ID_HEADPHONES = 1 # Product IDs are now strings (UUIDs or similar) in the router, but SERIAL in DB for now.
                                # The router uses product_id: str. Let's assume our seeded IDs are treated as strings by the path.
                                # For consistency, if product.id is INT in DB, router should cast path param.
                                # Let's keep as string for now to match router path param type hint.
                                # If products.id is INT, router path param should be int, or cast.
                                # The existing product router uses `product_id: str`, so we'll use string here.
                                # The conftest.py seeds products with SERIAL IDs (int).
                                # The product_variants router uses product_id: str in path.
                                # This implies the router is expected to handle string IDs, even if DB uses int.
                                # For tests, we'll use string IDs that correspond to the integer IDs from seeding.

TEST_PRODUCT_ID_TSHIRT = 2

@pytest.mark.asyncio
async def test_create_product_variant(auth_client: AsyncClient):
    variant_data = {
        "sku": "WH-BLU-001", # product_id is part of the path
        "attributes": {"Color": "Blue", "Material": "Plastic"},
        "specific_price": 109.99,
        "stock_quantity": 25,
        "image_url": "https://example.com/images/headphones_blue.jpg"
    }
    # The router uses /products/{product_id}/variants
    response = await auth_client.post(f"/api/v1/products/{TEST_PRODUCT_ID_HEADPHONES}/variants", json=variant_data)
    assert response.status_code == 201
    data = response.json()
    assert data["sku"] == variant_data["sku"]
    assert data["attributes"] == variant_data["attributes"]
    assert data["specific_price"] == variant_data["specific_price"]
    assert data["product_id"] == TEST_PRODUCT_ID_HEADPHONES # Router should return product_id as string
    assert "id" in data

@pytest.mark.asyncio
async def test_list_variants_for_product(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    response = await client.get(f"/api/v1/products/{TEST_PRODUCT_ID_HEADPHONES}/variants")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Based on conftest.py, Wireless Headphones should have 2 variants (Black, White)
    assert len(data) >= 2
    assert any(v["attributes"].get("Color") == "Black" for v in data)
    assert any(v["attributes"].get("Color") == "White" for v in data)

@pytest.mark.asyncio
async def test_get_product_variant(client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    # First, get a known variant's ID from the list to make the test robust
    list_response = await client.get(f"/api/v1/products/{TEST_PRODUCT_ID_HEADPHONES}/variants")
    assert list_response.status_code == 200
    variants = list_response.json()
    assert len(variants) > 0
    # Find the 'Black' variant for headphones, assuming SKU 'WH-BLK-001' from seed
    black_variant = next((v for v in variants if v["sku"] == "WH-BLK-001"), None)
    assert black_variant is not None
    variant_id_to_get = black_variant["id"]

    response = await client.get(f"/api/v1/variants/{variant_id_to_get}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == variant_id_to_get
    assert data["sku"] == "WH-BLK-001"
    assert data["product_id"] == TEST_PRODUCT_ID_HEADPHONES

@pytest.mark.asyncio
async def test_update_product_variant(auth_client: AsyncClient, verbose_db_conn: asyncpg.Connection):
    # Get a variant to update, e.g., T-Shirt, Size M (SKU: TS-M-001)
    list_response = await auth_client.get(f"/api/v1/products/{TEST_PRODUCT_ID_TSHIRT}/variants")
    assert list_response.status_code == 200
    variants = list_response.json()
    variant_to_update = next((v for v in variants if v["sku"] == "TS-M-001"), None)
    assert variant_to_update is not None
    variant_id_to_update = variant_to_update["id"]

    update_data = {"stock_quantity": 90, "specific_price": 20.50} # Updated price
    response = await auth_client.put(f"/api/v1/variants/{variant_id_to_update}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["stock_quantity"] == update_data["stock_quantity"]
    assert data["specific_price"] == update_data["specific_price"]
    assert data["id"] == variant_id_to_update
    assert data["sku"] == "TS-M-001" # SKU should remain unchanged unless specified

@pytest.mark.asyncio
async def test_delete_product_variant(auth_client: AsyncClient):
    # Create a new variant specifically for this test to delete
    variant_to_delete_payload = {
        "sku": "TS-DEL-TEMP-001",
        "attributes": {"Color": "Temporary", "Size": "ToDelete"},
        "stock_quantity": 5
    }
    create_response = await auth_client.post(f"/api/v1/products/{TEST_PRODUCT_ID_TSHIRT}/variants", json=variant_to_delete_payload)
    assert create_response.status_code == 201
    variant_id_to_delete = create_response.json()["id"]

    delete_response = await auth_client.delete(f"/api/v1/variants/{variant_id_to_delete}")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    # Verify it's actually marked as deleted or truly gone (router might just mark as inactive or return 404)
    get_response = await auth_client.get(f"/api/v1/variants/{variant_id_to_delete}")
    assert get_response.status_code == status.HTTP_404_NOT_FOUND
