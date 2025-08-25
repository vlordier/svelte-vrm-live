"""FastAPI server for LAM Audio2Expression service."""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Set
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import numpy as np

from config import *
from lam_model import get_model, initialize_model

try:
    from lam_model_real import get_real_model, initialize_real_model
    REAL_LAM_AVAILABLE = True
except ImportError:
    REAL_LAM_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure directories exist
ensure_directories()

# FastAPI app
app = FastAPI(
    title="LAM Audio2Expression Service",
    description="Convert audio to facial expression blendshapes using LAM model",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class Audio2ExpressionRequest(BaseModel):
    audio: str = Field(..., description="Base64 encoded audio data")
    sample_rate: Optional[int] = Field(24000, description="Audio sample rate in Hz")
    format: Optional[str] = Field("wav", description="Audio format")
    config: Optional[Dict] = Field(default_factory=dict, description="Additional configuration")

class BlendshapeFrame(BaseModel):
    timestamp: float = Field(..., description="Time in seconds")
    blendshapes: Dict[str, float] = Field(..., description="ARKit blendshape coefficients")

class Audio2ExpressionResponse(BaseModel):
    success: bool = Field(..., description="Whether processing succeeded")
    blendshapes: List[BlendshapeFrame] = Field(default_factory=list, description="Generated frames")
    duration: float = Field(0.0, description="Total audio duration in seconds")
    sample_rate: int = Field(SAMPLE_RATE, description="Processed sample rate")
    processing_time: float = Field(0.0, description="Processing time in seconds")
    error: Optional[str] = Field(None, description="Error message if failed")

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    version: str
    uptime: float

# Global state
start_time = time.time()
model_loading = False

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"🔌 WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"🔌 WebSocket client disconnected. Total connections: {len(self.active_connections)}")

    async def send_blendshapes(self, blendshapes: Dict[str, float], timestamp: float = None):
        """Send ARKit blendshapes to all connected clients."""
        if not self.active_connections:
            return
            
        message = {
            "type": "blendshapes",
            "timestamp": timestamp or time.time(),
            "blendshapes": blendshapes
        }
        
        # Send to all connected clients
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket client: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    async def send_test_sequence(self):
        """Send a test sequence of ARKit blendshapes for VRM testing."""
        logger.info("🎭 Starting WebSocket test sequence...")
        
        # Test sequence: jaw open/close, smile, blink
        test_frames = [
            # Frame 1: Mouth open
            {"jawOpen": 0.8, "mouthOpen": 0.6},
            # Frame 2: Peak open
            {"jawOpen": 1.0, "mouthOpen": 0.8},
            # Frame 3: Close
            {"jawOpen": 0.3, "mouthClose": 0.4},
            # Frame 4: Smile
            {"jawOpen": 0.1, "mouthSmileLeft": 0.7, "mouthSmileRight": 0.7},
            # Frame 5: Pucker
            {"jawOpen": 0.0, "mouthPucker": 0.8, "mouthFunnel": 0.5},
            # Frame 6: Blink + open
            {"jawOpen": 0.6, "eyeBlinkLeft": 0.9, "eyeBlinkRight": 0.9},
            # Frame 7: Wide eyes + open
            {"jawOpen": 0.8, "eyeWideLeft": 0.6, "eyeWideRight": 0.6},
            # Frame 8: Return to neutral
            {"jawOpen": 0.0, "mouthClose": 0.2}
        ]
        
        for i, frame in enumerate(test_frames):
            await self.send_blendshapes(frame, time.time())
            logger.info(f"🎭 Sent test frame {i+1}/{len(test_frames)}: {list(frame.keys())}")
            await asyncio.sleep(0.8)  # 800ms between frames
            
        logger.info("✅ WebSocket test sequence completed")

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time blendshape streaming."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and listen for any client messages
            data = await websocket.receive_text()
            logger.info(f"📨 Received WebSocket message: {data}")
            
            # Echo back confirmation
            await websocket.send_text(json.dumps({"type": "pong", "message": "connected"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("🔌 WebSocket client disconnected")

async def run_startup_test_sequence():
    """Run the startup test sequence after a short delay."""
    await asyncio.sleep(3.0)  # Wait for server to fully initialize
    logger.info("🎬 Starting WebSocket startup test sequence...")
    
    # Send test sequence if there are connections, or log that we're ready
    if manager.active_connections:
        await manager.send_test_sequence()
    else:
        logger.info("🔌 No WebSocket connections yet, but test sequence is ready")
        logger.info("💡 VRM client can connect to ws://localhost:8001/ws for real-time blendshapes")

async def test_model_with_cached_audio():
    """Test the model with cached audio files if available."""
    try:
        logger.info("🔍 Looking for cached audio files to test model...")
        
        # Check for cached welcome audio in TTS cache
        import os
        tts_cache_dir = os.path.join(os.getcwd(), '..', '..', '.tts-cache')
        
        if os.path.exists(tts_cache_dir):
            logger.info(f"📁 Found TTS cache directory: {tts_cache_dir}")
            
            welcome_cache_file = os.path.join(tts_cache_dir, 'welcome-messages.json')
            if os.path.exists(welcome_cache_file):
                logger.info("📋 Found welcome messages cache, testing with cached audio...")
                
                import json
                with open(welcome_cache_file, 'r') as f:
                    cache_data = json.load(f)
                
                if cache_data:
                    # Get the first cached welcome message
                    first_key = next(iter(cache_data.keys()))
                    cached_msg = cache_data[first_key]
                    
                    logger.info(f"🎵 Testing with cached audio: '{cached_msg['text'][:50]}...' ({cached_msg['voice']}, {cached_msg['provider']})")
                    
                    # Test inference (use real model if available)
                    if REAL_LAM_AVAILABLE and get_real_model().is_loaded:
                        model = get_real_model()
                        logger.info("🎯 Testing with real LAM model")
                    else:
                        model = get_model()
                        logger.info("🎭 Testing with enhanced ARKit model")
                    
                    if model.is_loaded:
                        test_result = model.process_audio_base64(
                            cached_msg['audioBase64'], 
                            cached_msg['sampleRate']
                        )
                        
                        logger.info(f"✅ Model test successful! Generated {len(test_result)} blendshape frames")
                        logger.info(f"📊 Test audio duration: {cached_msg['duration']:.2f}s")
                        
                        # Log first few blendshapes for validation
                        if test_result:
                            first_frame = test_result[0]
                            active_blendshapes = {k: v for k, v in first_frame['blendshapes'].items() if v > 0.01}
                            logger.info(f"🎭 Sample blendshapes: {active_blendshapes}")
                        
                    else:
                        logger.warning(f"⚠️  Model not loaded (real: {REAL_LAM_AVAILABLE and get_real_model().is_loaded if REAL_LAM_AVAILABLE else False}, arkit: {get_model().is_loaded}), skipping test")
                else:
                    logger.info("📭 Welcome cache is empty")
            else:
                logger.info("📂 No welcome messages cache found")
        else:
            logger.info("📁 No TTS cache directory found")
            
    except Exception as e:
        logger.error(f"💥 Error testing model with cached audio: {e}", exc_info=True)

@app.on_event("startup")
async def startup_event():
    """Initialize the model on startup with comprehensive testing."""
    global model_loading
    logger.info("🎭 Starting LAM Audio2Expression service...")
    logger.info("=" * 60)
    
    model_loading = True
    try:
        logger.info("📦 Initializing LAM model...")
        
        # Try real LAM model first
        if REAL_LAM_AVAILABLE:
            logger.info("🎯 Attempting to load real LAM framework model...")
            real_success = initialize_real_model()
            if real_success:
                logger.info("✅ Real LAM model loaded successfully!")
                success = True
            else:
                logger.warning("⚠️ Real LAM model failed, falling back to ARKit...")
                success = initialize_model()
        else:
            logger.info("📦 Using enhanced ARKit model (real LAM framework not available)")
            success = initialize_model()
        
        if success:
            logger.info("✅ LAM model initialized successfully")
            
            # Test the model with cached audio if available
            try:
                await test_model_with_cached_audio()
            except Exception as test_error:
                logger.warning(f"⚠️ Model test failed (audio format issue): {test_error}")
                logger.info("🎯 Model is loaded and ready for requests")
            
        else:
            logger.error("❌ Failed to initialize LAM model")
    except Exception as e:
        logger.error(f"💥 Error during model initialization: {e}", exc_info=True)
    finally:
        model_loading = False
        logger.info("=" * 60)
        logger.info("🚀 LAM Audio2Expression service startup complete")
        
        # Start test sequence in background after a short delay
        asyncio.create_task(run_startup_test_sequence())

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    # Check real model first, then fallback to ARKit
    if REAL_LAM_AVAILABLE:
        real_model = get_real_model()
        if real_model.is_loaded:
            return HealthResponse(
                status="healthy",
                model_loaded=True,
                device=str(real_model.device),
                version="1.0.0",
                uptime=time.time() - start_time
            )
    
    # Fallback to ARKit model
    model = get_model()
    return HealthResponse(
        status="healthy" if model.is_loaded else "initializing" if model_loading else "error",
        model_loaded=model.is_loaded,
        device=str(model.device),
        version="1.0.0",
        uptime=time.time() - start_time
    )

@app.post("/process", response_model=Audio2ExpressionResponse)
async def process_audio(request: Audio2ExpressionRequest):
    """Process audio and generate blendshape coefficients."""
    start_time_req = time.time()
    request_id = f"req_{int(time.time() * 1000) % 10000:04d}"
    
    try:
        logger.info(f"🎵 [{request_id}] New audio processing request:")
        logger.info(f"   📊 Audio data: {len(request.audio)} chars (base64)")
        logger.info(f"   🔊 Sample rate: {request.sample_rate}Hz")
        logger.info(f"   📝 Format: {request.format}")
        logger.info(f"   ⚙️  Config: {request.config}")
        
        # Check if real model is loaded first, then fallback to mock
        if REAL_LAM_AVAILABLE:
            real_model = get_real_model()
            if real_model.is_loaded:
                model = real_model
                logger.info(f"   🎯 Using LAM ARKit model: {'✅ loaded' if model.is_loaded else '❌ not loaded'}")
            else:
                model = get_model()
                logger.info(f"   🎭 Using enhanced ARKit model: {'✅ loaded' if model.is_loaded else '❌ not loaded'}")
        else:
            model = get_model()
            logger.info(f"   🎭 Using enhanced ARKit model: {'✅ loaded' if model.is_loaded else '❌ not loaded'}")
        
        if not model.is_loaded:
            if model_loading:
                logger.warning(f"   ⏳ [{request_id}] Model still loading, rejecting request")
                raise HTTPException(
                    status_code=503, 
                    detail="Model is still loading, please try again in a moment"
                )
            else:
                logger.error(f"   💥 [{request_id}] Model not loaded, rejecting request")
                raise HTTPException(
                    status_code=503, 
                    detail="Model is not loaded. Check server logs for initialization errors."
                )
        
        # Validate input
        if not request.audio:
            logger.error(f"   ❌ [{request_id}] No audio data provided")
            raise HTTPException(status_code=400, detail="No audio data provided")
        
        logger.info(f"   🔄 [{request_id}] Starting audio processing...")
        
        # Process audio
        blendshape_frames = model.process_audio_base64(
            request.audio, 
            request.sample_rate
        )
        
        # Calculate duration
        duration = blendshape_frames[-1]['timestamp'] if blendshape_frames else 0.0
        processing_time = time.time() - start_time_req
        
        logger.info(f"✅ [{request_id}] Audio processing complete:")
        logger.info(f"   🎭 Generated frames: {len(blendshape_frames)}")
        logger.info(f"   ⏱️  Processing time: {processing_time:.3f}s")
        logger.info(f"   📏 Audio duration: {duration:.2f}s")
        
        # Log sample blendshapes from first frame
        if blendshape_frames:
            first_frame = blendshape_frames[0]
            active_shapes = {k: v for k, v in first_frame['blendshapes'].items() if v > 0.01}
            logger.info(f"   🎪 Sample blendshapes: {active_shapes}")
        
        return Audio2ExpressionResponse(
            success=True,
            blendshapes=[BlendshapeFrame(**frame) for frame in blendshape_frames],
            duration=duration,
            sample_rate=SAMPLE_RATE,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [{request_id}] Error processing audio: {e}", exc_info=True)
        return Audio2ExpressionResponse(
            success=False,
            error=str(e),
            processing_time=time.time() - start_time_req
        )

@app.get("/models/info")
async def model_info():
    """Get information about the loaded model."""
    model = get_model()
    
    return {
        "model_name": MODEL_NAME,
        "device": str(model.device),
        "is_loaded": model.is_loaded,
        "sample_rate": SAMPLE_RATE,
        "output_fps": OUTPUT_FPS,
        "num_blendshapes": NUM_BLENDSHAPES,
        "supported_formats": SUPPORTED_FORMATS,
        "max_audio_length": MAX_AUDIO_LENGTH
    }

@app.post("/models/reload")
async def reload_model(background_tasks: BackgroundTasks):
    """Reload the model."""
    def _reload():
        model = get_model()
        model.is_loaded = False
        success = model.load_model()
        logger.info(f"Model reload {'successful' if success else 'failed'}")
    
    background_tasks.add_task(_reload)
    return {"message": "Model reload initiated"}

if __name__ == "__main__":
    logger.info(f"Starting LAM Audio2Expression service on {HOST}:{PORT}")
    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        workers=WORKERS,
        log_level=LOG_LEVEL.lower(),
        reload=DEBUG_MODE
    )