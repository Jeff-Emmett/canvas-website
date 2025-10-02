import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type FileSystem from "@oddjs/odd/fs/index";

// Helper function to validate API keys
function isValidApiKey(provider: string, key: string): boolean {
	if (!key || typeof key !== 'string' || key.trim() === '') {
		return false;
	}
	
	switch (provider) {
		case 'openai':
			return key.startsWith('sk-') && key.length > 20;
		case 'anthropic':
			return key.startsWith('sk-ant-') && key.length > 20;
		case 'google':
			return key.length > 20; // Google keys don't have a specific prefix
		default:
			return key.length > 10; // Generic validation for unknown providers
	}
}

// Helper function to load API keys from user profile filesystem
async function loadApiKeysFromProfile(fs: FileSystem | null): Promise<{ openai: string; anthropic: string }> {
	const result = { openai: '', anthropic: '' };
	
	if (!fs) {
		return result;
	}
	
	try {
		// Try to read API keys from user profile settings
		const settingsPath = ['private', 'settings', 'api_keys.json'];
		const filePath = (window as any).webnative?.path?.file(...settingsPath);
		
		if (filePath && await fs.exists(filePath)) {
			const fileContent = await fs.read(filePath);
			const settings = JSON.parse(new TextDecoder().decode(fileContent));
			
			if (settings.openai && typeof settings.openai === 'string') {
				result.openai = settings.openai;
			}
			if (settings.anthropic && typeof settings.anthropic === 'string') {
				result.anthropic = settings.anthropic;
			}
			
			console.log("📁 Loaded API keys from user profile");
		}
	} catch (error) {
		console.log("⚠️ Could not load API keys from user profile:", error);
	}
	
	return result;
}

// Helper function to save API keys to user profile filesystem
async function saveApiKeysToProfile(fs: FileSystem | null, openaiKey: string, anthropicKey: string): Promise<void> {
	if (!fs) {
		return;
	}
	
	try {
		const settings = {
			openai: openaiKey,
			anthropic: anthropicKey,
			updated: new Date().toISOString()
		};
		
		const settingsPath = ['private', 'settings', 'api_keys.json'];
		const filePath = (window as any).webnative?.path?.file(...settingsPath);
		
		if (filePath) {
			const content = new TextEncoder().encode(JSON.stringify(settings, null, 2));
			await fs.write(filePath, content);
			await fs.publish();
			console.log("💾 Saved API keys to user profile");
		}
	} catch (error) {
		console.log("⚠️ Could not save API keys to user profile:", error);
	}
}

export async function llm(
	userPrompt: string,
	onToken: (partialResponse: string, done?: boolean) => void,
	fileSystem?: FileSystem | null,
) {
	// Validate the callback function
	if (typeof onToken !== 'function') {
		throw new Error("onToken must be a function");
	}
	
	// Load API keys from both localStorage and user profile
	const localOpenaiKey = localStorage.getItem("openai_api_key") || "";
	const localAnthropicKey = localStorage.getItem("anthropic_api_key") || "";
	
	// Load from user profile if filesystem is available
	const profileKeys = await loadApiKeysFromProfile(fileSystem || null);
	
	// Use profile keys if available, otherwise fall back to localStorage
	const openaiKey = profileKeys.openai || localOpenaiKey;
	const anthropicKey = profileKeys.anthropic || localAnthropicKey;
	
	console.log("🔑 OpenAI key present:", !!openaiKey && isValidApiKey('openai', openaiKey));
	console.log("🔑 Anthropic key present:", !!anthropicKey && isValidApiKey('anthropic', anthropicKey));
	console.log("📁 Profile keys loaded:", { openai: !!profileKeys.openai, anthropic: !!profileKeys.anthropic });
	console.log("💾 Local keys loaded:", { openai: !!localOpenaiKey, anthropic: !!localAnthropicKey });
	
	// Determine which provider to use
	let provider: string | null = null;
	let apiKey: string | null = null;
	
	// Try OpenAI first if available
	if (openaiKey && isValidApiKey('openai', openaiKey)) {
		provider = 'openai';
		apiKey = openaiKey;
	}
	// Try Anthropic if OpenAI not available
	else if (anthropicKey && isValidApiKey('anthropic', anthropicKey)) {
		provider = 'anthropic';
		apiKey = anthropicKey;
	}
	
	if (!provider || !apiKey) {
		throw new Error("No valid API key found. Please set either 'openai_api_key' or 'anthropic_api_key' in localStorage.");
	}
	
	console.log(`✅ Using ${provider} API`);
	
	// Try the selected provider
	try {
		await tryProvider(provider, apiKey, getDefaultModel(provider), userPrompt, onToken);
		console.log(`✅ Successfully used ${provider} API`);
	} catch (error: any) {
		console.error(`❌ ${provider} API failed:`, error.message);
		
		// If the first provider failed, try the other one
		const otherProvider = provider === 'openai' ? 'anthropic' : 'openai';
		const otherKey = otherProvider === 'openai' ? openaiKey : anthropicKey;
		
		if (otherKey && isValidApiKey(otherProvider, otherKey)) {
			console.log(`🔄 Trying fallback ${otherProvider} API`);
			try {
				await tryProvider(otherProvider, otherKey, getDefaultModel(otherProvider), userPrompt, onToken);
				console.log(`✅ Successfully used fallback ${otherProvider} API`);
				return;
			} catch (fallbackError: any) {
				console.error(`❌ Fallback ${otherProvider} API also failed:`, fallbackError.message);
			}
		}
		
		// If all providers failed, throw the original error
		throw error;
	}
}

