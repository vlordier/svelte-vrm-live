#!/usr/bin/env node
/**
 * Test script for LAM Audio2Expression integration
 */

import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) { log(`[INFO] ${message}`, 'blue'); }
function logSuccess(message) { log(`[SUCCESS] ${message}`, 'green'); }
function logWarning(message) { log(`[WARNING] ${message}`, 'yellow'); }
function logError(message) { log(`[ERROR] ${message}`, 'red'); }

async function testHealthEndpoints() {
    logInfo('Testing health endpoints...');
    
    try {
        // Test Node.js Audio2Expression endpoint
        const nodeResponse = await fetch('http://localhost:5173/api/audio2expression');
        if (nodeResponse.ok) {
            const data = await nodeResponse.json();
            logSuccess('Node.js Audio2Expression endpoint is healthy');
            logInfo(`Current mode: ${data.features?.current_mode || 'unknown'}`);
            logInfo(`Python service available: ${data.python_service?.available || false}`);
        } else {
            logWarning('Node.js Audio2Expression endpoint returned error status');
        }
    } catch (error) {
        logError(`Node.js endpoint test failed: ${error.message}`);
    }
    
    try {
        // Test Python service directly
        const pythonResponse = await fetch('http://localhost:8001/health');
        if (pythonResponse.ok) {
            const data = await pythonResponse.json();
            logSuccess('Python LAM service is healthy');
            logInfo(`Model loaded: ${data.model_loaded}`);
            logInfo(`Device: ${data.device}`);
            logInfo(`Status: ${data.status}`);
        } else {
            logWarning('Python LAM service returned error status');
        }
    } catch (error) {
        logWarning(`Python service test failed: ${error.message}`);
        logInfo('This is expected if Python service is not running');
    }
}

async function testAudio2ExpressionProcessing() {
    logInfo('Testing Audio2Expression processing...');
    
    try {
        // Create a simple test audio (sine wave as base64)
        const sampleRate = 24000;
        const duration = 1.0; // 1 second
        const frequency = 440; // A4 note
        const samples = Math.floor(sampleRate * duration);
        
        // Generate sine wave
        const audioData = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            audioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
        }
        
        // Convert to base64
        const buffer = Buffer.from(audioData.buffer);
        const audioBase64 = buffer.toString('base64');
        
        logInfo('Generated 1-second test audio (440Hz sine wave)');
        
        // Test the endpoint
        const response = await fetch('http://localhost:5173/api/audio2expression', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio: audioBase64,
                sample_rate: sampleRate,
                format: 'wav'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                logSuccess(`Processing succeeded! Generated ${result.blendshapes?.length || 0} frames`);
                logInfo(`Duration: ${result.duration?.toFixed(2) || 'unknown'}s`);
                logInfo(`Sample rate: ${result.sample_rate || 'unknown'}Hz`);
                
                // Show some blendshape samples
                if (result.blendshapes && result.blendshapes.length > 0) {
                    const firstFrame = result.blendshapes[0];
                    const activeBlendshapes = Object.entries(firstFrame.blendshapes || {})
                        .filter(([name, value]) => value > 0.1)
                        .slice(0, 5);
                    
                    if (activeBlendshapes.length > 0) {
                        logInfo('Active blendshapes in first frame:');
                        activeBlendshapes.forEach(([name, value]) => {
                            console.log(`  ${name}: ${value.toFixed(3)}`);
                        });
                    }
                }
            } else {
                logError(`Processing failed: ${result.error || 'Unknown error'}`);
            }
        } else {
            logError(`Request failed with status ${response.status}`);
        }
        
    } catch (error) {
        logError(`Audio2Expression test failed: ${error.message}`);
    }
}

async function testFileStructure() {
    logInfo('Checking file structure...');
    
    const requiredFiles = [
        'src/lib/audio/audio2expression.ts',
        'src/routes/api/audio2expression/+server.ts',
        'python-services/lam-audio2expression/server.py',
        'python-services/lam-audio2expression/lam_model.py',
        'python-services/lam-audio2expression/config.py',
        'python-services/lam-audio2expression/requirements.txt',
        'scripts/setup-lam-audio2expression.sh'
    ];
    
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
            logSuccess(`✓ ${file}`);
        } else {
            logError(`✗ ${file} - MISSING`);
            allFilesExist = false;
        }
    }
    
    if (allFilesExist) {
        logSuccess('All required files are present');
    } else {
        logError('Some required files are missing');
    }
    
    // Check Python virtual environment
    const venvPath = 'python-services/lam-audio2expression/venv';
    if (fs.existsSync(venvPath)) {
        logSuccess('Python virtual environment exists');
    } else {
        logWarning('Python virtual environment not found - run setup script');
    }
    
    // Check model directory
    const modelPath = 'python-services/lam-audio2expression/models/LAM_audio2exp';
    if (fs.existsSync(modelPath)) {
        logSuccess('LAM model directory exists');
    } else {
        logWarning('LAM model not downloaded - use download_model.py');
    }
}

async function main() {
    log('🎭 LAM Audio2Expression Integration Test', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    await testFileStructure();
    console.log('');
    
    await testHealthEndpoints();
    console.log('');
    
    await testAudio2ExpressionProcessing();
    console.log('');
    
    log('Test completed!', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    logInfo('Next steps:');
    logInfo('1. If Python service is not running: cd python-services/lam-audio2expression && ./start.sh');
    logInfo('2. If Node.js is not running: npm run dev');
    logInfo('3. Open http://localhost:5173 and test the 🤖 Advanced mode');
}

// Run the tests
main().catch(error => {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
});