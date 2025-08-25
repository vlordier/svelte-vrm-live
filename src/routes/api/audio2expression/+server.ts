import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface Audio2ExpressionRequest {
	audio: string; // base64 encoded audio
	sample_rate?: number;
	format?: string;
	config?: {
		smoothing?: number;
		intensity?: number;
	};
}

interface BlendshapeFrame {
	timestamp: number; // seconds
	blendshapes: Record<string, number>; // ARKit blendshape name -> weight
}

interface Audio2ExpressionResponse {
	success: boolean;
	blendshapes: BlendshapeFrame[];
	duration: number;
	sample_rate: number;
	error?: string;
}

// Configuration for Python service
const PYTHON_SERVICE_URL = process.env.LAM_SERVICE_URL || 'http://localhost:8001';
const PYTHON_SERVICE_TIMEOUT = 30000; // 30 seconds
const USE_MOCK_FALLBACK = process.env.LAM_USE_MOCK_FALLBACK !== 'false';

// Helper function for fetch with timeout
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeoutMs: number = 5000
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});
		clearTimeout(timeout);
		return response;
	} catch (error) {
		clearTimeout(timeout);
		throw error;
	}
}

// Check if Python service is available
let pythonServiceAvailable = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // Check every 30 seconds

async function checkPythonServiceHealth(): Promise<boolean> {
	const now = Date.now();
	if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
		return pythonServiceAvailable;
	}

	try {
		const response = await fetchWithTimeout(
			`${PYTHON_SERVICE_URL}/health`,
			{
				method: 'GET'
			},
			5000
		);

		if (response.ok) {
			const health = await response.json();
			pythonServiceAvailable = health.model_loaded === true;
		} else {
			pythonServiceAvailable = false;
		}
	} catch (error) {
		console.warn('[Audio2Expression] Python service health check failed:', error);
		pythonServiceAvailable = false;
	}

	lastHealthCheck = now;
	console.log(
		`[Audio2Expression] Python service status: ${pythonServiceAvailable ? 'available' : 'unavailable'}`
	);
	return pythonServiceAvailable;
}

// Real LAM_Audio2Expression inference via Python service
async function processAudioToExpressionReal(
	audioBase64: string,
	sampleRate: number = 24000,
	config: Record<string, unknown> = {}
): Promise<BlendshapeFrame[]> {
	try {
		console.log('[Audio2Expression] Sending request to Python service...');

		const response = await fetchWithTimeout(
			`${PYTHON_SERVICE_URL}/process`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					audio: audioBase64,
					sample_rate: sampleRate,
					format: 'wav',
					config: config
				})
			},
			PYTHON_SERVICE_TIMEOUT
		);

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(
				`Python service error ${response.status}: ${error.error || error.message || 'Unknown error'}`
			);
		}

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error || 'Python service returned failure status');
		}

		console.log(
			`[Audio2Expression] ARKit model generated ${result.blendshapes?.length || 0} frames in ${result.processing_time?.toFixed(3) || 'unknown'}s`
		);

		return result.blendshapes || [];
	} catch (error) {
		console.error('[Audio2Expression] ARKit model processing failed:', error);
		throw error;
	}
}

// Mock LAM_Audio2Expression inference - fallback implementation
async function processAudioToExpressionMock(
	audioBase64: string,
	sampleRate: number = 24000
): Promise<BlendshapeFrame[]> {
	console.log('[Audio2Expression] Using fallback ARKit implementation');

	// For now, create synthetic blendshape data based on audio length
	const audioData = globalThis.atob(audioBase64);
	const audioLength = audioData.length;
	const durationSeconds = audioLength / (sampleRate * 4); // Approximate duration for Float32 audio

	const frames: BlendshapeFrame[] = [];
	const frameRate = 30; // 30 FPS for blendshape animation
	const frameCount = Math.ceil(durationSeconds * frameRate);

	// Generate realistic-looking blendshape animation
	for (let i = 0; i < frameCount; i++) {
		const timestamp = i / frameRate;
		const progress = i / frameCount;

		// Create more realistic mouth movements with sine waves
		const mouthOpenBase = Math.sin(progress * Math.PI * 8) * 0.3 + 0.1;
		const mouthOpen = Math.max(0, mouthOpenBase + Math.random() * 0.2 - 0.1);

		// Add some variation to other facial features
		const browIntensity = Math.sin(progress * Math.PI * 2) * 0.15 + 0.05;
		const eyeVariation = Math.random() * 0.1;

		frames.push({
			timestamp,
			blendshapes: {
				// Mouth movements (primary)
				mouthOpen: Math.min(1.0, mouthOpen),
				jawOpen: Math.min(1.0, mouthOpen * 0.8),
				mouthSmile: Math.max(0, Math.sin(progress * Math.PI * 3) * 0.2),
				mouthFunnel: Math.max(0, Math.sin(progress * Math.PI * 5 + 1) * 0.15),
				mouthPucker: Math.max(0, Math.sin(progress * Math.PI * 4 + 2) * 0.1),

				// Subtle brow movements
				browInnerUp: Math.max(0, browIntensity + eyeVariation),
				browDownLeft: Math.max(0, -browIntensity * 0.5 + eyeVariation * 0.5),
				browDownRight: Math.max(0, -browIntensity * 0.5 + eyeVariation * 0.5),

				// Occasional eye expressions
				eyeWideLeft: Math.max(0, Math.sin(progress * Math.PI * 1.5) * 0.1),
				eyeWideRight: Math.max(0, Math.sin(progress * Math.PI * 1.5) * 0.1),

				// Cheek involvement
				cheekPuff: Math.max(0, Math.sin(progress * Math.PI * 6) * 0.08)
			}
		});
	}

	console.log(
		`[Audio2Expression] Fallback ARKit generated ${frames.length} blendshape frames for ${durationSeconds.toFixed(2)}s audio`
	);
	return frames;
}

