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
	
	// Determine which provider to use based on available keys
	let provider: string | null = null
	let apiKey: string | null = null
	
	// Check if we have a preferred provider with a valid key
	if (settings.provider && availableKeys[settings.provider as keyof typeof availableKeys] && availableKeys[settings.provider as keyof typeof availableKeys].trim() !== '') {
		provider = settings.provider
		apiKey = availableKeys[settings.provider as keyof typeof availableKeys]
	} else {
		// Fallback: use the first available provider with a valid key
		for (const [key, value] of Object.entries(availableKeys)) {
			if (typeof value === 'string' && value.trim() !== '') {
				provider = key
				apiKey = value
				break
			}
		}
	}
	
	if (!provider || !apiKey) {
		// Try to get keys directly from localStorage as fallback
		try {
			const directSettings = localStorage.getItem("openai_api_key");
			if (directSettings) {
				// Check if it's the old format (just a string)
				if (directSettings.startsWith('sk-') && !directSettings.startsWith('{')) {
					// This is an old format OpenAI key, use it
					provider = 'openai';
					apiKey = directSettings;
				} else {
					// Try to parse as JSON
					try {
						const parsed = JSON.parse(directSettings);
						if (parsed.keys) {
							for (const [key, value] of Object.entries(parsed.keys)) {
								if (typeof value === 'string' && value.trim() !== '') {
									provider = key;
									apiKey = value;
									break;
								}
							}
						}
					} catch (parseError) {
						// If it's not JSON and starts with sk-, treat as old format OpenAI key
						if (directSettings.startsWith('sk-')) {
							provider = 'openai';
							apiKey = directSettings;
						}
					}
				}
			}
		} catch (e) {
			// Continue with error handling
		}
		
		if (!provider || !apiKey) {
			throw new Error("No valid API key found for any provider")
		}
	}
	
	const model = settings.models[provider] || getDefaultModel(provider)
	let partial = "";
	
	try {
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
		
	} catch (error) {
		throw error;
	}
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