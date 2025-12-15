import React from "react"
import { createPortal } from "react-dom"
import { useParams } from "react-router-dom"
import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import { FocusLockIndicator } from "./FocusLockIndicator"
import { MycelialIntelligenceBar } from "./MycelialIntelligenceBar"
import { CommandPalette } from "./CommandPalette"
import { NetworkGraphPanel } from "../components/networking"
import CryptIDDropdown from "../components/auth/CryptIDDropdown"
import StarBoardButton from "../components/StarBoardButton"
import ShareBoardButton from "../components/ShareBoardButton"
import BoardSettingsDropdown from "../components/BoardSettingsDropdown"
import { SettingsDialog } from "./SettingsDialog"
// import { VersionHistoryPanel } from "../components/history" // TODO: Re-enable when version reversion is ready
import { useAuth } from "../context/AuthContext"
import { PermissionLevel } from "../lib/auth/types"
import { WORKER_URL } from "../constants/workerUrl"
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

// Permission labels and colors
const PERMISSION_CONFIG: Record<PermissionLevel, { label: string; color: string; icon: string }> = {
  view: { label: 'View Only', color: '#6b7280', icon: '👁️' },
  edit: { label: 'Edit', color: '#3b82f6', icon: '✏️' },
  admin: { label: 'Admin', color: '#10b981', icon: '👑' },
}

