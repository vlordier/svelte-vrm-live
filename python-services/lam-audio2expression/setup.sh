#!/bin/bash
# Setup script for LAM Audio2Expression Python service

set -e

echo "Setting up LAM Audio2Expression Python service..."

# Check if Python 3.10 is available
if ! command -v python3.10 &> /dev/null; then
    echo "Error: Python 3.10 is required but not installed."
    echo "Please install Python 3.10 and try again."
    exit 1
fi

# Create virtual environment
echo "Creating Python virtual environment..."
python3.10 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch (CPU version by default, modify for CUDA if needed)
echo "Installing PyTorch..."
if [ "$INSTALL_CUDA" = "true" ]; then
    echo "Installing PyTorch with CUDA support..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    export CUDA_AVAILABLE=true
else
    echo "Installing PyTorch CPU version..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    export CUDA_AVAILABLE=false
fi

# Install other requirements
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "Creating directories..."
mkdir -p models cache logs

# Download model (optional - can be done separately)
if [ "$DOWNLOAD_MODEL" = "true" ]; then
    echo "Downloading LAM model..."
    python download_model.py
else
    echo "Skipping model download. Run 'python download_model.py' later to download the model."
fi

echo "Setup complete!"
echo ""
echo "To start the service:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. (Optional) Download model: python download_model.py"
echo "3. Start server: python server.py"
echo ""
echo "Or use the start script: ./start.sh"