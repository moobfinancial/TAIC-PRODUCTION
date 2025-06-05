import pytest
import os
import sys
from pathlib import Path

# Add the project root to sys.path to allow imports like 'from payment_service.app import ...'
project_root = Path(__file__).resolve().parent.parent.parent # This should point to /app
sys.path.insert(0, str(project_root))

from unittest.mock import patch, MagicMock
from payment_service.app import app as flask_app


@pytest.fixture(scope='session')
def app():
    """Session-wide test Flask application."""
    # Set up test config
    flask_app.config.update({
        "TESTING": True,
        "STRIPE_SECRET_KEY": "sk_test_mockkey",
        "STRIPE_WEBHOOK_SECRET": "whsec_mocksecret",
        "DB_HOST": "mock_db_host",
        "DB_NAME": "mock_db_name",
        "DB_USER": "mock_db_user",
        "DB_PASSWORD": "mock_db_password",
        "NEXT_PUBLIC_PAYMENT_API_URL": "http://localhost:5000" # though not used by backend itself
    })

    # Prevent .env file from interfering with test configuration
    # by temporarily disabling load_dotenv during app setup for tests if it's called within create_app
    # If load_dotenv is at module level of app.py, this mock needs to be active when app.py is imported.
    # For simplicity, we assume .env is loaded and then overridden by flask_app.config.update.

    # If your app uses create_app pattern:
    # app = create_app({"TESTING": True, ...})
    # else, directly use the imported app instance:

    yield flask_app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def mock_db_connection():
    """Mocks the database connection and cursor."""
    # Create a mock connection and cursor
    mock_conn = MagicMock()
    mock_cur = MagicMock()

    # Configure mock_cur.fetchone() to return a value or None based on context
    # Example: mock_cur.fetchone.return_value = (1,) for RETURNING id
    # This will be configured per-test or with more specific fixtures if needed.

    # Configure mock_conn.cursor() to return our mock cursor
    mock_conn.cursor.return_value = mock_cur

    # Patch 'psycopg2.connect' in your app's context
    # Adjust 'payment_service.app.psycopg2.connect' if 'psycopg2' is imported differently in app.py
    with patch('payment_service.app.psycopg2.connect') as mock_connect:
        mock_connect.return_value = mock_conn
        yield mock_conn, mock_cur # provide both if tests need to assert on cursor methods

# Example of how to use mock_db_connection in a test:
# def test_example(client, mock_db_connection):
#     mock_conn, mock_cur = mock_db_connection
#     mock_cur.fetchone.return_value = (123,) # Simulate DB returning an ID
#
#     response = client.post('/some-endpoint', json={...})
#
#     assert mock_cur.execute.called_once_with(...)
#     assert mock_conn.commit.called_once()

# To make psycopg2.extras.Json available for tests if needed, though it's usually fine
# import psycopg2.extras
# psycopg2.extras.register_uuid() # If you use UUIDs

# Environment variables for Stripe (can be overridden by app.config but good to set for test env)
os.environ['STRIPE_SECRET_KEY'] = 'sk_test_mockkey_env'
os.environ['STRIPE_WEBHOOK_SECRET'] = 'whsec_mocksecret_env'
os.environ['DB_HOST'] = 'test_db_host'
# ... and other DB env vars if your app directly reads them before config overwrite

# Note: If your app.py calls load_dotenv() at the module level,
# these os.environ settings might be overwritten by a .env file.
# It's often better to manage config explicitly in tests via app.config.update()
# or by ensuring load_dotenv is not called during tests or uses a test-specific .env file.
# The current setup with flask_app.config.update should generally be effective.
