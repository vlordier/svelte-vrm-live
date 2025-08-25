# LAM Audio2Expression Python Service

This service provides real-time audio-to-facial-expression conversion using the LAM (Large Audio Model) Audio2Expression model from Hugging Face.

## Overview

The service converts audio input into ARKit-compatible blendshape coefficients that can drive realistic facial animations on 3D avatars. It uses the LAM_Audio2Expression model to generate 52 standard ARKit blendshapes at 30 FPS.

## Requirements

- Python 3.10
- PyTorch 2.0+
- CUDA (optional, for GPU acceleration)
- 4GB+ RAM (8GB+ recommended)
- Internet connection (for initial model download)

## Quick Start

1. **Setup the service:**

   ```bash
   cd python-services/lam-audio2expression
   ./setup.sh
   ```

2. **Start the service:**

   ```bash
   ./start.sh
   ```

3. **Test the service:**
   ```bash
   curl http://localhost:8001/health
   ```

## Manual Setup

If you prefer manual setup:

```bash
# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download model
python download_model.py

# Start server
python server.py
```

## Configuration

Environment variables:

- `LAM_PORT`: Service port (default: 8001)
- `LOG_LEVEL`: Logging level (default: INFO)
- `DEBUG`: Enable debug mode (default: false)
- `CUDA_AVAILABLE`: Enable CUDA if available (default: auto-detect)
- `HUGGING_FACE_TOKEN`: HF token for private models
- `HF_OFFLINE`: Use offline mode (default: false)

## API Endpoints

### POST /process

Convert audio to blendshape coefficients.

**Request:**

```json
{
	"audio": "base64-encoded-audio-data",
	"sample_rate": 24000,
	"format": "wav",
	"config": {}
}
```

**Response:**

```json
{
  "success": true,
  "blendshapes": [
    {
      "timestamp": 0.033,
      "blendshapes": {
        "mouthOpen": 0.7,
        "jawOpen": 0.5,
        "eyeBlinkLeft": 0.1,
        ...
      }
    }
  ],
  "duration": 2.5,
  "sample_rate": 16000,
  "processing_time": 0.15
}
```

### GET /health

Health check endpoint.

### GET /models/info

Get model information.

### POST /models/reload

Reload the model (useful for updates).

## Model Architecture

The LAM Audio2Expression model:

1. **Audio Preprocessing**: Converts input audio to 16kHz mono
2. **Feature Extraction**: Uses Wav2Vec-style encoder for audio features
3. **Expression Generation**: Generates ARKit blendshape coefficients
4. **Temporal Smoothing**: Ensures smooth animation transitions

## Supported Blendshapes

The service outputs 52 ARKit-standard blendshapes:

- **Jaw**: `jawOpen`, `jawForward`, `jawLeft`, `jawRight`
- **Mouth**: `mouthClose`, `mouthFunnel`, `mouthPucker`, `mouthSmile*`, etc.
- **Eyes**: `eyeBlink*`, `eyeLook*`, `eyeSquint*`, `eyeWide*`
- **Brows**: `browDown*`, `browInnerUp`, `browOuterUp*`
- **Nose/Cheek**: `noseSneer*`, `cheekPuff`, `cheekSquint*`
- **Tongue**: `tongueOut`

## Performance

**Processing Speed:**

- CPU: ~2-5x real-time (depends on audio length)
- GPU: ~5-15x real-time (CUDA required)

**Memory Usage:**

- Model loading: ~2-4GB
- Processing: ~100-500MB per request

**Latency:**

- Cold start: ~5-10 seconds (model loading)
- Warm inference: ~50-200ms per second of audio

## Troubleshooting

### Common Issues

1. **"Model not found"**: Run `python download_model.py`
2. **CUDA errors**: Set `CUDA_AVAILABLE=false` for CPU-only mode
3. **Memory errors**: Reduce `MAX_AUDIO_LENGTH` in config.py
4. **Python 3.10 required**: LAM model requires specific Python version

### Debug Mode

Enable detailed logging:

```bash
export DEBUG=true
export LOG_LEVEL=DEBUG
python server.py
```

### Model Issues

If the model fails to load:

```bash
# Check model files
python download_model.py --check

# Re-download if needed
python download_model.py --force
```

## Integration with Node.js

The Node.js application connects to this service via HTTP:

1. Start this Python service first
2. Configure the Node.js app to use `http://localhost:8001`
3. The Audio2Expression toggle will use real model inference

## Development

**File Structure:**

```
python-services/lam-audio2expression/
├── server.py          # FastAPI server
├── lam_model.py       # Model wrapper
├── config.py          # Configuration
├── download_model.py  # Model downloader
├── requirements.txt   # Dependencies
├── setup.sh          # Setup script
├── start.sh          # Start script
└── README.md         # This file
```

**Adding Features:**

1. Extend `Audio2ExpressionRequest` for new parameters
2. Modify `lam_model.py` for processing changes
3. Update `server.py` for new endpoints

## License

This service integrates with the LAM Audio2Expression model. Please check the model's license on Hugging Face for usage terms.

## Support

For issues with:

- This service: Check GitHub issues
- LAM model: Refer to the original model repository
- Integration: Check the main project documentation
