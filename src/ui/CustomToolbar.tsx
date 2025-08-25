import { TldrawUiMenuItem } from "tldraw"
import { DefaultToolbar, DefaultToolbarContent } from "tldraw"
import { useTools } from "tldraw"
import { useEditor } from "tldraw"
import { useState, useEffect } from "react"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { useAuth } from "../context/AuthContext"
import LoginButton from "../components/auth/LoginButton"
import StarBoardButton from "../components/StarBoardButton"

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  const [isReady, setIsReady] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const { addDialog, removeDialog } = useDialogs()

  const { session, setSession, clearSession } = useAuth()
  const [showProfilePopup, setShowProfilePopup] = useState(false)

  useEffect(() => {
    if (editor && tools) {
      setIsReady(true)
    }
  }, [editor, tools])

  const checkApiKeys = () => {
    const settings = localStorage.getItem("openai_api_key")
  
    try {
      if (settings) {
        try {
          const parsed = JSON.parse(settings)
          if (parsed.keys) {
            // New format with multiple providers
            const hasValidKey = Object.values(parsed.keys).some(key => 
              typeof key === 'string' && key.trim() !== ''
            )
            setHasApiKey(hasValidKey)
          } else {
            // Old format - single string
            const hasValidKey = typeof settings === 'string' && settings.trim() !== ''
            setHasApiKey(hasValidKey)
          }
        } catch (e) {
          // Fallback to old format
          const hasValidKey = typeof settings === 'string' && settings.trim() !== ''
          setHasApiKey(hasValidKey)
        }
      } else {
        setHasApiKey(false)
      }
    } catch (e) {
      setHasApiKey(false)
    }
  }

  // Initial check
  useEffect(() => {
    checkApiKeys()
  }, [])

  // Periodic check
  useEffect(() => {
    const interval = setInterval(checkApiKeys, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    // Clear the session
    clearSession()
    
    // Close the popup
    setShowProfilePopup(false)
  }

  const openApiKeysDialog = () => {
    addDialog({
      id: "api-keys",
      component: ({ onClose }: { onClose: () => void }) => (
        <SettingsDialog
          onClose={() => {
            onClose()
            removeDialog("api-keys")
            checkApiKeys() // Refresh API key status
          }}
        />
      ),
    })
  }

  if (!isReady) return null

  return (
    <div style={{ position: "relative" }}>
      <div
        className="toolbar-container"
        style={{
          position: "fixed",
          top: "4px",
          right: "40px",
          zIndex: 99999,
          pointerEvents: "auto",
          display: "flex",
          gap: "6px",
          alignItems: "center",
        }}
      >
        <LoginButton className="toolbar-login-button" />
        <StarBoardButton className="toolbar-star-button" />
        
        {session.authed && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfilePopup(!showProfilePopup)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                background: "#6B7280",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                transition: "background 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                whiteSpace: "nowrap",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "22px",
                minHeight: "22px",
                boxSizing: "border-box",
                fontSize: "0.75rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#4B5563"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#6B7280"
              }}
            >
              <span style={{ fontSize: "12px" }}>
                {hasApiKey ? "🔑" : "❌"}
              </span>
              <span>{session.username}</span>
            </button>
          
            {showProfilePopup && (
              <div 
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "0",
                  width: "250px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                  padding: "16px",
                  zIndex: 100000,
                }}
              >
                <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
                  Hello, {session.username}!
                </div>
                
                {/* API Key Status */}
                <div style={{ 
                  marginBottom: "16px", 
                  padding: "12px",
                  backgroundColor: hasApiKey ? "#f0f9ff" : "#fef2f2",
                  borderRadius: "4px",
                  border: `1px solid ${hasApiKey ? "#0ea5e9" : "#f87171"}`
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    marginBottom: "8px"
                  }}>
                    <span style={{ fontWeight: "500" }}>AI API Keys</span>
                    <span style={{ fontSize: "14px" }}>
                      {hasApiKey ? "✅ Configured" : "❌ Not configured"}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: "12px", 
                    color: "#666",
                    margin: "0 0 8px 0"
                  }}>
                    {hasApiKey 
                      ? "Your AI models are ready to use" 
                      : "Configure API keys to use AI features"
                    }
                  </p>
                  <button
                    onClick={openApiKeysDialog}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      backgroundColor: hasApiKey ? "#0ea5e9" : "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "500",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hasApiKey ? "#0284c7" : "#dc2626"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = hasApiKey ? "#0ea5e9" : "#ef4444"
                    }}
                  >
                    {hasApiKey ? "Manage Keys" : "Add API Keys"}
                  </button>
                </div>
                
                <a
                  href="/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#3B82F6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    textDecoration: "none",
                    textAlign: "center",
                    marginBottom: "8px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#2563EB"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#3B82F6"
                  }}
                >
                  My Dashboard
                </a>
                
                {!session.backupCreated && (
                  <div style={{ 
                    marginBottom: "12px", 
                    fontSize: "12px", 
                    color: "#666",
                    padding: "8px",
                    backgroundColor: "#f8f8f8",
                    borderRadius: "4px"
                  }}>
                    Remember to back up your encryption keys to prevent data loss!
                  </div>
                )}
                
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#EF4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#DC2626"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#EF4444"
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <DefaultToolbar>
        <DefaultToolbarContent />
        {tools["VideoChat"] && (
          <TldrawUiMenuItem
            {...tools["VideoChat"]}
            icon="video"
            label="Video Chat"
            isSelected={tools["VideoChat"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["ChatBox"] && (
          <TldrawUiMenuItem
            {...tools["ChatBox"]}
            icon="chat"
            label="Chat"
            isSelected={tools["ChatBox"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Embed"] && (
          <TldrawUiMenuItem
            {...tools["Embed"]}
            icon="embed"
            label="Embed"
            isSelected={tools["Embed"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["SlideShape"] && (
          <TldrawUiMenuItem
            {...tools["SlideShape"]}
            icon="slides"
            label="Slide"
            isSelected={tools["SlideShape"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Markdown"] && (
          <TldrawUiMenuItem
            {...tools["Markdown"]}
            icon="markdown"
            label="Markdown"
            isSelected={tools["Markdown"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["MycrozineTemplate"] && (
          <TldrawUiMenuItem
            {...tools["MycrozineTemplate"]}
            icon="mycrozinetemplate"
            label="MycrozineTemplate"
            isSelected={
              tools["MycrozineTemplate"].id === editor.getCurrentToolId()
            }
          />
        )}
        {tools["Prompt"] && (
          <TldrawUiMenuItem
            {...tools["Prompt"]}
            icon="prompt"
            label="Prompt"
            isSelected={tools["Prompt"].id === editor.getCurrentToolId()}
          />
        )}
      </DefaultToolbar>
    </div>
  )
}
