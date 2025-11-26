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
    }
  }
}

/**
 * Get RunPod configuration for API calls (defaults to image endpoint)
 */
export function getRunPodConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  if (!config.runpodApiKey || !config.runpodEndpointId) {
    return null
  }

  return {
    apiKey: config.runpodApiKey,
    endpointId: config.runpodEndpointId
  }
}

/**
 * Get RunPod configuration for image generation
 */
export function getRunPodImageConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()
  const endpointId = config.runpodImageEndpointId || config.runpodEndpointId

  if (!config.runpodApiKey || !endpointId) {
    return null
  }

  return {
    apiKey: config.runpodApiKey,
    endpointId: endpointId
  }
}

/**
 * Get RunPod configuration for video generation
 */
export function getRunPodVideoConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  if (!config.runpodApiKey || !config.runpodVideoEndpointId) {
    return null
  }

  return {
    apiKey: config.runpodApiKey,
    endpointId: config.runpodVideoEndpointId
  }
}

/**
 * Get RunPod configuration for text generation (vLLM)
 */
export function getRunPodTextConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  if (!config.runpodApiKey || !config.runpodTextEndpointId) {
    return null
  }

  return {
    apiKey: config.runpodApiKey,
    endpointId: config.runpodTextEndpointId
  }
}

/**
 * Get RunPod configuration for Whisper transcription
 */
export function getRunPodWhisperConfig(): { apiKey: string; endpointId: string } | null {
  const config = getClientConfig()

  if (!config.runpodApiKey || !config.runpodWhisperEndpointId) {
    return null
  }

  return {
    apiKey: config.runpodApiKey,
    endpointId: config.runpodWhisperEndpointId
  }
}

/**
 * Get Ollama configuration for local LLM
 */
export function getOllamaConfig(): { url: string } | null {
  const config = getClientConfig()

  if (!config.ollamaUrl) {
    return null
  }

  return {
    url: config.ollamaUrl
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
