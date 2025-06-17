#!/bin/bash

# Exit on error
set -e

# Bypass database check for now
export RUN_TESTS_WITHOUT_DB=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Setting up test environment ===${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}" || exit 1

# Create and activate virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3.11 -m venv venv
    
    # Activate the new virtual environment
    source "${SCRIPT_DIR}/venv/bin/activate"
    
    # Upgrade pip and install requirements
    echo -e "${YELLOW}Installing requirements...${NC}"
    pip install --upgrade pip
    pip install -r requirements.txt -r requirements-test.txt
else
    # Activate existing virtual environment
    source "${SCRIPT_DIR}/venv/bin/activate"
    
    # Ensure requirements are up to date
    echo -e "${YELLOW}Updating requirements...${NC}"
    pip install --upgrade pip
    pip install -r requirements.txt -r requirements-test.txt
fi

# Set PYTHONPATH to ensure 'app' module can be found
export PYTHONPATH="${SCRIPT_DIR}/.."

# Ensure test database is running
echo -e "${YELLOW}Checking test database...${NC}"
if ! pg_isready -h localhost -p 5432 -d test_db -U postgres > /dev/null 2>&1; then
    echo -e "${RED}Error: Test database is not running. Please start PostgreSQL and ensure the test_db exists.${NC}"
    echo -e "${YELLOW}You can create the test database with:${NC}"
    echo -e "  createdb -U postgres test_db"
    echo -e "${YELLOW}Or, to run tests without full DB integration (some tests may fail):${NC}"
    echo -e "  export RUN_TESTS_WITHOUT_DB=true${NC}"
    if [ "${RUN_TESTS_WITHOUT_DB}" != "true" ]; then
        exit 1
    fi
fi

# Run tests
echo -e "${GREEN}=== Running tests ===${NC}"
# The PYTHONDONTWRITEBYTECODE=1 flag prevents Python from writing .pyc files to disk.
PYTHONDONTWRITEBYTECODE=1 venv/bin/python -m pytest -v tests/
TEST_RESULT=$?

# Deactivate virtual environment (optional, as script exits anyway)
# deactivate

echo -e "${GREEN}=== Test run finished ===${NC}"
exit $TEST_RESULT
