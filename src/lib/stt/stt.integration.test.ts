import { describe, it, expect } from 'vitest';
import { UnifiedSTTClient } from './client';
import { WhisperClient } from './whisper';
import { VADClient } from './vad';

// Note: These integration tests require actual model downloads and microphone access
// They may be slow on first run due to model downloading
describe('STT Integration Tests', () => {
	describe('UnifiedSTTClient', () => {
		it('should create an STT client with default configuration', () => {
			const client = new UnifiedSTTClient();
			const config = client.getConfig();

			expect(config.vad.positiveSpeechThreshold).toBe(0.8);
			expect(config.vad.negativeSpeechThreshold).toBe(0.35);
			expect(config.whisper.modelId).toBe('Xenova/whisper-tiny.en');
			expect(config.whisper.dtype).toBe('q4');
			expect(config.whisper.device).toBe('wasm');
			expect(config.whisper.language).toBe('en');
			expect(config.whisper.task).toBe('transcribe');
		});

		it('should respect custom configuration', () => {
			const client = new UnifiedSTTClient({
				vad: {
					positiveSpeechThreshold: 0.9,
					minSpeechFrames: 10
				},
				whisper: {
					modelId: 'Xenova/whisper-base.en',
					returnTimestamps: true
				}
			});
			const config = client.getConfig();

			expect(config.vad.positiveSpeechThreshold).toBe(0.9);
			expect(config.vad.minSpeechFrames).toBe(10);
			expect(config.whisper.modelId).toBe('Xenova/whisper-base.en');
			expect(config.whisper.returnTimestamps).toBe(true);
		});

		it('should get provider info', () => {
			const info = UnifiedSTTClient.getProviderInfo();

			expect(info).toHaveProperty('vad');
			expect(info).toHaveProperty('whisper');
			expect(info.vad.name).toBe('Silero VAD');
			expect(info.whisper.name).toBe('Whisper ASR');
			expect(Array.isArray(info.whisper.models)).toBe(true);
			expect(info.whisper.models.length).toBeGreaterThan(0);
		});

		it('should update callbacks', () => {
			const client = new UnifiedSTTClient();

			client.updateCallbacks({
				onTranscriptionResult: () => {
					// Callback updated
				},
				onStatusChange: () => {
					// Status callback updated
				}
			});

			// Callbacks should be updated
			expect(client.getStatus()).toBe('idle');
		});
	});

	describe('WhisperClient', () => {
		it('should have available models', () => {
			const models = WhisperClient.getAvailableModels();

			expect(Array.isArray(models)).toBe(true);
			expect(models.length).toBeGreaterThan(0);

			const tinyModel = models.find((m) => m.id === 'Xenova/whisper-tiny.en');
			expect(tinyModel).toBeDefined();
			expect(tinyModel?.name).toBe('Whisper Tiny English');
			expect(tinyModel?.languages).toContain('en');
		});

		it('should create client with default configuration', () => {
			const client = new WhisperClient();
			const config = client.getConfig();

			expect(config.modelId).toBe('Xenova/whisper-tiny.en');
			expect(config.dtype).toBe('q4');
			expect(config.device).toBe('wasm');
			expect(config.language).toBe('en');
			expect(config.task).toBe('transcribe');
			expect(config.returnTimestamps).toBe(false);
		});

		it('should allow configuration updates', () => {
			const client = new WhisperClient();

			client.updateConfig({
				modelId: 'Xenova/whisper-base.en',
				returnTimestamps: 'word',
				language: 'fr'
			});
			const config = client.getConfig();

			expect(config.modelId).toBe('Xenova/whisper-base.en');
			expect(config.returnTimestamps).toBe('word');
			expect(config.language).toBe('fr');
		});
	});

	describe('VADClient', () => {
		it('should create VAD client with default configuration', () => {
			const client = new VADClient();
			const config = client.getConfig();

			expect(config.positiveSpeechThreshold).toBe(0.8);
			expect(config.negativeSpeechThreshold).toBe(0.35);
			expect(config.minSpeechFrames).toBe(5);
			expect(config.startOnLoad).toBe(false);
		});

		it('should allow configuration updates', () => {
			const client = new VADClient();

			client.updateConfig({
				positiveSpeechThreshold: 0.9,
				minSpeechFrames: 10
			});
			const config = client.getConfig();

			expect(config.positiveSpeechThreshold).toBe(0.9);
			expect(config.minSpeechFrames).toBe(10);
		});

		it('should report listening status', () => {
			const client = new VADClient();

			expect(client.isListening()).toBe(false);
		});
	});

	// Commented out actual functionality tests as they require model download and microphone access
	// Uncomment these for full integration testing:

	// describe('STT Functionality (requires model download and microphone)', () => {
	// 	it('should test microphone access', async () => {
	// 		const result = await UnifiedSTTClient.testMicrophoneAccess();
	//
	// 		// This will depend on browser permissions
	// 		expect(result).toHaveProperty('success');
	// 		expect(result).toHaveProperty('message');
	// 		expect(typeof result.success).toBe('boolean');
	// 	}, 10000);
	//
	// 	it('should test Whisper connection', async () => {
	// 		const result = await WhisperClient.testConnection();
	//
	// 		expect(result.success).toBe(true);
	// 		expect(result.message).toContain('successful');
	// 	}, 60000); // Increased timeout for model download
	//
	// 	it('should test full STT connection', async () => {
	// 		const result = await UnifiedSTTClient.testConnection();
	//
	// 		expect(result.success).toBe(true);
	// 		expect(result).toHaveProperty('details');
	// 		expect(result.details).toHaveProperty('vad');
	// 		expect(result.details).toHaveProperty('whisper');
	// 	}, 60000);
	//
	// 	it('should transcribe silent audio', async () => {
	// 		const client = new WhisperClient();
	//
	// 		// Create 1 second of silence at 16kHz
	// 		const silentAudio = new Float32Array(16000).fill(0);
	// 		const result = await client.transcribe(silentAudio);
	//
	// 		expect(result).toHaveProperty('text');
	// 		expect(typeof result.text).toBe('string');
	//
	// 		await client.dispose();
	// 	}, 60000);
	//
	// 	it('should initialize and destroy STT client properly', async () => {
	// 		const client = new UnifiedSTTClient();
	//
	// 		expect(client.getStatus()).toBe('idle');
	//
	// 		await client.initialize();
	// 		expect(client.getStatus()).toBe('idle');
	//
	// 		client.destroy();
	// 		expect(client.getStatus()).toBe('idle');
	// 	}, 60000);
	// });
});
