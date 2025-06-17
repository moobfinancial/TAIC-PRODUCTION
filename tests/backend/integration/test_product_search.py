import pytest
from fastapi import status
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock

from src.models import Product, Category, Merchant
from src.schemas.product import ProductSortBy, ProductSortOrder


def test_search_products_by_keyword(auth_client, test_db: Session, test_products: list[Product]):
    """Test searching products by keyword"""
    # Arrange - add more test products
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    # Add products with specific names for testing search
    search_products = [
        Product(
            name="Premium Wireless Headphones",
            description="High-quality wireless headphones with noise cancellation",
            price=199.99,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ),
        Product(
            name="Wireless Earbuds Pro",
            description="Premium wireless earbuds with charging case",
            price=149.99,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ),
        Product(
            name="Wired Headphones",
            description="Basic wired headphones",
            price=29.99,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        )
    ]
    test_db.add_all(search_products)
    test_db.commit()
    
    # Act - search for "wireless"
    response = auth_client.get("/api/products/search?q=wireless")
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "items" in data
    assert data["total"] == 2  # Should find 2 wireless products
    assert all("wireless" in product["name"].lower() or 
               "wireless" in product["description"].lower() 
               for product in data["items"])


def test_search_with_filters(auth_client, test_db: Session, test_products: list[Product]):
    """Test searching products with filters"""
    # Arrange - create categories and products with different prices
    electronics = Category(name="Electronics", slug="electronics")
    clothing = Category(name="Clothing", slug="clothing")
    test_db.add_all([electronics, clothing])
    test_db.commit()
    
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    # Add test products
    products = [
        Product(
            name="Smartphone", 
            price=699.99, 
            category_id=electronics.id,
            merchant_id=merchant.id,
            is_active=True
        ),
        Product(
            name="Laptop", 
            price=1299.99, 
            category_id=electronics.id,
            merchant_id=merchant.id,
            is_active=True
        ),
        Product(
            name="T-Shirt", 
            price=24.99, 
            category_id=clothing.id,
            merchant_id=merchant.id,
            is_active=True
        ),
    ]
    test_db.add_all(products)
    test_db.commit()
    
    # Test category filter
    response = auth_client.get(f"/api/products/search?category_id={electronics.id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 2
    assert all(p["category_id"] == electronics.id for p in data["items"])
    
    # Test price range
    response = auth_client.get("/api/products/search?min_price=500&max_price=1000")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Smartphone"
    
    # Test multiple filters
    response = auth_client.get(f"/api/products/search?category_id={electronics.id}&min_price=1000")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Laptop"


def test_search_sorting(auth_client, test_db: Session):
    """Test sorting search results"""
    # Arrange - create test products with different prices and ratings
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    products = [
        Product(
            name="Product A", 
            price=99.99, 
            rating=4.2,
            review_count=50,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ),
        Product(
            name="Product B", 
            price=49.99, 
            rating=4.8,
            review_count=100,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ),
        Product(
            name="Product C", 
            price=149.99, 
            rating=4.5,
            review_count=75,
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ),
    ]
    test_db.add_all(products)
    test_db.commit()
    
    # Test sort by price ascending
    response = auth_client.get("/api/products/search?sort_by=price&sort_order=asc")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    prices = [p["price"] for p in data["items"]]
    assert prices == sorted(prices)
    
    # Test sort by rating descending
    response = auth_client.get("/api/products/search?sort_by=rating&sort_order=desc")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    ratings = [p["rating"] for p in data["items"]]
    assert ratings == sorted(ratings, reverse=True)
    
    # Test sort by popularity (review count)
    response = auth_client.get("/api/products/search?sort_by=popularity")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    review_counts = [p["review_count"] for p in data["items"]]
    assert review_counts == sorted(review_counts, reverse=True)


def test_search_pagination(auth_client, test_db: Session):
    """Test pagination of search results"""
    # Arrange - create multiple test products
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    # Create 15 test products
    products = [
        Product(
            name=f"Product {i}",
            price=10.99 * (i + 1),
            merchant_id=merchant.id,
            category_id=1,
            is_active=True
        ) 
        for i in range(15)
    ]
    test_db.add_all(products)
    test_db.commit()
    
    # Test default pagination (first page, 10 items)
    response = auth_client.get("/api/products/search")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 15
    assert len(data["items"]) == 10
    assert data["page"] == 1
    assert data["per_page"] == 10
    assert data["total_pages"] == 2
    
    # Test second page
    response = auth_client.get("/api/products/search?page=2&per_page=5")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["items"]) == 5
    assert data["page"] == 2
    assert data["per_page"] == 5
    assert data["total_pages"] == 3

