#!/usr/bin/env node

/**
 * Test TTS Configuration
 *
 * This script helps you test your TTS provider configuration
 * Usage: node scripts/test-tts.js
 */

import { config } from 'dotenv';

// Load environment variables
config();

console.log('🔊 TTS Configuration Test');
console.log('=========================\n');

// Provider information
const providerInfo = {
	kokoro: {
		name: 'Kokoro TTS',
		description: 'High-quality local TTS with ONNX runtime',
		setupUrl: 'https://github.com/Xenova/transformers.js',
		isLocal: true,
		requiredEnv: [],
		voices: [
			'af_heart',
			'af_alloy',
			'af_aoede',
			'af_bella',
			'af_jessica',
			'af_kore',
			'af_nicole',
			'af_nova',
			'af_river',
			'af_sarah',
			'af_sky',
			'am_adam',
			'am_echo',
			'am_eric',
			'am_fenrir',
			'am_liam',
			'am_michael',
			'am_onyx',
			'am_puck',
			'am_santa',
			'bf_emma',
			'bf_isabella',
			'bf_alice',
			'bf_lily',
			'bm_george',
			'bm_lewis',
			'bm_daniel',
			'bm_fable'
		]
	},
	browser: {
		name: 'Browser TTS',
		description: 'Native browser speech synthesis',
		setupUrl: 'Built into modern browsers',
		isLocal: true,
		requiredEnv: [],
		voices: ['default', 'varies by browser']
	},
	elevenlabs: {
		name: 'ElevenLabs TTS',
		description: 'Premium cloud-based TTS with phoneme alignment',
		setupUrl: 'https://elevenlabs.io',
		isLocal: false,
		requiredEnv: ['ELEVENLABS_API_KEY'],
		voices: ['Premium voices available']
	}
};

console.log('Available TTS Providers:');
Object.entries(providerInfo).forEach(([key, info]) => {
	console.log(
		`  ${key}: ${info.name} - ${info.description} ${info.isLocal ? '(Local)' : '(Cloud)'}`
	);
});
console.log();

// Auto-detection logic (matches the client logic)
function detectProvider() {
	if (process.env.TTS_PROVIDER === 'kokoro' || process.env.KOKORO_MODEL_ID) {
		return { provider: 'kokoro', reason: 'Kokoro TTS configured' };
	}
	if (process.env.TTS_PROVIDER === 'browser') {
		return { provider: 'browser', reason: 'Browser TTS configured' };
	}
	if (
		process.env.ELEVENLABS_API_KEY &&
		process.env.ELEVENLABS_API_KEY !== 'your_elevenlabs_api_key'
	) {
		return { provider: 'elevenlabs', reason: 'ElevenLabs API key found' };
	}
	return { provider: 'kokoro', reason: 'Default (local TTS preferred)' };
}

// Show auto-detection vs manual override
const manualProvider = process.env.TTS_PROVIDER;
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
	console.log('   Valid options: kokoro, browser, elevenlabs');
	process.exit(1);
}

console.log(`Selected: ${info.name}`);

// Check required environment variables
const missingVars = [];
if (currentProvider === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY) {
	missingVars.push('ELEVENLABS_API_KEY');
}

// Show configuration details
console.log('\n📋 Current Configuration:');
switch (currentProvider) {
	case 'kokoro':
		console.log(`   Voice: ${process.env.KOKORO_VOICE || 'af_bella (default)'}`);
		console.log(
			`   Model: ${process.env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX (default)'}`
		);
		console.log(`   Dtype: ${process.env.KOKORO_DTYPE || 'q4 (default)'}`);
		console.log(`   Device: ${process.env.KOKORO_DEVICE || 'wasm (default)'}`);
		break;
	case 'browser':
		console.log(`   Voice: ${process.env.BROWSER_VOICE || 'default'}`);
		console.log('   Note: Browser TTS uses system voices');
		break;
	case 'elevenlabs':
		console.log(`   API Key: ${process.env.ELEVENLABS_API_KEY ? '✓ Set' : '✗ Missing'}`);
		console.log('   Voice ID: 3XOBzXhnDY98yeWQ3GdM (non-premium)');
		break;
}

if (missingVars.length > 0) {
	console.log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`);

	console.log('\n💡 Setup Help:');
	console.log(`   Provider: ${info.name}`);
	console.log(`   Setup URL: ${info.setupUrl}`);

	if (currentProvider === 'elevenlabs') {
		console.log('   1. Sign up at ElevenLabs.io');
		console.log('   2. Get your API key from account settings');
		console.log('   3. Set ELEVENLABS_API_KEY in your .env file');
		console.log('   4. Set TTS_PROVIDER=elevenlabs in your .env file');
	}
} else {
	console.log('\n✅ Configuration looks good!');
	console.log('\n🚀 You can now run: npm run dev');

	if (info.isLocal && currentProvider === 'kokoro') {
		console.log('💡 Kokoro TTS will download the model on first use (~200MB)');
		console.log('   Model will be cached locally for faster subsequent use');
	}
}

// Show available voices
if (info.voices && info.voices.length > 1) {
	console.log(`\n🎭 Available Voices for ${info.name}:`);
	info.voices.forEach((voice) => {
		console.log(`   - ${voice}`);
	});
}

console.log('\n📚 For detailed setup instructions, see README.md');
