// Advanced streaming-friendly spell checker for transcribed text
// Unicode-aware, safer, faster (caches), and less twitchy (only edits the last clause)

/** ---------- init ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let spell: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Dynamic import to avoid top-level await issues
async function loadDependencies() {
	const [nspellModule, dictionaryModule] = await Promise.all([
		import('nspell'),
		import('dictionary-en')
	]);
	return {
		nspell: nspellModule.default || nspellModule,
		dictionary: dictionaryModule.default || dictionaryModule
	};
}

// Initialize spell checker asynchronously
async function initSpellChecker(): Promise<void> {
	if (isInitialized && spell) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		try {
			const { nspell, dictionary } = await loadDependencies();

			spell = await new Promise((resolve, reject) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const dictCallback = dictionary as any;
				dictCallback((err: any, dict: any) => (err ? reject(err) : resolve(nspell(dict))));
			});

			// Domain words (add/remove at runtime as needed)
			const CUSTOM_ALLOW = new Set([
				'Whisper',
				'Vincent',
				'SMPL-X',
				'SMPL',
				'SMPLX',
				'EMO',
				'VRM',
				'Svelte'
			]);
			for (const w of CUSTOM_ALLOW) {
				spell.add(w);
			}

			// Force as wrong even if added elsewhere
			spell.remove('teh');

			isInitialized = true;
			console.log('[Spellcheck] Dictionary initialized successfully');
		} catch (error) {
			console.error('[Spellcheck] Failed to initialize dictionary:', error);
			throw error;
		}
	})();

	return initPromise;
}

/** ---------- helpers ---------- */

// Prefer Unicode segmentation when available (handles emojis, accents, etc.)
const seg =
	typeof Intl !== 'undefined' && Intl.Segmenter
		? new Intl.Segmenter('en', { granularity: 'word' })
		: null;

// Skip tokens you should not "fix"
const SKIP = [
	/^(https?:\/\/|www\.)/i, // URLs
	/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/, // emails
	/^[@#][\p{L}\p{N}_]+$/u, // @handles, #hashtags
	/^[\p{N}]+([:.\-/][\p{N}]+)*$/u, // numbers/timestamps/ratios
	/^[\p{L}\p{N}_-]+\.[A-Za-z0-9]{1,6}$/u, // filenames.ext
	/^[A-Z]{2,}s?$/u // acronyms, e.g., GPU, GPUs
];

const WORD = /^[\p{L}]+(?:[''][\p{L}]+)?$/u; // letters + optional apostrophe word
const CAMEL = /[a-z][A-Z]/; // camelCase signal

// tiny cache to avoid repeated suggestions in realtime
const suggestCache = new Map<string, string | null>(); // key: token -> suggestion or null

// light distance guard to avoid wild substitutions
function dlDistance(a: string, b: string, max = 2): number {
	// Damerau-Levenshtein with early exit
	const al = a.length,
		bl = b.length;
	if (Math.abs(al - bl) > max) return max + 1;
	const dp = Array.from({ length: al + 1 }, (_, i) => [i, ...Array(bl).fill(0)]);
	for (let j = 1; j <= bl; j++) dp[0][j] = j;
	for (let i = 1; i <= al; i++) {
		let rowMin = dp[i][0];
		for (let j = 1; j <= bl; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const v = Math.min(
				dp[i - 1][j] + 1, // delete
				dp[i][j - 1] + 1, // insert
				dp[i - 1][j - 1] + cost // substitute
			);
			let trans = v;
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				trans = Math.min(trans, dp[i - 2][j - 2] + 1); // transpose
			}
			dp[i][j] = trans;
			if (trans < rowMin) rowMin = trans;
		}
		if (rowMin > max) return max + 1; // early exit
	}
	return dp[al][bl];
}

function preserveCase(src: string, sug: string): string {
	if (src === src.toUpperCase()) return sug.toUpperCase();
	if (src[0] === src[0].toUpperCase()) return sug[0].toUpperCase() + sug.slice(1);
	return sug;
}

// contractions & common ASR shorthands (extend as needed)
const REWRITE: Array<[RegExp, string]> = [
	[/\bi\b/g, 'I'],
	[/\bidk\b/gi, "I don't know"],
	[/\bu\b/gi, 'you'],
	[/\bim\b/gi, "I'm"],
	[/\bdont\b/gi, "don't"],
	[/\bdoesnt\b/gi, "doesn't"],
	[/\bthats\b/gi, "that's"],
	[/\bcant\b/gi, "can't"],
	[/\bwont\b/gi, "won't"],
	[/\bhavent\b/gi, "haven't"],
	[/\bhasnt\b/gi, "hasn't"],
	[/\bisnt\b/gi, "isn't"],
	[/\barent\b/gi, "aren't"],
	[/\bwerent\b/gi, "weren't"],
	[/\bwasnt\b/gi, "wasn't"],
	[/\bcouldnt\b/gi, "couldn't"],
	[/\bwouldnt\b/gi, "wouldn't"],
	[/\bshouldnt\b/gi, "shouldn't"]
];

