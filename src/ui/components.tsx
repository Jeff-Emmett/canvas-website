import React from "react"
import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import { FocusLockIndicator } from "./FocusLockIndicator"
import { MycelialIntelligenceBar } from "./MycelialIntelligenceBar"
import { CommandPalette } from "./CommandPalette"
import { UserSettingsModal } from "./UserSettingsModal"
import { NetworkGraphPanel } from "../components/networking"
import CryptIDDropdown from "../components/auth/CryptIDDropdown"
import StarBoardButton from "../components/StarBoardButton"
import ShareBoardButton from "../components/ShareBoardButton"
import { SettingsDialog } from "./SettingsDialog"
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  TLComponents,
  TldrawUiMenuItem,
  useTools,
  useActions,
  useDialogs,
} from "tldraw"
import { SlidesPanel } from "@/slides/SlidesPanel"

// AI tool model configurations
const AI_TOOLS = [
  { id: 'chat', name: 'Chat', icon: '💬', model: 'llama3.1:8b', provider: 'Ollama', type: 'local' },
  { id: 'make-real', name: 'Make Real', icon: '🔧', model: 'claude-sonnet-4-5', provider: 'Anthropic', type: 'cloud' },
  { id: 'image-gen', name: 'Image Gen', icon: '🎨', model: 'SDXL', provider: 'RunPod', type: 'gpu' },
  { id: 'video-gen', name: 'Video Gen', icon: '🎬', model: 'Wan2.1', provider: 'RunPod', type: 'gpu' },
  { id: 'transcription', name: 'Transcribe', icon: '🎤', model: 'Web Speech', provider: 'Browser', type: 'local' },
  { id: 'mycelial', name: 'Mycelial', icon: '🍄', model: 'llama3.1:70b', provider: 'Ollama', type: 'local' },
];

