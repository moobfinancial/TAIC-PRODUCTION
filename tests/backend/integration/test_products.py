import pytest
from fastapi import status
from sqlalchemy.orm import Session

from src.models import Product, User, Merchant


def test_create_product(auth_client, test_db: Session):
    """Test creating a new product"""
    # Arrange - create a test merchant
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    product_data = {
        "name": "Test Product",
        "description": "A test product",
        "price": 99.99,
        "stock_quantity": 10,
        "merchant_id": merchant.id,
        "category_id": 1,
        "is_active": True
    }
    
    # Act
    response = auth_client.post("/api/products/", json=product_data)
    
    # Assert
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == product_data["name"]
    assert data["price"] == product_data["price"]
    assert data["merchant_id"] == merchant.id
    assert "id" in data
    
    # Verify in database
    db_product = test_db.query(Product).filter(Product.id == data["id"]).first()
    assert db_product is not None
    assert db_product.name == product_data["name"]
    assert db_product.price == product_data["price"]


def test_get_products(auth_client, test_db: Session):
    """Test retrieving a list of products"""
    # Arrange - create test products
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    products = [
        Product(
            name=f"Product {i}",
            description=f"Description {i}",
            price=10.99 * (i + 1),
            stock_quantity=5,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ) for i in range(5)
    ]
    test_db.add_all(products)
    test_db.commit()
    
    # Act
    response = auth_client.get("/api/products/")
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5  # Should return at least the 5 we created
    
    # Verify pagination if implemented
    if "total" in data and "items" in data:
        assert data["total"] >= 5
        assert len(data["items"]) <= data["total"]


def test_get_product(auth_client, test_db: Session):
    """Test retrieving a single product"""
    # Arrange - create a test product
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    product = Product(
        name="Test Product",
        description="A test product",
        price=99.99,
        stock_quantity=10,
        merchant_id=merchant.id,
        category_id=1,
        is_active=True
    )
    test_db.add(product)
    test_db.commit()
    test_db.refresh(product)
    
    # Act
    response = auth_client.get(f"/api/products/{product.id}")
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == product.id
    assert data["name"] == product.name
    assert data["price"] == product.price


def test_update_product(auth_client, test_db: Session):
    """Test updating a product"""
    # Arrange - create a test product
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    product = Product(
        name="Original Product",
        description="Original description",
        price=50.00,
        stock_quantity=5,
        merchant_id=merchant.id,
        category_id=1,
        is_active=True
    )
    test_db.add(product)
    test_db.commit()
    test_db.refresh(product)
    
    update_data = {
        "name": "Updated Product Name",
        "price": 75.50,
        "description": "Updated description"
    }
    
    # Act
    response = auth_client.put(
        f"/api/products/{product.id}",
        json=update_data
    )
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == product.id
    assert data["name"] == update_data["name"]
    assert data["price"] == update_data["price"]
    assert data["description"] == update_data["description"]
    
    # Verify in database
    test_db.refresh(product)
    assert product.name == update_data["name"]
    assert product.price == update_data["price"]


def test_delete_product(auth_client, test_db: Session):
    """Test deleting a product"""
    # Arrange - create a test product
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    product = Product(
        name="Product to Delete",
        description="Will be deleted",
        price=25.00,
        stock_quantity=3,
        merchant_id=merchant.id,
        category_id=1,
        is_active=True
    )
    test_db.add(product)
    test_db.commit()
    test_db.refresh(product)
    
    # Act
    response = auth_client.delete(f"/api/products/{product.id}")
    
    # Assert
    assert response.status_code == status.HTTP_204_NO_CONTENT
    
    # Verify product is no longer in database
    db_product = test_db.query(Product).filter(Product.id == product.id).first()
    assert db_product is None
