/**
 * Comprehensive logging system with different log levels and structured output
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	SILENT = 4
}

export interface LogContext {
	module?: string;
	component?: string;
	userId?: string;
	sessionId?: string;
	[key: string]: unknown;
}

class Logger {
	private logLevel: LogLevel;
	private isDevelopment: boolean;

	constructor() {
		this.isDevelopment =
			typeof globalThis !== 'undefined' && 'window' in globalThis
				? globalThis.window.location.hostname === 'localhost'
				: typeof globalThis !== 'undefined' && 'process' in globalThis
					? globalThis.process?.env?.NODE_ENV === 'development'
					: false;
		this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
	}

	private formatMessage(level: string, message: string, context?: LogContext): string {
		const timestamp = new Date().toISOString();
		const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
		return `[${timestamp}] ${level}:${contextStr} ${message}`;
	}

	private shouldLog(level: LogLevel): boolean {
		return level >= this.logLevel;
	}

	debug(message: string, context?: LogContext): void {
		if (!this.shouldLog(LogLevel.DEBUG)) return;
		console.debug(this.formatMessage('DEBUG', message, context));
	}

	info(message: string, context?: LogContext): void {
		if (!this.shouldLog(LogLevel.INFO)) return;
		console.info(this.formatMessage('INFO', message, context));
	}

	warn(message: string, context?: LogContext): void {
		if (!this.shouldLog(LogLevel.WARN)) return;
		console.warn(this.formatMessage('WARN', message, context));
	}

	error(message: string, error?: Error | unknown, context?: LogContext): void {
		if (!this.shouldLog(LogLevel.ERROR)) return;
		const errorContext = {
			...context,
			error:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack
						}
					: error
		};
		console.error(this.formatMessage('ERROR', message, errorContext));
	}

	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	// Performance logging
	time(label: string): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.time(`[PERF] ${label}`);
		}
	}

	timeEnd(label: string): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.timeEnd(`[PERF] ${label}`);
		}
	}

	// API request logging
	apiRequest(method: string, url: string, context?: LogContext): void {
		this.info(`API ${method} ${url}`, { module: 'api', ...context });
	}

	apiResponse(
		method: string,
		url: string,
		status: number,
		duration?: number,
		context?: LogContext
	): void {
		const level = status >= 400 ? LogLevel.ERROR : status >= 300 ? LogLevel.WARN : LogLevel.INFO;
		const message = `API ${method} ${url} - ${status}${duration ? ` (${duration}ms)` : ''}`;

		if (level === LogLevel.ERROR) {
			this.error(message, undefined, { module: 'api', ...context });
		} else if (level === LogLevel.WARN) {
			this.warn(message, { module: 'api', ...context });
		} else {
			this.info(message, { module: 'api', ...context });
		}
	}
}

// Export singleton logger instance
export const logger = new Logger();

// Module-specific loggers
export const createModuleLogger = (moduleName: string) => ({
	debug: (message: string, context?: Omit<LogContext, 'module'>) =>
		logger.debug(message, { module: moduleName, ...context }),
	info: (message: string, context?: Omit<LogContext, 'module'>) =>
		logger.info(message, { module: moduleName, ...context }),
	warn: (message: string, context?: Omit<LogContext, 'module'>) =>
		logger.warn(message, { module: moduleName, ...context }),
	error: (message: string, error?: Error | unknown, context?: Omit<LogContext, 'module'>) =>
		logger.error(message, error, { module: moduleName, ...context }),
	time: (label: string) => logger.time(`${moduleName}:${label}`),
	timeEnd: (label: string) => logger.timeEnd(`${moduleName}:${label}`)
});
