# TAIC Platform Test Suite

This directory contains the automated tests for the TAIC platform, following the Testing Pyramid approach with unit, integration, and end-to-end tests.

## Test Structure

```
tests/
├── backend/                  # Backend (FastAPI) tests
│   ├── unit/                 # Unit tests (70% of tests)
│   │   ├── test_auth.py      # Authentication unit tests
│   │   └── ...
│   ├── integration/         # Integration tests (20% of tests)
│   │   ├── test_products.py  # Product API integration tests
│   │   └── ...
│   ├── conftest.py          # Pytest fixtures and configuration
│   └── pytest.ini            # Pytest configuration
│
├── e2e/                     # End-to-end tests (10% of tests)
│   └── cypress/
│       ├── e2e/             # Test files
│       │   └── auth.cy.ts    # Auth flow tests
│       ├── fixtures/         # Test data fixtures
│       └── support/          # Custom commands and utilities
│
└── frontend/                # Frontend (Next.js) tests
    ├── unit/                 # Unit tests for components/hooks
    │   └── auth/             # Auth-related tests
    │       └── useAuth.test.tsx
    ├── integration/          # Component integration tests
    │   └── cart/            # Shopping cart tests
    │       └── Cart.test.tsx
    ├── jest.config.js        # Jest configuration
    └── setupTests.ts         # Test setup and mocks
```

## Running Tests

### Prerequisites

1. Install Python dependencies:
   ```bash
   pip install -r requirements-test.txt
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Set up test database:
   - Create a PostgreSQL database for testing
   - Set the `TEST_DATABASE_URL` environment variable

### Running Backend Tests

```bash
# Run all backend tests
cd tests/backend
pytest -v

# Run tests with coverage report
pytest --cov=src --cov-report=term-missing

# Run a specific test file
pytest unit/test_auth.py -v
```

### Running Frontend Tests

```bash
# Run all frontend tests
cd tests/frontend
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Running End-to-End Tests

1. Start the development server:
   ```bash
   npm run dev
   ```

2. In a new terminal, run Cypress:
   ```bash
   cd tests/e2e
   npx cypress open  # Interactive mode
   # or
   npx cypress run   # Headless mode
   ```

## Continuous Integration

The test suite is automatically run on every push and pull request using GitHub Actions. The CI pipeline includes:

1. Linting and type checking
2. Backend tests with coverage
3. Frontend unit tests
4. End-to-end tests
5. Security scanning

## Writing Tests

### Backend Tests

- Place unit tests in `backend/unit/`
- Place integration tests in `backend/integration/`
- Use fixtures in `conftest.py` for common test data
- Follow the Arrange-Act-Assert pattern

### Frontend Tests

- Test components in isolation
- Use React Testing Library for component tests
- Mock external dependencies
- Test user interactions and state changes

### End-to-End Tests

- Test critical user journeys
- Use data-testid attributes for reliable element selection
- Keep tests independent and isolated
- Use fixtures for test data

## Best Practices

1. **Unit Tests (70%)**: Test individual functions and components in isolation
2. **Integration Tests (20%)**: Test interactions between components and APIs
3. **E2E Tests (10%)**: Test complete user flows
4. **Keep tests fast, isolated, and deterministic**
5. **Write clear test descriptions**
6. **Test edge cases and error conditions**
7. **Maintain test data consistency**
8. **Update tests when requirements change**

## Troubleshooting

- **Tests failing?** Check the test database connection and environment variables
- **Cypress not working?** Make sure the development server is running
- **Need to debug?** Use `console.log()` in tests or `cy.log()` in Cypress
- **Slow tests?** Consider parallelization with `pytest-xdist`

## Coverage Reports

Coverage reports are generated in the `coverage/` directory. Open `coverage/index.html` in a browser to view detailed coverage information.
