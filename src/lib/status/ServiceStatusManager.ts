/**
 * Centralized service status management
 * Tracks the status of all services, models, and their resources
 */

export interface ServiceStatus {
	name: string;
	status: 'initializing' | 'downloading' | 'loading' | 'ready' | 'error' | 'offline';
	message?: string;
	progress?: number; // 0-100 for downloads/loading
	device?: 'cpu' | 'gpu' | 'mps' | 'cuda' | 'unknown';
	memory_usage?: {
		allocated: number; // MB
		peak: number; // MB
		available: number; // MB
	};
	model_info?: {
		name: string;
		version?: string;
		size?: string; // e.g. "2.3GB"
		parameters?: string; // e.g. "7B"
		quantization?: string; // e.g. "4-bit", "8-bit", "fp16"
	};
	performance?: {
		avg_response_time?: number; // ms
		tokens_per_second?: number;
		requests_processed?: number;
		uptime?: number; // seconds
	};
	last_updated: string;
}

export interface SystemStatus {
	timestamp: string;
	overall_health: 'healthy' | 'degraded' | 'unhealthy';
	services: Record<string, ServiceStatus>;
	system_info: {
		platform: string;
		arch: string;
		memory_total: number; // MB
		memory_free: number; // MB
		cpu_usage?: number; // percentage
		gpu_info?: Array<{
			name: string;
			memory_total: number;
			memory_used: number;
			utilization: number;
		}>;
	};
}

class ServiceStatusManager {
	private static instance: ServiceStatusManager;
	private services: Map<string, ServiceStatus> = new Map();
	private subscribers: Set<(status: SystemStatus) => void> = new Set();
	private updateInterval: ReturnType<typeof setInterval> | null = null;
	private fetchFunction: typeof fetch = globalThis.fetch;

	private constructor() {
		this.initializeServices();
		this.startPeriodicUpdates();
	}

	public static getInstance(): ServiceStatusManager {
		if (!ServiceStatusManager.instance) {
			ServiceStatusManager.instance = new ServiceStatusManager();
		}
		return ServiceStatusManager.instance;
	}

	public setFetch(fetchFn: typeof fetch) {
		this.fetchFunction = fetchFn;
	}

	private initializeServices() {
		const services = [
			'tts',
			'stt', 
			'llm',
			'audio2expression',
			'python_service',
			'whisper',
			'vrm_system',
			'animation_system'
		];

		services.forEach(service => {
			this.services.set(service, {
				name: service,
				status: 'initializing',
				message: 'Service initializing...',
				last_updated: new Date().toISOString()
			});
		});
	}

	private startPeriodicUpdates() {
		// Update service statuses every 30 seconds
		this.updateInterval = globalThis.setInterval(() => {
			this.updateAllServices();
		}, 30000);
	}

	private async updateAllServices() {
		await Promise.allSettled([
			this.updateTTSStatus(),
			this.updateSTTStatus(),
			this.updateLLMStatus(),
			this.updateAudio2ExpressionStatus(),
			this.updatePythonServiceStatus(),
			this.updateWhisperStatus(),
			this.updateVRMStatus(),
			this.updateAnimationStatus()
		]);

		this.notifySubscribers();
	}

	private async updateTTSStatus() {
		try {
			// Check TTS service status
			const response = await this.fetchFunction('/api/tts/status', { 
				method: 'GET',
				signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(5000) : undefined
			});
			
			if (response.ok) {
				const data = await response.json();
				this.updateService('tts', {
					status: 'ready',
					message: `Provider: ${data.provider}`,
					model_info: {
						name: data.provider,
						version: data.version || 'unknown'
					},
					performance: {
						requests_processed: data.requests_processed || 0
					}
				});
			} else {
				this.updateService('tts', {
					status: 'error',
					message: `HTTP ${response.status}`
				});
			}
		} catch {
			this.updateService('tts', {
				status: 'offline',
				message: error instanceof Error ? error.message : 'Service unavailable'
			});
		}
	}

	private async updateSTTStatus() {
		try {
			const response = await this.fetchFunction('/api/stt?action=info', {
				method: 'GET',
				signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(5000) : undefined
			});
			
			if (response.ok) {
				const data = await response.json();
				this.updateService('stt', {
					status: 'ready',
					message: 'Speech-to-Text ready',
					model_info: {
						name: 'Whisper',
						version: data.data?.version || 'unknown'
					}
				});
			} else {
				this.updateService('stt', {
					status: 'error',
					message: 'STT service error'
				});
			}
		} catch {
			this.updateService('stt', {
				status: 'offline',
				message: 'STT service offline'
			});
		}
	}

	private async updateLLMStatus() {
		try {
			// Check if we have LLM configuration
			const response = await this.fetchFunction('/api/config', {
				method: 'GET',
				signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(5000) : undefined
			});

			if (response.ok) {
				this.updateService('llm', {
					status: 'ready',
					message: 'LLM service configured',
					model_info: {
						name: 'External LLM Provider',
						version: 'API-based'
					}
				});
			} else {
				this.updateService('llm', {
					status: 'offline',
					message: 'LLM configuration unavailable'
				});
			}
		} catch {
			this.updateService('llm', {
				status: 'offline',
				message: 'LLM service offline'
			});
		}
	}

