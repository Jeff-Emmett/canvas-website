import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { makeRealSettings, AI_PERSONALITIES } from "@/lib/settings";
import { getRunPodConfig, getRunPodTextConfig, getOllamaConfig } from "@/lib/clientConfig";

export async function llm(
	userPrompt: string,
	onToken: (partialResponse: string, done?: boolean) => void,
	customSystemPromptOrPersonality?: string,
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
	
	// Check if custom system prompt or personality is provided
	// If it looks like a full system prompt (long text), store it for direct use
	// If it looks like a personality ID (short), look it up from AI_PERSONALITIES
	let customSystemPrompt: string | null = null;
	if (customSystemPromptOrPersonality) {
		// If it's longer than 100 chars, treat it as a full system prompt
		// Personality IDs are short like "web-developer", "creative-writer", etc.
		if (customSystemPromptOrPersonality.length > 100) {
			customSystemPrompt = customSystemPromptOrPersonality;
		} else {
			// It's a personality ID - look it up
			settings.personality = customSystemPromptOrPersonality;
		}
	}
	
	const availableKeys = settings.keys || {}
	
	// Get all available providers with valid keys
	const availableProviders = getAvailableProviders(availableKeys, settings);

	if (availableProviders.length === 0) {
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
			attemptedProviders.push(`${provider} (${model})`);

			// Add retry logic for temporary failures
			await callProviderAPIWithRetry(provider, apiKey, model, userPrompt, onToken, settings, endpointId, customSystemPrompt);
			return; // Success, exit the function
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Check if it's a model not found error (404) for Anthropic - try fallback models
			if (provider === 'anthropic' && (errorMessage.includes('404') || errorMessage.includes('not_found_error') || errorMessage.includes('model:'))) {
				// Try fallback models
				let fallbackSucceeded = false;
				for (const fallbackModel of anthropicFallbackModels) {
					if (fallbackModel === model) continue; // Skip the one we already tried

					try {
						attemptedProviders.push(`${provider} (${fallbackModel})`);
						const providerInfo = availableProviders.find(p => p.provider === provider);
						const endpointId = (providerInfo as any)?.endpointId;
						await callProviderAPIWithRetry(provider, apiKey, fallbackModel, userPrompt, onToken, settings, endpointId, customSystemPrompt);
						fallbackSucceeded = true;
						return; // Success, exit the function
					} catch (fallbackError) {
						// Continue to next fallback model
					}
				}

				if (!fallbackSucceeded) {
					lastError = error as Error;
				}
			} else if (errorMessage.includes('401') || errorMessage.includes('403') ||
			    errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid API key') ||
			    errorMessage.includes('expired') || errorMessage.includes('Expired')) {
				// Mark this specific API key as invalid for future attempts
				markApiKeyAsInvalid(provider, apiKey);
				lastError = error as Error;
			} else {
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
		}
		return false;
	};
	
	// PRIORITY 0: Check for Ollama configuration (FREE local AI - highest priority)
	const ollamaConfig = getOllamaConfig();
	if (ollamaConfig && ollamaConfig.url) {
		// Get the selected Ollama model from settings
		const selectedOllamaModel = settings.ollamaModel || 'llama3.1:8b';
		providers.push({
			provider: 'ollama',
			apiKey: 'ollama', // Ollama doesn't need an API key
			baseUrl: ollamaConfig.url,
			model: selectedOllamaModel
		});
	}

	// PRIORITY 1: Check for RunPod TEXT configuration from environment variables
	// RunPod vLLM text endpoint is used as fallback when Ollama is not available
	const runpodTextConfig = getRunPodTextConfig();
	if (runpodTextConfig && runpodTextConfig.apiKey && runpodTextConfig.endpointId) {
		providers.push({
			provider: 'runpod',
			apiKey: runpodTextConfig.apiKey,
			endpointId: runpodTextConfig.endpointId,
			model: 'default' // RunPod vLLM endpoint
		});
	} else {
		// Fallback to generic RunPod config if text endpoint not configured
		const runpodConfig = getRunPodConfig();
		if (runpodConfig && runpodConfig.apiKey && runpodConfig.endpointId) {
			providers.push({
				provider: 'runpod',
				apiKey: runpodConfig.apiKey,
				endpointId: runpodConfig.endpointId,
				model: 'default'
			});
		}
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
								}
							}
						}
					} catch (parseError) {
						// Silently skip invalid JSON
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
									}
								}
							}
						} catch (parseError) {
							// Continue with other users
						}
					}
				}
			} catch (parseError) {
				// Silently skip parse errors
			}
		}
	} catch (error) {
		// Silently skip errors
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
		case 'ollama':
			// Ollama doesn't require an API key - any value is valid
			return true;
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
	customSystemPrompt?: string | null,
	maxRetries: number = 2
) {
	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await callProviderAPI(provider, apiKey, model, userPrompt, onToken, settings, endpointId, customSystemPrompt);
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
	endpointId?: string,
	customSystemPrompt?: string | null
) {
	let partial = "";
	// Use custom system prompt if provided, otherwise fall back to personality-based prompt
	const systemPrompt = customSystemPrompt || (settings ? getSystemPrompt(settings) : 'You are a helpful assistant.');

	if (provider === 'ollama') {
		// Ollama API integration via AI Orchestrator
		// The orchestrator provides /api/chat endpoint that routes to local Ollama
		const ollamaConfig = getOllamaConfig();
		const baseUrl = (settings as any)?.baseUrl || ollamaConfig?.url || 'http://localhost:11434';

		const messages = [];
		if (systemPrompt) {
			messages.push({ role: 'system', content: systemPrompt });
		}
		messages.push({ role: 'user', content: userPrompt });

		try {
			// Use the AI Orchestrator's /api/chat endpoint
			const response = await fetch(`${baseUrl}/api/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: model,
					messages: messages,
					priority: 'low', // Use free Ollama
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
			}

			const data = await response.json() as Record<string, any>;

			// Extract response from AI Orchestrator format
			let responseText = '';
			if (data.message?.content) {
				responseText = data.message.content;
			} else if (data.response) {
				responseText = data.response;
			} else if (typeof data === 'string') {
				responseText = data;
			}

			if (responseText) {
				// Stream the response character by character for UX
				for (let i = 0; i < responseText.length; i++) {
					partial += responseText[i];
					onToken(partial, false);
					// Small delay to simulate streaming
					if (i % 10 === 0) {
						await new Promise(resolve => setTimeout(resolve, 5));
					}
				}
			}

			onToken(partial, true);
			return;
		} catch (error) {
			throw error;
		}
	} else if (provider === 'runpod') {
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
					const syncData = await syncResponse.json() as Record<string, any>;

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
						const result = await pollRunPodJob(syncData.id, apiKey, runpodEndpointId);
						partial = result;
						onToken(partial, true);
						return;
					}
				}
			} catch (syncError) {
				// Synchronous endpoint not available, fall back to async
			}

			// Fall back to async endpoint (/run) if sync didn't work
			const response = await fetch(asyncUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
			}

			const data = await response.json() as Record<string, any>;

			// Handle async job pattern (RunPod often returns job IDs)
			if (data.id && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS')) {
				const result = await pollRunPodJob(data.id, apiKey, runpodEndpointId);
				partial = result;
				onToken(partial, true);
				return;
			}

			// Handle OpenAI-compatible response format (vLLM endpoints)
			if (data.output && data.output.choices && Array.isArray(data.output.choices)) {
				const choice = data.output.choices[0];
				if (choice && choice.message && choice.message.content) {
					const responseText = choice.message.content;

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
				// Try to extract text from various possible response formats
				let responseText = '';
				if (typeof data.output === 'string') {
					responseText = data.output;
				} else if (data.output.text) {
					responseText = data.output.text;
				} else if (data.output.response) {
					responseText = data.output.response;
				} else if (data.output.content) {
					responseText = data.output.content;
				} else if (Array.isArray(data.output.segments)) {
					responseText = data.output.segments.map((seg: any) => seg.text || seg).join(' ');
				} else {
					// Fallback: stringify the output
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
				throw new Error(`RunPod API error: ${data.error}`);
			}

			// Check for status messages that might indicate endpoint is starting up
			if (data.status) {
				if (data.status === 'STARTING' || data.status === 'PENDING') {
					// Wait a bit and retry
					await new Promise(resolve => setTimeout(resolve, 2000));
					throw new Error('RunPod endpoint is starting up. Please wait a moment and try again.');
				}
			}

			throw new Error('No valid response from RunPod API');
		} catch (error) {
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
				throw new Error(`Failed to check job status: ${response.status} - ${errorText}`);
			}

			const data = await response.json() as Record<string, any>;

			if (data.status === 'COMPLETED') {
				// If no output after a couple of retries, try the stream endpoint as fallback
				if (!data.output) {
					if (attempt < 3) {
						// Only retry 2-3 times, then try stream endpoint
						await new Promise(resolve => setTimeout(resolve, 500));
						continue;
					}

					// After a few retries, try the stream endpoint as fallback
					try {
						const streamUrl = `https://api.runpod.ai/v2/${endpointId}/stream/${jobId}`;
						const streamResponse = await fetch(streamUrl, {
							method: 'GET',
							headers: {
								'Authorization': `Bearer ${apiKey}`
							}
						});

						if (streamResponse.ok) {
							const streamData = await streamResponse.json() as Record<string, any>;

							if (streamData.output) {
								// Use stream endpoint output
								data.output = streamData.output;
							} else if (streamData.choices && Array.isArray(streamData.choices)) {
								// Handle OpenAI-compatible format from stream endpoint
								data.output = { choices: streamData.choices };
							}
						}
					} catch (streamError) {
						// Stream endpoint not available or failed
					}
				}

				// Extract text from various possible response formats
				let result = '';
				if (typeof data.output === 'string') {
					result = data.output;
				} else if (data.output?.text) {
					result = data.output.text;
				} else if (data.output?.response) {
					result = data.output.response;
				} else if (data.output?.content) {
					result = data.output.content;
				} else if (data.output?.choices && Array.isArray(data.output.choices)) {
					// Handle OpenAI-compatible response format (vLLM endpoints)
					const choice = data.output.choices[0];
					if (choice && choice.message && choice.message.content) {
						result = choice.message.content;
					}
				} else if (data.output?.segments && Array.isArray(data.output.segments)) {
					result = data.output.segments.map((seg: any) => seg.text || seg).join(' ');
				} else if (Array.isArray(data.output)) {
					// Handle array responses (some vLLM endpoints return arrays)
					result = data.output.map((item: any) => {
						if (typeof item === 'string') return item;
						if (item.text) return item.text;
						if (item.response) return item.response;
						return JSON.stringify(item);
					}).join('\n');
				} else if (!data.output) {
					// No output field - check alternative structures or return empty
					// Try checking if output is directly in data (not data.output)
					if (typeof data === 'string') {
						result = data;
					} else if (data.text) {
						result = data.text;
					} else if (data.response) {
						result = data.response;
					} else if (data.content) {
						result = data.content;
					} else {
						// If still no result, return empty string instead of throwing error
						// This allows the UI to render something instead of failing
						result = '';
					}
				}

				// Return result even if empty - don't loop forever
				if (result !== undefined) {
					return result || '';
				}

				// If we get here, no output was found - return empty string instead of looping
				return '';
			}

			if (data.status === 'FAILED') {
				throw new Error(`Job failed: ${data.error || 'Unknown error'}`);
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
		case 'ollama':
			// Use Llama 3.1 8B as default for local Ollama
			return 'llama3.1:8b'
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