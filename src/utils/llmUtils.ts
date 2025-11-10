import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { makeRealSettings, AI_PERSONALITIES } from "@/lib/settings";

export async function llm(
	userPrompt: string,
	onToken: (partialResponse: string, done?: boolean) => void,
	customPersonality?: string,
) {
	// Validate the callback function
	if (typeof onToken !== 'function') {
		throw new Error("onToken must be a function");
	}
	
	// Auto-migrate old format API keys if needed
	await autoMigrateAPIKeys();
	
	// Get current settings and available API keys
	let settings;
	try {
		settings = makeRealSettings.get()
	} catch (e) {
		settings = null;
	}
	
	// Fallback to direct localStorage if makeRealSettings fails
	if (!settings) {
		try {
			const rawSettings = localStorage.getItem("openai_api_key");
			if (rawSettings) {
				settings = JSON.parse(rawSettings);
			}
		} catch (e) {
			// Continue with default settings
		}
	}
	
	// Default settings if everything fails
	if (!settings) {
		settings = {
			provider: 'openai',
			models: { openai: 'gpt-4o', anthropic: 'claude-sonnet-4-5-20250929' },
			keys: { openai: '', anthropic: '', google: '' },
			personality: 'web-developer'
		};
	}
	
	// Override personality if custom personality is provided
	if (customPersonality) {
		settings.personality = customPersonality;
	}
	
	const availableKeys = settings.keys || {}
	
	// Get all available providers with valid keys
	const availableProviders = getAvailableProviders(availableKeys, settings);
	
	console.log(`🔍 Found ${availableProviders.length} available AI providers:`, 
		availableProviders.map(p => `${p.provider} (${p.model})`).join(', '));
	
	if (availableProviders.length === 0) {
		throw new Error("No valid API key found for any provider")
	}
	
	// Try each provider/key combination in order until one succeeds
	let lastError: Error | null = null;
	const attemptedProviders: string[] = [];
	
	// List of fallback models for Anthropic if the primary model fails
	// Try newest models first (Sonnet 4.5, then Sonnet 4), then fall back to older models
	const anthropicFallbackModels = [
		'claude-sonnet-4-5-20250929',
		'claude-sonnet-4-20250522',
		'claude-3-opus-20240229',
		'claude-3-sonnet-20240229',
		'claude-3-haiku-20240307',
	];
	
	for (const { provider, apiKey, model } of availableProviders) {
		try {
			console.log(`🔄 Attempting to use ${provider} API (${model})...`);
			attemptedProviders.push(`${provider} (${model})`);
			
			// Add retry logic for temporary failures
			await callProviderAPIWithRetry(provider, apiKey, model, userPrompt, onToken, settings);
			console.log(`✅ Successfully used ${provider} API (${model})`);
			return; // Success, exit the function
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Check if it's a model not found error (404) for Anthropic - try fallback models
			if (provider === 'anthropic' && (errorMessage.includes('404') || errorMessage.includes('not_found_error') || errorMessage.includes('model:'))) {
				console.warn(`❌ ${provider} model ${model} not found, trying fallback models...`);
				
				// Try fallback models
				let fallbackSucceeded = false;
				for (const fallbackModel of anthropicFallbackModels) {
					if (fallbackModel === model) continue; // Skip the one we already tried
					
					try {
						console.log(`🔄 Trying fallback model: ${fallbackModel}...`);
						attemptedProviders.push(`${provider} (${fallbackModel})`);
						await callProviderAPIWithRetry(provider, apiKey, fallbackModel, userPrompt, onToken, settings);
						console.log(`✅ Successfully used ${provider} API with fallback model ${fallbackModel}`);
						fallbackSucceeded = true;
						return; // Success, exit the function
					} catch (fallbackError) {
						const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
						console.warn(`❌ Fallback model ${fallbackModel} also failed:`, fallbackErrorMessage);
						// Continue to next fallback model
					}
				}
				
				if (!fallbackSucceeded) {
					console.warn(`❌ All ${provider} models failed`);
					lastError = error as Error;
				}
			} else if (errorMessage.includes('401') || errorMessage.includes('403') || 
			    errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid API key') ||
			    errorMessage.includes('expired') || errorMessage.includes('Expired')) {
				console.warn(`❌ ${provider} API authentication failed (invalid/expired API key):`, errorMessage);
				// Mark this specific API key as invalid for future attempts
				markApiKeyAsInvalid(provider, apiKey);
				console.log(`🔄 Will try next available API key...`);
				lastError = error as Error;
			} else {
				console.warn(`❌ ${provider} API failed (non-auth error):`, errorMessage);
				lastError = error as Error;
			}
			// Continue to next provider/key
		}
	}
	
	// If we get here, all providers failed
	const attemptedList = attemptedProviders.join(', ');
	throw new Error(`All AI providers failed (attempted: ${attemptedList}). Last error: ${lastError?.message || 'Unknown error'}`);
}

