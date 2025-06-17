#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to display section headers
section() {
    echo -e "\n${YELLOW}==> $1${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running in CI environment
if [ -z "$CI" ]; then
    CI=false
else
    CI=true
fi

# Set environment variables
export NODE_ENV=test
export PYTHONPATH=$PWD

# Create test database URL
if [ "$CI" = true ]; then
    # In CI, use the PostgreSQL service
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taic_test"
    export TEST_DATABASE_URL="$DATABASE_URL"
else
    # In local development, use a local PostgreSQL instance
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taic_test"
    export TEST_DATABASE_URL="$DATABASE_URL"
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Install dependencies
section "Installing dependencies"

# Python dependencies
if [ -f "requirements-test.txt" ]; then
    pip install -r requirements-test.txt
else
    echo -e "${RED}Error: requirements-test.txt not found${NC}"
    exit 1
fi

# Node.js dependencies
if [ -f "package.json" ]; then
    npm ci
else
    echo -e "${RED}Error: package.json not found${NC}"
    exit 1
fi

# Set up database
section "Setting up test database"

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo -e "${RED}Error: PostgreSQL is not running${NC}"
    exit 1
fi

# Create test database if it doesn't exist
createdb taic_test 2>/dev/null || true

# Run migrations
echo -e "\n${YELLOW}Running database migrations...${NC}"\
alembic upgrade head

# Seed test data
if [ "$CI" = false ]; then
    section "Seeding test data"
    python -m scripts.seed_test_db
fi

# Run tests
section "Running tests"

# Backend tests
echo -e "\n${YELLOW}Running backend tests...${NC}"
if [ "$CI" = true ]; then
    cd tests/backend
    pytest --cov=src --cov-report=xml --cov-report=term-missing
    cd ../..
else
    cd tests/backend
    pytest -v --cov=src --cov-report=term-missing
    cd ../..
fi

# Frontend tests
echo -e "\n${YELLOW}Running frontend tests...${NC}"
if [ "$CI" = true ]; then
    cd tests/frontend
    npm test -- --coverage --watchAll=false
    cd ../..
else
    cd tests/frontend
    npm test -- --watchAll=false
    cd ../..
fi

# E2E tests (only run locally, not in CI)
if [ "$CI" = false ]; then
    section "Running E2E tests"
    
    # Start the development server in the background
    echo -e "\n${YELLOW}Starting development server...${NC}"
    npm run dev &
    SERVER_PID=$!
    
    # Wait for the server to start
    echo -e "\n${YELLOW}Waiting for server to start...${NC}"
    npx wait-on http://localhost:3000
    
    # Run Cypress tests
    echo -e "\n${YELLOW}Running E2E tests with Cypress...${NC}"
    cd tests/e2e
    npx cypress run
    cd ../..
    
    # Stop the development server
    echo -e "\n${YELLOW}Stopping development server...${NC}"
    kill $SERVER_PID
fi

# Display coverage summary
if [ "$CI" = true ]; then
    section "Coverage Summary"
    
    # Python coverage
    if [ -f "tests/backend/coverage.xml" ]; then
        echo -e "\n${YELLOW}Backend Coverage:${NC}"
        grep -oP 'line-rate="\K[0-9.]+' tests/backend/coverage.xml | head -1 | awk '{printf "%.2f%%\n", $1 * 100}'
    fi
    
    # Frontend coverage
    if [ -f "tests/frontend/coverage/lcov.info" ]; then
        echo -e "\n${YELLOW}Frontend Coverage:${NC}"
        npx nyc report --reporter=text-summary | grep -E '^All files' | awk '{print $NF}'
    fi
fi

echo -e "\n${GREEN}Test script completed successfully!${NC}"
