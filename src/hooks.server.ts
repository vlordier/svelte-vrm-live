import { dev } from '$app/environment';
import { UnifiedLLMClient } from '$lib/llm/client';

// Show LLM configuration on server startup (dev mode only)
if (dev) {
	try {
		const client = new UnifiedLLMClient();
		const config = client.getConfig();
		const providerInfo = UnifiedLLMClient.getProviderInfo();

		console.log('\n🧠 LLM Configuration:');
		console.log(`   Provider: ${providerInfo[config.provider].name} (${config.provider})`);
		console.log(`   Model: ${config.model}`);
		if (config.baseUrl) {
			console.log(`   URL: ${config.baseUrl}`);
		}
		console.log('   Status: ✅ Configuration loaded');
		console.log('   Test with: npm run test:llm\n');
	} catch (error) {
		console.log('\n🧠 LLM Configuration:');
		console.log('   Status: ❌ Configuration error');
		console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		console.log('   Fix: Check your .env file and run: npm run test:llm\n');
	}
}