// Helper function to get all available providers with their keys and models
// Now supports multiple keys per provider (stored as comma-separated or array)
function getAvailableProviders(availableKeys: Record<string, string>, settings: any) {
	const providers = [];
	
	// Helper to add a provider key if valid
	const addProviderKey = (provider: string, apiKey: string, model?: string) => {
		if (isValidApiKey(provider, apiKey) && !isApiKeyInvalid(provider, apiKey)) {
			providers.push({
				provider: provider,
				apiKey: apiKey,
				model: model || settings.models[provider] || getDefaultModel(provider)
			});
			return true;
		} else if (isApiKeyInvalid(provider, apiKey)) {
			console.log(`⏭️ Skipping ${provider} API key (marked as invalid)`);
		}
		return false;
	};
	
	// First, try the preferred provider - support multiple keys if stored as comma-separated
	if (settings.provider && availableKeys[settings.provider]) {
		const keyValue = availableKeys[settings.provider];
		// Check if it's a comma-separated list of keys
		if (keyValue.includes(',') && keyValue.trim() !== '') {
			const keys = keyValue.split(',').map(k => k.trim()).filter(k => k !== '');
			for (const apiKey of keys) {
				addProviderKey(settings.provider, apiKey);
			}
		} else if (keyValue.trim() !== '') {
			addProviderKey(settings.provider, keyValue);
		}
	}
	
	// Then add all other available providers (excluding the preferred one)
	// Support multiple keys per provider
	for (const [key, value] of Object.entries(availableKeys)) {
		if (key !== settings.provider && typeof value === 'string' && value.trim() !== '') {
			// Check if it's a comma-separated list of keys
			if (value.includes(',')) {
				const keys = value.split(',').map(k => k.trim()).filter(k => k !== '');
				for (const apiKey of keys) {
					addProviderKey(key, apiKey);
				}
			} else {
				addProviderKey(key, value);
			}
		}
	}
	
	// Fallback to old format localStorage if no providers found
	if (providers.length === 0) {
		try {
			const directSettings = localStorage.getItem("openai_api_key");
			if (directSettings) {
				// Check if it's the old format (just a string)
				if (directSettings.startsWith('sk-') && !directSettings.startsWith('{')) {
					if (isValidApiKey('openai', directSettings) && !isApiKeyInvalid('openai', directSettings)) {
						providers.push({
							provider: 'openai',
							apiKey: directSettings,
							model: getDefaultModel('openai')
						});
					} else if (isApiKeyInvalid('openai', directSettings)) {
						console.log(`⏭️ Skipping OpenAI API key (marked as invalid)`);
					}
				} else {
					// Try to parse as JSON
					try {
						const parsed = JSON.parse(directSettings);
						if (parsed.keys) {
							for (const [key, value] of Object.entries(parsed.keys)) {
								if (typeof value === 'string' && value.trim() !== '' && isValidApiKey(key, value) && !isApiKeyInvalid(key, value)) {
									providers.push({
										provider: key,
										apiKey: value,
										model: parsed.models?.[key] || getDefaultModel(key)
									});
								} else if (isApiKeyInvalid(key, value as string)) {
									console.log(`⏭️ Skipping ${key} API key (marked as invalid)`);
								}
							}
						}
					} catch (parseError) {
						// If it's not JSON and starts with sk-, treat as old format OpenAI key
						if (directSettings.startsWith('sk-') && isValidApiKey('openai', directSettings) && !isApiKeyInvalid('openai', directSettings)) {
							providers.push({
								provider: 'openai',
								apiKey: directSettings,
								model: getDefaultModel('openai')
							});
						} else if (isApiKeyInvalid('openai', directSettings)) {
							console.log(`⏭️ Skipping OpenAI API key (marked as invalid)`);
						}
					}
				}
			}
		} catch (e) {
			// Continue with error handling
		}
	}
	
	// Additional fallback: Check for user-specific API keys from profile dashboard
	if (providers.length === 0) {
		providers.push(...getUserSpecificApiKeys());
	}
	
	return providers;
}

