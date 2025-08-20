export interface ProgressInfo {
	percentage: number;
	fileName?: string;
	status: 'downloading' | 'initializing' | 'ready' | 'error' | 'retrying';
	message?: string;
	retryCount?: number;
}

class TTSProgressManager {
	private static instance: TTSProgressManager | null = null;
	private currentProgress: ProgressInfo = {
		percentage: 0,
		status: 'initializing'
	};
	private callbacks: Set<(progress: ProgressInfo) => void> = new Set();

	static getInstance(): TTSProgressManager {
		if (!TTSProgressManager.instance) {
			TTSProgressManager.instance = new TTSProgressManager();
		}
		return TTSProgressManager.instance;
	}

	updateProgress(progress: Partial<ProgressInfo>): void {
		this.currentProgress = { ...this.currentProgress, ...progress };

		// Notify all callbacks
		this.callbacks.forEach((callback) => {
			try {
				callback(this.currentProgress);
			} catch (error) {
				console.error('[TTSProgressManager] Error in progress callback:', error);
			}
		});
	}

	getCurrentProgress(): ProgressInfo {
		return { ...this.currentProgress };
	}

	subscribe(callback: (progress: ProgressInfo) => void): () => void {
		this.callbacks.add(callback);

		// Return unsubscribe function
		return () => {
			this.callbacks.delete(callback);
		};
	}

	reset(): void {
		this.currentProgress = {
			percentage: 0,
			status: 'initializing'
		};
		this.callbacks.clear();
	}
}

export const ttsProgressManager = TTSProgressManager.getInstance();
