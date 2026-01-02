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

// ============================================================================
// IMPORTANT: API keys are now stored server-side only!
// All AI service calls go through the Cloudflare Worker proxy at /api/fal/* and /api/runpod/*
// This prevents exposing API keys in the browser
// ============================================================================

/**
 * Get the worker API URL for proxied requests
 * Uses centralized WORKER_URL configuration based on VITE_WORKER_ENV:
 * - local: localhost:5172
 * - dev: jeffemmett-canvas-dev.jeffemmett.workers.dev
 * - staging: jeffemmett-canvas-dev.jeffemmett.workers.dev
 * - production: jeffemmett-canvas.jeffemmett.workers.dev
 */
export function getWorkerApiUrl(): string {
  // Check for explicit worker URL override (useful for development)
  const workerUrl = import.meta.env.VITE_WORKER_URL
  if (workerUrl) {
    return workerUrl
  }

  // Determine worker URL based on VITE_WORKER_ENV
  // This mirrors the logic in src/constants/workerUrl.ts
  const workerEnv = import.meta.env.VITE_WORKER_ENV || 'production'

  const workerUrls: Record<string, string> = {
    local: typeof window !== 'undefined' ? `http://${window.location.hostname}:5172` : 'http://localhost:5172',
    dev: 'https://jeffemmett-canvas-automerge-dev.jeffemmett.workers.dev',
    staging: 'https://jeffemmett-canvas-automerge-dev.jeffemmett.workers.dev',
    production: 'https://jeffemmett-canvas.jeffemmett.workers.dev'
  }

  return workerUrls[workerEnv] || workerUrls.production
}

/**
 * Get RunPod proxy configuration
 * All RunPod calls now go through the Cloudflare Worker proxy
 * API keys are stored server-side, never exposed to the browser
 */
export function getRunPodProxyConfig(type: 'image' | 'video' | 'text' | 'whisper' = 'image'): {
  proxyUrl: string
  endpointType: string
} {
  const workerUrl = getWorkerApiUrl()
  return {
    proxyUrl: `${workerUrl}/api/runpod/${type}`,
    endpointType: type
  }
}

/**
 * Get RunPod configuration for API calls (defaults to image endpoint)
 * @deprecated Use getRunPodProxyConfig() instead - API keys are now server-side
 */
export function getRunPodConfig(): { proxyUrl: string } {
  return { proxyUrl: `${getWorkerApiUrl()}/api/runpod/image` }
}

/**
 * Get RunPod configuration for image generation
 * @deprecated Use getRunPodProxyConfig('image') instead
 */
export function getRunPodImageConfig(): { proxyUrl: string } {
  return getRunPodProxyConfig('image')
}

/**
 * Get RunPod configuration for video generation
 * @deprecated Use getRunPodProxyConfig('video') instead
 */
export function getRunPodVideoConfig(): { proxyUrl: string } {
  return getRunPodProxyConfig('video')
}

/**
 * Get RunPod configuration for text generation (vLLM)
 * @deprecated Use getRunPodProxyConfig('text') instead
 */
export function getRunPodTextConfig(): { proxyUrl: string } {
  return getRunPodProxyConfig('text')
}

/**
 * Get RunPod configuration for Whisper transcription
 * @deprecated Use getRunPodProxyConfig('whisper') instead
 */
export function getRunPodWhisperConfig(): { proxyUrl: string } {
  return getRunPodProxyConfig('whisper')
}

/**
 * Get fal.ai proxy configuration
 * All fal.ai calls now go through the Cloudflare Worker proxy
 * API keys are stored server-side, never exposed to the browser
 */
export function getFalProxyConfig(): { proxyUrl: string } {
  const workerUrl = getWorkerApiUrl()
  return { proxyUrl: `${workerUrl}/api/fal` }
}

/**
 * Get fal.ai configuration for image and video generation
 * @deprecated API keys are now server-side. Use getFalProxyConfig() for proxy URL.
 */
export function getFalConfig(): { proxyUrl: string } {
  return getFalProxyConfig()
}

/**
 * Check if fal.ai integration is configured
 * Now always returns true since the proxy handles configuration
 */
export function isFalConfigured(): boolean {
  return true // Proxy is always available, server-side config determines availability
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
 * Now always returns true since the proxy handles configuration
 */
export function isRunPodConfigured(): boolean {
  return true // Proxy is always available, server-side config determines availability
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
            return { apiKey: parsed.keys.openai }
          }
        } catch (e) {
        }
      }
    }
    
    // Fallback to global API keys
    const settings = localStorage.getItem("openai_api_key")
    if (settings) {
      try {
        const parsed = JSON.parse(settings)
        if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
          return { apiKey: parsed.keys.openai }
        }
      } catch (e) {
        // If it's not JSON, it might be the old format (just a string)
        if (settings.startsWith('sk-') && settings.trim() !== '') {
          return { apiKey: settings }
        }
      }
    }
    
    return null
  } catch (e) {
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
            return { apiKey: parsed.keys.gemini }
          }
        } catch (e) {
        }
      }
    }

    // Fallback to global API keys in localStorage
    const settings = localStorage.getItem("gemini_api_key")
    if (settings && settings.trim() !== '') {
      return { apiKey: settings }
    }

    // Fallback to environment variable
    const config = getClientConfig()
    if (config.geminiApiKey && config.geminiApiKey.trim() !== '') {
      return { apiKey: config.geminiApiKey }
    }

    return null
  } catch (e) {
    return null
  }
}
