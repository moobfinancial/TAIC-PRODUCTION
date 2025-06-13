#!/bin/bash

# Set database environment variables for local development
export PGUSER=postgres
export PGPASSWORD=postgres
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=taic

# Set admin API key for testing - use a simple value for development only
export ADMIN_API_KEY="admin123"

# Start the development server
npm run dev
