import { atom } from 'tldraw'
import { SYSTEM_PROMPT, CONSTANCE_SYSTEM_PROMPT } from '@/prompt'

export const PROVIDERS = [
	{
		id: 'openai',
		name: 'OpenAI',
		models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], // 'o1-preview', 'o1-mini'],
		help: 'https://tldraw.notion.site/Make-Real-Help-93be8b5273d14f7386e14eb142575e6e#a9b75e58b1824962a1a69a2f29ace9be',
		validate: (key: string) => key.startsWith('sk-'),
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		models: [
			'claude-sonnet-4-5-20250929',
			'claude-sonnet-4-20250522',
			'claude-3-opus-20240229',
			'claude-3-sonnet-20240229',
			'claude-3-haiku-20240307',
		],
		help: 'https://tldraw.notion.site/Make-Real-Help-93be8b5273d14f7386e14eb142575e6e#3444b55a2ede405286929956d0be6e77',
		validate: (key: string) => key.startsWith('sk-'),
	},
	// { id: 'google', name: 'Google', model: 'Gemeni 1.5 Flash', validate: (key: string) => true },
]

// Ollama models available on the private AI server (no API key required)
export const OLLAMA_MODELS = [
	{
		id: 'llama3.1:70b',
		name: 'Llama 3.1 70B',
		description: 'Best quality (GPT-4 level) - ~7s response',
		size: '42 GB',
	},
	{
		id: 'llama3.1:8b',
		name: 'Llama 3.1 8B',
		description: 'Fast & capable - ~1-2s response',
		size: '4.9 GB',
	},
	{
		id: 'qwen2.5-coder:7b',
		name: 'Qwen 2.5 Coder 7B',
		description: 'Optimized for code generation',
		size: '4.7 GB',
	},
	{
		id: 'llama3.2:3b',
		name: 'Llama 3.2 3B',
		description: 'Fastest responses - <1s',
		size: '2.0 GB',
	},
]

export const AI_PERSONALITIES = [
	{
		id: 'web-developer',
		name: 'Web Developer',
		description: 'Expert web developer for building prototypes from wireframes',
		systemPrompt: SYSTEM_PROMPT,
	},
	{
		id: 'constance',
		name: 'Constance',
		description: 'Avatar of the US Constitution - helps understand constitutional principles',
		systemPrompt: CONSTANCE_SYSTEM_PROMPT,
	},
]

export const makeRealSettings = atom('make real settings', {
	provider: 'openai' as (typeof PROVIDERS)[number]['id'] | 'all',
	models: Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider.models[0]])),
	keys: {
		openai: '',
		anthropic: '',
		google: '',
	},
	ollamaModel: 'llama3.1:8b' as (typeof OLLAMA_MODELS)[number]['id'],
	personality: 'web-developer' as (typeof AI_PERSONALITIES)[number]['id'],
	prompts: {
		system: SYSTEM_PROMPT,
	},
})

export function applySettingsMigrations(settings: any) {
	const { keys, prompts, ...rest } = settings

	const settingsWithModelsProperty = {
		provider: 'openai',
		models: Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider.models[0]])),
		keys: {
			openai: '',
			anthropic: '',
			google: '',
			...keys,
		},
		ollamaModel: 'llama3.1:8b' as (typeof OLLAMA_MODELS)[number]['id'],
		personality: 'web-developer' as (typeof AI_PERSONALITIES)[number]['id'],
		prompts: {
			system: SYSTEM_PROMPT,
			...prompts,
		},
		...rest,
	}

	return settingsWithModelsProperty
}