// Custom SharePanel with layout: CryptID -> Star -> Gear -> Question mark
function CustomSharePanel() {
  const tools = useTools()
  const actions = useActions()
  const { addDialog, removeDialog } = useDialogs()
  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showSettingsDropdown, setShowSettingsDropdown] = React.useState(false)
  const [showAISection, setShowAISection] = React.useState(false)
  const [hasApiKey, setHasApiKey] = React.useState(false)

  // ESC key handler for closing dropdowns
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (showSettingsDropdown) setShowSettingsDropdown(false)
        if (showShortcuts) setShowShortcuts(false)
      }
    }
    if (showSettingsDropdown || showShortcuts) {
      // Use capture phase to intercept before tldraw
      document.addEventListener('keydown', handleKeyDown, true)
    }
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [showSettingsDropdown, showShortcuts])

  // Detect dark mode - use state to trigger re-render on change
  const [isDarkMode, setIsDarkMode] = React.useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  // Check for API keys on mount
  React.useEffect(() => {
    const checkApiKeys = () => {
      const keys = localStorage.getItem('apiKeys')
      if (keys) {
        try {
          const parsed = JSON.parse(keys)
          setHasApiKey(!!(parsed.openai || parsed.anthropic || parsed.google))
        } catch {
          setHasApiKey(false)
        }
      }
    }
    checkApiKeys()
  }, [])

  const handleToggleDarkMode = () => {
    const newIsDark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light')
    setIsDarkMode(newIsDark)
  }

  const handleManageApiKeys = () => {
    setShowSettingsDropdown(false)
    addDialog({
      id: "api-keys",
      component: ({ onClose: dialogClose }: { onClose: () => void }) => (
        <SettingsDialog
          onClose={() => {
            dialogClose()
            removeDialog("api-keys")
            // Recheck API keys after dialog closes
            const keys = localStorage.getItem('apiKeys')
            if (keys) {
              try {
                const parsed = JSON.parse(keys)
                setHasApiKey(!!(parsed.openai || parsed.anthropic || parsed.google))
              } catch {
                setHasApiKey(false)
              }
            }
          }}
        />
      ),
    })
  }

  // Helper to extract label string from tldraw label (can be string or {default, menu} object)
  const getLabelString = (label: any, fallback: string): string => {
    if (typeof label === 'string') return label
    if (label && typeof label === 'object' && 'default' in label) return label.default
    return fallback
  }

  // Collect all tools and actions with keyboard shortcuts
  const allShortcuts = React.useMemo(() => {
    const shortcuts: { name: string; kbd: string; category: string }[] = []

    // Built-in tools
    const builtInTools = ['select', 'hand', 'draw', 'eraser', 'arrow', 'text', 'note', 'frame', 'geo', 'line', 'highlight', 'laser']
    builtInTools.forEach(toolId => {
      const tool = tools[toolId]
      if (tool?.kbd) {
        shortcuts.push({
          name: getLabelString(tool.label, toolId),
          kbd: tool.kbd,
          category: 'Tools'
        })
      }
    })

    // Custom tools
    const customToolIds = ['VideoChat', 'ChatBox', 'Embed', 'Slide', 'Markdown', 'MycrozineTemplate', 'Prompt', 'ObsidianNote', 'Transcription', 'Holon', 'FathomMeetings', 'ImageGen', 'VideoGen', 'Multmux']
    customToolIds.forEach(toolId => {
      const tool = tools[toolId]
      if (tool?.kbd) {
        shortcuts.push({
          name: getLabelString(tool.label, toolId),
          kbd: tool.kbd,
          category: 'Custom Tools'
        })
      }
    })

    // Built-in actions
    const builtInActionIds = ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'select-all', 'duplicate', 'group', 'ungroup', 'bring-to-front', 'send-to-back', 'zoom-in', 'zoom-out', 'zoom-to-fit', 'zoom-to-100', 'toggle-grid']
    builtInActionIds.forEach(actionId => {
      const action = actions[actionId]
      if (action?.kbd) {
        shortcuts.push({
          name: getLabelString(action.label, actionId),
          kbd: action.kbd,
          category: 'Actions'
        })
      }
    })

    // Custom actions
    const customActionIds = ['copy-link-to-current-view', 'copy-focus-link', 'unlock-camera-focus', 'revert-camera', 'lock-element', 'save-to-pdf', 'search-shapes', 'llm', 'open-obsidian-browser']
    customActionIds.forEach(actionId => {
      const action = actions[actionId]
      if (action?.kbd) {
        shortcuts.push({
          name: getLabelString(action.label, actionId),
          kbd: action.kbd,
          category: 'Custom Actions'
        })
      }
    })

    return shortcuts
  }, [tools, actions])

  // Group shortcuts by category
  const groupedShortcuts = React.useMemo(() => {
    const groups: Record<string, typeof allShortcuts> = {}
    allShortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = []
      }
      groups[shortcut.category].push(shortcut)
    })
    return groups
  }, [allShortcuts])

  // Separator component for unified menu
  const Separator = () => (
    <div style={{
      width: '1px',
      height: '20px',
      background: 'var(--color-panel-contrast)',
      opacity: 0.5,
    }} />
  )

  return (
    <div className="tlui-share-zone" draggable={false} style={{ position: 'relative' }}>
      {/* Unified menu container - grey oval */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        background: 'var(--color-muted-1)',
        borderRadius: '20px',
        border: '1px solid var(--color-panel-contrast)',
        padding: '4px 6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        {/* CryptID dropdown - leftmost */}
        <div style={{ padding: '0 4px' }}>
          <CryptIDDropdown isDarkMode={isDarkMode} />
        </div>

        <Separator />

        {/* Share board button */}
        <div style={{ padding: '0 2px' }}>
          <ShareBoardButton className="share-panel-btn" />
        </div>

        <Separator />

        {/* Star board button */}
        <div style={{ padding: '0 2px' }}>
          <StarBoardButton className="share-panel-btn" />
        </div>

        <Separator />

        {/* Settings gear button with dropdown */}
        <div style={{ position: 'relative', padding: '0 2px' }}>
          <button
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
            className="share-panel-btn"
            style={{
              background: showSettingsDropdown ? 'var(--color-muted-2)' : 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-1)',
              opacity: showSettingsDropdown ? 1 : 0.7,
              transition: 'opacity 0.15s, background 0.15s',
              pointerEvents: 'all',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = 'var(--color-muted-2)'
            }}
            onMouseLeave={(e) => {
              if (!showSettingsDropdown) {
                e.currentTarget.style.opacity = '0.7'
                e.currentTarget.style.background = 'none'
              }
            }}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          {/* Settings dropdown */}
          {showSettingsDropdown && (
            <>
              {/* Backdrop - only uses onClick, not onPointerDown */}
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99998,
                  background: 'transparent',
                }}
                onClick={() => setShowSettingsDropdown(false)}
              />
              {/* Dropdown menu */}
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: '200px',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  background: 'var(--color-panel)',
                  border: '1px solid var(--color-panel-contrast)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  zIndex: 99999,
                  padding: '8px 0',
                  pointerEvents: 'auto',
                }}
                onWheel={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Dark mode toggle */}
                <button
                  onClick={() => {
                    handleToggleDarkMode()
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-muted-2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{isDarkMode ? '🌙' : '☀️'}</span>
                    <span>Appearance</span>
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--color-muted-2)',
                    color: 'var(--color-text-3)',
                  }}>
                    {isDarkMode ? 'Dark' : 'Light'}
                  </span>
                </button>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '4px 0' }} />

                {/* AI Models expandable section */}
                <div>
                  <button
                    onClick={() => setShowAISection(!showAISection)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-muted-2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>🤖</span>
                      <span>AI Models</span>
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      style={{ transform: showAISection ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                      <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </button>

                  {showAISection && (
                    <div style={{ padding: '8px 16px', backgroundColor: 'var(--color-muted-2)' }}>
                      <p style={{ fontSize: '10px', color: 'var(--color-text-3)', marginBottom: '8px' }}>
                        Local models are free. Cloud models require API keys.
                      </p>
                      {AI_TOOLS.map((tool) => (
                        <div
                          key={tool.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--color-panel-contrast)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text)' }}>
                            <span>{tool.icon}</span>
                            <span>{tool.name}</span>
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              backgroundColor: tool.type === 'local' ? '#d1fae5' : tool.type === 'gpu' ? '#e0e7ff' : '#fef3c7',
                              color: tool.type === 'local' ? '#065f46' : tool.type === 'gpu' ? '#3730a3' : '#92400e',
                              fontWeight: 500,
                            }}
                          >
                            {tool.model}
                          </span>
                        </div>
                      ))}
                      <button
                        onClick={handleManageApiKeys}
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 500,
                          backgroundColor: 'var(--color-primary, #3b82f6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {hasApiKey ? 'Manage API Keys' : 'Add API Keys'}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '4px 0' }} />

                {/* All settings */}
                <button
                  onClick={() => {
                    setShowSettingsDropdown(false)
                    setShowSettings(true)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-muted-2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <span>All Settings...</span>
                </button>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Help/Keyboard shortcuts button - rightmost */}
        <div style={{ padding: '0 4px' }}>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="share-panel-btn"
            style={{
              background: showShortcuts ? 'var(--color-muted-2)' : 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-1)',
              opacity: showShortcuts ? 1 : 0.7,
              transition: 'opacity 0.15s, background 0.15s',
              pointerEvents: 'all',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = 'var(--color-muted-2)'
            }}
            onMouseLeave={(e) => {
              if (!showShortcuts) {
                e.currentTarget.style.opacity = '0.7'
                e.currentTarget.style.background = 'none'
              }
            }}
            title="Keyboard shortcuts (?)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts panel */}
      {showShortcuts && (
        <>
          {/* Backdrop - only uses onClick, not onPointerDown */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              background: 'transparent',
            }}
            onClick={() => setShowShortcuts(false)}
          />
          {/* Shortcuts menu */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '320px',
              maxHeight: '60vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              background: 'var(--color-panel)',
              border: '1px solid var(--color-panel-contrast)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              zIndex: 99999,
              padding: '12px 0',
              pointerEvents: 'auto',
            }}
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '8px 16px 12px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text)',
              borderBottom: '1px solid var(--color-panel-contrast)',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Keyboard Shortcuts</span>
              <button
                onClick={() => setShowShortcuts(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--color-text-3)',
                  fontSize: '16px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category} style={{ marginBottom: '12px' }}>
                <div style={{
                  padding: '4px 16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--color-text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {category}
                </div>
                {shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 16px',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: 'var(--color-text)' }}>
                      {shortcut.name.replace('tool.', '').replace('action.', '')}
                    </span>
                    <kbd style={{
                      background: 'var(--color-muted-2)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'inherit',
                      color: 'var(--color-text-1)',
                      border: '1px solid var(--color-panel-contrast)',
                    }}>
                      {shortcut.kbd.toUpperCase()}
                    </kbd>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <UserSettingsModal
          onClose={() => setShowSettings(false)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />
      )}
    </div>
  )
}

// Combined InFrontOfCanvas component for floating UI elements
function CustomInFrontOfCanvas() {
  return (
    <>
      <MycelialIntelligenceBar />
      <FocusLockIndicator />
      <CommandPalette />
      <NetworkGraphPanel />
    </>
  )
}

export const components: TLComponents = {
  Toolbar: CustomToolbar,
  MainMenu: CustomMainMenu,
  ContextMenu: CustomContextMenu,
  HelperButtons: SlidesPanel,
  SharePanel: CustomSharePanel,
  InFrontOfTheCanvas: CustomInFrontOfCanvas,
  KeyboardShortcutsDialog: (props: any) => {
    const tools = useTools()
    const actions = useActions()
    
    // Get all custom tools with keyboard shortcuts
    const customTools = [
      tools["VideoChat"],
      tools["ChatBox"],
      tools["Embed"],
      tools["Slide"],
      tools["Markdown"],
      tools["MycrozineTemplate"],
      tools["Prompt"],
      tools["ObsidianNote"],
      tools["Transcription"],
      tools["Holon"],
      tools["FathomMeetings"],
      tools["ImageGen"],
      tools["VideoGen"],
      tools["Multmux"],
      // MycelialIntelligence moved to permanent floating bar
    ].filter(tool => tool && tool.kbd)
    
    // Get all custom actions with keyboard shortcuts
    const customActions = [
      actions["zoom-in"],
      actions["zoom-out"],
      actions["zoom-to-selection"],
      actions["copy-link-to-current-view"],
      actions["copy-focus-link"],
      actions["unlock-camera-focus"],
      actions["revert-camera"],
      actions["lock-element"],
      actions["save-to-pdf"],
      actions["search-shapes"],
      actions["llm"],
      actions["open-obsidian-browser"],
    ].filter(action => action && action.kbd)
    
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        {/* Custom Tools */}
        {customTools.map(tool => (
          <TldrawUiMenuItem 
            key={tool.id} 
            id={tool.id}
            label={tool.label}
            icon={typeof tool.icon === 'string' ? tool.icon : undefined}
            kbd={tool.kbd}
            onSelect={tool.onSelect}
          />
        ))}
        
        {/* Custom Actions */}
        {customActions.map(action => (
          <TldrawUiMenuItem 
            key={action.id} 
            id={action.id}
            label={action.label}
            icon={typeof action.icon === 'string' ? action.icon : undefined}
            kbd={action.kbd}
            onSelect={action.onSelect}
          />
        ))}
        
        {/* Default content (includes standard TLDraw shortcuts) */}
        <DefaultKeyboardShortcutsDialogContent />
      </DefaultKeyboardShortcutsDialog>
    )
  },
}
