// Utility functions for managing Fathom API key in user identity storage

/**
 * Get Fathom API key for the current user
 * Checks user-specific storage first, then falls back to global storage
 */
export function getFathomApiKey(username?: string): string | null {
  try {
    // If username is provided, check user-specific storage
    if (username) {
      const userApiKeys = localStorage.getItem(`${username}_api_keys`)
      if (userApiKeys) {
        try {
          const parsed = JSON.parse(userApiKeys)
          if (parsed.fathomApiKey && parsed.fathomApiKey.trim() !== '') {
            return parsed.fathomApiKey
          }
        } catch (e) {
          // Continue to fallback
        }
      }
      
      // Also check for standalone Fathom key with username prefix
      const standaloneKey = localStorage.getItem(`${username}_fathom_api_key`)
      if (standaloneKey && standaloneKey.trim() !== '') {
        return standaloneKey
      }
    }
    
    // Fallback to global storage
    const globalKey = localStorage.getItem('fathom_api_key')
    if (globalKey && globalKey.trim() !== '') {
      return globalKey
    }
    
    return null
  } catch (e) {
    console.error('Error getting Fathom API key:', e)
    return null
  }
}

/**
 * Save Fathom API key for the current user
 * Stores in user-specific storage if username is provided, otherwise global storage
 */
export function saveFathomApiKey(apiKey: string, username?: string): void {
  try {
    if (username) {
      // Get existing user API keys or create new object
      const userApiKeysStr = localStorage.getItem(`${username}_api_keys`)
      let userApiKeys: any = { keys: {} }
      
      if (userApiKeysStr) {
        try {
          userApiKeys = JSON.parse(userApiKeysStr)
        } catch (e) {
          // Start fresh if parsing fails
        }
      }
      
      // Add Fathom API key
      userApiKeys.fathomApiKey = apiKey
      
      // Save to user-specific storage
      localStorage.setItem(`${username}_api_keys`, JSON.stringify(userApiKeys))
      
      // Also save as standalone key for backward compatibility
      localStorage.setItem(`${username}_fathom_api_key`, apiKey)
    }
    
    // Also save to global storage for backward compatibility
    localStorage.setItem('fathom_api_key', apiKey)
  } catch (e) {
    console.error('Error saving Fathom API key:', e)
  }
}

/**
 * Remove Fathom API key for the current user
 */
export function removeFathomApiKey(username?: string): void {
  try {
    if (username) {
      // Remove from user-specific storage
      const userApiKeysStr = localStorage.getItem(`${username}_api_keys`)
      if (userApiKeysStr) {
        try {
          const userApiKeys = JSON.parse(userApiKeysStr)
          delete userApiKeys.fathomApiKey
          localStorage.setItem(`${username}_api_keys`, JSON.stringify(userApiKeys))
        } catch (e) {
          // Continue
        }
      }
      
      // Remove standalone key
      localStorage.removeItem(`${username}_fathom_api_key`)
    }
    
    // Remove from global storage
    localStorage.removeItem('fathom_api_key')
  } catch (e) {
    console.error('Error removing Fathom API key:', e)
  }
}

/**
 * Check if Fathom API key is configured for the current user
 */
export function isFathomApiKeyConfigured(username?: string): boolean {
  return getFathomApiKey(username) !== null
}

