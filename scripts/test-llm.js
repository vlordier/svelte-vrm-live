#!/usr/bin/env node

/**
 * Test LLM Configuration
 *
 * This script helps you test your LLM provider configuration
 * Usage: node scripts/test-llm.js
 */

import { config } from 'dotenv';

// Load environment variables
config();

console.log('🧠 LLM Configuration Test');
console.log('========================\n');

// Provider information
const providerInfo = {
	google: {
		name: 'Google Gemini',
		description: 'Cloud-based AI with advanced capabilities',
		setupUrl: 'https://aistudio.google.com/app/apikey',
		isLocal: false,
		requiredEnv: ['GOOGLE_API_KEY']
	},
	ollama: {
		name: 'Ollama',
		description: 'Free local LLM runner with many models',
		setupUrl: 'https://ollama.ai',
		isLocal: true,
		requiredEnv: ['OLLAMA_BASE_URL', 'OLLAMA_MODEL']
	},
	lmstudio: {
		name: 'LM Studio',
		description: 'User-friendly local LLM interface',
		setupUrl: 'https://lmstudio.ai',
		isLocal: true,
		requiredEnv: ['LMSTUDIO_BASE_URL', 'LMSTUDIO_MODEL']
	}
};

console.log('Available Providers:');
Object.entries(providerInfo).forEach(([key, info]) => {
	console.log(
		`  ${key}: ${info.name} - ${info.description} ${info.isLocal ? '(Local)' : '(Cloud)'}`
	);
});
console.log();

// Auto-detection logic (matches the client logic)
function detectProvider() {
	if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your_google_api_key_here') {
		return { provider: 'google', reason: 'GOOGLE_API_KEY found' };
	}
	if (process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL) {
		return { provider: 'ollama', reason: 'Ollama configuration found' };
	}
	if (process.env.LMSTUDIO_BASE_URL && process.env.LMSTUDIO_MODEL) {
		return { provider: 'lmstudio', reason: 'LM Studio configuration found' };
	}
	return { provider: 'lmstudio', reason: 'Default (no credentials detected)' };
}

// Show auto-detection vs manual override
const manualProvider = process.env.LLM_PROVIDER;
const autoDetection = detectProvider();

if (manualProvider) {
	console.log(`Manual Override: ${manualProvider}`);
	console.log(`Auto-Detection: ${autoDetection.provider} (${autoDetection.reason})`);
	console.log(`⚠️  Using manual override: ${manualProvider}`);
} else {
	console.log(`Auto-Detection: ${autoDetection.provider} (${autoDetection.reason})`);
	console.log(`✨ Using auto-detected provider: ${autoDetection.provider}`);
}
console.log();

// Use the effective provider
const currentProvider = manualProvider || autoDetection.provider;
const info = providerInfo[currentProvider];

if (!info) {
	console.log(`❌ Invalid provider: ${currentProvider}`);
	console.log('   Valid options: google, ollama, lmstudio');
	process.exit(1);
}

console.log(`Selected: ${info.name}`);

// Check required environment variables
const missingVars = [];
if (currentProvider === 'google' && !process.env.GOOGLE_API_KEY) {
	missingVars.push('GOOGLE_API_KEY');
}
if (currentProvider === 'ollama') {
	if (!process.env.OLLAMA_BASE_URL) missingVars.push('OLLAMA_BASE_URL');
	if (!process.env.OLLAMA_MODEL) missingVars.push('OLLAMA_MODEL');
}
if (currentProvider === 'lmstudio') {
	if (!process.env.LMSTUDIO_BASE_URL) missingVars.push('LMSTUDIO_BASE_URL');
	if (!process.env.LMSTUDIO_MODEL) missingVars.push('LMSTUDIO_MODEL');
}

if (missingVars.length > 0) {
	console.log(`❌ Missing required environment variables: ${missingVars.join(', ')}`);

	console.log('\n💡 Setup Help:');
	console.log(`   Provider: ${info.name}`);
	console.log(`   Setup URL: ${info.setupUrl}`);

	if (currentProvider === 'google') {
		console.log('   1. Get API key from Google AI Studio');
		console.log('   2. Set GOOGLE_API_KEY in your .env file');
	} else if (currentProvider === 'ollama') {
		console.log('   1. Install Ollama from https://ollama.ai');
		console.log('   2. Run: ollama serve');
		console.log('   3. Run: ollama pull llama3.2:latest');
		console.log('   4. Uncomment Ollama section in your .env file');
	} else if (currentProvider === 'lmstudio') {
		console.log('   1. Install LM Studio from https://lmstudio.ai');
		console.log('   2. Load a model and start the local server');
		console.log('   3. Uncomment LM Studio section in your .env file');
	}
} else {
	console.log('✅ Configuration looks good!');
	console.log('\n🚀 You can now run: npm run dev');

	if (info.isLocal) {
		console.log(`💡 Make sure ${info.name} is running locally before starting the app`);
	}
}

console.log('\n📚 For detailed setup instructions, see README.md');
