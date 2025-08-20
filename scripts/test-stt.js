#!/usr/bin/env node

/**
 * Test STT Configuration
 *
 * This script helps you test your Speech-to-Text configuration
 * Usage: node scripts/test-stt.js
 */

import { config } from 'dotenv';

// Load environment variables
config();

console.log('🎤 Speech-to-Text Configuration Test');
console.log('====================================\n');

// Provider information
const providerInfo = {
	vad: {
		name: 'Silero VAD',
		description: 'Voice Activity Detection using Silero models',
		setupUrl: 'https://github.com/ricky0123/vad',
		isLocal: true,
		requiredPermissions: ['microphone access'],
		features: ['Real-time speech detection', 'Browser-based processing', 'No API key required']
	},
	whisper: {
		name: 'Whisper ASR',
		description: 'Automatic Speech Recognition using OpenAI Whisper via Transformers.js',
		setupUrl: 'https://github.com/xenova/transformers.js',
		isLocal: true,
		requiredPermissions: ['none'],
		models: [
			'Xenova/whisper-tiny.en (39MB)',
			'Xenova/whisper-tiny (39MB)',
			'Xenova/whisper-base.en (74MB)',
			'Xenova/whisper-base (74MB)',
			'Xenova/whisper-small.en (244MB)',
			'Xenova/whisper-small (244MB)'
		]
	}
};

console.log('Available STT Components:');
Object.entries(providerInfo).forEach(([key, info]) => {
	console.log(`  ${key}: ${info.name} - ${info.description}`);
});
console.log();

// Show current configuration
console.log('📋 Current Configuration:');

console.log('\n🎙️ VAD (Voice Activity Detection):');
console.log(
	`   Positive Threshold: ${process.env.PUBLIC_VAD_POSITIVE_THRESHOLD || '0.8 (default)'}`
);
console.log(
	`   Negative Threshold: ${process.env.PUBLIC_VAD_NEGATIVE_THRESHOLD || '0.35 (default)'}`
);
console.log(`   Min Speech Frames: ${process.env.PUBLIC_VAD_MIN_SPEECH_FRAMES || '5 (default)'}`);

console.log('\n🧠 Whisper ASR:');
console.log(
	`   Model: ${process.env.PUBLIC_WHISPER_MODEL_ID || 'Xenova/whisper-tiny.en (default)'}`
);
console.log(`   Dtype: ${process.env.PUBLIC_WHISPER_DTYPE || 'q4 (default)'}`);
console.log(`   Device: ${process.env.PUBLIC_WHISPER_DEVICE || 'wasm (default)'}`);
console.log(`   Language: ${process.env.PUBLIC_WHISPER_LANGUAGE || 'en (default)'}`);
console.log(`   Task: ${process.env.PUBLIC_WHISPER_TASK || 'transcribe (default)'}`);

// Check browser compatibility
console.log('\n🌐 Browser Requirements:');
console.log('   • Modern browser with WebAssembly support');
console.log('   • Microphone access permission');
console.log('   • HTTPS connection (required for microphone access)');
console.log('   • Sufficient memory for model loading');

// Model size information
const selectedModel = process.env.PUBLIC_WHISPER_MODEL_ID || 'Xenova/whisper-tiny.en';
const modelSizes = {
	'Xenova/whisper-tiny.en': '39MB',
	'Xenova/whisper-tiny': '39MB',
	'Xenova/whisper-base.en': '74MB',
	'Xenova/whisper-base': '74MB',
	'Xenova/whisper-small.en': '244MB',
	'Xenova/whisper-small': '244MB'
};

const modelSize = modelSizes[selectedModel] || 'Unknown size';
console.log(`\n📦 Model Download:`);
console.log(`   Selected Model: ${selectedModel}`);
console.log(`   Download Size: ${modelSize}`);
console.log(`   💡 Model will be downloaded on first use and cached locally`);

// Performance expectations
console.log('\n⚡ Performance Expectations:');
console.log('   • VAD: Real-time processing with minimal latency');
console.log('   • Whisper: 2-10 seconds processing time depending on model size');
console.log('   • Memory: 100-500MB depending on selected model');
console.log('   • First run: Slower due to model download');

// Configuration recommendations
console.log('\n💡 Configuration Recommendations:');

const device = process.env.PUBLIC_WHISPER_DEVICE || 'wasm';
switch (device) {
	case 'webgpu':
		console.log('   🚀 WebGPU: Fastest processing, requires WebGPU support');
		console.log('   ⚠️  Note: WebGPU may not be available in all browsers');
		break;
	case 'wasm':
		console.log('   ⚖️  WebAssembly: Good balance of speed and compatibility');
		console.log('   ✅ Recommended for most use cases');
		break;
	case 'cpu':
		console.log('   🐌 CPU: Slowest but most compatible');
		console.log('   ⚠️  May be too slow for real-time use');
		break;
}

const dtype = process.env.PUBLIC_WHISPER_DTYPE || 'q4';
switch (dtype) {
	case 'fp32':
		console.log('   📊 FP32: Highest quality, largest size, slowest');
		break;
	case 'fp16':
		console.log('   📊 FP16: Good quality, medium size, medium speed');
		break;
	case 'q8':
		console.log('   📊 Q8: Good quality with compression');
		break;
	case 'q4':
		console.log('   📊 Q4: Best balance of quality, size, and speed');
		console.log('   ✅ Recommended for most use cases');
		break;
	default:
		console.log(`   📊 ${dtype}: Custom quantization level`);
}

// Integration information
console.log('\n🔗 Integration Pattern:');
console.log('   1. VAD detects when user starts speaking');
console.log('   2. Audio is captured in real-time (16kHz Float32Array)');
console.log('   3. When user stops speaking, audio is sent to Whisper');
console.log('   4. Whisper transcribes the audio segment');
console.log('   5. Transcription result is returned');

// Setup instructions
console.log('\n🚀 Quick Setup:');
console.log('   1. Ensure HTTPS is enabled (required for microphone access)');
console.log('   2. Run: npm run dev');
console.log('   3. Navigate to your app in the browser');
console.log('   4. Grant microphone permission when prompted');
console.log('   5. Start speaking to test the system');

console.log('\n🧪 Testing:');
console.log('   • Use the browser developer tools to test microphone access');
console.log('   • Check the console for VAD and Whisper initialization logs');
console.log('   • Test with short phrases first (3-10 seconds)');
console.log('   • Verify transcription accuracy with different voices and accents');

// Troubleshooting
console.log('\n🔧 Troubleshooting:');
console.log('   • Microphone not working? Check browser permissions');
console.log('   • Model loading slowly? Check network connection');
console.log('   • Poor transcription? Try a larger model or adjust VAD thresholds');
console.log('   • High memory usage? Use a smaller model or q4 quantization');

console.log('\n📚 For detailed setup instructions, see README.md');