// Helper function to get user-specific API keys from profile dashboard
function getUserSpecificApiKeys() {
	const providers = [];
	
	try {
		// Get current session to find username
		const sessionData = localStorage.getItem('session');
		if (sessionData) {
			const session = JSON.parse(sessionData);
			const username = session.username;
			
			if (username) {
				// Check for user-specific API keys stored with username prefix
				const userApiKey = localStorage.getItem(`${username}_api_keys`);
				if (userApiKey) {
					try {
						const parsed = JSON.parse(userApiKey);
						if (parsed.keys) {
							for (const [provider, apiKey] of Object.entries(parsed.keys)) {
								if (typeof apiKey === 'string' && apiKey.trim() !== '' && isValidApiKey(provider, apiKey) && !isApiKeyInvalid(provider, apiKey as string)) {
									providers.push({
										provider,
										apiKey,
										model: parsed.models?.[provider] || getDefaultModel(provider)
									});
								} else if (isApiKeyInvalid(provider, apiKey as string)) {
									console.log(`⏭️ Skipping ${provider} API key (marked as invalid)`);
								}
							}
						}
					} catch (parseError) {
						console.warn('Failed to parse user-specific API keys:', parseError);
					}
				}
				
				// Also check for individual provider keys with username prefix
				const providerKeys = ['openai', 'anthropic', 'google'];
				for (const provider of providerKeys) {
					const key = localStorage.getItem(`${username}_${provider}_api_key`);
					if (key && isValidApiKey(provider, key) && !isApiKeyInvalid(provider, key as string)) {
						providers.push({
							provider,
							apiKey: key,
							model: getDefaultModel(provider)
						});
					} else if (isApiKeyInvalid(provider, key as string)) {
						console.log(`⏭️ Skipping ${provider} API key (marked as invalid)`);
					}
				}
			}
		}
		
		// Check for any registered users and their API keys
		const registeredUsers = localStorage.getItem('registeredUsers');
		if (registeredUsers) {
			try {
				const users = JSON.parse(registeredUsers);
				for (const username of users) {
					// Skip if we already checked the current user
					const sessionData = localStorage.getItem('session');
					if (sessionData) {
						const session = JSON.parse(sessionData);
						if (session.username === username) continue;
					}
					
					// Check for user-specific API keys
					const userApiKey = localStorage.getItem(`${username}_api_keys`);
					if (userApiKey) {
						try {
							const parsed = JSON.parse(userApiKey);
							if (parsed.keys) {
								for (const [provider, apiKey] of Object.entries(parsed.keys)) {
									if (typeof apiKey === 'string' && apiKey.trim() !== '' && isValidApiKey(provider, apiKey) && !isApiKeyInvalid(provider, apiKey as string)) {
										providers.push({
											provider,
											apiKey,
											model: parsed.models?.[provider] || getDefaultModel(provider)
										});
									} else if (isApiKeyInvalid(provider, apiKey as string)) {
										console.log(`⏭️ Skipping ${provider} API key (marked as invalid)`);
									}
								}
							}
						} catch (parseError) {
							// Continue with other users
						}
					}
				}
			} catch (parseError) {
				console.warn('Failed to parse registered users:', parseError);
			}
		}
	} catch (error) {
		console.warn('Error checking user-specific API keys:', error);
	}
	
	return providers;
}

// Helper function to validate API key format
function isValidApiKey(provider: string, apiKey: string): boolean {
	if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
		return false;
	}
	
	switch (provider) {
		case 'openai':
			return apiKey.startsWith('sk-') && apiKey.length > 20;
		case 'anthropic':
			return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
		case 'google':
			// Google API keys are typically longer and don't have a specific prefix
			return apiKey.length > 20;
		default:
			return apiKey.length > 10; // Basic validation for unknown providers
	}
}

