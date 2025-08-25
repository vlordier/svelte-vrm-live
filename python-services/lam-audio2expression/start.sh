#!/bin/bash
# Start script for LAM Audio2Expression service

set -e

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Check if model exists
if [ ! -d "models/LAM_audio2exp" ]; then
    echo "LAM model not found. Downloading..."
    python download_model.py
fi

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export LAM_PORT="${LAM_PORT:-8001}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"
export DEBUG="${DEBUG:-false}"

echo "Starting LAM Audio2Expression service on port $LAM_PORT..."
echo "Logs will be saved to logs/service.log"

# Create logs directory
mkdir -p logs

# Start the service
python server.py 2>&1 | tee logs/service.log