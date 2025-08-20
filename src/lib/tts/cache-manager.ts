import { promises as fs } from 'fs';
import path from 'path';

export class TTSCacheManager {
	private static getCachePath(modelId: string): string {
		return path.join(
			process.cwd(),
			'node_modules',
			'@huggingface',
			'transformers',
			'.cache',
			...modelId.split('/')
		);
	}

	static async clearModelCache(modelId: string): Promise<boolean> {
		try {
			const cachePath = this.getCachePath(modelId);
			console.log(`[TTSCacheManager] Clearing cache at: ${cachePath}`);

			await fs.rm(cachePath, { recursive: true, force: true });
			console.log('[TTSCacheManager] Cache cleared successfully');
			return true;
		} catch (error) {
			console.error('[TTSCacheManager] Failed to clear cache:', error);
			return false;
		}
	}

	static async validateModelCache(modelId: string): Promise<boolean> {
		try {
			const cachePath = this.getCachePath(modelId);
			const modelPath = path.join(cachePath, 'onnx', 'model.onnx');

			// Check if model file exists
			const stats = await fs.stat(modelPath);

			// Basic validation - check if file is not empty and has reasonable size
			if (stats.size < 1000) {
				console.warn(`[TTSCacheManager] Model file too small: ${stats.size} bytes`);
				return false;
			}

			// Check if file was created/modified recently (might indicate incomplete download)
			const now = Date.now();
			const fileAge = now - stats.mtime.getTime();
			const isRecentlyModified = fileAge < 60000; // 1 minute

			if (isRecentlyModified) {
				console.log('[TTSCacheManager] Model file recently modified, may be incomplete');
				return false;
			}

			console.log(`[TTSCacheManager] Model cache validated: ${stats.size} bytes`);
			return true;
		} catch (error) {
			console.log('[TTSCacheManager] Cache validation failed (file may not exist):', error);
			return false;
		}
	}

	static async getCacheInfo(modelId: string): Promise<{
		exists: boolean;
		size?: number;
		lastModified?: Date;
		path: string;
	}> {
		const cachePath = this.getCachePath(modelId);
		const modelPath = path.join(cachePath, 'onnx', 'model.onnx');

		try {
			const stats = await fs.stat(modelPath);
			return {
				exists: true,
				size: stats.size,
				lastModified: stats.mtime,
				path: modelPath
			};
		} catch {
			return {
				exists: false,
				path: modelPath
			};
		}
	}
}
