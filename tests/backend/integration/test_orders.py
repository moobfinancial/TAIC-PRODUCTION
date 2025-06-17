import pytest
from fastapi import status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from unittest.mock import patch

from src.models import Order, OrderItem, Product, User, Payment
from src.schemas.order import OrderStatus, OrderCreate, OrderUpdate


def test_create_order(auth_client, test_db: Session, test_user: User, test_products: list[Product]):
    """Test creating a new order"""
    # Arrange
    order_data = {
        "items": [
            {"product_id": test_products[0].id, "quantity": 2},
            {"product_id": test_products[1].id, "quantity": 1}
        ],
        "shipping_address": "123 Test St, Test City, 12345",
        "billing_address": "123 Test St, Test City, 12345"
    }
    
    # Calculate expected total
    expected_total = (test_products[0].price * 2) + test_products[1].price
    
    # Act
    with patch('src.utils.payments.process_payment') as mock_process_payment:
        mock_process_payment.return_value = {"status": "succeeded", "transaction_id": "txn_123"}
        response = auth_client.post("/api/orders/", json=order_data)
    
    # Assert
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["status"] == OrderStatus.PROCESSING.value
    assert data["total_amount"] == expected_total
    assert len(data["items"]) == 2
    assert data["user_id"] == test_user.id
    
    # Verify order items
    assert any(item["product_id"] == test_products[0].id and item["quantity"] == 2 
              for item in data["items"])
    assert any(item["product_id"] == test_products[1].id and item["quantity"] == 1 
              for item in data["items"])
    
    # Verify payment was processed
    db_order = test_db.query(Order).filter(Order.id == data["id"]).first()
    assert db_order.payment.transaction_id == "txn_123"
    assert db_order.payment.amount == expected_total
    assert db_order.payment.status == "succeeded"


def test_get_orders(auth_client, test_orders: list[Order]):
    """Test retrieving a list of orders for the authenticated user"""
    # Act
    response = auth_client.get("/api/orders/")
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= len(test_orders)  # Should return at least the test orders
    
    # Verify orders belong to the test user
    for order in data:
        assert order["user_id"] == test_orders[0].user_id


def test_get_order_detail(auth_client, test_order: Order):
    """Test retrieving a specific order"""
    # Act
    response = auth_client.get(f"/api/orders/{test_order.id}")
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == test_order.id
    assert data["status"] == test_order.status
    assert len(data["items"]) == len(test_order.items)


def test_update_order_status(auth_client, test_order: Order, admin_user: User):
    """Test updating order status (admin only)"""
    # Arrange
    update_data = {"status": "shipped", "tracking_number": "TRACK123"}
    
    # Act - use admin client to update status
    response = auth_client.put(
        f"/api/admin/orders/{test_order.id}",
        json=update_data
    )
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "shipped"
    assert data["tracking_number"] == "TRACK123"
    assert data["shipped_at"] is not None


def test_order_status_workflow(auth_client, test_db: Session, test_products: list[Product]):
    """Test the complete order status workflow"""
    # 1. Create order
    order_data = {
        "items": [{"product_id": test_products[0].id, "quantity": 1}],
        "shipping_address": "123 Test St"
    }
    
    with patch('src.utils.payments.process_payment') as mock_process_payment:
        mock_process_payment.return_value = {"status": "succeeded", "transaction_id": "txn_123"}
        response = auth_client.post("/api/orders/", json=order_data)
    
    assert response.status_code == status.HTTP_201_CREATED
    order_id = response.json()["id"]
    
    # 2. Verify initial status is 'processing'
    response = auth_client.get(f"/api/orders/{order_id}")
    assert response.json()["status"] == "processing"
    
    # 3. Update to 'shipped'
    update_data = {"status": "shipped", "tracking_number": "TRACK123"}
    response = auth_client.put(f"/api/admin/orders/{order_id}", json=update_data)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "shipped"
    
    # 4. Update to 'delivered'
    update_data = {"status": "delivered"}
    response = auth_client.put(f"/api/admin/orders/{order_id}", json=update_data)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "delivered"
    assert response.json()["delivered_at"] is not None


def test_order_validation(auth_client, test_products: list[Product]):
    """Test order validation rules"""
    # Test empty items
    response = auth_client.post("/api/orders/", json={"items": [], "shipping_address": "123 Test St"})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Test invalid quantity
    response = auth_client.post(
        "/api/orders/", 
        json={"items": [{"product_id": test_products[0].id, "quantity": 0}], "shipping_address": "123 Test St"}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Test insufficient stock
    response = auth_client.post(
        "/api/orders/", 
        json={"items": [{"product_id": test_products[0].id, "quantity": 9999}], "shipping_address": "123 Test St"}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@patch('src.utils.payments.process_payment')
def test_payment_failure_handling(mock_process_payment, auth_client, test_products: list[Product]):
    """Test order creation with payment failure"""
    # Arrange
    order_data = {
        "items": [{"product_id": test_products[0].id, "quantity": 1}],
        "shipping_address": "123 Test St"
    }
    
    # Mock payment failure
    mock_process_payment.return_value = {"status": "failed", "error": "Insufficient funds"}
    
    # Act
    response = auth_client.post("/api/orders/", json=order_data)
    
    # Assert
    assert response.status_code == status.HTTP_402_PAYMENT_REQUIRED
    assert "payment" in response.json()["detail"].lower()


def test_order_cancellation(auth_client, test_order: Order):
    """Test order cancellation by the customer"""
    # Act - cancel the order
    response = auth_client.post(f"/api/orders/{test_order.id}/cancel")
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "cancelled"
    assert data["cancelled_at"] is not None
    
    # Verify cancellation reason is logged
    assert data["cancellation_reason"] is not None


def test_order_history(auth_client, test_orders: list[Order]):
    """Test retrieving order history with filters"""
    # Test filtering by status
    response = auth_client.get("/api/orders/?status=completed")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert all(order["status"] == "completed" for order in data)
    
    # Test date range filtering
    end_date = datetime.utcnow().isoformat()
    start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
    response = auth_client.get(f"/api/orders/?start_date={start_date}&end_date={end_date}")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) > 0
