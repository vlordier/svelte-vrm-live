import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ollama } from 'ollama';
import { LMStudioClient } from '@lmstudio/sdk';
import { env } from '$env/dynamic/private';

export type LLMProvider = 'google' | 'ollama' | 'lmstudio';

export interface LLMConfig {
	provider: LLMProvider;
	model: string;
	baseUrl?: string;
	apiKey?: string;
}

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface LLMResponse {
	content: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
}

export class UnifiedLLMClient {
	private config: LLMConfig;
	private googleClient?: GoogleGenerativeAI;
	private ollamaClient?: Ollama;
	private lmstudioClient?: LMStudioClient;

	constructor(config?: Partial<LLMConfig>) {
		const provider = (config?.provider || env.LLM_PROVIDER || this.detectProvider()) as LLMProvider;

		// Validate provider
		this.validateProvider(provider);

		this.config = {
			provider,
			model: this.getDefaultModel(provider, config?.model),
			baseUrl: config?.baseUrl || this.getDefaultBaseUrl(provider),
			apiKey: config?.apiKey || this.getDefaultApiKey(provider)
		};

		// Validate configuration before initialization
		this.validateConfiguration();
		this.initializeClient();
	}

	/**
	 * Automatically detect the best provider based on available credentials
	 * Priority: 1. Any configured API key/service, 2. LM Studio (default), 3. Google
	 */
	private detectProvider(): LLMProvider {
		// Check for Google API key
		if (env.GOOGLE_API_KEY && env.GOOGLE_API_KEY !== 'your_google_api_key_here') {
			return 'google';
		}

		// Check for Ollama configuration
		if (env.OLLAMA_BASE_URL && env.OLLAMA_MODEL) {
			return 'ollama';
		}

		// Check for LM Studio configuration
		if (env.LMSTUDIO_BASE_URL && env.LMSTUDIO_MODEL) {
			return 'lmstudio';
		}

		// Default to LM Studio (free, local, user-friendly)
		return 'lmstudio';
	}

	private validateProvider(provider: string): asserts provider is LLMProvider {
		const validProviders: LLMProvider[] = ['google', 'ollama', 'lmstudio'];
		if (!validProviders.includes(provider as LLMProvider)) {
			throw new Error(
				`Invalid LLM_PROVIDER: "${provider}". Must be one of: ${validProviders.join(', ')}`
			);
		}
	}

	private validateConfiguration(): void {
		switch (this.config.provider) {
			case 'google':
				if (!this.config.apiKey) {
					throw new Error(
						'GOOGLE_API_KEY is required when LLM_PROVIDER=google. ' +
							'Get your API key from https://aistudio.google.com/app/apikey'
					);
				}
				break;
			case 'ollama':
				if (!this.config.baseUrl) {
					throw new Error(
						'OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama. ' +
							'Default: http://localhost:11434. Ensure Ollama is running with `ollama serve`'
					);
				}
				break;
			case 'lmstudio':
				if (!this.config.baseUrl) {
					throw new Error(
						'LMSTUDIO_BASE_URL is required when LLM_PROVIDER=lmstudio. ' +
							'Default: http://localhost:1234. Ensure LM Studio local server is running'
					);
				}
				break;
		}
	}

	private getDefaultModel(provider: LLMProvider, customModel?: string): string {
		if (customModel) return customModel;

		switch (provider) {
			case 'google':
				return 'gemini-2.0-flash';
			case 'ollama':
				return env.OLLAMA_MODEL || 'llama3.2:latest';
			case 'lmstudio':
				return env.LMSTUDIO_MODEL || 'llama-3.2-1b-instruct';
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}
	}

	private getDefaultBaseUrl(provider: LLMProvider): string | undefined {
		switch (provider) {
			case 'ollama':
				return env.OLLAMA_BASE_URL || 'http://localhost:11434';
			case 'lmstudio':
				return env.LMSTUDIO_BASE_URL || 'http://localhost:1234';
			default:
				return undefined;
		}
	}

	private getDefaultApiKey(provider: LLMProvider): string | undefined {
		switch (provider) {
			case 'google':
				return env.GOOGLE_API_KEY;
			default:
				return undefined;
		}
	}

