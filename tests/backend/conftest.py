import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app, get_db
from src.database import Base

# Test database URL - using SQLite in-memory for tests
TEST_DATABASE_URL = "sqlite:///:memory:"

# Create engine and session for testing
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create test database tables
Base.metadata.create_all(bind=engine)

def override_get_db():
    """Override dependency to use test database"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def test_db():
    """Fixture to provide a test database session"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()

@pytest.fixture(scope="module")
def client():
    """Fixture to provide a test client"""
    # Override the database dependency
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Clean up overrides
    app.dependency_overrides = {}

@pytest.fixture(scope="function")
def auth_client(client, test_db):
    """Fixture to provide an authenticated test client"""
    # Create a test user
    from src.models import User
    from src.auth.utils import get_password_hash
    
    test_user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpassword"),
        is_active=True,
        is_verified=True
    )
    test_db.add(test_user)
    test_db.commit()
    
    # Get token
    response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "testpassword"},
    )
    token = response.json()["access_token"]
    
    # Set auth header
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    return client

# Add any other common fixtures below

if __name__ == "__main__":
    # This allows running the tests directly with Python
    pytest.main(["-v"])
