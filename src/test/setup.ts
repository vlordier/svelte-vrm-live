import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock WebAudio API
global.AudioContext = vi.fn().mockImplementation(() => ({
	createBufferSource: vi.fn().mockReturnValue({
		buffer: null,
		connect: vi.fn(),
		start: vi.fn(),
		onended: null
	}),
	createBuffer: vi.fn(),
	decodeAudioData: vi.fn().mockResolvedValue({
		duration: 1.0
	}),
	destination: {}
}));

global.AudioBuffer = vi.fn();

// Mock crypto for browser environment
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: vi.fn().mockReturnValue('mock-uuid-1234'),
		getRandomValues: vi.fn().mockReturnValue(new Uint8Array(16))
	}
});

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
	value: {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn()
	}
});

// Mock console methods for cleaner test output
global.console = {
	...console,
	log: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn()
};

// This will be handled by vitest globals
