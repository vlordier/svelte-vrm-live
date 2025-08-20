<!-- eslint-disable no-undef -->
<script lang="ts">
	import { browser } from '$app/environment';
	import type { VRM } from '@pixiv/three-vrm';
	import {
		speakWithLipsync,
		lipSyncPresets,
		createLipSyncConfig,
		type Emotion
	} from '$lib/audio/tts';
	import type { ChatMessage } from '$lib/types/chat';
	import type { AnimationController } from '$lib/animation/AnimationController.svelte';
	import type { AnswerWithEmotion } from '$lib/llm/generative';
	import { onMount, onDestroy } from 'svelte';
	import Send from './icons/send.svelte';
	import Microphone from './icons/microphone.svelte';
	import { AudioDeviceChecker, type AudioDeviceInfo } from '$lib/audio/device-checker';
	import { clientResponseFilter } from '$lib/utils/client-response-filter';
	import { UnifiedSTTClient, type STTCallbacks, type STTStatus } from '$lib/stt/client';
	import type { TranscriptionResult } from '$lib/stt/whisper';
	import { autocorrect, preloadSpellcheck } from '$lib/utils/spellcheck';

	// TTS Status tracking
	let ttsStatus = $state<
		'ready' | 'downloading' | 'error' | 'initializing' | 'retrying' | 'unknown'
	>('unknown');
	// eslint-disable-next-line no-unused-vars
	let ttsMessage = $state('Checking TTS status...');
	// eslint-disable-next-line no-unused-vars
	let ttsProvider = $state('kokoro');
	let ttsProgress = $state(0);
	let hasPlayedWelcome = $state(false); // Track if welcome message has been played

	// Audio device information
	let audioDeviceInfo = $state<AudioDeviceInfo | null>(null);
	let audioDeviceChecker: AudioDeviceChecker | null = null;
	let {
		vrmInstance,
		animationController
	}: {
		vrmInstance: VRM | null;
		animationController: AnimationController | null;
	} = $props();

	let inputText = $state('');
	let chatHistory = $state<ChatMessage[]>([]);
	let isLoadingResponse = $state(false);

	const CHAT_HISTORY_LOCAL_STORAGE_KEY = 'emo_chat_history';
	let chatContainerElement: HTMLDivElement | undefined;

	// Enhanced lip-sync configuration (simplified)
	const lipSyncConfig = createLipSyncConfig({
		...lipSyncPresets.natural,
		debugLogging: true
	});

	// Track speaking state
	let isSpeaking = $state(false);
	let ttsEnabled = $state(true); // Quick toggle to disable TTS entirely

	// STT (Speech-to-Text) state
	let sttClient = $state<UnifiedSTTClient | null>(null);
	let sttStatus = $state<STTStatus>('idle');
	let sttEnabled = $state(false); // Toggle for STT mode
	let isTranscribing = $state(false);
	let sttError = $state<string | null>(null);
	let sttInitialized = $state(false);
	let voiceDetected = $state(false); // Voice activity detection feedback
	let autoSendTranscription = $state(true); // Auto-send transcribed messages

	// Load chat history from localStorage on component mount
	onMount(() => {
		if (browser) {
			const storedHistory = localStorage.getItem(CHAT_HISTORY_LOCAL_STORAGE_KEY);
			if (storedHistory) {
				try {
					chatHistory = JSON.parse(storedHistory);
				} catch (e) {
					console.error('Failed to parse chat history from localStorage:', e);
				}
			}

			// Check TTS status and audio devices
			checkTTSStatus();
			checkAudioDevices();

			// Initialize STT system
			initializeSTT();

			// Preload spellcheck dictionary
			preloadSpellcheck().then((success) => {
				if (success) {
					console.log('[Chat] Spellcheck dictionary preloaded successfully');
				} else {
					console.warn('[Chat] Failed to preload spellcheck dictionary');
				}
			});
		}
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (sttClient) {
			sttClient.destroy();
			console.log('[Chat STT] STT client destroyed');
		}
	});

	// STT (Speech-to-Text) Functions
	async function initializeSTT() {
		try {
			console.log('[Chat STT] Starting STT initialization...');

			// Clear any previous errors
			sttError = null;
			sttStatus = 'idle';

			const sttCallbacks: STTCallbacks = {
				onTranscriptionResult: async (result: TranscriptionResult) => {
					console.log('[Chat STT] Transcription result received:', {
						text: result.text,
						chunks: result.chunks?.length || 0
					});

					if (result.text && result.text.trim()) {
						let transcribedText = result.text.trim();

						// Apply spellcheck to transcribed text
						try {
							const spellcheckedText = await autocorrect(transcribedText);
							if (spellcheckedText !== transcribedText) {
								console.log('[Chat STT] Spellcheck applied:', {
									original: transcribedText,
									corrected: spellcheckedText
								});
								transcribedText = spellcheckedText;
							}
						} catch (error) {
							console.warn('[Chat STT] Spellcheck failed, using original text:', error);
						}

						// Add transcribed (and corrected) text to input
						inputText = (inputText + ' ' + transcribedText).trim();
						console.log('[Chat STT] Added transcribed text to input:', transcribedText);

						// Auto-send the transcribed message if enabled
						if (autoSendTranscription) {
							setTimeout(() => {
								if (inputText.trim() && vrmInstance && !isLoadingResponse) {
									console.log('[Chat STT] Auto-sending transcribed message:', inputText);
									handleSpeak();
								}
							}, 500); // Small delay to ensure UI updates
						}
					} else {
						console.warn('[Chat STT] Empty or invalid transcription result');
					}
					isTranscribing = false;
					sttError = null; // Clear error on successful transcription
				},
				onSpeechStart: () => {
					console.log('[Chat STT] Speech detection started');
					voiceDetected = true;
					isTranscribing = true;
					sttError = null;
				},
				onSpeechEnd: () => {
					console.log('[Chat STT] Speech detection ended, processing audio...');
					voiceDetected = false;
					// Keep isTranscribing true until we get the result
				},
				onError: (error: Error) => {
					const errorMessage = error.message || 'Unknown STT error';
					console.error('[Chat STT] Error occurred:', {
						message: errorMessage,
						stack: error.stack,
						name: error.name
					});

					voiceDetected = false;
					isTranscribing = false;
					sttStatus = 'error';
					sttError = errorMessage;

					// Provide user-friendly error messages
					if (errorMessage.includes('microphone') || errorMessage.includes('getUserMedia')) {
						sttError = 'Microphone access denied. Please allow microphone access and try again.';
					} else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
						sttError = 'Network error loading STT models. Check your connection.';
					} else if (errorMessage.includes('WebAssembly') || errorMessage.includes('wasm')) {
						sttError =
							'Browser compatibility issue. Try a modern browser with WebAssembly support.';
					} else if (
						errorMessage.includes('task') ||
						errorMessage.includes('language') ||
						errorMessage.includes('English-only')
					) {
						sttError = 'Model configuration error. English-only models fixed automatically.';
					}
				},
				onStatusChange: (status: STTStatus) => {
					sttStatus = status;
					console.log('[Chat STT] Status changed to:', status);

					if (status === 'error') {
						sttEnabled = false;
						voiceDetected = false;
					}
				}
			};

			// Create STT client with enhanced configuration
			const sttConfig = {
				vad: {
					startOnLoad: false,
					positiveSpeechThreshold: 0.8,
					negativeSpeechThreshold: 0.35,
					minSpeechFrames: 5
				},
				whisper: {
					modelId: 'Xenova/whisper-tiny.en',
					dtype: 'q4' as const,
					device: 'wasm' as const
					// Don't specify language or task for English-only models
					// The .en models are English-only and don't accept these parameters
				},
				autoStart: false
			};

			console.log('[Chat STT] Creating STT client with config:', sttConfig);
			sttClient = new UnifiedSTTClient(sttConfig, sttCallbacks);
			sttInitialized = true;
			sttError = null;

			// Run basic diagnostics
			await runSTTDiagnostics();

			console.log('[Chat STT] STT client created successfully');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
			console.error('[Chat STT] Failed to initialize STT:', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined
			});

			sttStatus = 'error';
			sttError = `Initialization failed: ${errorMessage}`;
			sttInitialized = false;
			sttEnabled = false;
		}
	}

	// Diagnostic function to check STT environment
	async function runSTTDiagnostics() {
		console.log('[Chat STT] Running diagnostics...');

		const diagnostics = {
			webassembly: typeof WebAssembly !== 'undefined',
			mediaDevices:
				browser &&
				typeof globalThis !== 'undefined' &&
				globalThis.navigator?.mediaDevices !== undefined,
			getUserMedia:
				browser &&
				typeof globalThis !== 'undefined' &&
				globalThis.navigator?.mediaDevices?.getUserMedia !== undefined,
			https:
				browser &&
				typeof globalThis !== 'undefined' &&
				(globalThis.window?.location.protocol === 'https:' ||
					globalThis.window?.location.hostname === 'localhost'),
			audioContext:
				typeof AudioContext !== 'undefined' ||
				(browser &&
					typeof globalThis !== 'undefined' &&
					typeof (globalThis.window as any)?.webkitAudioContext !== 'undefined')
		};

		console.log('[Chat STT] Environment diagnostics:', diagnostics);

		// Check for critical missing features
		const issues = [];
		if (!diagnostics.webassembly) issues.push('WebAssembly not supported');
		if (!diagnostics.mediaDevices) issues.push('MediaDevices API not available');
		if (!diagnostics.getUserMedia) issues.push('getUserMedia not available');
		if (!diagnostics.https) issues.push('HTTPS required for microphone access');
		if (!diagnostics.audioContext) issues.push('Web Audio API not supported');

		if (issues.length > 0) {
			const errorMsg = `Browser compatibility issues: ${issues.join(', ')}`;
			console.warn('[Chat STT]', errorMsg);
			sttError = errorMsg;
			sttStatus = 'error';
			return false;
		}

		console.log('[Chat STT] All diagnostic checks passed');
		return true;
	}

	async function toggleSTT() {
		if (!sttClient) {
			console.warn('[Chat STT] STT client not initialized, attempting to reinitialize...');
			try {
				await initializeSTT();
				if (!sttClient) {
					sttError = 'Failed to initialize STT client';
					sttStatus = 'error';
					return;
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				sttError = `Reinitialization failed: ${errorMsg}`;
				sttStatus = 'error';
				return;
			}
		}

		try {
			if (sttEnabled) {
				// Disable STT
				console.log('[Chat STT] Disabling STT...');
				sttClient.pause();
				sttEnabled = false;
				sttStatus = 'idle';
				isTranscribing = false;
				voiceDetected = false;
				sttError = null;
				console.log('[Chat STT] STT disabled successfully');
			} else {
				// Enable STT - initialize and start
				console.log('[Chat STT] Enabling STT...');
				sttError = null;
				sttStatus = 'idle';

				// Check for microphone permission first
				try {
					if (
						!browser ||
						typeof globalThis === 'undefined' ||
						!globalThis.navigator?.mediaDevices
					) {
						throw new Error('MediaDevices API not available');
					}
					const stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: true });
					stream.getTracks().forEach((track) => track.stop()); // Clean up test stream
					console.log('[Chat STT] Microphone access confirmed');
				} catch (micError) {
					const micErrorMsg =
						micError instanceof Error ? micError.message : 'Microphone access denied';
					console.error('[Chat STT] Microphone access error:', micErrorMsg);
					sttError =
						'Microphone access required. Please allow microphone permission and try again.';
					sttStatus = 'error';
					return;
				}

				// Initialize STT system
				console.log('[Chat STT] Initializing STT system...');
				await sttClient.initialize();
				console.log('[Chat STT] STT system initialized, starting listening...');

				// Start listening
				await sttClient.start();
				sttEnabled = true;
				console.log('[Chat STT] STT enabled and listening');
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown toggle error';
			console.error('[Chat STT] Error toggling STT:', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				wasEnabled: sttEnabled
			});

			sttEnabled = false;
			sttStatus = 'error';
			isTranscribing = false;
			voiceDetected = false;

			// Provide specific error messages based on the error type
			if (errorMessage.includes('getUserMedia') || errorMessage.includes('NotAllowedError')) {
				sttError = 'Microphone access denied. Please check browser permissions.';
			} else if (errorMessage.includes('NotFoundError')) {
				sttError = 'No microphone found. Please connect a microphone and try again.';
			} else if (errorMessage.includes('initialize')) {
				sttError = 'Failed to initialize speech recognition. Check browser compatibility.';
			} else if (errorMessage.includes('start')) {
				sttError = 'Failed to start listening. Try refreshing the page.';
			} else {
				sttError = `STT error: ${errorMessage}`;
			}
		}
	}

	// Function to check TTS status
	async function checkTTSStatus() {
		try {
			const response = await fetch('/api/tts/status');
			if (response.ok) {
				const statusData = await response.json();
				const previousStatus = ttsStatus;
				ttsStatus = statusData.status;
				ttsMessage = statusData.message;
				ttsProvider = statusData.provider;
				ttsProgress = statusData.progress || 0;

				// If TTS just became ready and we haven't played welcome yet, play it
				if (
					ttsStatus === 'ready' &&
					previousStatus !== 'ready' &&
					!hasPlayedWelcome &&
					vrmInstance &&
					ttsEnabled
				) {
					playWelcomeMessage();
				}

				// If downloading, initializing, or retrying, poll for updates
				if (
					ttsStatus === 'downloading' ||
					ttsStatus === 'initializing' ||
					ttsStatus === 'retrying'
				) {
					setTimeout(checkTTSStatus, 3000); // Check again in 3 seconds
				}
			} else {
				ttsStatus = 'error';
				ttsMessage = 'Failed to check TTS status';
			}
		} catch (error) {
			console.error('Error checking TTS status:', error);
			ttsStatus = 'error';
			ttsMessage = 'TTS status check failed';
		}
	}

	// Function to clear TTS cache
	async function clearTTSCache() {
		try {
			const response = await fetch('/api/tts/clear-cache', { method: 'POST' });
			if (response.ok) {
				ttsStatus = 'unknown';
				ttsMessage = 'Cache cleared, checking TTS status...';
				ttsProgress = 0;
				setTimeout(checkTTSStatus, 1000);
			}
		} catch (error) {
			console.error('Error clearing TTS cache:', error);
		}
	}

	// Function to check audio devices
	async function checkAudioDevices() {
		try {
			audioDeviceChecker = AudioDeviceChecker.getInstance();
			audioDeviceInfo = await audioDeviceChecker.checkAudioCapabilities();
			console.log('[Chat] Audio device info:', $state.snapshot(audioDeviceInfo));
		} catch (error) {
			console.error('[Chat] Error checking audio devices:', error);
		}
	}

	// Function to resume audio context (needed for Chrome)
	async function resumeAudioContext() {
		if (audioDeviceChecker) {
			const resumed = await audioDeviceChecker.resumeAudioContext();
			if (resumed) {
				// Refresh audio device info
				audioDeviceInfo = await audioDeviceChecker.checkAudioCapabilities();

				// If TTS is ready and we haven't played welcome yet, try to play it now
				if (ttsStatus === 'ready' && !hasPlayedWelcome && vrmInstance && ttsEnabled) {
					console.log('[Chat] Audio context resumed - attempting to play welcome message');
					playWelcomeMessage();
				}
			}
			return resumed;
		}
		return false;
	}

	// Function to play welcome message
	async function playWelcomeMessage() {
		if (hasPlayedWelcome || !vrmInstance || isSpeaking) {
			return;
		}

		// Check if AudioContext needs to be resumed first
		if (audioDeviceInfo?.audioContext.state === 'suspended') {
			console.log(
				'[Chat] AudioContext suspended - welcome message will play after user enables audio'
			);
			return; // Don't play until user enables audio
		}

		hasPlayedWelcome = true;
		const welcomeText =
			"Well hello there... First time here? What's your name? Tell me what brings you here?";
		const welcomeEmotion: Emotion = 'happy'; // Use happy emotion for welcoming

		// Add welcome message to chat history (only when we can actually play it)
		const welcomeMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'avatar',
			content: welcomeText,
			timestamp: Date.now()
		};
		chatHistory = [...chatHistory, welcomeMessage];

		try {
			// Start talking animation with curious emotion
			if (animationController) {
				animationController.startTalking(welcomeEmotion);
			}

			// Speak the welcome message
			isSpeaking = true;
			console.log('[Chat] Playing welcome message:', welcomeText);

			await speakWithLipsync(welcomeText, vrmInstance, lipSyncConfig, welcomeEmotion);
		} catch (error) {
			console.error('Error playing welcome message:', error);
		} finally {
			isSpeaking = false;
			// Stop talking animation and return to idle state
			if (animationController) {
				animationController.stopTalking();
			}
		}
	}

	// Save chat history to localStorage
	$effect(() => {
		// if (browser) {
		// 	localStorage.setItem(CHAT_HISTORY_LOCAL_STORAGE_KEY, JSON.stringify(chatHistory));
		// }

		// Scroll to bottom when chat history changes
		const element = chatContainerElement;
		if (element) {
			Promise.resolve().then(() => {
				element.scrollTop = element.scrollHeight;
			});
		}
	});

	async function handleSpeak() {
		if (inputText.trim() && vrmInstance && !isLoadingResponse) {
			const userMessageContent = inputText;

			inputText = '';
			isLoadingResponse = true;

			// Add user message to chat history immediately
			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: userMessageContent,
				timestamp: Date.now()
			};
			chatHistory = [...chatHistory, userMessage];

			try {
				// Use our new generate API that includes emotion
				const apiResponse = await fetch('/api/generate', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						systemInstruction:
							'You are EMO, a character who is deeply introspective and sensitive. You often feel misunderstood and express yourself with a touch of melancholy and poetic flair. Respond to user inputs in a way that is consistent with your persona: thoughtful, a bit reserved, and with a hint of poetic sadness or depth. Keep your responses relatively concise for a live interaction, but let your emotions show. IMPORTANT: Always respond in English only, regardless of what language the user uses.',
						prompt: userMessageContent
					})
				});

				if (!apiResponse.ok) {
					const errorData = await apiResponse
						.json()
						.catch(() => ({ message: apiResponse.statusText }));
					throw new Error(`API Error ${apiResponse.status}: ${errorData.message}`);
				}

				const responseData = (await apiResponse.json()) as AnswerWithEmotion;

				// Add avatar response to chat and speak it
				if (responseData.answer) {
					// Apply client-side filtering as final safety check
					const filterResult = clientResponseFilter.filterResponse(responseData.answer);

					if (!filterResult.isClean) {
						console.warn('[Chat] Client-side filtering applied:', filterResult.warnings);
					}

					const avatarMessage: ChatMessage = {
						id: crypto.randomUUID(),
						role: 'avatar',
						content: filterResult.cleanedMessage,
						timestamp: Date.now()
					};
					chatHistory = [...chatHistory, avatarMessage];

					// Start talking animation with emotion
					if (animationController) {
						animationController.startTalking(responseData.emotion as Emotion);
					}

					// Speak the response with TTS (only if enabled and not already speaking)
					if (ttsEnabled && !isSpeaking && vrmInstance) {
						// Pre-process message for TTS
						const ttsMessage = clientResponseFilter.prepareForTTS(filterResult.cleanedMessage);

						// Validate message is safe for TTS
						if (!clientResponseFilter.validateForTTS(ttsMessage)) {
							console.warn('[Chat] Message not suitable for TTS, skipping audio');
						} else {
							isSpeaking = true;
							console.log(
								`[Chat] Starting TTS for response with emotion ${responseData.emotion}:`,
								ttsMessage.substring(0, 30) + '...'
							);

							speakWithLipsync(
								ttsMessage,
								vrmInstance,
								lipSyncConfig,
								responseData.emotion as Emotion
							).finally(() => {
								isSpeaking = false;
								console.log('[Chat] TTS completed');
								// Stop talking animation and return to idle state smoothly
								if (animationController) {
									animationController.stopTalking();
								}
							});
						}
					}
				}
			} catch (error) {
				console.error('Error generating response:', error);

				// Use default error message since we can't access the response in catch block
				let errorMessage = "Sorry, I'm having trouble thinking right now.";

				// Apply client-side filtering to error message as well
				const errorFilterResult = clientResponseFilter.filterResponse(errorMessage);

				const errorAvatarMessage: ChatMessage = {
					id: crypto.randomUUID(),
					role: 'avatar',
					content: errorFilterResult.cleanedMessage,
					timestamp: Date.now()
				};
				chatHistory = [...chatHistory, errorAvatarMessage];

				// Start neutral talking animation for error
				if (animationController) {
					await animationController.startTalking('neutral' as Emotion);
				}

				// Speak error message if TTS is enabled
				if (ttsEnabled && !isSpeaking && vrmInstance) {
					const errorTTSMessage = clientResponseFilter.prepareForTTS(
						errorFilterResult.cleanedMessage
					);

					if (clientResponseFilter.validateForTTS(errorTTSMessage)) {
						isSpeaking = true;
						console.log(
							'[Chat] Starting TTS for error message:',
							errorTTSMessage.substring(0, 30) + '...'
						);

						speakWithLipsync(
							errorTTSMessage,
							vrmInstance,
							lipSyncConfig,
							'neutral' as Emotion
						).finally(() => {
							isSpeaking = false;
							console.log('[Chat] TTS completed');
							// Stop talking animation and return to idle state smoothly
							if (animationController) {
								animationController.stopTalking();
							}
						});
					}
				}
			} finally {
				isLoadingResponse = false;
			}
		}
	}