// Helper function to call API with retry logic
async function callProviderAPIWithRetry(
	provider: string, 
	apiKey: string, 
	model: string, 
	userPrompt: string, 
	onToken: (partialResponse: string, done?: boolean) => void,
	settings?: any,
	maxRetries: number = 2
) {
	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await callProviderAPI(provider, apiKey, model, userPrompt, onToken, settings);
			return; // Success
		} catch (error) {
			lastError = error as Error;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Don't retry authentication errors
			if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
				throw error;
			}
			
			// Don't retry on last attempt
			if (attempt === maxRetries) {
				throw error;
			}
			
			// Wait before retry (exponential backoff)
			const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
			console.log(`⏳ Retrying ${provider} API in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	
	throw lastError;
}

// Helper function to mark an API key as invalid
function markApiKeyAsInvalid(provider: string, apiKey: string) {
	try {
		// Store invalid keys in localStorage to avoid retrying them
		const invalidKeysKey = 'invalid_api_keys';
		let invalidKeys: Record<string, string[]> = {};
		
		try {
			const stored = localStorage.getItem(invalidKeysKey);
			if (stored) {
				invalidKeys = JSON.parse(stored);
			}
		} catch (e) {
			// Start fresh if parsing fails
		}
		
		// Add this key to invalid keys
		if (!invalidKeys[provider]) {
			invalidKeys[provider] = [];
		}
		
		// Only add if not already marked as invalid
		if (!invalidKeys[provider].includes(apiKey)) {
			invalidKeys[provider].push(apiKey);
			localStorage.setItem(invalidKeysKey, JSON.stringify(invalidKeys));
			console.log(`🚫 Marked ${provider} API key as invalid`);
		}
	} catch (e) {
		// Silently handle errors
	}
}

// Helper function to check if an API key is marked as invalid
function isApiKeyInvalid(provider: string, apiKey: string): boolean {
	try {
		const invalidKeysKey = 'invalid_api_keys';
		const stored = localStorage.getItem(invalidKeysKey);
		if (stored) {
			const invalidKeys = JSON.parse(stored);
			return invalidKeys[provider] && invalidKeys[provider].includes(apiKey);
		}
	} catch (e) {
		// If parsing fails, assume not invalid
	}
	return false;
}

// Helper function to get system prompt based on personality
function getSystemPrompt(settings: any): string {
	const personality = settings.personality || 'web-developer';
	const personalityConfig = AI_PERSONALITIES.find(p => p.id === personality);
	
	if (personalityConfig) {
		return personalityConfig.systemPrompt;
	}
	
	// Fallback to custom system prompt or default
	return settings.prompts?.system || 'You are a helpful assistant.';
}

// Helper function to call the appropriate provider API
async function callProviderAPI(
	provider: string, 
	apiKey: string, 
	model: string, 
	userPrompt: string, 
	onToken: (partialResponse: string, done?: boolean) => void,
	settings?: any
) {
	let partial = "";
	const systemPrompt = settings ? getSystemPrompt(settings) : 'You are a helpful assistant.';
	
	if (provider === 'openai') {
		const openai = new OpenAI({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
		
		const stream = await openai.chat.completions.create({
			model: model,
			messages: [
				{ role: "system", content: systemPrompt },
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
		
		// Anthropic now supports system messages in the API
		// Try with system message first, fallback to prepending if needed
		try {
			const stream = await anthropic.messages.create({
				model: model,
				max_tokens: 4096,
				system: systemPrompt,
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
		} catch (systemError: any) {
			// If system message fails, try without it (for older API versions)
			if (systemError.message && systemError.message.includes('system')) {
				const fullPrompt = `${systemPrompt}\n\nUser: ${userPrompt}`;
				const stream = await anthropic.messages.create({
					model: model,
					max_tokens: 4096,
					messages: [
						{ role: "user", content: fullPrompt }
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
				throw systemError;
			}
		}
		// Call onToken with done=true after streaming completes
		onToken(partial, true);
		return; // Exit early since we handle streaming above
	} else {
		throw new Error(`Unsupported provider: ${provider}`)
	}
	
	onToken(partial, true);
}

// Auto-migration function that runs automatically
async function autoMigrateAPIKeys() {
	try {
		const raw = localStorage.getItem("openai_api_key");
		
		if (!raw) {
			return; // No key to migrate
		}
		
		// Check if it's already in new format
		if (raw.startsWith('{')) {
			try {
				const parsed = JSON.parse(raw);
				if (parsed.keys && (parsed.keys.openai || parsed.keys.anthropic)) {
					// Migrate invalid model names
					if (parsed.models) {
						let needsUpdate = false;
						// Migrate any invalid claude-3-5-sonnet models to claude-3-opus (which works)
						if (parsed.models.anthropic === 'claude-3-5-sonnet-20241022' || 
						    parsed.models.anthropic === 'claude-3-5-sonnet-20240620') {
							parsed.models.anthropic = 'claude-3-opus-20240229';
							needsUpdate = true;
						}
						if (needsUpdate) {
							localStorage.setItem("openai_api_key", JSON.stringify(parsed));
							console.log('🔄 Migrated invalid Anthropic model name to claude-3-opus-20240229');
						}
					}
					return; // Already migrated
				}
			} catch (e) {
				// Continue with migration
			}
		}
		
		// If it's old format (starts with sk-)
		if (raw.startsWith('sk-')) {
			// Determine which provider this key belongs to
			let provider = 'openai';
			if (raw.startsWith('sk-ant-')) {
				provider = 'anthropic';
			}
			
			const newSettings = {
				provider: provider,
				models: {
					openai: 'gpt-4o',
					anthropic: 'claude-sonnet-4-5-20250929',
					google: 'gemini-1.5-flash'
				},
				keys: {
					openai: provider === 'openai' ? raw : '',
					anthropic: provider === 'anthropic' ? raw : '',
					google: ''
				},
				prompts: {
					system: 'You are a helpful assistant.'
				}
			};
			
			localStorage.setItem("openai_api_key", JSON.stringify(newSettings));
		}
		
	} catch (e) {
		// Silently handle migration errors
	}
}

// Helper function to get default model for a provider
function getDefaultModel(provider: string): string {
	switch (provider) {
		case 'openai':
			return 'gpt-4o'
		case 'anthropic':
			// Use Claude Sonnet 4.5 as default (newest and best model)
			return 'claude-sonnet-4-5-20250929'
		default:
			return 'gpt-4o'
	}
}

// Helper function to get API key from settings for a specific provider
export function getApiKey(provider: string = 'openai'): string {
	try {
		const settings = localStorage.getItem("openai_api_key")
		
		if (settings) {
			try {
				const parsed = JSON.parse(settings)
				
				if (parsed.keys && parsed.keys[provider]) {
					const key = parsed.keys[provider];
					return key;
				}
				// Fallback to old format
				if (typeof settings === 'string' && provider === 'openai') {
					return settings;
				}
			} catch (e) {
				// Fallback to old format
				if (typeof settings === 'string' && provider === 'openai') {
					return settings;
				}
			}
		}
		return ""
	} catch (e) {
		return ""
	}
}

// Helper function to get the first available API key from any provider
export function getFirstAvailableApiKey(): string | null {
	try {
		const settings = localStorage.getItem("openai_api_key")
		if (settings) {
			const parsed = JSON.parse(settings)
			if (parsed.keys) {
				for (const [key, value] of Object.entries(parsed.keys)) {
					if (typeof value === 'string' && value.trim() !== '') {
						return value
					}
				}
			}
			// Fallback to old format
			if (typeof settings === 'string' && settings.trim() !== '') {
				return settings
			}
		}
		return null
	} catch (e) {
		return null
	}
}

// Helper function to get the first available API key and provider
export function getFirstAvailableApiKeyAndProvider(): { key: string; provider: string } | null {
	try {
		const settings = localStorage.getItem("openai_api_key")
		if (settings) {
			const parsed = JSON.parse(settings)
			if (parsed.keys) {
				for (const [provider, key] of Object.entries(parsed.keys)) {
					if (typeof key === 'string' && key.trim() !== '') {
						return { key: key as string, provider }
					}
				}
			}
			// Fallback to old format (assume OpenAI)
			if (typeof settings === 'string' && settings.trim() !== '') {
				return { key: settings, provider: 'openai' }
			}
		}
		return null
	} catch (e) {
		return null
	}
}

// Helper function to clear all invalid API keys
export function clearInvalidApiKeys() {
	try {
		localStorage.removeItem('invalid_api_keys');
		console.log('🧹 Cleared all invalid API key markers');
	} catch (e) {
		console.warn('Failed to clear invalid API keys:', e);
	}
}

// Helper function to get information about invalid API keys
export function getInvalidApiKeysInfo(): { provider: string; count: number }[] {
	try {
		const invalidKeysKey = 'invalid_api_keys';
		const stored = localStorage.getItem(invalidKeysKey);
		if (stored) {
			const invalidKeys = JSON.parse(stored);
			return Object.entries(invalidKeys).map(([provider, keys]) => ({
				provider,
				count: Array.isArray(keys) ? keys.length : 0
			}));
		}
	} catch (e) {
		// If parsing fails, return empty array
	}
	return [];
}

// Helper function to provide user guidance for API key issues
export function getApiKeyGuidance(): string {
	const invalidKeys = getInvalidApiKeysInfo();
	
	if (invalidKeys.length === 0) {
		return "All API keys appear to be valid.";
	}
	
	let guidance = "Some API keys are marked as invalid:\n";
	invalidKeys.forEach(({ provider, count }) => {
		guidance += `- ${provider}: ${count} invalid key(s)\n`;
	});
	
	guidance += "\nTo fix this:\n";
	guidance += "1. Check your API keys at the provider's website\n";
	guidance += "2. Update your API keys in the settings\n";
	guidance += "3. Or clear invalid key markers to retry them\n";
	
	return guidance;
}