	private async updateAudio2ExpressionStatus() {
		try {
			const response = await this.fetchFunction('/api/audio2expression', {
				method: 'GET',
				signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(5000) : undefined
			});
			
			if (response.ok) {
				const data = await response.json();
				this.updateService('audio2expression', {
					status: data.python_service.available ? 'ready' : 'offline',
					message: data.features.current_mode === 'real_model' 
						? 'LAM model ready' 
						: data.features.current_mode === 'mock_fallback'
							? 'Using mock fallback'
							: 'Service disabled',
					device: data.python_service.info?.device || 'unknown',
					model_info: data.python_service.info ? {
						name: 'LAM Audio2Expression',
						version: data.python_service.info.version || 'unknown',
						size: data.python_service.info.model_size || 'unknown'
					} : undefined,
					performance: data.python_service.info?.performance
				});
			} else {
				this.updateService('audio2expression', {
					status: 'error',
					message: 'Audio2Expression API error'
				});
			}
		} catch {
			this.updateService('audio2expression', {
				status: 'offline',
				message: 'Audio2Expression offline'
			});
		}
	}

	private async updatePythonServiceStatus() {
		try {
			const serviceUrl = process.env.LAM_SERVICE_URL || 'http://localhost:8001';
			const response = await this.fetchFunction(`${serviceUrl}/health`, {
				method: 'GET',
				signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(5000) : undefined
			});
			
			if (response.ok) {
				const data = await response.json();
				this.updateService('python_service', {
					status: data.model_loaded ? 'ready' : 'loading',
					message: data.model_loaded ? 'Python service ready' : 'Loading models...',
					progress: data.loading_progress,
					device: data.device || 'unknown',
					memory_usage: data.memory_usage,
					model_info: data.model_info,
					performance: data.performance
				});
			} else {
				this.updateService('python_service', {
					status: 'error',
					message: `Python service error: ${response.status}`
				});
			}
		} catch {
			this.updateService('python_service', {
				status: 'offline',
				message: 'Python service not accessible'
			});
		}
	}

	private async updateWhisperStatus() {
		try {
			const response = await this.fetchFunction('/api/stt?action=models', {
				method: 'GET',
				signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(5000) : undefined
			});
			
			if (response.ok) {
				const data = await response.json();
				const modelCount = data.data?.available_models?.length || 0;
				this.updateService('whisper', {
					status: modelCount > 0 ? 'ready' : 'offline',
					message: `${modelCount} Whisper models available`,
					model_info: {
						name: 'Whisper',
						version: 'WebAssembly'
					}
				});
			} else {
				this.updateService('whisper', {
					status: 'error',
					message: 'Whisper models unavailable'
				});
			}
		} catch {
			this.updateService('whisper', {
				status: 'offline',
				message: 'Whisper service offline'
			});
		}
	}

	private updateVRMStatus() {
		// VRM system is always ready if the app is running
		this.updateService('vrm_system', {
			status: 'ready',
			message: 'VRM avatar system ready',
			model_info: {
				name: '@pixiv/three-vrm',
				version: '2.x'
			}
		});
	}

	private updateAnimationStatus() {
		// Animation system is always ready if the app is running
		this.updateService('animation_system', {
			status: 'ready',
			message: 'FBX + VRMA animation system ready',
			model_info: {
				name: 'Enhanced Animation Controller',
				version: '1.0'
			}
		});
	}

	private updateService(serviceName: string, updates: Partial<ServiceStatus>) {
		const current = this.services.get(serviceName);
		if (current) {
			this.services.set(serviceName, {
				...current,
				...updates,
				last_updated: new Date().toISOString()
			});
		}
	}

	private notifySubscribers() {
		const status = this.getSystemStatus();
		this.subscribers.forEach(callback => {
			try {
				callback(status);
			} catch {
				console.error('Error notifying status subscriber:', error);
			}
		});
	}

	public getSystemStatus(): SystemStatus {
		const services = Object.fromEntries(this.services);
		const healthyCount = Object.values(services).filter(s => s.status === 'ready').length;
		const totalCount = Object.values(services).length;
		
		let overall_health: 'healthy' | 'degraded' | 'unhealthy';
		if (healthyCount === totalCount) {
			overall_health = 'healthy';
		} else if (healthyCount >= totalCount * 0.7) {
			overall_health = 'degraded';
		} else {
			overall_health = 'unhealthy';
		}

		return {
			timestamp: new Date().toISOString(),
			overall_health,
			services,
			system_info: this.getSystemInfo()
		};
	}

	private getSystemInfo() {
		// Check if we're in a browser environment
		if (typeof window !== 'undefined') {
			return {
				platform: 'browser',
				arch: 'unknown',
				memory_total: 0,
				memory_free: 0,
				user_agent: globalThis.navigator?.userAgent || 'unknown'
			};
		}

		// Server-side Node.js environment
		try {
			const memoryUsage = process.memoryUsage();
			return {
				platform: process.platform,
				arch: process.arch,
				memory_total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
				memory_free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024),
				// GPU info would need additional libraries to detect
			};
		} catch {
			return {
				platform: 'unknown',
				arch: 'unknown',
				memory_total: 0,
				memory_free: 0,
			};
		}
	}

	public subscribe(callback: (status: SystemStatus) => void): () => void {
		this.subscribers.add(callback);
		// Send current status immediately
		callback(this.getSystemStatus());
		
		return () => {
			this.subscribers.delete(callback);
		};
	}

	public async refreshService(serviceName: string) {
		switch (serviceName) {
			case 'tts': await this.updateTTSStatus(); break;
			case 'stt': await this.updateSTTStatus(); break;
			case 'llm': await this.updateLLMStatus(); break;
			case 'audio2expression': await this.updateAudio2ExpressionStatus(); break;
			case 'python_service': await this.updatePythonServiceStatus(); break;
			case 'whisper': await this.updateWhisperStatus(); break;
			case 'vrm_system': this.updateVRMStatus(); break;
			case 'animation_system': this.updateAnimationStatus(); break;
			default:
				throw new Error(`Unknown service: ${serviceName}`);
		}
		this.notifySubscribers();
	}

	public destroy() {
		if (this.updateInterval) {
			globalThis.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		this.subscribers.clear();
	}
}

export default ServiceStatusManager;