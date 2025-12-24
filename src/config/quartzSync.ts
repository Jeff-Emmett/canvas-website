/**
 * Quartz Sync Configuration
 * Centralized configuration for all Quartz sync methods
 */

export interface QuartzSyncSettings {
  // GitHub Integration
  github: {
    enabled: boolean
    token?: string
    repository?: string
    branch?: string
    autoCommit?: boolean
    commitMessage?: string
  }
  
  // Cloudflare Integration
  cloudflare: {
    enabled: boolean
    apiKey?: string
    accountId?: string
    r2Bucket?: string
    durableObjectId?: string
  }
  
  // Direct Quartz API
  quartzApi: {
    enabled: boolean
    baseUrl?: string
    apiKey?: string
  }
  
  // Webhook Integration
  webhook: {
    enabled: boolean
    url?: string
    secret?: string
  }
  
  // Fallback Options
  fallback: {
    localStorage: boolean
    download: boolean
    console: boolean
  }
}

export const defaultQuartzSyncSettings: QuartzSyncSettings = {
  github: {
    enabled: true,
    repository: 'Jeff-Emmett/quartz',
    branch: 'main',
    autoCommit: true,
    commitMessage: 'Update note: {title}'
  },
  cloudflare: {
    enabled: false  // Disabled by default, enable if needed
  },
  quartzApi: {
    enabled: false
  },
  webhook: {
    enabled: false
  },
  fallback: {
    localStorage: true,
    download: true,
    console: true
  }
}

/**
 * Get Quartz sync settings from environment variables and localStorage
 */
export function getQuartzSyncSettings(): QuartzSyncSettings {
  const settings = { ...defaultQuartzSyncSettings }
  
  // GitHub settings
  if (process.env.NEXT_PUBLIC_GITHUB_TOKEN) {
    settings.github.token = process.env.NEXT_PUBLIC_GITHUB_TOKEN
  }
  if (process.env.NEXT_PUBLIC_QUARTZ_REPO) {
    settings.github.repository = process.env.NEXT_PUBLIC_QUARTZ_REPO
  }
  
  // Cloudflare settings
  if (process.env.NEXT_PUBLIC_CLOUDFLARE_API_KEY) {
    settings.cloudflare.apiKey = process.env.NEXT_PUBLIC_CLOUDFLARE_API_KEY
  }
  if (process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID) {
    settings.cloudflare.accountId = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID
  }
  if (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET) {
    settings.cloudflare.r2Bucket = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET
  }
  
  // Quartz API settings
  if (process.env.NEXT_PUBLIC_QUARTZ_API_URL) {
    settings.quartzApi.baseUrl = process.env.NEXT_PUBLIC_QUARTZ_API_URL
    settings.quartzApi.enabled = true
  }
  if (process.env.NEXT_PUBLIC_QUARTZ_API_KEY) {
    settings.quartzApi.apiKey = process.env.NEXT_PUBLIC_QUARTZ_API_KEY
  }
  
  // Webhook settings
  if (process.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_URL) {
    settings.webhook.url = process.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_URL
    settings.webhook.enabled = true
  }
  if (process.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET) {
    settings.webhook.secret = process.env.NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET
  }
  
  // Load user preferences from localStorage
  try {
    const userSettings = localStorage.getItem('quartz_sync_settings')
    if (userSettings) {
      const parsed = JSON.parse(userSettings)
      Object.assign(settings, parsed)
    }
  } catch (error) {
    console.warn('Failed to load user Quartz sync settings:', error)
  }
  
  return settings
}

/**
 * Save Quartz sync settings to localStorage
 */
export function saveQuartzSyncSettings(settings: Partial<QuartzSyncSettings>): void {
  try {
    const currentSettings = getQuartzSyncSettings()
    const newSettings = { ...currentSettings, ...settings }
    localStorage.setItem('quartz_sync_settings', JSON.stringify(newSettings))
  } catch (error) {
    console.error('❌ Failed to save Quartz sync settings:', error)
  }
}

/**
 * Check if any sync methods are available
 */
export function hasAvailableSyncMethods(): boolean {
  const settings = getQuartzSyncSettings()
  
  return Boolean(
    (settings.github.enabled && settings.github.token && settings.github.repository) ||
    (settings.cloudflare.enabled && settings.cloudflare.apiKey && settings.cloudflare.accountId) ||
    (settings.quartzApi.enabled && settings.quartzApi.baseUrl) ||
    (settings.webhook.enabled && settings.webhook.url)
  )
}
