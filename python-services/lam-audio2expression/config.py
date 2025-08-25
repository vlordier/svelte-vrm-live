"""Configuration settings for LAM Audio2Expression service."""

import os
from pathlib import Path
from typing import Optional

# Model Configuration
MODEL_NAME = "3DAIGC/LAM_audio2exp"
MODEL_PATH = Path("./models/LAM_audio2exp")
DEVICE = "cuda" if os.getenv("CUDA_AVAILABLE", "false").lower() == "true" else "cpu"

# Audio Configuration
SAMPLE_RATE = 16000  # LAM model expects 16kHz
MAX_AUDIO_LENGTH = 30  # seconds
SUPPORTED_FORMATS = ["wav", "mp3", "flac", "m4a"]

# Blendshape Configuration
OUTPUT_FPS = 30  # 30 FPS for smooth animation
NUM_BLENDSHAPES = 52  # ARKit standard blendshapes

# API Configuration
HOST = "0.0.0.0"
PORT = int(os.getenv("LAM_PORT", "8001"))
WORKERS = 1  # Single worker for model consistency

# Model Parameters
MAX_SEQUENCE_LENGTH = 1024
BATCH_SIZE = 1

# Caching
ENABLE_CACHE = True
CACHE_DIR = Path("./cache")
MAX_CACHE_SIZE = 1000  # Maximum cached results

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"

# Hugging Face
HF_TOKEN: Optional[str] = os.getenv("HUGGING_FACE_TOKEN")
OFFLINE_MODE = os.getenv("HF_OFFLINE", "false").lower() == "true"

# Performance
TORCH_COMPILE = os.getenv("TORCH_COMPILE", "false").lower() == "true"
MIXED_PRECISION = True
GRADIENT_CHECKPOINTING = False

# ARKit Blendshape Names (52 standard shapes)
ARKIT_BLENDSHAPES = [
    # Jaw
    "jawOpen", "jawForward", "jawLeft", "jawRight",
    
    # Mouth
    "mouthClose", "mouthFunnel", "mouthPucker", "mouthLeft", "mouthRight",
    "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight",
    "mouthDimpleLeft", "mouthDimpleRight", "mouthStretchLeft", "mouthStretchRight",
    "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
    "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight",
    "mouthUpperUpLeft", "mouthUpperUpRight",
    
    # Nose
    "noseSneerLeft", "noseSneerRight",
    
    # Cheek
    "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
    
    # Eyes
    "eyeBlinkLeft", "eyeLookDownLeft", "eyeLookInLeft", "eyeLookOutLeft", 
    "eyeLookUpLeft", "eyeSquintLeft", "eyeWideLeft",
    "eyeBlinkRight", "eyeLookDownRight", "eyeLookInRight", "eyeLookOutRight", 
    "eyeLookUpRight", "eyeSquintRight", "eyeWideRight",
    
    # Brows
    "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
    
    # Tongue
    "tongueOut"
]

def ensure_directories():
    """Create necessary directories if they don't exist."""
    MODEL_PATH.mkdir(parents=True, exist_ok=True)
    if ENABLE_CACHE:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)