	private initializeClient(): void {
		switch (this.config.provider) {
			case 'google':
				if (!this.config.apiKey) {
					throw new Error('Google API key is required');
				}
				this.googleClient = new GoogleGenerativeAI(this.config.apiKey);
				break;
			case 'ollama':
				this.ollamaClient = new Ollama({
					host: this.config.baseUrl || 'http://localhost:11434'
				});
				break;
			case 'lmstudio':
				this.lmstudioClient = new LMStudioClient();
				break;
			default:
				throw new Error(`Unsupported provider: ${this.config.provider}`);
		}
	}

	async generateText(prompt: string, systemInstruction?: string): Promise<LLMResponse> {
		switch (this.config.provider) {
			case 'google':
				return this.generateGoogleText(prompt, systemInstruction);
			case 'ollama':
				return this.generateOllamaText(prompt, systemInstruction);
			case 'lmstudio':
				return this.generateLMStudioText(prompt, systemInstruction);
			default:
				throw new Error(`Unsupported provider: ${this.config.provider}`);
		}
	}

	async chat(messages: ChatMessage[]): Promise<LLMResponse> {
		switch (this.config.provider) {
			case 'google':
				return this.chatGoogle(messages);
			case 'ollama':
				return this.chatOllama(messages);
			case 'lmstudio':
				return this.chatLMStudio(messages);
			default:
				throw new Error(`Unsupported provider: ${this.config.provider}`);
		}
	}