@patch('src.services.search.SearchService.search_products')
def test_search_service_integration(mock_search, auth_client):
    """Test integration with the search service"""
    # Mock the search service response
    mock_results = {
        "items": [
            {"id": 1, "name": "Mock Product", "price": 99.99, "score": 0.95},
            {"id": 2, "name": "Another Mock", "price": 49.99, "score": 0.85},
        ],
        "total": 2,
        "facets": {"category": [], "price_ranges": []}
    }
    mock_search.return_value = mock_results
    
    # Make the request
    response = auth_client.get("/api/products/search?q=mock")
    
    # Verify the search service was called correctly
    mock_search.assert_called_once()
    
    # Verify the response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["name"] == "Mock Product"


def test_search_with_invalid_filters(auth_client):
    """Test handling of invalid filter parameters"""
    # Test invalid price range
    response = auth_client.get("/api/products/search?min_price=abc&max_price=xyz")
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Test invalid category ID
    response = auth_client.get("/api/products/search?category_id=not_an_id")
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Test invalid sort parameters
    response = auth_client.get("/api/products/search?sort_by=invalid_field&sort_order=invalid_order")
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_search_performance(auth_client, benchmark):
    """Performance test for search endpoint"""
    # This test uses pytest-benchmark to measure performance
    def search_products():
        return auth_client.get("/api/products/search?q=test")
    
    # Run the benchmark
    result = benchmark.pedantic(
        search_products,
        setup=lambda: None,
        rounds=10,
        iterations=3
    )
    
    # Basic performance assertion (adjust based on your requirements)
    assert result.elapsed < 1.0  # Should complete in less than 1 second


# Test search with different user roles
def test_search_with_different_roles(admin_client, merchant_client, user_client, test_db: Session):
    """Test search functionality with different user roles"""
    # Add a product that's only visible to admins/merchants
    merchant = Merchant(
        business_name="Test Merchant",
        business_email="merchant@example.com",
        business_phone="+1234567890"
    )
    test_db.add(merchant)
    test_db.commit()
    
    product = Product(
        name="Admin Only Product",
        price=999.99,
        merchant_id=merchant.id,
        category_id=1,
        is_active=True,
        is_approved=False  # Not approved, should be hidden from regular users
    )
    test_db.add(product)
    test_db.commit()
    
    # Regular user shouldn't see unapproved products
    response = user_client.get("/api/products/search")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert not any(p["name"] == "Admin Only Product" for p in data["items"])
    
    # Merchant should see their own unapproved products
    response = merchant_client.get("/api/products/search")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert any(p["name"] == "Admin Only Product" for p in data["items"])
    
    # Admin should see all products
    response = admin_client.get("/api/products/search")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert any(p["name"] == "Admin Only Product" for p in data["items"])


def test_search_analytics(auth_client, test_db: Session):
    """Test that search analytics are being tracked"""
    # Mock the analytics service
    with patch('src.services.analytics.AnalyticsService.track_search') as mock_track:
        # Perform a search
        response = auth_client.get("/api/products/search?q=headphones")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify the search was tracked
        mock_track.assert_called_once()
        args, kwargs = mock_track.call_args
        assert "headphones" in args[0]  # search query
        assert "user_id" in kwargs  # should include user context