/** Split but keep separators; Unicode-aware when possible */
function splitTokens(text: string): string[] {
	if (!seg) return text.split(/(\b)/); // fallback
	const out: string[] = [];
	let last = 0;
	for (const { index, isWordLike } of seg.segment(text)) {
		if (index > last) out.push(text.slice(last, index));
		const end =
			index +
			(isWordLike ? (text.slice(index).match(/^\p{L}+(?:['']\p{L}+)?/u)?.[0].length ?? 0) : 1);
		out.push(text.slice(index, end));
		last = end;
	}
	if (last < text.length) out.push(text.slice(last));
	return out;
}

/** Decide if a token is a candidate for correction */
function shouldCheckToken(t: string): boolean {
	if (!t || !WORD.test(t)) return false;
	if (SKIP.some((r) => r.test(t))) return false;
	if (CAMEL.test(t)) return false; // likely code-ish
	if (t.length <= 2) return false; // too short -> noisy
	// Heuristic: leading capitalized word in middle of sentence is probably a proper noun
	return true;
}

/** ---------- core: correct a single sentence ---------- */
async function correctSentence(text: string): Promise<string> {
	await initSpellChecker();
	if (!spell) return text;

	let tokens = splitTokens(text);

	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (!shouldCheckToken(t)) continue;

		// cache lookup
		if (!suggestCache.has(t)) {
			let suggestion: string | null = null;
			if (!spell.correct(t)) {
				const suggestions = spell.suggest(t);
				const s = suggestions[0];
				if (s && dlDistance(t.toLowerCase(), s.toLowerCase(), 2) <= 2) {
					suggestion = preserveCase(t, s);
				}
			}
			suggestCache.set(t, suggestion);
		}
		const rep = suggestCache.get(t);
		if (rep) tokens[i] = rep;
	}

	let out = tokens.join('');

	// Apply rewrites
	for (const [re, val] of REWRITE) {
		out = out.replace(re, val);
	}

	// Trim spaces before punctuation; ensure one space after ,.?! if followed by a letter
	out = out.replace(/\s+([,.;!?])/g, '$1').replace(/([,;!?])([^\s])/g, '$1 $2');

	// Sentence case: capitalize first letter after . ! ? or start
	out = out.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

	return out;
}

/** ---------- streaming-aware API ---------- */
/**
 * Corrects only the "current" clause (reduces flicker).
 * - finalized: text that won't change again
 * - current:   last partial or just-finished sentence
 * Returns { finalized, current }
 */
export async function autocorrectIncremental(
	finalized: string,
	current: string
): Promise<{ finalized: string; current: string }> {
	try {
		// Find last hard sentence boundary in `current`
		const lastStop = Math.max(
			current.lastIndexOf('.'),
			current.lastIndexOf('!'),
			current.lastIndexOf('?')
		);

		if (lastStop >= 0) {
			// Move up to boundary into finalized, correct what remains
			const move = current.slice(0, lastStop + 1);
			const tail = current.slice(lastStop + 1);
			const newFinal = (finalized + move).replace(/\s+([,.;!?])/g, '$1');
			const fixedTail = await correctSentence(tail);
			return { finalized: newFinal, current: fixedTail };
		} else {
			// No boundary: correct lightly the visible tail only
			return { finalized, current: await correctSentence(current) };
		}
	} catch (error) {
		console.warn('[Spellcheck] Incremental autocorrect failed, returning original text:', error);
		return { finalized, current };
	}
}

/** ---------- simple one-shot API (non-streaming) ---------- */
export async function autocorrect(text: string): Promise<string> {
	try {
		return await correctSentence(text);
	} catch (error) {
		console.warn('[Spellcheck] Autocorrect failed, returning original text:', error);
		// In case of error, apply basic rewrites and return
		let out = text;
		for (const [re, val] of REWRITE) {
			out = out.replace(re, val);
		}
		// Basic sentence case
		out = out.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
		return out;
	}
}

/** ---------- utilities ---------- */
export function clearSpellcheckCache(): void {
	suggestCache.clear();
	console.log('[Spellcheck] Cache cleared');
}

export function addCustomWords(words: string[]): void {
	if (!spell) {
		console.warn('[Spellcheck] Dictionary not initialized yet');
		return;
	}
	for (const word of words) {
		spell.add(word);
	}
	console.log(`[Spellcheck] Added ${words.length} custom words`);
}

export function removeCustomWords(words: string[]): void {
	if (!spell) {
		console.warn('[Spellcheck] Dictionary not initialized yet');
		return;
	}
	for (const word of words) {
		spell.remove(word);
	}
	console.log(`[Spellcheck] Removed ${words.length} custom words`);
}

export function isSpellcheckReady(): boolean {
	return isInitialized && spell !== null;
}

/** ---------- initialization helper ---------- */
export async function preloadSpellcheck(): Promise<boolean> {
	try {
		await initSpellChecker();
		return true;
	} catch (error) {
		console.error('[Spellcheck] Failed to preload:', error);
		return false;
	}
}
