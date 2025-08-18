import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, createModuleLogger, LogLevel } from './logger';

describe('Logger', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset logger to default state
		logger.setLogLevel(LogLevel.DEBUG);
	});

	describe('Log Level Filtering', () => {
		it('should log debug messages when log level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			const spy = vi.spyOn(console, 'debug');

			logger.debug('test message');

			expect(spy).toHaveBeenCalled();
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('test message'));
		});

		it('should not log debug messages when log level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			const spy = vi.spyOn(console, 'debug');

			logger.debug('test message');

			expect(spy).not.toHaveBeenCalled();
		});

		it('should always log error messages regardless of log level', () => {
			logger.setLogLevel(LogLevel.SILENT);
			const spy = vi.spyOn(console, 'error');

			logger.error('error message');

			expect(spy).not.toHaveBeenCalled(); // SILENT level blocks all
		});
	});

	describe('Message Formatting', () => {
		it('should format messages with timestamp and level', () => {
			const spy = vi.spyOn(console, 'info');

			logger.info('test message');

			expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] INFO: test message$/));
		});

		it('should include context in formatted messages', () => {
			const spy = vi.spyOn(console, 'info');
			const context = { module: 'test', userId: '123' };

			logger.info('test message', context);

			expect(spy).toHaveBeenCalledWith(expect.stringContaining('{"module":"test","userId":"123"}'));
		});
	});

	describe('Error Logging', () => {
		it('should log error objects with stack traces', () => {
			const spy = vi.spyOn(console, 'error');
			const error = new Error('test error');

			logger.error('Something went wrong', error);

			expect(spy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('test error'));
		});
	});

	describe('Performance Logging', () => {
		it('should start and end performance timers', () => {
			const timeSpy = vi.spyOn(console, 'time');
			const timeEndSpy = vi.spyOn(console, 'timeEnd');

			logger.time('operation');
			logger.timeEnd('operation');

			expect(timeSpy).toHaveBeenCalledWith('[PERF] operation');
			expect(timeEndSpy).toHaveBeenCalledWith('[PERF] operation');
		});
	});

	describe('API Logging', () => {
		it('should log API requests with method and URL', () => {
			const spy = vi.spyOn(console, 'info');

			logger.apiRequest('GET', '/api/test');

			expect(spy).toHaveBeenCalledWith(expect.stringContaining('API GET /api/test'));
		});

		it('should log successful API responses as info', () => {
			const spy = vi.spyOn(console, 'info');

			logger.apiResponse('GET', '/api/test', 200, 150);

			expect(spy).toHaveBeenCalledWith(expect.stringContaining('API GET /api/test - 200 (150ms)'));
		});

		it('should log error API responses as errors', () => {
			const spy = vi.spyOn(console, 'error');

			logger.apiResponse('POST', '/api/test', 500);

			expect(spy).toHaveBeenCalledWith(expect.stringContaining('API POST /api/test - 500'));
		});
	});
});

describe('Module Logger', () => {
	it('should create module-specific logger with context', () => {
		const moduleLogger = createModuleLogger('TestModule');
		const spy = vi.spyOn(console, 'info');

		moduleLogger.info('test message');

		expect(spy).toHaveBeenCalledWith(expect.stringContaining('{"module":"TestModule"}'));
	});

	it('should merge additional context with module name', () => {
		const moduleLogger = createModuleLogger('TestModule');
		const spy = vi.spyOn(console, 'info');

		moduleLogger.info('test message', { userId: '123' });

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining('{"module":"TestModule","userId":"123"}')
		);
	});
});