	async generateStructuredOutput(
		systemInstruction: string,
		prompt: string,
		schema: Record<string, unknown>,
		maxRetries = 10
	): Promise<string> {
		if (this.config.provider !== 'google') {
			// For non-Google providers, we'll do a simple JSON format request
			const jsonPrompt = `${systemInstruction}

Please respond with valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}

User request: ${prompt}`;

			const response = await this.generateText(jsonPrompt);
			return response.content;
		}

		// Use Google's structured output for Gemini
		const model = this.googleClient!.getGenerativeModel({
			model: this.config.model,
			generationConfig: {
				responseMimeType: 'application/json',
				responseSchema: schema,
				maxOutputTokens: 64000
			},
			systemInstruction
		});

		let lastError;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const result = await model.generateContent(prompt);
				return result.response.text();
			} catch (error: unknown) {
				lastError = error;
				if (error && typeof error === 'object' && 'status' in error && error.status === 503) {
					const backoffTime = Math.pow(2, attempt) * 5000;
					console.log(
						`Service unavailable. Retrying in ${backoffTime / 1000} seconds... (Attempt ${
							attempt + 1
						}/${maxRetries})`
					);
					await this.sleep(backoffTime);
					continue;
				}
				throw error;
			}
		}

		if (lastError) {
			throw lastError;
		} else {
			throw new Error(
				'Failed to generate structured output after multiple retries without a specific error.'
			);
		}
	}

	private async generateGoogleText(
		prompt: string,
		systemInstruction?: string
	): Promise<LLMResponse> {
		const model = this.googleClient!.getGenerativeModel({
			model: this.config.model,
			systemInstruction
		});

		const result = await model.generateContent(prompt);
		const response = result.response;

		return {
			content: response.text(),
			usage: {
				promptTokens: result.response.usageMetadata?.promptTokenCount,
				completionTokens: result.response.usageMetadata?.candidatesTokenCount,
				totalTokens: result.response.usageMetadata?.totalTokenCount
			}
		};
	}

	private async generateOllamaText(
		prompt: string,
		systemInstruction?: string
	): Promise<LLMResponse> {
		const messages: ChatMessage[] = [];

		if (systemInstruction) {
			messages.push({ role: 'system', content: systemInstruction });
		}
		messages.push({ role: 'user', content: prompt });

		const response = await this.ollamaClient!.chat({
			model: this.config.model,
			messages: messages.map((msg) => ({ role: msg.role, content: msg.content }))
		});

		return {
			content: response.message.content
		};
	}

	private async generateLMStudioText(
		prompt: string,
		systemInstruction?: string
	): Promise<LLMResponse> {
		const model = await this.lmstudioClient!.llm.model(this.config.model);

		let fullPrompt = prompt;
		if (systemInstruction) {
			fullPrompt = `${systemInstruction}\n\n${prompt}`;
		}

		const result = await model.respond(fullPrompt);

		return {
			content: result.content
		};
	}

	private async chatGoogle(messages: ChatMessage[]): Promise<LLMResponse> {
		const systemMessage = messages.find((m) => m.role === 'system');
		const conversationMessages = messages.filter((m) => m.role !== 'system');

		const model = this.googleClient!.getGenerativeModel({
			model: this.config.model,
			systemInstruction: systemMessage?.content
		});

		const chat = model.startChat({
			history: conversationMessages.slice(0, -1).map((msg) => ({
				role: msg.role === 'assistant' ? 'model' : 'user',
				parts: [{ text: msg.content }]
			}))
		});

		const lastMessage = conversationMessages[conversationMessages.length - 1];
		const result = await chat.sendMessage(lastMessage.content);
		const response = result.response;

		return {
			content: response.text(),
			usage: {
				promptTokens: result.response.usageMetadata?.promptTokenCount,
				completionTokens: result.response.usageMetadata?.candidatesTokenCount,
				totalTokens: result.response.usageMetadata?.totalTokenCount
			}
		};
	}

	private async chatOllama(messages: ChatMessage[]): Promise<LLMResponse> {
		const response = await this.ollamaClient!.chat({
			model: this.config.model,
			messages: messages.map((msg) => ({ role: msg.role, content: msg.content }))
		});

		return {
			content: response.message.content
		};
	}

	private async chatLMStudio(messages: ChatMessage[]): Promise<LLMResponse> {
		const model = await this.lmstudioClient!.llm.model(this.config.model);

		// LM Studio SDK expects the last message to be sent separately
		const conversationHistory = messages.slice(0, -1);
		const lastMessage = messages[messages.length - 1];

		// Create a prompt from conversation history
		let prompt = '';
		for (const msg of conversationHistory) {
			prompt += `${msg.role}: ${msg.content}\n`;
		}
		prompt += `${lastMessage.role}: ${lastMessage.content}\nassistant:`;

		const result = await model.respond(prompt);

		return {
			content: result.content
		};
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	getConfig(): LLMConfig {
		return { ...this.config };
	}

	updateConfig(newConfig: Partial<LLMConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.initializeClient();
	}

	/**
	 * Get provider status and helpful setup information
	 */
	static getProviderInfo(): Record<
		LLMProvider,
		{ name: string; description: string; setupUrl: string; isLocal: boolean }
	> {
		return {
			google: {
				name: 'Google Gemini',
				description: 'Cloud-based AI with advanced capabilities',
				setupUrl: 'https://aistudio.google.com/app/apikey',
				isLocal: false
			},
			ollama: {
				name: 'Ollama',
				description: 'Free local LLM runner with many models',
				setupUrl: 'https://ollama.ai',
				isLocal: true
			},
			lmstudio: {
				name: 'LM Studio',
				description: 'User-friendly local LLM interface',
				setupUrl: 'https://lmstudio.ai',
				isLocal: true
			}
		};
	}

	/**
	 * Test connection to the configured provider
	 */
	async testConnection(): Promise<{ success: boolean; message: string }> {
		try {
			await this.generateText('Hello', 'Respond with just "OK"');
			return {
				success: true,
				message: `Successfully connected to ${this.config.provider} (${this.config.model})`
			};
		} catch (error) {
			const providerInfo = UnifiedLLMClient.getProviderInfo()[this.config.provider];
			return {
				success: false,
				message: `Failed to connect to ${providerInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Detect which provider would be automatically selected based on current environment
	 */
	static detectAvailableProvider(): { provider: LLMProvider; reason: string } {
		// Import env here to use in static context
		const envVars = typeof process !== 'undefined' ? process.env : {};

		// Check for Google API key
		if (envVars.GOOGLE_API_KEY && envVars.GOOGLE_API_KEY !== 'your_google_api_key_here') {
			return { provider: 'google', reason: 'GOOGLE_API_KEY found' };
		}

		// Check for Ollama configuration
		if (envVars.OLLAMA_BASE_URL && envVars.OLLAMA_MODEL) {
			return { provider: 'ollama', reason: 'Ollama configuration found' };
		}

		// Check for LM Studio configuration
		if (envVars.LMSTUDIO_BASE_URL && envVars.LMSTUDIO_MODEL) {
			return { provider: 'lmstudio', reason: 'LM Studio configuration found' };
		}

		// Default to LM Studio
		return { provider: 'lmstudio', reason: 'Default (no credentials detected)' };
	}
}
