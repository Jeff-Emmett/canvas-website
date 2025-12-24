/**
 * Client-side configuration utility
 * Handles environment variables in browser environment
 */

export interface ClientConfig {
  githubToken?: string
  quartzRepo?: string
  quartzBranch?: string
  cloudflareApiKey?: string
  cloudflareAccountId?: string
  quartzApiUrl?: string
  quartzApiKey?: string
  webhookUrl?: string
  webhookSecret?: string
  openaiApiKey?: string
  runpodApiKey?: string
  runpodEndpointId?: string
  runpodImageEndpointId?: string
  runpodVideoEndpointId?: string
  runpodTextEndpointId?: string
  runpodWhisperEndpointId?: string
  ollamaUrl?: string
  geminiApiKey?: string
  falApiKey?: string
}

/**
 * Get client-side configuration
 * This works in both browser and server environments
 */
export function getClientConfig(): ClientConfig {
  // In Vite, environment variables are available via import.meta.env
  // In Next.js, NEXT_PUBLIC_ variables are available at build time
  if (typeof window !== 'undefined') {
    // Browser environment - check for Vite first, then Next.js
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // Vite environment
      return {
        githubToken: import.meta.env.VITE_GITHUB_TOKEN || import.meta.env.NEXT_PUBLIC_GITHUB_TOKEN,
        quartzRepo: import.meta.env.VITE_QUARTZ_REPO || import.meta.env.NEXT_PUBLIC_QUARTZ_REPO,
        quartzBranch: import.meta.env.VITE_QUARTZ_BRANCH || import.meta.env.NEXT_PUBLIC_QUARTZ_BRANCH,
        cloudflareApiKey: import.meta.env.VITE_CLOUDFLARE_API_KEY || import.meta.env.NEXT_PUBLIC_CLOUDFLARE_API_KEY,
        cloudflareAccountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || import.meta.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID,
        quartzApiUrl: import.meta.env.VITE_QUARTZ_API_URL || import.meta.env.NEXT_PUBLIC_QUARTZ_API_URL,
        quartzApiKey: import.meta.env.VITE_QUARTZ_API_KEY || import.meta.env.NEXT_PUBLIC_QUARTZ_API_KEY,
        webhookUrl: import.meta.env.VITE_QUARTZ_WEBHOOK_URL || import.meta.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_URL,
        webhookSecret: import.meta.env.VITE_QUARTZ_WEBHOOK_SECRET || import.meta.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET,
        openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.NEXT_PUBLIC_OPENAI_API_KEY,
        runpodApiKey: import.meta.env.VITE_RUNPOD_API_KEY || import.meta.env.NEXT_PUBLIC_RUNPOD_API_KEY,
        runpodEndpointId: import.meta.env.VITE_RUNPOD_ENDPOINT_ID || import.meta.env.VITE_RUNPOD_IMAGE_ENDPOINT_ID || import.meta.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID,
        runpodImageEndpointId: import.meta.env.VITE_RUNPOD_IMAGE_ENDPOINT_ID || import.meta.env.NEXT_PUBLIC_RUNPOD_IMAGE_ENDPOINT_ID,
        runpodVideoEndpointId: import.meta.env.VITE_RUNPOD_VIDEO_ENDPOINT_ID || import.meta.env.NEXT_PUBLIC_RUNPOD_VIDEO_ENDPOINT_ID,
        runpodTextEndpointId: import.meta.env.VITE_RUNPOD_TEXT_ENDPOINT_ID || import.meta.env.NEXT_PUBLIC_RUNPOD_TEXT_ENDPOINT_ID,
        runpodWhisperEndpointId: import.meta.env.VITE_RUNPOD_WHISPER_ENDPOINT_ID || import.meta.env.NEXT_PUBLIC_RUNPOD_WHISPER_ENDPOINT_ID,
        ollamaUrl: import.meta.env.VITE_OLLAMA_URL || import.meta.env.NEXT_PUBLIC_OLLAMA_URL,
        geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY,
        falApiKey: import.meta.env.VITE_FAL_API_KEY || import.meta.env.NEXT_PUBLIC_FAL_API_KEY,
      }
    } else {
      // Next.js environment
      return {
        githubToken: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_GITHUB_TOKEN,
        quartzRepo: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_QUARTZ_REPO,
        quartzBranch: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_QUARTZ_BRANCH,
        cloudflareApiKey: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_CLOUDFLARE_API_KEY,
        cloudflareAccountId: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID,
        quartzApiUrl: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_QUARTZ_API_URL,
        quartzApiKey: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_QUARTZ_API_KEY,
        webhookUrl: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_QUARTZ_WEBHOOK_URL,
        webhookSecret: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET,
        openaiApiKey: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_OPENAI_API_KEY,
        runpodApiKey: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_RUNPOD_API_KEY,
        runpodEndpointId: (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID,
      }
    }
  } else {
    // Server environment
    return {
      githubToken: process.env.VITE_GITHUB_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN,
      quartzRepo: process.env.VITE_QUARTZ_REPO || process.env.NEXT_PUBLIC_QUARTZ_REPO,
      quartzBranch: process.env.VITE_QUARTZ_BRANCH || process.env.NEXT_PUBLIC_QUARTZ_BRANCH,
      cloudflareApiKey: process.env.VITE_CLOUDFLARE_API_KEY || process.env.NEXT_PUBLIC_CLOUDFLARE_API_KEY,
      cloudflareAccountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID || process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID,
      quartzApiUrl: process.env.VITE_QUARTZ_API_URL || process.env.NEXT_PUBLIC_QUARTZ_API_URL,
      quartzApiKey: process.env.VITE_QUARTZ_API_KEY || process.env.NEXT_PUBLIC_QUARTZ_API_KEY,
      webhookUrl: process.env.VITE_QUARTZ_WEBHOOK_URL || process.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_URL,
      webhookSecret: process.env.VITE_QUARTZ_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET,
      runpodApiKey: process.env.VITE_RUNPOD_API_KEY || process.env.NEXT_PUBLIC_RUNPOD_API_KEY,
      runpodEndpointId: process.env.VITE_RUNPOD_ENDPOINT_ID || process.env.VITE_RUNPOD_IMAGE_ENDPOINT_ID || process.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID,
      runpodImageEndpointId: process.env.VITE_RUNPOD_IMAGE_ENDPOINT_ID || process.env.NEXT_PUBLIC_RUNPOD_IMAGE_ENDPOINT_ID,
      runpodVideoEndpointId: process.env.VITE_RUNPOD_VIDEO_ENDPOINT_ID || process.env.NEXT_PUBLIC_RUNPOD_VIDEO_ENDPOINT_ID,
      runpodTextEndpointId: process.env.VITE_RUNPOD_TEXT_ENDPOINT_ID || process.env.NEXT_PUBLIC_RUNPOD_TEXT_ENDPOINT_ID,
      runpodWhisperEndpointId: process.env.VITE_RUNPOD_WHISPER_ENDPOINT_ID || process.env.NEXT_PUBLIC_RUNPOD_WHISPER_ENDPOINT_ID,
      ollamaUrl: process.env.VITE_OLLAMA_URL || process.env.NEXT_PUBLIC_OLLAMA_URL,
      geminiApiKey: process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      falApiKey: process.env.VITE_FAL_API_KEY || process.env.NEXT_PUBLIC_FAL_API_KEY,
    }
  }
}

