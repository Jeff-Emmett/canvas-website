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
import { PROVIDERS, AI_PERSONALITIES, OLLAMA_MODELS } from "../lib/settings"
import { useAuth } from "../context/AuthContext"
import { getOllamaConfig } from "../lib/clientConfig"

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

  const [ollamaModel, setOllamaModel] = React.useState(() => {
    try {
      // First try to get user-specific settings if logged in
      if (session.authed && session.username) {
        const userApiKeys = localStorage.getItem(`${session.username}_api_keys`)
        if (userApiKeys) {
          try {
            const parsed = JSON.parse(userApiKeys)
            if (parsed.ollamaModel) {
              return parsed.ollamaModel
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
          if (parsed.ollamaModel) {
            return parsed.ollamaModel
          }
        } catch (e) {
          // Continue to fallback
        }
      }
      return 'llama3.1:8b'
    } catch (e) {
      return 'llama3.1:8b'
    }
  })

  // Check if Ollama is configured
  const ollamaConfig = getOllamaConfig()

  const handleKeyChange = (provider: string, value: string) => {
    const newKeys = { ...apiKeys, [provider]: value }
    setApiKeys(newKeys)
    saveSettings(newKeys, personality, ollamaModel)
  }

  const handlePersonalityChange = (newPersonality: string) => {
    setPersonality(newPersonality)
    saveSettings(apiKeys, newPersonality, ollamaModel)
  }

  const handleOllamaModelChange = (newModel: string) => {
    setOllamaModel(newModel)
    saveSettings(apiKeys, personality, newModel)
  }

  const saveSettings = (keys: any, personalityValue: string, ollamaModelValue: string) => {
    // Save to localStorage with the new structure
    const settings = {
      keys: keys,
      provider: 'openai', // Default provider
      models: Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider.models[0]])),
      ollamaModel: ollamaModelValue,
      personality: personalityValue,
    }
    
    // If user is logged in, save to user-specific storage
    if (session.authed && session.username) {
      localStorage.setItem(`${session.username}_api_keys`, JSON.stringify(settings))
      
      // Also save to global storage as fallback
      localStorage.setItem("openai_api_key", JSON.stringify(settings))
    } else {
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

          {/* Ollama Model Selector - Only show if Ollama is configured */}
          {ollamaConfig && (
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>🦙</span>
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
                  Private AI Model
                </h3>
                <span style={{
                  fontSize: "11px",
                  color: "#059669",
                  backgroundColor: "#d1fae5",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontWeight: "500"
                }}>
                  FREE
                </span>
              </div>
              <p style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "12px",
                lineHeight: "1.4"
              }}>
                Running on your private server. No API key needed - select quality vs speed.
              </p>
              <select
                value={ollamaModel}
                onChange={(e) => handleOllamaModelChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  backgroundColor: "white",
                  cursor: "pointer"
                }}
              >
                {OLLAMA_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                fontSize: "11px",
                color: "#9ca3af"
              }}>
                <span>Server: {ollamaConfig.url}</span>
                <span>
                  Model size: {OLLAMA_MODELS.find(m => m.id === ollamaModel)?.size || 'Unknown'}
                </span>
              </div>
            </div>
          )}

          {/* API Keys Section */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
              Cloud API Keys
            </h3>
            <p style={{
              fontSize: "12px",
              color: "#6b7280",
              marginBottom: "16px",
              lineHeight: "1.4"
            }}>
              {ollamaConfig
                ? "Optional fallback - used when private AI is unavailable."
                : "Enter API keys to use cloud AI services."}
            </p>
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
