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
import { PROVIDERS } from "../lib/settings"

export function SettingsDialog({ onClose }: TLUiDialogProps) {
  const [apiKeys, setApiKeys] = React.useState(() => {
    try {
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

  const handleKeyChange = (provider: string, value: string) => {
    const newKeys = { ...apiKeys, [provider]: value }
    setApiKeys(newKeys)
    
    // Save to localStorage with the new structure
    const settings = {
      keys: newKeys,
      provider: provider === 'openai' ? 'openai' : provider, // Use the actual provider
      models: Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider.models[0]])),
    }
    console.log("💾 Saving settings to localStorage:", settings);
    localStorage.setItem("openai_api_key", JSON.stringify(settings))
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
        <TldrawUiDialogTitle>AI API Keys</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 400 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                style={{
                  border: validateKey(provider.id, apiKeys[provider.id] || '') 
                    ? undefined 
                    : '1px solid #ef4444'
                }}
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
