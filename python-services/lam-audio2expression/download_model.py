"""Script to download LAM Audio2Expression model from Hugging Face."""

import os
import sys
import logging
from pathlib import Path
from huggingface_hub import hf_hub_download, snapshot_download
import argparse

from config import MODEL_NAME, MODEL_PATH, HF_TOKEN

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_model(force: bool = False, use_snapshot: bool = True):
    """Download the LAM model from Hugging Face."""
    try:
        logger.info(f"Downloading LAM model '{MODEL_NAME}' to '{MODEL_PATH}'")
        
        if MODEL_PATH.exists() and not force:
            logger.info("Model directory already exists. Use --force to re-download.")
            return True
        
        # Ensure directory exists
        MODEL_PATH.mkdir(parents=True, exist_ok=True)
        
        if use_snapshot:
            # Download entire repository
            logger.info("Downloading complete model repository...")
            snapshot_download(
                repo_id=MODEL_NAME,
                cache_dir=str(MODEL_PATH.parent),
                local_dir=str(MODEL_PATH),
                token=HF_TOKEN,
                resume_download=True
            )
        else:
            # Download individual files
            logger.info("Downloading individual model files...")
            
            # List of files to download (adjust based on actual model structure)
            model_files = [
                "config.json",
                "pytorch_model.bin",
                "model.safetensors",
                "tokenizer.json",
                "tokenizer_config.json",
                "special_tokens_map.json",
                "vocab.txt",
                "README.md"
            ]
            
            for file_name in model_files:
                try:
                    logger.info(f"Downloading {file_name}...")
                    file_path = hf_hub_download(
                        repo_id=MODEL_NAME,
                        filename=file_name,
                        cache_dir=str(MODEL_PATH),
                        token=HF_TOKEN,
                        resume_download=True
                    )
                    logger.info(f"Downloaded {file_name} to {file_path}")
                except Exception as e:
                    logger.warning(f"Could not download {file_name}: {e}")
        
        logger.info("Model download completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download model: {e}")
        return False

def check_model():
    """Check if the model is properly downloaded."""
    if not MODEL_PATH.exists():
        logger.error(f"Model directory not found: {MODEL_PATH}")
        return False
    
    # Check for essential files
    essential_files = ["config.json"]
    model_files = ["pytorch_model.bin", "model.safetensors"]
    
    for file_name in essential_files:
        file_path = MODEL_PATH / file_name
        if not file_path.exists():
            logger.error(f"Essential file missing: {file_name}")
            return False
        logger.info(f"Found: {file_name}")
    
    # Check for at least one model file
    has_model_file = any((MODEL_PATH / f).exists() for f in model_files)
    if not has_model_file:
        logger.error(f"No model weights found. Expected one of: {model_files}")
        return False
    
    for file_name in model_files:
        file_path = MODEL_PATH / file_name
        if file_path.exists():
            logger.info(f"Found model weights: {file_name}")
            break
    
    logger.info("Model appears to be properly downloaded!")
    return True

def main():
    parser = argparse.ArgumentParser(description="Download LAM Audio2Expression model")
    parser.add_argument("--force", action="store_true", help="Force re-download even if model exists")
    parser.add_argument("--check", action="store_true", help="Check if model is properly downloaded")
    parser.add_argument("--individual", action="store_true", help="Download individual files instead of snapshot")
    
    args = parser.parse_args()
    
    if args.check:
        success = check_model()
        sys.exit(0 if success else 1)
    
    # Set up Hugging Face token if provided
    if HF_TOKEN:
        logger.info("Using Hugging Face token for authentication")
    else:
        logger.warning("No Hugging Face token provided. Some models may not be accessible.")
        logger.info("Set HUGGING_FACE_TOKEN environment variable if needed")
    
    success = download_model(force=args.force, use_snapshot=not args.individual)
    
    if success:
        logger.info("Running post-download check...")
        check_model()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()