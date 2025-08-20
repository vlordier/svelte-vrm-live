import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface CachedWelcomeMessage {
	text: string;
	voice: string;
	provider: string;
	timestamp: number;
	audioBase64: string;
	sampleRate: number;
	duration: number;
	hash: string;
}

export class TTSCache {
	private static cacheDir = join(process.cwd(), '.tts-cache');
	private static welcomeCacheFile = join(this.cacheDir, 'welcome-messages.json');

	private static ensureCacheDir(): void {
		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, { recursive: true });
			console.log('[TTS Cache] Created cache directory:', this.cacheDir);
		}
	}

	private static generateHash(text: string, voice: string, provider: string): string {
		return createHash('md5').update(`${text}-${voice}-${provider}`).digest('hex');
	}

	static getCachedWelcomeMessage(
		text: string,
		voice: string,
		provider: string
	): CachedWelcomeMessage | null {
		try {
			this.ensureCacheDir();

			if (!existsSync(this.welcomeCacheFile)) {
				return null;
			}

			const cache: Record<string, CachedWelcomeMessage> = JSON.parse(
				readFileSync(this.welcomeCacheFile, 'utf-8')
			);

			const hash = this.generateHash(text, voice, provider);
			const cached = cache[hash];

			if (cached) {
				console.log(`[TTS Cache] Found cached welcome message for ${voice} (${provider})`);
				return cached;
			}

			return null;
		} catch (error) {
			console.error('[TTS Cache] Error reading welcome cache:', error);
			return null;
		}
	}

	static cacheWelcomeMessage(
		text: string,
		voice: string,
		provider: string,
		audioBase64: string,
		sampleRate: number,
		duration: number
	): void {
		try {
			this.ensureCacheDir();

			let cache: Record<string, CachedWelcomeMessage> = {};
			if (existsSync(this.welcomeCacheFile)) {
				try {
					cache = JSON.parse(readFileSync(this.welcomeCacheFile, 'utf-8'));
				} catch {
					console.log('[TTS Cache] Corrupted cache file, creating new one');
				}
			}

			const hash = this.generateHash(text, voice, provider);
			const cachedMessage: CachedWelcomeMessage = {
				text,
				voice,
				provider,
				timestamp: Date.now(),
				audioBase64,
				sampleRate,
				duration,
				hash
			};

			cache[hash] = cachedMessage;

			writeFileSync(this.welcomeCacheFile, JSON.stringify(cache, null, 2));
			console.log(`[TTS Cache] Cached welcome message for ${voice} (${provider})`);
		} catch (error) {
			console.error('[TTS Cache] Error writing welcome cache:', error);
		}
	}

	static clearCache(): void {
		try {
			if (existsSync(this.welcomeCacheFile)) {
				writeFileSync(this.welcomeCacheFile, '{}');
				console.log('[TTS Cache] Cleared welcome message cache');
			}
		} catch (error) {
			console.error('[TTS Cache] Error clearing cache:', error);
		}
	}

	static getCacheStats(): { count: number; totalSize: number; entries: string[] } {
		try {
			if (!existsSync(this.welcomeCacheFile)) {
				return { count: 0, totalSize: 0, entries: [] };
			}

			const cacheData = readFileSync(this.welcomeCacheFile, 'utf-8');
			const cache: Record<string, CachedWelcomeMessage> = JSON.parse(cacheData);

			const entries = Object.keys(cache);
			const totalSize = cacheData.length;

			return {
				count: entries.length,
				totalSize,
				entries: entries.map((hash) => {
					const cached = cache[hash];
					return `${cached.voice} (${cached.provider}) - ${cached.text.substring(0, 30)}...`;
				})
			};
		} catch {
			return { count: 0, totalSize: 0, entries: [] };
		}
	}
}
