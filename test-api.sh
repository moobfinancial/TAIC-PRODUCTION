#!/bin/bash

# Set database environment variables for local development
export PGUSER=postgres
export PGPASSWORD=postgres
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=taic

# Set admin API key for testing - use a simple value for development only
export ADMIN_API_KEY="admin123"

# Test the storefront product API endpoint
echo "Testing storefront product API endpoint..."
curl -s http://localhost:9002/api/storefront/products/1 | head -n 20
echo -e "\n"

# Test the admin categories API endpoint
echo "Testing admin categories API endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" http://localhost:9002/api/admin/categories/1
echo -e "\n"

# Test the admin CJ product status API endpoint
echo "Testing admin CJ product status API endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" http://localhost:9002/api/admin/cj/products/1/status
echo -e "\n"

# Test the admin orders API endpoint
echo "Testing admin orders API endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" http://localhost:9002/api/admin/orders/1/refresh-cj-status
echo -e "\n"

# Test the merchant orders API endpoint
echo "Testing merchant orders API endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" http://localhost:9002/api/merchant/orders/1
echo -e "\n"
