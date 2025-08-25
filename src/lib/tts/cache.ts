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

interface CachedControl {
	text: string;
	voice: string;
	provider: string;
	timestamp: number;
	phonemes?: Array<{ phoneme: string; start: number; end: number }>;
	blendshapes?: Array<{ timestamp: number; blendshapes: Record<string, number> }>;
	hash: string;
}

export class TTSCache {
	private static cacheDir = join(process.cwd(), '.tts-cache');
	private static welcomeCacheFile = join(this.cacheDir, 'welcome-messages.json');
	private static controlCacheFile = join(this.cacheDir, 'control-data.json');

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

	static getCachedControl(text: string, voice: string, provider: string): CachedControl | null {
		try {
			this.ensureCacheDir();

			if (!existsSync(this.controlCacheFile)) {
				return null;
			}

			const cache: Record<string, CachedControl> = JSON.parse(
				readFileSync(this.controlCacheFile, 'utf-8')
			);

			const hash = this.generateHash(text, voice, provider);
			const cached = cache[hash];

			if (cached) {
				console.log(`[TTS Cache] Found cached control data for ${voice} (${provider})`);
				return cached;
			}

			return null;
		} catch (error) {
			console.error('[TTS Cache] Error reading control cache:', error);
			return null;
		}
	}

	static cacheControl(
		text: string,
		voice: string,
		provider: string,
		phonemes?: Array<{ phoneme: string; start: number; end: number }>,
		blendshapes?: Array<{ timestamp: number; blendshapes: Record<string, number> }>
	): void {
		try {
			this.ensureCacheDir();

			let cache: Record<string, CachedControl> = {};
			if (existsSync(this.controlCacheFile)) {
				try {
					cache = JSON.parse(readFileSync(this.controlCacheFile, 'utf-8'));
				} catch {
					console.log('[TTS Cache] Corrupted control cache file, creating new one');
				}
			}

			const hash = this.generateHash(text, voice, provider);
			const cachedControl: CachedControl = {
				text,
				voice,
				provider,
				timestamp: Date.now(),
				phonemes,
				blendshapes,
				hash
			};

			cache[hash] = cachedControl;

			writeFileSync(this.controlCacheFile, JSON.stringify(cache, null, 2));
			console.log(`[TTS Cache] Cached control data for ${voice} (${provider})`);
		} catch (error) {
			console.error('[TTS Cache] Error writing control cache:', error);
		}
	}

	static clearCache(): void {
		try {
			if (existsSync(this.welcomeCacheFile)) {
				writeFileSync(this.welcomeCacheFile, '{}');
				console.log('[TTS Cache] Cleared welcome message cache');
			}
			if (existsSync(this.controlCacheFile)) {
				writeFileSync(this.controlCacheFile, '{}');
				console.log('[TTS Cache] Cleared control data cache');
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
