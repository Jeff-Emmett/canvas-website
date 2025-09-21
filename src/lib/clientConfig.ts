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
    }
  }
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
    const settings = localStorage.getItem("openai_api_key")
    if (settings) {
      const parsed = JSON.parse(settings)
      if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
        return true
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
    const settings = localStorage.getItem("openai_api_key")
    if (settings) {
      const parsed = JSON.parse(settings)
      if (parsed.keys && parsed.keys.openai && parsed.keys.openai.trim() !== '') {
        return { apiKey: parsed.keys.openai }
      }
    }
    return null
  } catch (e) {
    return null
  }
}
