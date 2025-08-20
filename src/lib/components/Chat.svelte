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
	import { onMount } from 'svelte';
	import Send from './icons/send.svelte';
	import { AudioDeviceChecker, type AudioDeviceInfo } from '$lib/audio/device-checker';
	import { clientResponseFilter } from '$lib/utils/client-response-filter';

	// TTS Status tracking
	let ttsStatus = $state<'ready' | 'downloading' | 'error' | 'initializing' | 'unknown'>('unknown');
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
		}
	});

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

				// If downloading, poll for updates
				if (ttsStatus === 'downloading' || ttsStatus === 'initializing') {
					setTimeout(checkTTSStatus, 5000); // Check again in 5 seconds
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
		{#if (ttsStatus === 'downloading' || ttsStatus === 'initializing') && ttsProgress > 0}
			<div class="mt-2 h-1 w-full rounded-full bg-gray-700">
				<div
					class="h-1 rounded-full bg-yellow-500 transition-all duration-300"
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

	<div class="relative mt-4 flex w-full max-w-md items-center gap-2">
		<textarea
			bind:value={inputText}
			placeholder="Type your message to EMO..."
			class="flex-1 rounded-lg bg-gray-700 px-2 py-2 pr-10 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			onkeydown={(e) => e.key === 'Enter' && handleSpeak()}
			disabled={isLoadingResponse}
			rows={2}
		></textarea>

		<button
			onclick={handleSpeak}
			class="absolute right-2 rounded-lg bg-blue-500 px-2 py-1.5 font-semibold text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
			disabled={isLoadingResponse}
		>
			<Send />
		</button>
	</div>
</div>
