import {
  TLUiDialogProps,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TldrawUiInput,
} from "tldraw"
import React from "react"
import { PROVIDERS, AI_PERSONALITIES } from "../lib/settings"
import { useAuth } from "../context/AuthContext"

export function SettingsDialog({ onClose }: TLUiDialogProps) {
  const { session } = useAuth()
  
  const [apiKeys, setApiKeys] = React.useState(() => {
    try {
      // First try to get user-specific API keys if logged in
      if (session.authed && session.username) {
        const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
        if (userApiKeys) {
          try {
            const parsed = JSON.parse(userApiKeys)
            if (parsed.keys) {
              return parsed.keys
            }
          } catch (e) {
            // Continue to fallback
          }
        }
      }
      
      // Fallback to global API keys
      const stored = localStorage.getItem("openai_api_key")
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed.keys) {
            return parsed.keys
          }
        } catch (e) {
          // Fallback to old format
          return { openai: stored }
        }
      }
      return { openai: '', anthropic: '', google: '' }
    } catch (e) {
      return { openai: '', anthropic: '', google: '' }
    }
  })

  const [personality, setPersonality] = React.useState(() => {
    try {
      // First try to get user-specific settings if logged in
      if (session.authed && session.username) {
        const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
        if (userApiKeys) {
          try {
            const parsed = JSON.parse(userApiKeys)
            if (parsed.personality) {
              return parsed.personality
            }
          } catch (e) {
            // Continue to fallback
          }
        }
      }
      
      // Fallback to global settings
      const stored = localStorage.getItem("openai_api_key")
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed.personality) {
            return parsed.personality
          }
        } catch (e) {
          // Continue to fallback
        }
      }
      return 'web-developer'
    } catch (e) {
      return 'web-developer'
    }
  })

  const handleKeyChange = (provider: string, value: string) => {
    const newKeys = { ...apiKeys, [provider]: value }
    setApiKeys(newKeys)
    saveSettings(newKeys, personality)
  }

  const handlePersonalityChange = (newPersonality: string) => {
    setPersonality(newPersonality)
    saveSettings(apiKeys, newPersonality)
  }

  const saveSettings = (keys: any, personalityValue: string) => {
    // Save to localStorage with the new structure
    const settings = {
      keys: keys,
      provider: 'openai', // Default provider
      models: Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider.models[0]])),
      personality: personalityValue,
    }
    
    // If user is logged in, save to user-specific storage
    if (session.authed && session.username) {
      console.log(`💾 Saving user-specific settings for ${session.username}:`, settings);
      localStorage.setItem(`${session.username}_api_keys`, JSON.stringify(settings))
      
      // Also save to global storage as fallback
      localStorage.setItem("openai_api_key", JSON.stringify(settings))
    } else {
      console.log("💾 Saving global settings to localStorage:", settings);
      localStorage.setItem("openai_api_key", JSON.stringify(settings))
    }
  }

  const validateKey = (provider: string, key: string) => {
    const providerConfig = PROVIDERS.find(p => p.id === provider)
    if (providerConfig && key.trim()) {
      return providerConfig.validate(key)
    }
    return true
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>AI Settings</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 400 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* AI Personality Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontWeight: "500", fontSize: "14px" }}>
              AI Personality
            </label>
            <select
              value={personality}
              onChange={(e) => handlePersonalityChange(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                backgroundColor: "white",
                cursor: "pointer"
              }}
            >
              {AI_PERSONALITIES.map((personality) => (
                <option key={personality.id} value={personality.id}>
                  {personality.name} - {personality.description}
                </option>
              ))}
            </select>
          </div>
          
          {/* API Keys Section */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>
              API Keys
            </h3>
          {PROVIDERS.map((provider) => (
            <div key={provider.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontWeight: "500", fontSize: "14px" }}>
                  {provider.name} API Key
                </label>
                <span style={{ 
                  fontSize: "12px", 
                  color: "#666",
                  backgroundColor: "#f3f4f6",
                  padding: "2px 6px",
                  borderRadius: "4px"
                }}>
                  {provider.models[0]}
                </span>
              </div>
              <TldrawUiInput
                value={apiKeys[provider.id] || ''}
                placeholder={`Enter your ${provider.name} API key`}
                onValueChange={(value) => handleKeyChange(provider.id, value)}
              />
              {apiKeys[provider.id] && !validateKey(provider.id, apiKeys[provider.id]) && (
                <div style={{ 
                  fontSize: "12px", 
                  color: "#ef4444",
                  marginTop: "4px"
                }}>
                  Invalid API key format
                </div>
              )}
              <div style={{ 
                fontSize: "11px", 
                color: "#666",
                lineHeight: "1.4"
              }}>
                {provider.help && (
                  <a 
                    href={provider.help} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: "#3b82f6", textDecoration: "none" }}
                  >
                    Learn more about {provider.name} setup →
                  </a>
                )}
              </div>
            </div>
          ))}
          </div> {/* Close API Keys Section */}
          
          <div style={{ 
            padding: "12px", 
            backgroundColor: "#f8fafc", 
            borderRadius: "6px",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.4" }}>
              <strong>Note:</strong> API keys are stored locally in your browser. 
              Make sure to use keys with appropriate usage limits for your needs.
            </div>
          </div>
        </div>
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter>
        <TldrawUiButton type="primary" onClick={onClose}>
          <TldrawUiButtonLabel>Close</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  )
}
