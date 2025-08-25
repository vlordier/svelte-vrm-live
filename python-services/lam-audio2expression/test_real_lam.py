#!/usr/bin/env python3
"""Test script for real LAM model integration."""

import logging
import sys
from pathlib import Path
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_real_lam():
    """Test the real LAM model directly."""
    try:
        from lam_model_real import get_real_model, initialize_real_model
        
        logger.info("🎯 Testing real LAM model...")
        
        # Initialize model
        success = initialize_real_model()
        if not success:
            logger.error("❌ Failed to initialize real LAM model")
            return False
            
        model = get_real_model()
        logger.info(f"✅ Model loaded: {model.is_loaded}")
        
        # Test with cached audio
        cache_path = Path("../../.tts-cache/welcome-messages.json")
        if cache_path.exists():
            with open(cache_path) as f:
                cache_data = json.load(f)
            
            # Get first cached audio
            first_key = next(iter(cache_data.keys()))
            audio_base64 = cache_data[first_key]["audioBase64"]
            
            logger.info("🎵 Testing with cached audio...")
            result = model.process_audio_base64(audio_base64, 24000)
            
            logger.info(f"✅ Real LAM model generated {len(result)} frames!")
            return True
        else:
            logger.warning("⚠️ No cached audio found for testing")
            return True
            
    except Exception as e:
        logger.error(f"💥 Error testing real LAM model: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    success = test_real_lam()
    sys.exit(0 if success else 1)