async function tryProvider(provider: string, apiKey: string, model: string, userPrompt: string, onToken: (partialResponse: string, done?: boolean) => void) {
	let partial = "";
	
	if (provider === 'openai') {
		const openai = new OpenAI({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
		
		const stream = await openai.chat.completions.create({
			model: model,
			messages: [
				{ role: "system", content: 'You are a helpful assistant.' },
				{ role: "user", content: userPrompt },
			],
			stream: true,
		});
		
		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content || "";
			partial += content;
			onToken(partial, false);
		}
	} else if (provider === 'anthropic') {
		const anthropic = new Anthropic({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
		
		const stream = await anthropic.messages.create({
			model: model,
			max_tokens: 4096,
			messages: [
				{ role: "user", content: userPrompt }
			],
			stream: true,
		});
		
		for await (const chunk of stream) {
			if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
				const content = chunk.delta.text || "";
				partial += content;
				onToken(partial, false);
			}
		}
	} else {
		throw new Error(`Unsupported provider: ${provider}`)
	}
	
	onToken(partial, true);
}


// Helper function to get default model for a provider
function getDefaultModel(provider: string): string {
	switch (provider) {
		case 'openai':
			return 'gpt-4o'
		case 'anthropic':
			return 'claude-3-5-sonnet-20241022'
		default:
			return 'gpt-4o'
	}
}

// Helper function to get API key from settings for a specific provider
export function getApiKey(provider: string = 'openai'): string {
	try {
		if (provider === 'openai') {
			return localStorage.getItem("openai_api_key") || "";
		} else if (provider === 'anthropic') {
			return localStorage.getItem("anthropic_api_key") || "";
		}
		return "";
	} catch (e) {
		return "";
	}
}

// Helper function to check API key status
export function checkApiKeyStatus(): { provider: string; hasValidKey: boolean; keyPreview: string }[] {
	const results: { provider: string; hasValidKey: boolean; keyPreview: string }[] = [];
	
	// Check OpenAI key
	const openaiKey = localStorage.getItem("openai_api_key") || "";
	const openaiValid = isValidApiKey('openai', openaiKey);
	results.push({
		provider: 'openai',
		hasValidKey: openaiValid,
		keyPreview: openaiKey ? `${openaiKey.substring(0, 10)}...` : 'empty'
	});
	
	// Check Anthropic key
	const anthropicKey = localStorage.getItem("anthropic_api_key") || "";
	const anthropicValid = isValidApiKey('anthropic', anthropicKey);
	results.push({
		provider: 'anthropic',
		hasValidKey: anthropicValid,
		keyPreview: anthropicKey ? `${anthropicKey.substring(0, 10)}...` : 'empty'
	});
	
	return results;
}

// Helper function to get the first available API key from any provider
export function getFirstAvailableApiKey(): string | null {
	try {
		// Try OpenAI first
		const openaiKey = localStorage.getItem("openai_api_key");
		if (openaiKey && isValidApiKey('openai', openaiKey)) {
			return openaiKey;
		}
		
		// Try Anthropic
		const anthropicKey = localStorage.getItem("anthropic_api_key");
		if (anthropicKey && isValidApiKey('anthropic', anthropicKey)) {
			return anthropicKey;
		}
		
		return null;
	} catch (e) {
		return null;
	}
}

// Helper function to set up API keys (for debugging/setup)
export function setupApiKey(provider: 'openai' | 'anthropic', key: string): void {
	try {
		if (provider === 'openai') {
			localStorage.setItem("openai_api_key", key);
		} else if (provider === 'anthropic') {
			localStorage.setItem("anthropic_api_key", key);
		}
		
		console.log(`✅ ${provider} API key set successfully`);
		console.log(`🔑 Key preview: ${key.substring(0, 10)}...`);
	} catch (e) {
		console.error("❌ Failed to set API key:", e);
	}
}