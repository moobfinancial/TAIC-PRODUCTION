#!/bin/bash

# Kill any existing Next.js processes
echo "Killing any existing Next.js processes..."
pkill -f "next dev" || true

# Set database environment variables for local development
echo "Setting up environment variables..."
export PGUSER=postgres
export PGPASSWORD=postgres
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=taic

# Set admin API key for testing - use a simple value for development only
export ADMIN_API_KEY="admin123"

# Print environment variables for debugging
echo "Environment variables set:"
echo "PGUSER=$PGUSER"
echo "PGHOST=$PGHOST"
echo "PGPORT=$PGPORT"
echo "PGDATABASE=$PGDATABASE"
echo "ADMIN_API_KEY=$ADMIN_API_KEY"

# Start the development server
echo "Starting Next.js development server..."
npm run dev
