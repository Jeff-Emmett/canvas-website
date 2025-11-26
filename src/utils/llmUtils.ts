import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { makeRealSettings, AI_PERSONALITIES } from "@/lib/settings";
import { getRunPodConfig } from "@/lib/clientConfig";

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
		const runpodConfig = getRunPodConfig();
		if (runpodConfig && runpodConfig.apiKey && runpodConfig.endpointId) {
			// RunPod should have been added, but if not, try one more time
			console.log('⚠️ No user API keys found, but RunPod is configured - this should not happen');
		}
		throw new Error("No valid API key found for any provider. Please configure API keys in settings or set up RunPod environment variables (VITE_RUNPOD_API_KEY and VITE_RUNPOD_ENDPOINT_ID).")
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
	
	for (const providerInfo of availableProviders) {
		const { provider, apiKey, model, endpointId } = providerInfo as any;
		try {
			console.log(`🔄 Attempting to use ${provider} API (${model})...`);
			attemptedProviders.push(`${provider} (${model})`);
			
			// Add retry logic for temporary failures
			await callProviderAPIWithRetry(provider, apiKey, model, userPrompt, onToken, settings, endpointId);
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
						const providerInfo = availableProviders.find(p => p.provider === provider);
						const endpointId = (providerInfo as any)?.endpointId;
						await callProviderAPIWithRetry(provider, apiKey, fallbackModel, userPrompt, onToken, settings, endpointId);
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
	const addProviderKey = (provider: string, apiKey: string, model?: string, endpointId?: string) => {
		if (isValidApiKey(provider, apiKey) && !isApiKeyInvalid(provider, apiKey)) {
			const providerInfo: any = {
				provider: provider,
				apiKey: apiKey,
				model: model || settings.models[provider] || getDefaultModel(provider)
			};
			if (endpointId) {
				providerInfo.endpointId = endpointId;
			}
			providers.push(providerInfo);
			return true;
		} else if (isApiKeyInvalid(provider, apiKey)) {
			console.log(`⏭️ Skipping ${provider} API key (marked as invalid)`);
		}
		return false;
	};
	
	// PRIORITY 1: Check for RunPod configuration from environment variables FIRST
	// RunPod takes priority over user-configured keys
	const runpodConfig = getRunPodConfig();
	if (runpodConfig && runpodConfig.apiKey && runpodConfig.endpointId) {
		console.log('🔑 Found RunPod configuration from environment variables - using as primary AI provider');
		providers.push({
			provider: 'runpod',
			apiKey: runpodConfig.apiKey,
			endpointId: runpodConfig.endpointId,
			model: 'default' // RunPod doesn't use model selection in the same way
		});
	}
	
	// PRIORITY 2: Then add user-configured keys (they will be tried after RunPod)
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
	// These will be tried after RunPod (if RunPod was added)
	const userSpecificKeys = getUserSpecificApiKeys();
	if (userSpecificKeys.length > 0) {
		providers.push(...userSpecificKeys);
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
	endpointId?: string,
	maxRetries: number = 2
) {
	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await callProviderAPI(provider, apiKey, model, userPrompt, onToken, settings, endpointId);
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
	settings?: any,
	endpointId?: string
) {
	let partial = "";
	const systemPrompt = settings ? getSystemPrompt(settings) : 'You are a helpful assistant.';
	
	if (provider === 'runpod') {
		// RunPod API integration - uses environment variables for automatic setup
		// Get endpointId from parameter or from config
		let runpodEndpointId = endpointId;
		if (!runpodEndpointId) {
			const runpodConfig = getRunPodConfig();
			if (runpodConfig) {
				runpodEndpointId = runpodConfig.endpointId;
			}
		}
		
		if (!runpodEndpointId) {
			throw new Error('RunPod endpoint ID not configured');
		}
		
		// Try /runsync first for synchronous execution (returns output immediately)
		// Fall back to /run + polling if /runsync is not available
		const syncUrl = `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`;
		const asyncUrl = `https://api.runpod.ai/v2/${runpodEndpointId}/run`;
		
		// vLLM endpoints typically expect OpenAI-compatible format with messages array
		// But some endpoints might accept simple prompt format
		// Try OpenAI-compatible format first, as it's more standard for vLLM
		const messages = [];
		if (systemPrompt) {
			messages.push({ role: 'system', content: systemPrompt });
		}
		messages.push({ role: 'user', content: userPrompt });
		
		// Combine system prompt and user prompt for simple prompt format (fallback)
		const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${userPrompt}` : userPrompt;
		
		const requestBody = {
			input: {
				messages: messages,
				stream: false  // vLLM can handle streaming, but we'll process it synchronously for now
			}
		};
		
		console.log('📤 RunPod API: Trying synchronous endpoint first:', syncUrl);
		console.log('📤 RunPod API: Using OpenAI-compatible messages format');
		
		try {
			// First, try synchronous endpoint (/runsync) - this returns output immediately
			try {
				const syncResponse = await fetch(syncUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${apiKey}`
					},
					body: JSON.stringify(requestBody)
				});
				
				if (syncResponse.ok) {
					const syncData = await syncResponse.json();
					console.log('📥 RunPod API: Synchronous response:', JSON.stringify(syncData, null, 2));
					
					// Check if we got output directly
					if (syncData.output) {
						let responseText = '';
						if (syncData.output.choices && Array.isArray(syncData.output.choices)) {
							const choice = syncData.output.choices[0];
							if (choice && choice.message && choice.message.content) {
								responseText = choice.message.content;
							}
						} else if (typeof syncData.output === 'string') {
							responseText = syncData.output;
						} else if (syncData.output.text) {
							responseText = syncData.output.text;
						} else if (syncData.output.response) {
							responseText = syncData.output.response;
						}
						
						if (responseText) {
							console.log('✅ RunPod API: Got output from synchronous endpoint, length:', responseText.length);
							// Stream the response character by character to simulate streaming
							for (let i = 0; i < responseText.length; i++) {
								partial += responseText[i];
								onToken(partial, false);
								await new Promise(resolve => setTimeout(resolve, 10));
							}
							onToken(partial, true);
							return;
						}
					}
					
					// If sync endpoint returned a job ID, fall through to async polling
					if (syncData.id && (syncData.status === 'IN_QUEUE' || syncData.status === 'IN_PROGRESS')) {
						console.log('⏳ RunPod API: Sync endpoint returned job ID, polling:', syncData.id);
						const result = await pollRunPodJob(syncData.id, apiKey, runpodEndpointId);
						console.log('✅ RunPod API: Job completed, result length:', result.length);
						partial = result;
						onToken(partial, true);
						return;
					}
				}
			} catch (syncError) {
				console.log('⚠️ RunPod API: Synchronous endpoint not available, trying async:', syncError);
			}
			
			// Fall back to async endpoint (/run) if sync didn't work
			console.log('📤 RunPod API: Using async endpoint:', asyncUrl);
			const response = await fetch(asyncUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify(requestBody)
			});
			
			console.log('📥 RunPod API: Response status:', response.status, response.statusText);
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ RunPod API: Error response:', errorText);
				throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
			}
			
			const data = await response.json();
			console.log('📥 RunPod API: Response data:', JSON.stringify(data, null, 2));
			
			// Handle async job pattern (RunPod often returns job IDs)
			if (data.id && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS')) {
				console.log('⏳ RunPod API: Job queued/in progress, polling job ID:', data.id);
				const result = await pollRunPodJob(data.id, apiKey, runpodEndpointId);
				console.log('✅ RunPod API: Job completed, result length:', result.length);
				partial = result;
				onToken(partial, true);
				return;
			}
			
			// Handle OpenAI-compatible response format (vLLM endpoints)
			if (data.output && data.output.choices && Array.isArray(data.output.choices)) {
				console.log('📥 RunPod API: Detected OpenAI-compatible response format');
				const choice = data.output.choices[0];
				if (choice && choice.message && choice.message.content) {
					const responseText = choice.message.content;
					console.log('✅ RunPod API: Extracted content from OpenAI-compatible format, length:', responseText.length);
					
					// Stream the response character by character to simulate streaming
					for (let i = 0; i < responseText.length; i++) {
						partial += responseText[i];
						onToken(partial, false);
						// Small delay to simulate streaming
						await new Promise(resolve => setTimeout(resolve, 10));
					}
					onToken(partial, true);
					return;
				}
			}
			
			// Handle direct response
			if (data.output) {
				console.log('📥 RunPod API: Processing output:', typeof data.output, Array.isArray(data.output) ? 'array' : 'object');
				// Try to extract text from various possible response formats
				let responseText = '';
				if (typeof data.output === 'string') {
					responseText = data.output;
					console.log('✅ RunPod API: Extracted string output, length:', responseText.length);
				} else if (data.output.text) {
					responseText = data.output.text;
					console.log('✅ RunPod API: Extracted text from output.text, length:', responseText.length);
				} else if (data.output.response) {
					responseText = data.output.response;
					console.log('✅ RunPod API: Extracted response from output.response, length:', responseText.length);
				} else if (data.output.content) {
					responseText = data.output.content;
					console.log('✅ RunPod API: Extracted content from output.content, length:', responseText.length);
				} else if (Array.isArray(data.output.segments)) {
					responseText = data.output.segments.map((seg: any) => seg.text || seg).join(' ');
					console.log('✅ RunPod API: Extracted text from segments, length:', responseText.length);
				} else {
					// Fallback: stringify the output
					console.warn('⚠️ RunPod API: Unknown output format, stringifying:', Object.keys(data.output));
					responseText = JSON.stringify(data.output);
				}
				
				// Stream the response character by character to simulate streaming
				for (let i = 0; i < responseText.length; i++) {
					partial += responseText[i];
					onToken(partial, false);
					// Small delay to simulate streaming
					await new Promise(resolve => setTimeout(resolve, 10));
				}
				onToken(partial, true);
				return;
			}
			
			// Handle error response
			if (data.error) {
				console.error('❌ RunPod API: Error in response:', data.error);
				throw new Error(`RunPod API error: ${data.error}`);
			}
			
			// Check for status messages that might indicate endpoint is starting up
			if (data.status) {
				console.log('ℹ️ RunPod API: Response status:', data.status);
				if (data.status === 'STARTING' || data.status === 'PENDING') {
					console.log('⏳ RunPod API: Endpoint appears to be starting up, this may take a moment...');
					// Wait a bit and retry
					await new Promise(resolve => setTimeout(resolve, 2000));
					throw new Error('RunPod endpoint is starting up. Please wait a moment and try again.');
				}
			}
			
			console.error('❌ RunPod API: No valid response format detected. Full response:', JSON.stringify(data, null, 2));
			throw new Error('No valid response from RunPod API');
		} catch (error) {
			console.error('❌ RunPod API error:', error);
			throw error;
		}
	} else if (provider === 'openai') {
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

// Helper function to poll RunPod job status until completion
async function pollRunPodJob(
	jobId: string,
	apiKey: string,
	endpointId: string,
	maxAttempts: number = 60,
	pollInterval: number = 1000
): Promise<string> {
	const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;
	console.log('🔄 RunPod API: Starting to poll job:', jobId);
	
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const response = await fetch(statusUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${apiKey}`
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`❌ RunPod API: Poll error (attempt ${attempt + 1}/${maxAttempts}):`, response.status, errorText);
				throw new Error(`Failed to check job status: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			console.log(`🔄 RunPod API: Poll attempt ${attempt + 1}/${maxAttempts}, status:`, data.status);
			console.log(`📥 RunPod API: Full poll response:`, JSON.stringify(data, null, 2));
			
			if (data.status === 'COMPLETED') {
				console.log('✅ RunPod API: Job completed, processing output...');
				console.log('📥 RunPod API: Output structure:', typeof data.output, data.output ? Object.keys(data.output) : 'null');
				console.log('📥 RunPod API: Full data object keys:', Object.keys(data));
				
				// If no output after a couple of retries, try the stream endpoint as fallback
				if (!data.output) {
					if (attempt < 3) {
						// Only retry 2-3 times, then try stream endpoint
						console.log(`⏳ RunPod API: COMPLETED but no output yet, waiting briefly (attempt ${attempt + 1}/3)...`);
						await new Promise(resolve => setTimeout(resolve, 500));
						continue;
					}
					
					// After a few retries, try the stream endpoint as fallback
					console.log('⚠️ RunPod API: Status endpoint not returning output, trying stream endpoint...');
					try {
						const streamUrl = `https://api.runpod.ai/v2/${endpointId}/stream/${jobId}`;
						const streamResponse = await fetch(streamUrl, {
							method: 'GET',
							headers: {
								'Authorization': `Bearer ${apiKey}`
							}
						});
						
						if (streamResponse.ok) {
							const streamData = await streamResponse.json();
							console.log('📥 RunPod API: Stream endpoint response:', JSON.stringify(streamData, null, 2));
							
							if (streamData.output) {
								// Use stream endpoint output
								data.output = streamData.output;
								console.log('✅ RunPod API: Found output via stream endpoint');
							} else if (streamData.choices && Array.isArray(streamData.choices)) {
								// Handle OpenAI-compatible format from stream endpoint
								data.output = { choices: streamData.choices };
								console.log('✅ RunPod API: Found choices via stream endpoint');
							}
						} else {
							console.log(`⚠️ RunPod API: Stream endpoint returned ${streamResponse.status}`);
						}
					} catch (streamError) {
						console.log('⚠️ RunPod API: Stream endpoint not available or failed:', streamError);
					}
				}
				
				// Extract text from various possible response formats
				let result = '';
				if (typeof data.output === 'string') {
					result = data.output;
					console.log('✅ RunPod API: Extracted string output from job, length:', result.length);
				} else if (data.output?.text) {
					result = data.output.text;
					console.log('✅ RunPod API: Extracted text from output.text, length:', result.length);
				} else if (data.output?.response) {
					result = data.output.response;
					console.log('✅ RunPod API: Extracted response from output.response, length:', result.length);
				} else if (data.output?.content) {
					result = data.output.content;
					console.log('✅ RunPod API: Extracted content from output.content, length:', result.length);
				} else if (data.output?.choices && Array.isArray(data.output.choices)) {
					// Handle OpenAI-compatible response format (vLLM endpoints)
					const choice = data.output.choices[0];
					if (choice && choice.message && choice.message.content) {
						result = choice.message.content;
						console.log('✅ RunPod API: Extracted content from OpenAI-compatible format, length:', result.length);
					}
				} else if (data.output?.segments && Array.isArray(data.output.segments)) {
					result = data.output.segments.map((seg: any) => seg.text || seg).join(' ');
					console.log('✅ RunPod API: Extracted text from segments, length:', result.length);
				} else if (Array.isArray(data.output)) {
					// Handle array responses (some vLLM endpoints return arrays)
					result = data.output.map((item: any) => {
						if (typeof item === 'string') return item;
						if (item.text) return item.text;
						if (item.response) return item.response;
						return JSON.stringify(item);
					}).join('\n');
					console.log('✅ RunPod API: Extracted text from array output, length:', result.length);
					} else if (!data.output) {
						// No output field - check alternative structures or return empty
						console.warn('⚠️ RunPod API: No output field found, checking alternative structures...');
						console.log('📥 RunPod API: Full data structure:', JSON.stringify(data, null, 2));
						
						// Try checking if output is directly in data (not data.output)
						if (typeof data === 'string') {
							result = data;
							console.log('✅ RunPod API: Data itself is a string, length:', result.length);
						} else if (data.text) {
							result = data.text;
							console.log('✅ RunPod API: Found text at top level, length:', result.length);
						} else if (data.response) {
							result = data.response;
							console.log('✅ RunPod API: Found response at top level, length:', result.length);
						} else if (data.content) {
							result = data.content;
							console.log('✅ RunPod API: Found content at top level, length:', result.length);
						} else {
							// Stream endpoint already tried above (around line 848), just log that we couldn't find output
							if (attempt >= 3) {
								console.warn('⚠️ RunPod API: Could not find output in status or stream endpoint after multiple attempts');
							}
							
							// If still no result, return empty string instead of throwing error
							// This allows the UI to render something instead of failing
							if (!result) {
								console.warn('⚠️ RunPod API: No output found in response. Returning empty result.');
								console.log('📥 RunPod API: Available fields:', Object.keys(data));
								result = ''; // Return empty string so UI can render
							}
						}
					}
				
				// Return result even if empty - don't loop forever
				if (result !== undefined) {
					// Return empty string if no result found - allows UI to render
					console.log('✅ RunPod API: Returning result (may be empty):', result ? `length ${result.length}` : 'empty');
					return result || '';
				}
				
				// If we get here, no output was found - return empty string instead of looping
				console.warn('⚠️ RunPod API: No output found after checking all formats. Returning empty result.');
				return '';
			}
			
			if (data.status === 'FAILED') {
				console.error('❌ RunPod API: Job failed:', data.error || 'Unknown error');
				throw new Error(`Job failed: ${data.error || 'Unknown error'}`);
			}
			
			// Check for starting/pending status
			if (data.status === 'STARTING' || data.status === 'PENDING') {
				console.log(`⏳ RunPod API: Endpoint still starting (attempt ${attempt + 1}/${maxAttempts})...`);
			}
			
			// Job still in progress, wait and retry
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		} catch (error) {
			if (attempt === maxAttempts - 1) {
				throw error;
			}
			// Wait before retrying
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		}
	}
	
	throw new Error('Job polling timeout - job did not complete in time');
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