import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.auth import utils as auth_utils
from src.models import User


def test_create_user(test_db: Session):
    """Test creating a new user"""
    # Arrange
    email = "test@example.com"
    password = "testpassword"
    
    # Act
    hashed_password = auth_utils.get_password_hash(password)
    user = User(email=email, hashed_password=hashed_password)
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Assert
    assert user.email == email
    assert user.hashed_password != password  # Password should be hashed
    assert user.is_active is True
    assert user.is_verified is False


def test_verify_password():
    """Test password verification"""
    # Arrange
    password = "testpassword"
    hashed_password = auth_utils.get_password_hash(password)
    
    # Act & Assert
    assert auth_utils.verify_password(password, hashed_password) is True
    assert auth_utils.verify_password("wrongpassword", hashed_password) is False


class TestAuthAPI:
    def test_register_new_user(self, client: TestClient):
        """Test user registration"""
        # Arrange
        user_data = {
            "email": "newuser@example.com",
            "password": "securepassword123",
            "confirm_password": "securepassword123"
        }
        
        # Act
        response = client.post("/api/auth/register", json=user_data)
        
        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == user_data["email"]
        assert "id" in data
        assert "hashed_password" not in data  # Sensitive data should not be returned
    
    def test_login_successful(self, client: TestClient, test_db: Session):
        """Test successful user login"""
        # Arrange - create a test user
        email = "test@example.com"
        password = "testpassword"
        hashed_password = auth_utils.get_password_hash(password)
        user = User(email=email, hashed_password=hashed_password, is_verified=True)
        test_db.add(user)
        test_db.commit()
        
        # Act
        response = client.post(
            "/api/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self, client: TestClient):
        """Test login with invalid credentials"""
        # Act
        response = client.post(
            "/api/auth/login",
            data={"username": "nonexistent@example.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        # Assert
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect email or password" in response.json()["detail"]


class TestProtectedEndpoints:
    def test_protected_endpoint_unauthorized(self, client: TestClient):
        """Test accessing protected endpoint without authentication"""
        # Act
        response = client.get("/api/users/me")
        
        # Assert
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_protected_endpoint_authorized(self, auth_client: TestClient):
        """Test accessing protected endpoint with valid token"""
        # Act
        response = auth_client.get("/api/users/me")
        
        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "email" in data
        assert data["email"] == "test@example.com"