// Custom SharePanel with layout: CryptID -> Star -> Gear -> Question mark
function CustomSharePanel() {
  const tools = useTools()
  const actions = useActions()
  const { addDialog, removeDialog } = useDialogs()
  const { session } = useAuth()
  const { slug } = useParams<{ slug: string }>()
  const boardId = slug || 'mycofi33'

  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const [showSettingsDropdown, setShowSettingsDropdown] = React.useState(false)
  // const [showVersionHistory, setShowVersionHistory] = React.useState(false) // TODO: Re-enable when version reversion is ready
  const [showAISection, setShowAISection] = React.useState(false)
  const [hasApiKey, setHasApiKey] = React.useState(false)
  const [permissionRequestStatus, setPermissionRequestStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [requestMessage, setRequestMessage] = React.useState('')

  // Refs for dropdown positioning
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null)
  const shortcutsButtonRef = React.useRef<HTMLButtonElement>(null)
  const [settingsDropdownPos, setSettingsDropdownPos] = React.useState<{ top: number; right: number } | null>(null)
  const [shortcutsDropdownPos, setShortcutsDropdownPos] = React.useState<{ top: number; right: number } | null>(null)

  // Get current permission from session
  // Authenticated users default to 'edit', unauthenticated to 'view'
  const currentPermission: PermissionLevel = session.currentBoardPermission || (session.authed ? 'edit' : 'view')

  // Request permission upgrade
  const handleRequestPermission = async (requestedLevel: PermissionLevel) => {
    if (!session.authed || !session.username) {
      setRequestMessage('Please sign in to request permissions')
      return
    }

    setPermissionRequestStatus('sending')
    try {
      const response = await fetch(`${WORKER_URL}/boards/${boardId}/permission-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: session.username,
          email: session.email,
          requestedPermission: requestedLevel,
          currentPermission,
          boardId,
        }),
      })

      if (response.ok) {
        setPermissionRequestStatus('sent')
        setRequestMessage(`Request for ${PERMISSION_CONFIG[requestedLevel].label} access sent to board admins`)
        setTimeout(() => {
          setPermissionRequestStatus('idle')
          setRequestMessage('')
        }, 5000)
      } else {
        throw new Error('Failed to send request')
      }
    } catch (error) {
      console.error('Permission request error:', error)
      setPermissionRequestStatus('error')
      setRequestMessage('Failed to send request. Please try again.')
      setTimeout(() => {
        setPermissionRequestStatus('idle')
        setRequestMessage('')
      }, 3000)
    }
  }

  // Update dropdown positions when they open
  React.useEffect(() => {
    if (showSettingsDropdown && settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect()
      setSettingsDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showSettingsDropdown])

  React.useEffect(() => {
    if (showShortcuts && shortcutsButtonRef.current) {
      const rect = shortcutsButtonRef.current.getBoundingClientRect()
      setShortcutsDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showShortcuts])

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

    // Custom tools (VideoGen and Map temporarily hidden)
    const customToolIds = ['VideoChat', 'ChatBox', 'Embed', 'Slide', 'Markdown', 'MycrozineTemplate', 'Prompt', 'ObsidianNote', 'Transcription', 'Holon', 'FathomMeetings', 'ImageGen', 'Multmux']
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
        background: isDarkMode ? '#2d2d2d' : '#f3f4f6',
        backgroundColor: isDarkMode ? '#2d2d2d' : '#f3f4f6',
        backdropFilter: 'none',
        opacity: 1,
        borderRadius: '20px',
        border: `1px solid ${isDarkMode ? '#404040' : '#e5e7eb'}`,
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

        {/* Board settings (protection toggle, editor management) */}
        <div style={{ padding: '0 2px' }}>
          <BoardSettingsDropdown className="share-panel-btn" />
        </div>

        <Separator />

        {/* Star board button */}
        <div style={{ padding: '0 2px' }}>
          <StarBoardButton className="share-panel-btn" />
        </div>

        <Separator />

        {/* Settings gear button with dropdown */}
        <div style={{ padding: '0 2px' }}>
          <button
            ref={settingsButtonRef}
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

          {/* Settings dropdown - rendered via portal to break out of parent container */}
          {showSettingsDropdown && settingsDropdownPos && createPortal(
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
                  position: 'fixed',
                  top: settingsDropdownPos.top,
                  right: settingsDropdownPos.right,
                  minWidth: '220px',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  background: 'var(--color-panel)',
                  backgroundColor: 'var(--color-panel)',
                  border: '1px solid var(--color-panel-contrast)',
                  borderRadius: '8px',
                  boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.25)',
                  zIndex: 99999,
                  padding: '8px 0',
                  pointerEvents: 'auto',
                  backdropFilter: 'none',
                  opacity: 1,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
                onWheel={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Board Permission Section */}
                <div style={{ padding: '12px 16px 16px' }}>
                  {/* Section Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--color-panel-contrast)',
                  }}>
                    <span style={{ fontSize: '14px' }}>🔐</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Board Permission</span>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: `${PERMISSION_CONFIG[currentPermission].color}20`,
                      color: PERMISSION_CONFIG[currentPermission].color,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}>
                      {PERMISSION_CONFIG[currentPermission].label}
                    </span>
                  </div>

                  {/* Permission levels - indented to show hierarchy */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginLeft: '4px',
                    padding: '8px 12px',
                    background: 'var(--color-muted-2)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-panel-contrast)',
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-3)', marginBottom: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Access Levels
                    </span>
                    {(['view', 'edit', 'admin'] as PermissionLevel[]).map((level) => {
                      const config = PERMISSION_CONFIG[level]
                      const isCurrent = currentPermission === level
                      const canRequest = session.authed && !isCurrent && (
                        (level === 'edit' && currentPermission === 'view') ||
                        (level === 'admin' && currentPermission !== 'admin')
                      )

                      return (
                        <div
                          key={level}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: isCurrent ? `${config.color}15` : 'var(--color-panel)',
                            border: isCurrent ? `2px solid ${config.color}` : '1px solid var(--color-panel-contrast)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            color: isCurrent ? config.color : 'var(--color-text)',
                            fontWeight: isCurrent ? 600 : 400,
                          }}>
                            <span style={{ fontSize: '14px' }}>{config.icon}</span>
                            <span>{config.label}</span>
                            {isCurrent && (
                              <span style={{
                                fontSize: '9px',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                background: config.color,
                                color: 'white',
                                fontWeight: 500,
                              }}>
                                Current
                              </span>
                            )}
                          </span>

                          {canRequest && (
                            <button
                              onClick={() => handleRequestPermission(level)}
                              disabled={permissionRequestStatus === 'sending'}
                              style={{
                                padding: '4px 10px',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: `1px solid ${config.color}`,
                                background: 'transparent',
                                color: config.color,
                                cursor: permissionRequestStatus === 'sending' ? 'wait' : 'pointer',
                                opacity: permissionRequestStatus === 'sending' ? 0.6 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = config.color
                                e.currentTarget.style.color = 'white'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.color = config.color
                              }}
                            >
                              {permissionRequestStatus === 'sending' ? '...' : 'Request'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Request status message */}
                  {requestMessage && (
                    <p style={{
                      margin: '10px 0 0',
                      fontSize: '11px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: permissionRequestStatus === 'sent' ? '#d1fae5' :
                                 permissionRequestStatus === 'error' ? '#fee2e2' : 'var(--color-muted-2)',
                      color: permissionRequestStatus === 'sent' ? '#065f46' :
                             permissionRequestStatus === 'error' ? '#dc2626' : 'var(--color-text-3)',
                      textAlign: 'center',
                    }}>
                      {requestMessage}
                    </p>
                  )}

                  {!session.authed && (
                    <p style={{
                      margin: '10px 0 0',
                      fontSize: '10px',
                      color: 'var(--color-text-3)',
                      textAlign: 'center',
                      fontStyle: 'italic',
                    }}>
                      Sign in to request higher permissions
                    </p>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* Appearance Toggle */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                      <span style={{ fontSize: '14px' }}>🎨</span>
                      <span>Appearance</span>
                    </span>

                    {/* Toggle Switch */}
                    <button
                      onClick={handleToggleDarkMode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0',
                        padding: '3px',
                        background: isDarkMode ? '#374151' : '#e5e7eb',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {/* Sun icon */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: !isDarkMode ? '#ffffff' : 'transparent',
                        boxShadow: !isDarkMode ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        transition: 'all 0.2s ease',
                        fontSize: '14px',
                      }}>
                        ☀️
                      </span>
                      {/* Moon icon */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isDarkMode ? '#1f2937' : 'transparent',
                        boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                        transition: 'all 0.2s ease',
                        fontSize: '14px',
                      }}>
                        🌙
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* AI Models Accordion */}
                <div>
                  <button
                    onClick={() => setShowAISection(!showAISection)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: showAISection ? 'var(--color-muted-2)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!showAISection) e.currentTarget.style.background = 'var(--color-muted-2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!showAISection) e.currentTarget.style.background = 'none'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>🤖</span>
                      <span>AI Models</span>
                      <span style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: 'var(--color-muted-2)',
                        color: 'var(--color-text-3)',
                      }}>
                        {AI_TOOLS.length}
                      </span>
                    </span>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      background: showAISection ? 'var(--color-panel)' : 'var(--color-muted-2)',
                      transition: 'all 0.2s ease',
                    }}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        style={{
                          transform: showAISection ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          color: 'var(--color-text-3)',
                        }}
                      >
                        <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </span>
                  </button>

                  {showAISection && (
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--color-muted-2)',
                      borderTop: '1px solid var(--color-panel-contrast)',
                    }}>
                      <p style={{
                        fontSize: '11px',
                        color: 'var(--color-text-3)',
                        marginBottom: '12px',
                        padding: '8px 10px',
                        background: 'var(--color-panel)',
                        borderRadius: '6px',
                        border: '1px solid var(--color-panel-contrast)',
                      }}>
                        💡 <strong>Local models</strong> are free. <strong>Cloud models</strong> require API keys.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {AI_TOOLS.map((tool) => (
                          <div
                            key={tool.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              background: 'var(--color-panel)',
                              borderRadius: '6px',
                              border: '1px solid var(--color-panel-contrast)',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text)' }}>
                              <span style={{ fontSize: '14px' }}>{tool.icon}</span>
                              <span style={{ fontWeight: 500 }}>{tool.name}</span>
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                backgroundColor: tool.type === 'local' ? '#d1fae5' : tool.type === 'gpu' ? '#e0e7ff' : '#fef3c7',
                                color: tool.type === 'local' ? '#065f46' : tool.type === 'gpu' ? '#3730a3' : '#92400e',
                                fontWeight: 600,
                              }}
                            >
                              {tool.model}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleManageApiKeys}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '8px 12px',
                          fontSize: '11px',
                          fontWeight: 500,
                          fontFamily: 'inherit',
                          backgroundColor: 'var(--color-primary, #3b82f6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#2563eb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary, #3b82f6)'
                        }}
                      >
                        <span>🔑</span>
                        {hasApiKey ? 'Manage API Keys' : 'Add API Keys'}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* Version Reversion - Coming Soon */}
                <div style={{ padding: '12px 16px' }}>
                  {/* Section Header - matches other headers */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                  }}>
                    <span style={{ fontSize: '14px' }}>🕐</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Version Reversion</span>
                  </div>

                  {/* Coming Soon Button */}
                  <button
                    disabled
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'var(--color-muted-2)',
                      border: '1px solid var(--color-panel-contrast)',
                      borderRadius: '6px',
                      cursor: 'not-allowed',
                      color: 'var(--color-text-3)',
                      fontSize: '11px',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    Coming soon
                  </button>
                </div>

              </div>
            </>,
            document.body
          )}
        </div>

        <Separator />

        {/* Help/Keyboard shortcuts button - rightmost */}
        <div style={{ padding: '0 4px' }}>
          <button
            ref={shortcutsButtonRef}
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

      {/* Keyboard shortcuts panel - rendered via portal to break out of parent container */}
      {showShortcuts && shortcutsDropdownPos && createPortal(
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
              position: 'fixed',
              top: shortcutsDropdownPos.top,
              right: shortcutsDropdownPos.right,
              width: '320px',
              maxHeight: '50vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              background: 'var(--color-panel, #ffffff)',
              backgroundColor: 'var(--color-panel, #ffffff)',
              border: '1px solid var(--color-panel-contrast)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              zIndex: 99999,
              padding: '10px 0',
              pointerEvents: 'auto',
              backdropFilter: 'none',
              opacity: 1,
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
        </>,
        document.body
      )}

      {/* Version Reversion Panel - Coming Soon */}
      {/* TODO: Re-enable when version history backend is fully tested
      {showVersionHistory && createPortal(
        <VersionHistoryPanel
          roomId={boardId}
          onClose={() => setShowVersionHistory(false)}
          onRevert={(hash) => {
            console.log('Reverted to version:', hash)
            window.location.reload()
          }}
          isDarkMode={isDarkMode}
        />,
        document.body
      )}
      */}

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
      // tools["VideoGen"], // Temporarily hidden
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
