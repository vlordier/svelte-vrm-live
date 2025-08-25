"""Real LAM Audio2Expression model implementation."""

import logging
import numpy as np
import torch
import torch.nn.functional as F
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import librosa
import soundfile as sf
import tempfile
import base64
import sys
import os
from omegaconf import OmegaConf

from config import *

# Add LAM source to Python path
LAM_SOURCE_PATH = Path(__file__).parent / "lam-source"
sys.path.insert(0, str(LAM_SOURCE_PATH))

logger = logging.getLogger(__name__)

try:
    from engines.infer import INFER, Audio2ExpressionInfer
    from models import build_model
    LAM_FRAMEWORK_AVAILABLE = True
    logger.info("✅ LAM framework modules imported successfully")
except ImportError as e:
    LAM_FRAMEWORK_AVAILABLE = False
    logger.warning(f"⚠️ LAM framework not available: {e}")

class BlendshapeFrame:
    """Represents a single frame of blendshape coefficients."""
    
    def __init__(self, timestamp: float, blendshapes: Dict[str, float]):
        self.timestamp = timestamp
        self.blendshapes = blendshapes
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp,
            "blendshapes": self.blendshapes
        }

class RealLAMAudio2ExpressionModel:
    """Real LAM Audio2Expression model using the LAM framework."""
    
    def __init__(self):
        self.lam_infer = None
        self.config = None
        self.device = torch.device(DEVICE)
        self.is_loaded = False
        
        logger.info(f"Initializing Real LAM model on device: {self.device}")
        
    def load_model(self) -> bool:
        """Load the LAM model using the real framework."""
        try:
            if not LAM_FRAMEWORK_AVAILABLE:
                logger.error("❌ LAM framework not available")
                return False
                
            logger.info("🎯 Loading real LAM Audio2Expression model...")
            
            # Create configuration  
            cfg = OmegaConf.create({
                'weight': str(Path.cwd() / "lam_audio2exp_flow"),
                'audio_sr': 16000,
                'id_idx': 0,
                'save_path': './exp/audio2exp',
                'resume': False,
                'find_unused_parameters': False,
                'movement_smooth': False,
                'brow_movement': False,
                'device': 'cpu',  # Force CPU usage for macOS compatibility
                'model': {
                    'type': 'DefaultEstimator',
                    'backbone': {
                        'type': 'Audio2Expression',
                        'pretrained_encoder_type': 'wav2vec',
                        'pretrained_encoder_path': 'facebook/wav2vec2-base-960h',
                        'wav2vec2_config_path': 'lam-source/configs/wav2vec2_config.json',
                        'num_identity_classes': 12,
                        'identity_feat_dim': 64,
                        'hidden_dim': 512,
                        'expression_dim': 52,
                        'norm_type': 'ln',
                        'use_transformer': False,
                        'num_attention_heads': 8,
                        'num_transformer_layers': 6,
                    }
                },
                'infer': {
                    'type': 'Audio2ExpressionInfer'
                }
            })
            
            logger.info(f"🎯 Using model weights from: {cfg.weight}")
            
            # Create the inference engine
            # Convert OmegaConf to dict for LAM framework compatibility
            cfg_dict = OmegaConf.to_container(cfg, resolve=True)
            logger.info(f"🔧 Config type: {type(cfg_dict)}")
            
            # Create hybrid config: namespace with dict model property
            import argparse
            
            class HybridConfig(argparse.Namespace):
                """Config object that supports both namespace and dict access."""
                def __init__(self, data):
                    super().__init__()
                    for key, value in data.items():
                        if key == 'model':
                            # Keep model as dict for registry.py
                            setattr(self, key, value)
                        elif isinstance(value, dict):
                            # Convert other dicts to namespace
                            setattr(self, key, argparse.Namespace(**value))
                        else:
                            setattr(self, key, value)
            
            cfg_hybrid = HybridConfig(cfg_dict)
            logger.info(f"🔧 Created hybrid config: {type(cfg_hybrid)}, model type: {type(cfg_hybrid.model)}")
            
            # LAM framework expects hybrid access pattern
            self.lam_infer = Audio2ExpressionInfer(cfg_hybrid)
            
            logger.info("✅ Real LAM Audio2Expression model loaded successfully!")
            logger.info(f"🏗️ Model type: {type(self.lam_infer).__name__}")
            
            self.config = cfg
            self.is_loaded = True
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load real LAM model: {e}", exc_info=True)
            self.is_loaded = False
            return False
    
    def process_audio_base64(self, audio_base64: str, sample_rate: int = None) -> List[Dict]:
        """Process audio using real LAM model."""
        try:
            if not self.is_loaded:
                raise RuntimeError("Model not loaded")
                
            logger.info("🎵 Processing audio with real LAM model...")
            
            # Decode audio
            audio_bytes = base64.b64decode(audio_base64)
            
            # Try to determine if this is raw PCM or WAV format
            try:
                # First try to read as WAV file directly
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                    tmp_file.write(audio_bytes)
                    tmp_audio_path = tmp_file.name
                
                audio_data, sr = sf.read(tmp_audio_path)
                logger.info(f"📊 Audio loaded as WAV: {len(audio_data)} samples at {sr}Hz")
                
            except Exception as wav_error:
                logger.info(f"⚠️ WAV format failed: {wav_error}")
                logger.info("🔄 Attempting to interpret as raw PCM data...")
                
                # Try as raw PCM (assume float32, mono, at specified sample rate)
                try:
                    import numpy as np
                    audio_data = np.frombuffer(audio_bytes, dtype=np.float32)
                    sr = sample_rate
                    logger.info(f"📊 Audio loaded as raw PCM: {len(audio_data)} samples at {sr}Hz")
                    
                    # Save as proper WAV for cleanup
                    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                        tmp_audio_path = tmp_file.name
                    sf.write(tmp_audio_path, audio_data, sr)
                    
                except Exception as pcm_error:
                    logger.error(f"💥 Both WAV and PCM parsing failed: {pcm_error}")
                    raise RuntimeError(f"Unable to parse audio format: WAV error: {wav_error}, PCM error: {pcm_error}")
            
            try:
                
                # Use LAM's streaming inference
                result = self.lam_infer.infer_streaming_audio(
                    audio=audio_data,
                    ssr=sr,
                    context=None
                )
                
                if result and result[0]['code'] == 'SUCCESS':
                    expression_data = result[0]['expression']
                    logger.info(f"✅ LAM inference successful, expression shape: {expression_data.shape}")
                    
                    # Convert to blendshape frames
                    frames = self._convert_to_frames(expression_data, len(audio_data) / sr)
                    return [frame.to_dict() for frame in frames]
                else:
                    logger.error("❌ LAM inference failed")
                    return []
                    
            finally:
                # Clean up temp file
                if os.path.exists(tmp_audio_path):
                    os.unlink(tmp_audio_path)
                    
        except Exception as e:
            logger.error(f"💥 Error in real LAM processing: {e}", exc_info=True)
            raise
    
    def _convert_to_frames(self, expression_data: np.ndarray, duration: float) -> List[BlendshapeFrame]:
        """Convert LAM expression data to blendshape frames."""
        frames = []
        num_frames = expression_data.shape[0]
        
        for i in range(num_frames):
            timestamp = (i / num_frames) * duration
            
            # Map LAM expression to ARKit blendshapes
            blendshapes = {}
            for j, name in enumerate(ARKIT_BLENDSHAPES):
                if j < expression_data.shape[1]:
                    blendshapes[name] = float(np.clip(expression_data[i, j], 0.0, 1.0))
                else:
                    blendshapes[name] = 0.0
            
            frames.append(BlendshapeFrame(timestamp, blendshapes))
        
        return frames

# Global instance
_real_model_instance: Optional[RealLAMAudio2ExpressionModel] = None

def get_real_model() -> RealLAMAudio2ExpressionModel:
    """Get the global real model instance."""
    global _real_model_instance
    if _real_model_instance is None:
        _real_model_instance = RealLAMAudio2ExpressionModel()
    return _real_model_instance

def initialize_real_model() -> bool:
    """Initialize the global real model instance."""
    model = get_real_model()
    return model.load_model()