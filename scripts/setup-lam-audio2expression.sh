#!/bin/bash
# Complete setup script for LAM Audio2Expression integration

set -e

echo "🎭 Setting up LAM Audio2Expression integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check Python 3.10
if ! command -v python3.10 &> /dev/null; then
    print_error "Python 3.10 is required but not installed."
    echo "Please install Python 3.10 and run this script again."
    echo "On macOS: brew install python@3.10"
    echo "On Ubuntu: sudo apt-get install python3.10"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed."
    echo "Please install Node.js and run this script again."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed."
    echo "Please install npm and run this script again."
    exit 1
fi

print_success "Prerequisites check passed!"

# Parse command line arguments
DOWNLOAD_MODEL=false
INSTALL_CUDA=false
FORCE_REINSTALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --download-model)
            DOWNLOAD_MODEL=true
            shift
            ;;
        --cuda)
            INSTALL_CUDA=true
            shift
            ;;
        --force)
            FORCE_REINSTALL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --download-model    Download LAM model from Hugging Face"
            echo "  --cuda             Install PyTorch with CUDA support"
            echo "  --force            Force reinstall even if already set up"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            print_warning "Unknown option: $1"
            shift
            ;;
    esac
done

# Setup Python service
print_status "Setting up Python service..."

cd python-services/lam-audio2expression

# Check if already set up
if [ -d "venv" ] && [ "$FORCE_REINSTALL" = false ]; then
    print_warning "Virtual environment already exists. Use --force to reinstall."
else
    if [ "$FORCE_REINSTALL" = true ] && [ -d "venv" ]; then
        print_status "Force reinstall requested, removing existing venv..."
        rm -rf venv
    fi
    
    # Create virtual environment
    print_status "Creating Python virtual environment..."
    python3.10 -m venv venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch
if [ "$INSTALL_CUDA" = true ]; then
    print_status "Installing PyTorch with CUDA support..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    export CUDA_AVAILABLE=true
else
    print_status "Installing PyTorch (CPU version)..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    export CUDA_AVAILABLE=false
fi

# Install other requirements
print_status "Installing Python dependencies..."
if pip install -r requirements.txt; then
    print_success "Python dependencies installed successfully!"
else
    print_error "Some dependencies failed to install. Attempting to continue..."
    
    # Try to install core dependencies individually
    print_status "Installing core dependencies individually..."
    core_deps=(
        "torch>=2.0.0"
        "torchaudio>=2.0.0" 
        "torchvision>=0.15.0"
        "transformers>=4.21.0"
        "huggingface-hub>=0.16.4"
        "librosa>=0.10.0"
        "fastapi>=0.100.0"
        "uvicorn>=0.23.0"
        "pydantic>=2.0.0"
        "numpy>=1.24.0"
        "scipy>=1.10.0"
        "soundfile>=0.12.1"
    )
    
    failed_deps=()
    for dep in "${core_deps[@]}"; do
        print_status "Installing: $dep"
        if ! pip install "$dep"; then
            print_warning "Failed to install: $dep"
            failed_deps+=("$dep")
        fi
    done
    
    if [ ${#failed_deps[@]} -gt 0 ]; then
        print_error "Failed to install core dependencies: ${failed_deps[*]}"
        print_error "Please install these manually or check your Python environment."
        exit 1
    fi
    
    print_success "Core dependencies installed successfully!"
fi

# Create directories
print_status "Creating necessary directories..."
mkdir -p models cache logs

# Download model if requested
if [ "$DOWNLOAD_MODEL" = true ]; then
    if [ -z "$HUGGING_FACE_TOKEN" ]; then
        print_warning "HUGGING_FACE_TOKEN not set. Model download may fail for private models."
        echo "Set HUGGING_FACE_TOKEN environment variable if needed."
    fi
    
    print_status "Downloading LAM Audio2Expression model..."
    python download_model.py
    
    if [ $? -eq 0 ]; then
        print_success "Model downloaded successfully!"
    else
        print_error "Model download failed. You can download it later with:"
        echo "cd python-services/lam-audio2expression && python download_model.py"
    fi
else
    print_warning "Model download skipped. Use --download-model flag to download automatically."
fi

# Return to project root
cd ../..

# Setup Node.js dependencies (if needed)
print_status "Checking Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    print_status "Installing Node.js dependencies..."
    npm install
else
    print_success "Node.js dependencies already installed."
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please configure your .env file with appropriate API keys and settings."
else
    print_success ".env file already exists."
fi

# Test the setup
print_status "Testing the setup..."

# Test Node.js build
print_status "Testing Node.js build..."
if npm run check; then
    print_success "TypeScript check passed!"
else
    print_error "TypeScript check failed. Please fix the errors and try again."
    exit 1
fi

# Test Python service (if model was downloaded)
if [ "$DOWNLOAD_MODEL" = true ]; then
    print_status "Testing Python service..."
    cd python-services/lam-audio2expression
    source venv/bin/activate
    
    # Start service in background for testing
    python server.py &
    SERVICE_PID=$!
    
    # Wait for service to start
    sleep 10
    
    # Test health endpoint
    if curl -s http://localhost:8001/health > /dev/null; then
        print_success "Python service is responding!"
    else
        print_warning "Python service test failed. Check the logs when you start it manually."
    fi
    
    # Kill the test service
    kill $SERVICE_PID 2>/dev/null || true
    
    cd ../..
fi

print_success "Setup complete! 🎉"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your .env file:"
echo "   - Set HUGGING_FACE_TOKEN if using private models"
echo "   - Configure your preferred LLM provider"
echo "   - Adjust LAM_SERVICE_URL if needed"
echo ""
if [ "$DOWNLOAD_MODEL" = false ]; then
echo "2. Download the LAM model:"
echo "   cd python-services/lam-audio2expression"
echo "   source venv/bin/activate"
echo "   python download_model.py"
echo ""
fi
echo "3. Start the Python service:"
echo "   cd python-services/lam-audio2expression"
echo "   ./start.sh"
echo ""
echo "4. In a new terminal, start the main application:"
echo "   npm run dev"
echo ""
echo "5. Open http://localhost:5173 and test the Audio2Expression feature!"
echo ""
echo "🎭 The 🤖 Advanced mode will use the real LAM model when available."
echo "📝 Basic mode will continue to use phoneme-based animation."
echo ""
if [ "$INSTALL_CUDA" = true ]; then
    print_success "CUDA support enabled - the model will use GPU acceleration if available."
else
    print_warning "Using CPU-only PyTorch. Add --cuda flag for GPU acceleration."
fi