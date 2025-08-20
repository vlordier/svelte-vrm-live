import type { STTConfig } from './client';
import { VADClient } from './vad';
import { WhisperClient } from './whisper';

/**
 * Client-side utilities for STT functionality that require browser APIs
 * These functions should only be called from client-side code
 */

export async function testMicrophoneAccess(): Promise<{ success: boolean; message: string }> {
	if (typeof window === 'undefined') {
		return {
			success: false,
			message: 'Microphone access test can only be performed in browser environment'
		};
	}

	return VADClient.testMicrophoneAccess();
}

export async function testSTTConnection(config?: Partial<STTConfig>): Promise<{
	success: boolean;
	message: string;
	details: {
		vad: { success: boolean; message: string };
		whisper: { success: boolean; message: string };
	};
}> {
	if (typeof window === 'undefined') {
		return {
			success: false,
			message: 'STT connection test can only be performed in browser environment',
			details: {
				vad: { success: false, message: 'Browser environment required' },
				whisper: { success: false, message: 'Browser environment required' }
			}
		};
	}

	try {
		console.log('[STT] Testing Speech-to-Text system...');

		// Test microphone access
		const micTest = await testMicrophoneAccess();

		// Test Whisper
		const whisperTest = await WhisperClient.testConnection(config?.whisper);

		const allSuccessful = micTest.success && whisperTest.success;

		return {
			success: allSuccessful,
			message: allSuccessful
				? 'Speech-to-Text system test successful'
				: 'Some Speech-to-Text components failed testing',
			details: {
				vad: micTest,
				whisper: whisperTest
			}
		};
	} catch (error) {
		return {
			success: false,
			message: `Speech-to-Text test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			details: {
				vad: { success: false, message: 'Test not completed' },
				whisper: { success: false, message: 'Test not completed' }
			}
		};
	}
}