// Default fal.ai API key - shared for all users
const DEFAULT_FAL_API_KEY = '(REDACTED-FAL-KEY)'

// Default RunPod API key - shared across all endpoints
// This allows all users to access AI features without their own API keys
const DEFAULT_RUNPOD_API_KEY = '(REDACTED-RUNPOD-KEY)'

// Default RunPod endpoint IDs (from CLAUDE.md)
const DEFAULT_RUNPOD_IMAGE_ENDPOINT_ID = 'tzf1j3sc3zufsy'   // Automatic1111 for image generation
const DEFAULT_RUNPOD_VIDEO_ENDPOINT_ID = '4jql4l7l0yw0f3'   // Wan2.2 for video generation
const DEFAULT_RUNPOD_TEXT_ENDPOINT_ID = '03g5hz3hlo8gr2'    // vLLM for text generation
const DEFAULT_RUNPOD_WHISPER_ENDPOINT_ID = 'lrtisuv8ixbtub' // Whisper for transcription

/**
 * Get RunPod configuration for API calls (defaults to image endpoint)
 * Falls back to pre-configured endpoints if not set via environment
 */
export function getRunPodConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  const apiKey = config.runpodApiKey || DEFAULT_RUNPOD_API_KEY
  const endpointId = config.runpodEndpointId || config.runpodImageEndpointId || DEFAULT_RUNPOD_IMAGE_ENDPOINT_ID

  return {
    apiKey: apiKey,
    endpointId: endpointId
  }
}