</script>

<div
	class="fixed -right-14 bottom-5 flex max-h-[80vh] w-[600px] flex-col items-center justify-center"
>
	<!-- Chat display area -->
	<div
		bind:this={chatContainerElement}
		class="mt-4 flex min-h-[24vh] w-full max-w-md flex-col overflow-y-auto rounded-lg bg-gray-700 p-4"
	>
		{#each chatHistory as message (message.id)}
			<span
				class={`mb-2 inline-block max-w-[80%] rounded-lg px-3 py-1 ${message.role === 'user' ? 'ml-auto bg-blue-500 text-white' : 'bg-gray-600 text-white'}`}
			>
				{message.content}
			</span>
		{/each}
		{#if isLoadingResponse}
			<div class="mb-2 text-left">
				<span class="inline-block rounded-lg bg-gray-600 px-3 py-1 text-white italic">
					EMO is pondering...
				</span>
			</div>
		{/if}
	</div>

	<!-- TTS Status Indicator -->
	<div class="mb-2 w-full max-w-md rounded-lg bg-gray-800 px-3 py-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-gray-300">🎤 TTS:</span>
				<span class="flex items-center gap-1">
					{#if ttsStatus === 'ready'}
						<span class="h-2 w-2 rounded-full bg-green-500"></span>
						<span class="text-xs text-green-400">Ready</span>
					{:else if ttsStatus === 'downloading'}
						<span class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></span>
						<span class="text-xs text-yellow-400">Downloading... {ttsProgress}%</span>
					{:else if ttsStatus === 'initializing'}
						<span class="h-2 w-2 animate-spin rounded-full bg-blue-500"></span>
						<span class="text-xs text-blue-400">Initializing...</span>
					{:else if ttsStatus === 'retrying'}
						<span class="h-2 w-2 animate-bounce rounded-full bg-orange-500"></span>
						<span class="text-xs text-orange-400">Retrying... {ttsProgress}%</span>
					{:else if ttsStatus === 'error'}
						<span class="h-2 w-2 rounded-full bg-red-500"></span>
						<span class="text-xs text-red-400">Error</span>
					{:else}
						<span class="h-2 w-2 animate-pulse rounded-full bg-gray-500"></span>
						<span class="text-xs text-gray-400">Checking...</span>
					{/if}
				</span>
			</div>
			<div class="flex gap-1">
				{#if ttsStatus === 'error'}
					<button
						onclick={clearTTSCache}
						class="text-xs text-red-400 hover:text-red-300"
						title="Clear corrupted cache"
					>
						🗑️
					</button>
				{/if}
				<button
					onclick={checkTTSStatus}
					class="text-xs text-gray-400 hover:text-gray-300"
					title="Refresh TTS status"
				>
					↻
				</button>
			</div>
		</div>

		<!-- Progress Bar -->
		{#if (ttsStatus === 'downloading' || ttsStatus === 'initializing' || ttsStatus === 'retrying') && ttsProgress > 0}
			<div class="mt-2 h-1 w-full rounded-full bg-gray-700">
				<div
					class="h-1 rounded-full transition-all duration-300 {ttsStatus === 'retrying'
						? 'bg-orange-500'
						: 'bg-yellow-500'}"
					style="width: {ttsProgress}%"
				></div>
			</div>
		{/if}
	</div>

	<!-- Audio Device Status -->
	{#if audioDeviceInfo}
		<div class="mb-2 w-full max-w-md rounded-lg bg-gray-800 px-3 py-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-gray-300">🔊 Audio:</span>
					<span class="flex items-center gap-1">
						{#if audioDeviceInfo.audioContext.supported && audioDeviceInfo.audioContext.state === 'running'}
							<span class="h-2 w-2 rounded-full bg-green-500"></span>
							<span class="text-xs text-green-400">Ready</span>
						{:else if audioDeviceInfo.audioContext.state === 'suspended'}
							<span class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></span>
							<span class="text-xs text-yellow-400">Click to Enable Audio</span>
						{:else if !audioDeviceInfo.audioContext.supported}
							<span class="h-2 w-2 rounded-full bg-red-500"></span>
							<span class="text-xs text-red-400">Not Supported</span>
						{:else}
							<span class="h-2 w-2 rounded-full bg-gray-500"></span>
							<span class="text-xs text-gray-400">{audioDeviceInfo.audioContext.state}</span>
						{/if}
					</span>
				</div>
				<div class="flex gap-1">
					{#if audioDeviceInfo.audioContext.state === 'suspended'}
						<button
							onclick={resumeAudioContext}
							class="text-xs text-yellow-400 hover:text-yellow-300"
							title="Resume Audio Context"
						>
							▶️
						</button>
					{/if}
					<button
						onclick={checkAudioDevices}
						class="text-xs text-gray-400 hover:text-gray-300"
						title="Refresh audio status"
					>
						↻
					</button>
				</div>
			</div>

			<!-- Device Details (Collapsible) -->
			<div class="mt-2 text-xs text-gray-400">
				<div>🎧 Outputs: {audioDeviceInfo.devices.audioOutputs.length}</div>
				<div>🎤 Inputs: {audioDeviceInfo.devices.audioInputs.length}</div>
				{#if audioDeviceInfo.audioContext.supported}
					<div>📊 Sample Rate: {audioDeviceInfo.audioContext.sampleRate}Hz</div>
					{#if audioDeviceInfo.audioContext.baseLatency}
						<div>⏱️ Latency: {Math.round(audioDeviceInfo.audioContext.baseLatency * 1000)}ms</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	<!-- STT Status Indicator -->
	{#if sttInitialized || sttError}
		<div class="mb-2 w-full max-w-md rounded-lg bg-gray-800 px-3 py-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-gray-300">🎙️ STT:</span>
					<span class="flex items-center gap-1">
						{#if voiceDetected && sttEnabled}
							<span class="h-2 w-2 animate-ping rounded-full bg-orange-500"></span>
							<span class="text-xs font-semibold text-orange-400">Voice Detected!</span>
						{:else if sttEnabled && sttStatus === 'listening' && isTranscribing}
							<span class="h-2 w-2 animate-spin rounded-full bg-blue-500"></span>
							<span class="text-xs text-blue-400">Processing...</span>
						{:else if sttEnabled && sttStatus === 'listening'}
							<span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
							<span class="text-xs text-green-400">Listening</span>
						{:else if sttEnabled && sttStatus === 'processing'}
							<span class="h-2 w-2 animate-spin rounded-full bg-blue-500"></span>
							<span class="text-xs text-blue-400">Transcribing...</span>
						{:else if sttStatus === 'error' || sttError}
							<span class="h-2 w-2 rounded-full bg-red-500"></span>
							<span class="text-xs text-red-400">Error</span>
						{:else}
							<span class="h-2 w-2 rounded-full bg-gray-500"></span>
							<span class="text-xs text-gray-400">{sttEnabled ? 'Ready' : 'Off'}</span>
						{/if}
					</span>
				</div>
				<div class="flex gap-1">
					{#if sttEnabled}
						<button
							onclick={() => {
								autoSendTranscription = !autoSendTranscription;
							}}
							class="text-xs {autoSendTranscription
								? 'text-blue-400 hover:text-blue-300'
								: 'text-gray-400 hover:text-gray-300'}"
							title={autoSendTranscription
								? 'Disable auto-send transcriptions'
								: 'Enable auto-send transcriptions'}
						>
							{autoSendTranscription ? '⚡' : '📝'}
						</button>
					{/if}
					<button
						onclick={toggleSTT}
						class="text-xs {sttEnabled
							? 'text-green-400 hover:text-green-300'
							: 'text-gray-400 hover:text-gray-300'}"
						title={sttEnabled ? 'Disable STT' : 'Enable STT'}
						disabled={isTranscribing}
					>
						{sttEnabled ? '🔇' : '🎤'}
					</button>
				</div>
			</div>

			<!-- Error Details -->
			{#if sttError}
				<div class="mt-2 rounded bg-red-900/20 px-2 py-1">
					<div class="text-xs text-red-400">{sttError}</div>
					<button
						onclick={() => {
							sttError = null;
							sttStatus = 'idle';
							initializeSTT();
						}}
						class="mt-1 text-xs text-red-300 underline hover:text-red-200"
					>
						Try again
					</button>
				</div>
			{/if}

			<!-- Debug Info (only in development) -->
			{#if sttStatus && (sttStatus !== 'idle' || sttEnabled)}
				<div class="mt-1 text-xs text-gray-500">
					Status: {sttStatus} | Enabled: {sttEnabled} | Voice: {voiceDetected ? 'YES' : 'NO'} | Transcribing:
					{isTranscribing}
				</div>
			{/if}
		</div>
	{/if}

	<div class="relative mt-4 flex w-full max-w-md items-center gap-2">
		<textarea
			bind:value={inputText}
			placeholder="Type your message to EMO..."
			class="flex-1 rounded-lg bg-gray-700 px-2 py-2 pr-20 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			onkeydown={(e) => e.key === 'Enter' && handleSpeak()}
			disabled={isLoadingResponse}
			rows={2}
		></textarea>

		<!-- Microphone button -->
		<button
			onclick={toggleSTT}
			class="absolute right-12 rounded-lg px-2 py-1.5 font-semibold transition-colors focus:ring-2 focus:outline-none disabled:opacity-50 {voiceDetected &&
			sttEnabled
				? 'animate-pulse bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500'
				: sttEnabled
					? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500'
					: 'bg-gray-600 text-gray-300 hover:bg-gray-500 focus:ring-gray-500'}"
			title={voiceDetected
				? 'Voice detected! STT is active'
				: sttEnabled
					? 'Disable voice input (STT)'
					: 'Enable voice input (STT)'}
			disabled={isLoadingResponse || isTranscribing}
		>
			<Microphone />
		</button>

		<!-- Send button -->
		<button
			onclick={handleSpeak}
			class="absolute right-2 rounded-lg bg-blue-500 px-2 py-1.5 font-semibold text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
			disabled={isLoadingResponse}
		>
			<Send />
		</button>
	</div>
</div>
