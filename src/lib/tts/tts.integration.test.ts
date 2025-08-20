import { describe, it, expect } from 'vitest';
import { UnifiedTTSClient } from './client';
import { KokoroTTSClient } from './kokoro';

// Note: These integration tests require the actual model to be downloaded
// They may be slow on first run due to model downloading
describe('TTS Integration Tests', () => {
	describe('UnifiedTTSClient', () => {
		it('should create a Kokoro TTS client by default', () => {
			const client = new UnifiedTTSClient();
			const config = client.getConfig();

			expect(config.provider).toBe('kokoro');
			expect(config.voice).toBe('af_bella');
		});

		it('should respect provider configuration', () => {
			const client = new UnifiedTTSClient({
				provider: 'browser',
				voice: 'default'
			});
			const config = client.getConfig();

			expect(config.provider).toBe('browser');
			expect(config.voice).toBe('default');
		});

		it('should detect available provider', () => {
			const result = UnifiedTTSClient.detectAvailableProvider();

			expect(result.provider).toBe('kokoro');
			expect(result.reason).toContain('local TTS preferred');
		});

		it('should get provider info', () => {
			const info = UnifiedTTSClient.getProviderInfo();

			expect(info).toHaveProperty('kokoro');
			expect(info).toHaveProperty('browser');
			expect(info.kokoro.name).toBe('Kokoro TTS');
			expect(info.kokoro.isLocal).toBe(true);
			expect(Array.isArray(info.kokoro.voices)).toBe(true);
		});
	});

	describe('KokoroTTSClient', () => {
		it('should have available voices', () => {
			const voices = KokoroTTSClient.getAvailableVoices();

			expect(Array.isArray(voices)).toBe(true);
			expect(voices.length).toBeGreaterThan(0);
			expect(voices).toContain('af_bella');
			expect(voices).toContain('am_adam');
		});

		it('should create client with default configuration', () => {
			const client = new KokoroTTSClient();
			const config = client.getConfig();

			expect(config.voice).toBe('af_bella');
			expect(config.modelId).toBe('onnx-community/Kokoro-82M-ONNX');
			expect(config.dtype).toBe('q4');
			expect(config.device).toBe('wasm');
		});

		it('should allow configuration updates', () => {
			const client = new KokoroTTSClient();

			client.updateConfig({ voice: 'am_adam' });
			const config = client.getConfig();

			expect(config.voice).toBe('am_adam');
		});
	});

	// Commented out actual synthesis tests as they require model download
	// Uncomment these for full integration testing:

	// describe('TTS Synthesis (requires model download)', () => {
	// 	it('should synthesize text with Kokoro TTS', async () => {
	// 		const client = new UnifiedTTSClient({ provider: 'kokoro' });
	//
	// 		const result = await client.synthesize('Hello, this is a test.');
	//
	// 		expect(result).toHaveProperty('audio');
	// 		expect(result).toHaveProperty('sampleRate');
	// 		expect(result).toHaveProperty('duration');
	// 		expect(result.audio).toBeInstanceOf(ArrayBuffer);
	// 		expect(result.sampleRate).toBe(22050);
	// 		expect(result.duration).toBeGreaterThan(0);
	//
	// 		await client.dispose();
	// 	}, 60000); // Increased timeout for model download
	//
	// 	it('should test connection successfully', async () => {
	// 		const result = await UnifiedTTSClient.testConnection('kokoro');
	//
	// 		expect(result.success).toBe(true);
	// 		expect(result.message).toContain('successful');
	// 	}, 60000);
	// });
});