/**
 * Get RunPod configuration for image generation
 * Falls back to pre-configured Automatic1111 endpoint
 */
export function getRunPodImageConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  const apiKey = config.runpodApiKey || DEFAULT_RUNPOD_API_KEY
  const endpointId = config.runpodImageEndpointId || config.runpodEndpointId || DEFAULT_RUNPOD_IMAGE_ENDPOINT_ID

  return {
    apiKey: apiKey,
    endpointId: endpointId
  }
}

/**
 * Get RunPod configuration for video generation
 * Falls back to pre-configured Wan2.2 endpoint
 */
export function getRunPodVideoConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  const apiKey = config.runpodApiKey || DEFAULT_RUNPOD_API_KEY
  const endpointId = config.runpodVideoEndpointId || DEFAULT_RUNPOD_VIDEO_ENDPOINT_ID

  return {
    apiKey: apiKey,
    endpointId: endpointId
  }
}

/**
 * Get RunPod configuration for text generation (vLLM)
 * Falls back to pre-configured vLLM endpoint
 */
export function getRunPodTextConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  const apiKey = config.runpodApiKey || DEFAULT_RUNPOD_API_KEY
  const endpointId = config.runpodTextEndpointId || DEFAULT_RUNPOD_TEXT_ENDPOINT_ID

  return {
    apiKey: apiKey,
    endpointId: endpointId
  }
}

/**
 * Get RunPod configuration for Whisper transcription
 * Falls back to pre-configured Whisper endpoint
 */
export function getRunPodWhisperConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  const apiKey = config.runpodApiKey || DEFAULT_RUNPOD_API_KEY
  const endpointId = config.runpodWhisperEndpointId || DEFAULT_RUNPOD_WHISPER_ENDPOINT_ID

  return {
    apiKey: apiKey,
    endpointId: endpointId
  }
}

/**
 * Get fal.ai configuration for image and video generation
 * Falls back to pre-configured API key if not set
 */
export function getFalConfig(): { apiKey: string } | null {
  const config = getClientConfig()
  const apiKey = config.falApiKey || DEFAULT_FAL_API_KEY

  return {
    apiKey: apiKey
  }
}

/**
 * Check if fal.ai integration is configured
 */
export function isFalConfigured(): boolean {
  const config = getClientConfig()
  return !!(config.falApiKey || DEFAULT_FAL_API_KEY)
}

/**
 * Get Ollama configuration for local LLM
 * Falls back to the default Netcup AI Orchestrator if not configured
 */
export function getOllamaConfig(): { url: string } | null {
  const config = getClientConfig()

  // Default to Netcup AI Orchestrator (Ollama) if not configured
  // This ensures all users have free AI access without needing their own API keys
  const ollamaUrl = config.ollamaUrl || 'https://ai.jeffemmett.com'

  return {
    url: ollamaUrl
  }
}

/**
 * Check if RunPod integration is configured
 */
export function isRunPodConfigured(): boolean {
  const config = getClientConfig()
  return !!(config.runpodApiKey && config.runpodEndpointId)
}

/**
 * Check if GitHub integration is configured
 */
export function isGitHubConfigured(): boolean {
  const config = getClientConfig()
  return !!(config.githubToken && config.quartzRepo)
}

/**
 * Get GitHub configuration for API calls
 */
export function getGitHubConfig(): { token: string; repo: string; branch: string } | null {
  const config = getClientConfig()
  
  if (!config.githubToken || !config.quartzRepo) {
    return null
  }
  
  const [owner, repo] = config.quartzRepo.split('/')
  if (!owner || !repo) {
    return null
  }
  
  return {
    token: config.githubToken,
    repo: config.quartzRepo,
    branch: config.quartzBranch || 'main'
  }
}

/**
 * Check if OpenAI integration is configured
 * Reads from user profile settings (localStorage) instead of environment variables
 */
