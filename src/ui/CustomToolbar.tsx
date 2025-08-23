import { TldrawUiMenuItem } from "tldraw"
import { DefaultToolbar, DefaultToolbarContent } from "tldraw"
import { useTools } from "tldraw"
import { useEditor } from "tldraw"
import { useState, useEffect } from "react"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  const [isReady, setIsReady] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const { addDialog, removeDialog } = useDialogs()

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
          const { keys } = JSON.parse(settings)
          const hasValidKey = keys && Object.values(keys).some(key => typeof key === 'string' && key.trim() !== '')
          setHasApiKey(hasValidKey)
        } catch (e) {
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

  if (!isReady) return null

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "fixed",
          top: "4px",
          left: "350px",
          zIndex: 99999,
          pointerEvents: "auto",
          display: "flex",
          gap: "8px",
        }}
      >
        <button
          onClick={() => {
            addDialog({
              id: "api-keys",
              component: ({ onClose }: { onClose: () => void }) => (
                <SettingsDialog
                  onClose={() => {
                    onClose()
                    removeDialog("api-keys")
                    const settings = localStorage.getItem("openai_api_key")
                    if (settings) {
                      const { keys } = JSON.parse(settings)
                      setHasApiKey(Object.values(keys).some((key) => key))
                    }
                  }}
                />
              ),
            })
          }}
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            background: hasApiKey ? "#6B7280" : "#2F80ED",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            transition: "background 0.2s ease",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hasApiKey ? "#4B5563" : "#1366D6"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = hasApiKey ? "#6B7280" : "#2F80ED"
          }}
        >
          Keys {hasApiKey ? "✅" : "❌"}
        </button>
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
        {tools["SharedPiano"] && (
          <TldrawUiMenuItem
            {...tools["SharedPiano"]}
            icon="music"
            label="Shared Piano"
            isSelected={tools["SharedPiano"].id === editor.getCurrentToolId()}
          />
        )}
      </DefaultToolbar>
    </div>
  )
}
