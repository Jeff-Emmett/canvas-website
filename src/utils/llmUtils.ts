import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { makeRealSettings } from "@/lib/settings";

export async function llm(
	userPrompt: string,
	onToken: (partialResponse: string, done?: boolean) => void,
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
			models: { openai: 'gpt-4o', anthropic: 'claude-3-5-sonnet-20241022' },
			keys: { openai: '', anthropic: '', google: '' }
		};
	}
	
	const availableKeys = settings.keys || {}
	
	// Get all available providers with valid keys
	const availableProviders = getAvailableProviders(availableKeys, settings);
	
	console.log(`🔍 Found ${availableProviders.length} available AI providers:`, 
		availableProviders.map(p => `${p.provider} (${p.model})`).join(', '));
	
	if (availableProviders.length === 0) {
		throw new Error("No valid API key found for any provider")
	}
	
	// Try each provider in order until one succeeds
	let lastError: Error | null = null;
	const attemptedProviders: string[] = [];
	
	for (const { provider, apiKey, model } of availableProviders) {
		try {
			console.log(`🔄 Attempting to use ${provider} API (${model})...`);
			attemptedProviders.push(provider);
			
			// Add retry logic for temporary failures
			await callProviderAPIWithRetry(provider, apiKey, model, userPrompt, onToken);
			console.log(`✅ Successfully used ${provider} API`);
			return; // Success, exit the function
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Check if it's an authentication error (401, 403) - don't retry these
			if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
				console.warn(`❌ ${provider} API authentication failed (invalid API key):`, errorMessage);
				// Mark this API key as invalid for future attempts
				markApiKeyAsInvalid(provider, apiKey);
			} else {
				console.warn(`❌ ${provider} API failed:`, errorMessage);
			}
			
			lastError = error as Error;
			// Continue to next provider
		}
	}
	
	// If we get here, all providers failed
	const attemptedList = attemptedProviders.join(', ');
	throw new Error(`All AI providers failed (attempted: ${attemptedList}). Last error: ${lastError?.message || 'Unknown error'}`);
}

// Helper function to get all available providers with their keys and models
function getAvailableProviders(availableKeys: Record<string, string>, settings: any) {
	const providers = [];
	
	// First, try the preferred provider
	if (settings.provider && availableKeys[settings.provider] && availableKeys[settings.provider].trim() !== '') {
		const apiKey = availableKeys[settings.provider];
		if (isValidApiKey(settings.provider, apiKey) && !isApiKeyInvalid(settings.provider, apiKey)) {
			providers.push({
				provider: settings.provider,
				apiKey: apiKey,
				model: settings.models[settings.provider] || getDefaultModel(settings.provider)
			});
		} else if (isApiKeyInvalid(settings.provider, apiKey)) {
			console.log(`⏭️ Skipping ${settings.provider} API key (marked as invalid)`);
		}
	}
	
	// Then add all other available providers (excluding the preferred one)
	for (const [key, value] of Object.entries(availableKeys)) {
		if (typeof value === 'string' && value.trim() !== '' && key !== settings.provider) {
			if (isValidApiKey(key, value) && !isApiKeyInvalid(key, value)) {
				providers.push({
					provider: key,
					apiKey: value,
					model: settings.models[key] || getDefaultModel(key)
				});
			} else if (isApiKeyInvalid(key, value)) {
				console.log(`⏭️ Skipping ${key} API key (marked as invalid)`);
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
	maxRetries: number = 2
) {
	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await callProviderAPI(provider, apiKey, model, userPrompt, onToken);
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

// Helper function to call the appropriate provider API
async function callProviderAPI(
	provider: string, 
	apiKey: string, 
	model: string, 
	userPrompt: string, 
	onToken: (partialResponse: string, done?: boolean) => void
) {
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
					anthropic: 'claude-3-5-sonnet-20241022',
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
			return 'claude-3-5-sonnet-20241022'
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