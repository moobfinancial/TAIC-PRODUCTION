import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.sql import text
import json

# Test data
TEST_PRODUCTS = [
    {
        "name": "Wireless Headphones",
        "description": "High-quality wireless headphones with noise cancellation.",
        "price": 99.99,
        "category_id": 1,
        "image_url": "/images/headphones.jpg",
        "is_active": True
    },
    {
        "name": "Bluetooth Speaker",
        "description": "Portable bluetooth speaker with great sound",
        "price": 79.99,
        "category_id": 1,
        "image_url": "/images/speaker.jpg",
        "is_active": True
    },
    {
        "name": "T-Shirt",
        "description": "Comfortable cotton t-shirt",
        "price": 19.99,
        "category_id": 2,
        "image_url": "/images/tshirt.jpg",
        "is_active": True
    },
]

@pytest.mark.asyncio
async def test_search_products(client: AsyncClient, test_db, verbose_db_conn):
    """Test searching products with filters"""
    # Test relies on products seeded in conftest.py
    
    # Test search by keyword
    response = await client.get("/api/products/search?q=wireless")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["items"]) == 1
    assert "Wireless Headphones" in [p["name"] for p in data["items"]]
    
    # Test filter by category
    response = await client.get("/api/products/search?category_id=1")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["items"]) == 1  # Should find 1 electronic product (Wireless Headphones from seed)
    
    # Test price range filter
    response = await client.get("/api/products/search?min_price=50&max_price=100")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["items"]) == 1  # Should find 1 product (Wireless Headphones from seed)
    assert all(50 <= p["price"] <= 100 for p in data["items"])

@pytest.mark.asyncio
async def test_get_product_detail(client: AsyncClient, test_db):
    """Test getting a single product by ID"""
    # Get ID of pre-seeded "Wireless Headphones"
    async with test_db.acquire() as conn:
        product_id = await conn.fetchval(
            """
            SELECT id FROM products WHERE name = 'Wireless Headphones'
            """
        )
    assert product_id is not None, "Seeded 'Wireless Headphones' not found"
    
    # Test get product by ID
    response = await client.get(f"/api/products/{product_id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == TEST_PRODUCTS[0]["name"]
    assert data["description"] == "High-quality wireless headphones with noise cancellation."
    assert float(data["price"]) == TEST_PRODUCTS[0]["price"]

@pytest.mark.asyncio
async def test_create_product(auth_client: AsyncClient, test_db):
    """Test creating a new product"""
    # Create test category if it doesn't exist
    async with test_db.acquire() as conn:
        category_id = await conn.fetchval(
            """
            INSERT INTO categories (name, slug, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            "Test Category Create", "test-category-create", "Test category for creation"
        )
    
    # Test create product
    new_product = {
        "name": "New Test Product Create",
        "description": "A new test product for creation",
        "price": 49.99,
        "category_id": category_id,
        "image_url": "/images/test_create.jpg"
    }
    
    response = await auth_client.post("/api/products/", json=new_product)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    
    assert data["name"] == new_product["name"]
    assert data["description"] == new_product["description"]
    assert float(data["price"]) == new_product["price"]
    assert data["category_id"] == category_id
    assert data["image_url"] == new_product["image_url"]
    assert data["is_active"] is True  # Default value

@pytest.mark.asyncio
async def test_update_product(auth_client: AsyncClient, test_db):
    """Test updating an existing product"""
    # Insert test product
    async with test_db.acquire() as conn:
        # Ensure a unique category for this test to avoid conflicts if run multiple times or in parallel
        category_id_update = await conn.fetchval(
            """
            INSERT INTO categories (name, slug, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            "Test Category Update", "test-category-update", "Test category for update"
        )
        product_id = await conn.fetchval(
            """
            INSERT INTO products (name, description, price, category_id, image_url, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            "Old Product Name Update",
            "Old description update",
            29.99,
            category_id_update, # Use the specific category for this test
            "/images/old_update.jpg",
            True
        )
    
    # Test update product
    update_data = {
        "name": "Updated Product Name",
        "description": "Updated description",
        "price": 39.99,
        "is_active": False
    }
    
    response = await auth_client.put(f"/api/products/{product_id}", json=update_data)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    assert data["name"] == update_data["name"]
    assert data["description"] == update_data["description"]
    assert float(data["price"]) == update_data["price"]
    assert data["is_active"] == update_data["is_active"]

@pytest.mark.asyncio
async def test_delete_product(auth_client: AsyncClient, test_db):
    """Test deleting an existing product"""
    async with test_db.acquire() as conn:
        # Ensure a unique category for this test
        category_id_delete = await conn.fetchval(
            """
            INSERT INTO categories (name, slug, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            "Test Category Delete", "test-category-delete", "Test category for delete"
        )
        product_id = await conn.fetchval(
            """
            INSERT INTO products (name, description, price, category_id, image_url, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            "Product to Delete",
            "Description for delete",
            10.00,
            category_id_delete, # Use the specific category
            "/images/delete.jpg",
            True
        )

    response = await auth_client.delete(f"/api/products/{product_id}")
    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Verify product is deleted
    response = await auth_client.get(f"/api/products/{product_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
