#!/bin/bash

# Enable strict error handling
set -e

# Start the Babylon Workspace project using Docker Compose
echo "Building and starting the Babylon Workspace services..."

if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed or not in PATH" >&2
    exit 1
fi

if docker-compose up --build; then
    echo "Naviz services started successfully!"
    echo "Frontend: http://localhost:3000"
    echo "Backend: http://localhost:3001"
else
    echo "Error: Failed to start Naviz services"
    echo "Check docker-compose.yml and ensure Docker is running"
    exit 1
fi