export function isOpenAIConfigured(): boolean {
  try {
    // First try to get user-specific API keys if available
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    if (session.authed && session.username) {
      const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
      if (userApiKeys) {
        try {
          const parsed = JSON.parse(userApiKeys)
          if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
            return true
          }
        } catch (e) {
          // Continue to fallback
        }
      }
    }
    
    // Fallback to global API keys
    const settings = localStorage.getItem("openai_api_key")
    if (settings) {
      try {
        const parsed = JSON.parse(settings)
        if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
          return true
        }
      } catch (e) {
        // If it's not JSON, it might be the old format (just a string)
        if (settings.startsWith('sk-') && settings.trim() !== '') {
          return true
        }
      }
    }
    return false
  } catch (e) {
    return false
  }
}

/**
 * Get OpenAI API key for API calls
 * Reads from user profile settings (localStorage) instead of environment variables
 */
export function getOpenAIConfig(): { apiKey: string } | null {
  try {
    // First try to get user-specific API keys if available
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    if (session.authed && session.username) {
      const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
      if (userApiKeys) {
        try {
          const parsed = JSON.parse(userApiKeys)
          if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
            console.log('🔑 Found user-specific OpenAI API key')
            return { apiKey: parsed.keys.openai }
          }
        } catch (e) {
          console.log('🔑 Error parsing user-specific API keys:', e)
        }
      }
    }
    
    // Fallback to global API keys
    const settings = localStorage.getItem("openai_api_key")
    if (settings) {
      try {
        const parsed = JSON.parse(settings)
        if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
          console.log('🔑 Found global OpenAI API key')
          return { apiKey: parsed.keys.openai }
        }
      } catch (e) {
        // If it's not JSON, it might be the old format (just a string)
        if (settings.startsWith('sk-') && settings.trim() !== '') {
          console.log('🔑 Found old format OpenAI API key')
          return { apiKey: settings }
        }
      }
    }
    
    console.log('🔑 No OpenAI API key found')
    return null
  } catch (e) {
    console.log('🔑 Error getting OpenAI config:', e)
    return null
  }
}

/**
 * Check if Gemini integration is configured
 * Reads from user profile settings (localStorage) or environment variables
 */
export function isGeminiConfigured(): boolean {
  try {
    // First try to get user-specific API keys if available
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    if (session.authed && session.username) {
      const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
      if (userApiKeys) {
        try {
          const parsed = JSON.parse(userApiKeys)
          if (parsed.keys && parsed.keys.gemini && parsed.keys.gemini.trim() !== '') {
            return true
          }
        } catch (e) {
          // Continue to fallback
        }
      }
    }

    // Fallback to global API keys
    const settings = localStorage.getItem("gemini_api_key")
    if (settings && settings.trim() !== '') {
      return true
    }

    // Check environment variable
    const config = getClientConfig()
    if (config.geminiApiKey && config.geminiApiKey.trim() !== '') {
      return true
    }

    return false
  } catch (e) {
    return false
  }
}

/**
 * Get Gemini API key for API calls
 * Reads from user profile settings (localStorage) or environment variables
 */
export function getGeminiConfig(): { apiKey: string } | null {
  try {
    // First try to get user-specific API keys if available
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    if (session.authed && session.username) {
      const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
      if (userApiKeys) {
        try {
          const parsed = JSON.parse(userApiKeys)
          if (parsed.keys && parsed.keys.gemini && parsed.keys.gemini.trim() !== '') {
            console.log('🔑 Found user-specific Gemini API key')
            return { apiKey: parsed.keys.gemini }
          }
        } catch (e) {
          console.log('🔑 Error parsing user-specific API keys:', e)
        }
      }
    }

    // Fallback to global API keys in localStorage
    const settings = localStorage.getItem("gemini_api_key")
    if (settings && settings.trim() !== '') {
      console.log('🔑 Found global Gemini API key in localStorage')
      return { apiKey: settings }
    }

    // Fallback to environment variable
    const config = getClientConfig()
    if (config.geminiApiKey && config.geminiApiKey.trim() !== '') {
      console.log('🔑 Found Gemini API key in environment')
      return { apiKey: config.geminiApiKey }
    }

    console.log('🔑 No Gemini API key found')
    return null
  } catch (e) {
    console.log('🔑 Error getting Gemini config:', e)
    return null
  }
}