// Main processing function with automatic fallback
async function processAudioToExpression(
	audioBase64: string,
	sampleRate: number = 24000,
	config: Record<string, unknown> = {}
): Promise<BlendshapeFrame[]> {
	// Check if Python service is available
	const serviceAvailable = await checkPythonServiceHealth();

	if (serviceAvailable) {
		try {
			// Try real model first
			return await processAudioToExpressionReal(audioBase64, sampleRate, config);
		} catch (error) {
			console.warn('[Audio2Expression] ARKit model failed, checking fallback...', error);

			if (USE_MOCK_FALLBACK) {
				console.log('[Audio2Expression] Falling back to local ARKit implementation');
				return await processAudioToExpressionMock(audioBase64, sampleRate);
			} else {
				throw error;
			}
		}
	} else {
		if (USE_MOCK_FALLBACK) {
			console.log(
				'[Audio2Expression] Python service unavailable, using local ARKit implementation'
			);
			return await processAudioToExpressionMock(audioBase64, sampleRate);
		} else {
			throw new Error('Python service unavailable and mock fallback disabled');
		}
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: Audio2ExpressionRequest = await request.json();

		if (!body.audio) {
			return json(
				{
					success: false,
					error: 'No audio data provided'
				} as Audio2ExpressionResponse,
				{ status: 400 }
			);
		}

		console.log('[Audio2Expression API] Processing audio request:', {
			audioLength: body.audio.length,
			sampleRate: body.sample_rate || 24000,
			format: body.format || 'wav'
		});

		// Process audio through LAM_Audio2Expression model
		const blendshapes = await processAudioToExpression(body.audio, body.sample_rate || 24000);

		const response: Audio2ExpressionResponse = {
			success: true,
			blendshapes,
			duration: blendshapes.length > 0 ? blendshapes[blendshapes.length - 1].timestamp : 0,
			sample_rate: body.sample_rate || 24000
		};

		console.log(`[Audio2Expression API] Successfully generated ${blendshapes.length} frames`);
		return json(response);
	} catch (error) {
		console.error('[Audio2Expression API] Error processing request:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				blendshapes: [],
				duration: 0,
				sample_rate: 24000
			} as Audio2ExpressionResponse,
			{ status: 500 }
		);
	}
};

// Health check endpoint
export const GET: RequestHandler = async () => {
	const serviceAvailable = await checkPythonServiceHealth();

	let pythonServiceInfo = null;
	if (serviceAvailable) {
		try {
			const response = await fetchWithTimeout(`${PYTHON_SERVICE_URL}/models/info`, {}, 5000);
			if (response.ok) {
				pythonServiceInfo = await response.json();
			}
		} catch (error) {
			console.warn('[Audio2Expression] Failed to get Python service info:', error);
		}
	}

	return json({
		status: 'healthy',
		service: 'audio2expression',
		timestamp: new Date().toISOString(),
		version: '2.0.0',
		python_service: {
			url: PYTHON_SERVICE_URL,
			available: serviceAvailable,
			info: pythonServiceInfo
		},
		features: {
			real_model_available: serviceAvailable,
			mock_fallback_enabled: USE_MOCK_FALLBACK,
			current_mode: serviceAvailable
				? 'real_model'
				: USE_MOCK_FALLBACK
					? 'mock_fallback'
					: 'disabled'
		},
		config: {
			timeout: PYTHON_SERVICE_TIMEOUT,
			health_check_interval: HEALTH_CHECK_INTERVAL
		}
	});
};
