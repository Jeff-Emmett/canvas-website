import React from "react"
import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import { FocusLockIndicator } from "./FocusLockIndicator"
import { MycelialIntelligenceBar } from "./MycelialIntelligenceBar"
import { CommandPalette } from "./CommandPalette"
import { UserSettingsModal } from "./UserSettingsModal"
import { GoogleExportBrowser } from "../components/GoogleExportBrowser"
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  TLComponents,
  TldrawUiMenuItem,
  useTools,
  useActions,
  useEditor,
  useValue,
} from "tldraw"
import { SlidesPanel } from "@/slides/SlidesPanel"

// Custom People Menu component for showing connected users and integrations
function CustomPeopleMenu() {
  const editor = useEditor()
  const [showDropdown, setShowDropdown] = React.useState(false)
  const [showGoogleBrowser, setShowGoogleBrowser] = React.useState(false)
  const [googleConnected, setGoogleConnected] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)

  // Detect dark mode
  const isDarkMode = typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  // Get current user info
  const myUserColor = useValue('myColor', () => editor.user.getColor(), [editor])
  const myUserName = useValue('myName', () => editor.user.getName() || 'You', [editor])

  // Check Google connection on mount
  React.useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        const { GoogleDataService } = await import('../lib/google')
        const service = GoogleDataService.getInstance()
        const isAuthed = await service.isAuthenticated()
        setGoogleConnected(isAuthed)
      } catch (error) {
        console.warn('Failed to check Google status:', error)
      }
    }
    checkGoogleStatus()
  }, [])

  const handleGoogleConnect = async () => {
    setGoogleLoading(true)
    try {
      const { GoogleDataService } = await import('../lib/google')
      const service = GoogleDataService.getInstance()
      await service.authenticate(['drive'])
      setGoogleConnected(true)
    } catch (error) {
      console.error('Google auth failed:', error)
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleOpenGoogleBrowser = () => {
    setShowDropdown(false)
    setShowGoogleBrowser(true)
  }

  const handleAddToCanvas = async (items: any[], position: { x: number; y: number }) => {
    try {
      const { createGoogleItemProps } = await import('../shapes/GoogleItemShapeUtil')

      // Create shapes for each selected item
      items.forEach((item, index) => {
        const props = createGoogleItemProps(item, 'local')
        editor.createShape({
          type: 'GoogleItem',
          x: position.x + (index % 3) * 240,
          y: position.y + Math.floor(index / 3) * 160,
          props,
        })
      })

      setShowGoogleBrowser(false)
    } catch (error) {
      console.error('Failed to add items to canvas:', error)
    }
  }

  // Get all collaborators (other users in the session)
  const collaborators = useValue('collaborators', () => editor.getCollaborators(), [editor])

  const totalUsers = collaborators.length + 1

  return (
    <div className="custom-people-menu" style={{ position: 'relative' }}>
      {/* Clickable avatar stack */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        title="Click to see participants"
      >
        {/* Current user avatar */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: myUserColor,
            border: '2px solid white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {myUserName.charAt(0).toUpperCase()}
        </div>

        {/* Other users (stacked) */}
        {collaborators.slice(0, 3).map((presence) => (
          <div
            key={presence.id}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: presence.color,
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              marginLeft: '-10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {(presence.userName || 'A').charAt(0).toUpperCase()}
          </div>
        ))}

        {/* User count badge if more than shown */}
        {totalUsers > 1 && (
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-1)',
            marginLeft: '6px',
          }}>
            {totalUsers}
          </span>
        )}
      </button>

      {/* Dropdown with user names */}
      {showDropdown && (
        <div
          className="people-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '180px',
            background: 'var(--bg-color, #fff)',
            border: '1px solid var(--border-color, #e1e4e8)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100000,
            padding: '8px 0',
          }}
        >
          <div style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--tool-text)',
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Participants ({totalUsers})
          </div>

          {/* Current user */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: myUserColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}>
              {myUserName.charAt(0).toUpperCase()}
            </div>
            <span style={{
              fontSize: '13px',
              color: 'var(--text-color)',
              fontWeight: 500,
            }}>
              {myUserName} (you)
            </span>
          </div>

          {/* Other users */}
          {collaborators.map((presence) => (
            <div
              key={presence.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: presence.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                {(presence.userName || 'A').charAt(0).toUpperCase()}
              </div>
              <span style={{
                fontSize: '13px',
                color: 'var(--text-color)',
              }}>
                {presence.userName || 'Anonymous'}
              </span>
            </div>
          ))}

          {/* Separator */}
          <div style={{
            height: '1px',
            backgroundColor: 'var(--border-color, #e1e4e8)',
            margin: '8px 0',
          }} />

          {/* Google Workspace Section */}
          <div style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--tool-text)',
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Integrations
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #4285F4, #34A853, #FBBC04, #EA4335)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
            }}>
              G
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-color)',
                fontWeight: 500,
              }}>
                Google Workspace
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--tool-text)',
                opacity: 0.7,
              }}>
                {googleConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
            {googleConnected ? (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
              }} />
            ) : null}
          </div>

          {/* Google action buttons */}
          <div style={{
            padding: '4px 12px 8px',
            display: 'flex',
            gap: '8px',
          }}>
            {!googleConnected ? (
              <button
                onClick={handleGoogleConnect}
                disabled={googleLoading}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #e1e4e8)',
                  backgroundColor: 'var(--bg-color, #fff)',
                  color: 'var(--text-color)',
                  cursor: googleLoading ? 'wait' : 'pointer',
                  opacity: googleLoading ? 0.7 : 1,
                }}
              >
                {googleLoading ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <button
                onClick={handleOpenGoogleBrowser}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#4285F4',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Browse Data
              </button>
            )}
          </div>
        </div>
      )}

      {/* Google Export Browser Modal */}
      {showGoogleBrowser && (
        <GoogleExportBrowser
          isOpen={showGoogleBrowser}
          onClose={() => setShowGoogleBrowser(false)}
          onAddToCanvas={handleAddToCanvas}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
          }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}

// Custom SharePanel that shows people menu and help button
function CustomSharePanel() {
  const tools = useTools()
  const actions = useActions()
  const [showShortcuts, setShowShortcuts] = React.useState(false)

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

  return (
    <div className="tlui-share-zone" draggable={false} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      {/* Help/Keyboard shortcuts button */}
      <button
        onClick={() => setShowShortcuts(!showShortcuts)}
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
          zIndex: 10,
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

      {/* Keyboard shortcuts panel */}
      {showShortcuts && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
            }}
            onClick={() => setShowShortcuts(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '320px',
              maxHeight: '70vh',
              overflowY: 'auto',
              background: 'var(--color-panel)',
              border: '1px solid var(--color-panel-contrast)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              zIndex: 99999,
              padding: '12px 0',
            }}
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

      <CustomPeopleMenu />
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
