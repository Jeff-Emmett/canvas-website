import React, { useState, useEffect, useRef, useCallback } from "react"
import { useEditor } from "tldraw"

// Command Palette that shows when holding Ctrl+Shift or via global event
// Displays available keyboard shortcuts for custom tools and actions

interface ShortcutItem {
  id: string
  label: string
  kbd: string
  key: string // The actual key to press (e.g., 'V', 'C', etc.)
  icon?: string
  category: 'tool' | 'action'
}

// Global function to open the command palette
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('open-command-palette'))
}

export function CommandPalette() {
  const editor = useEditor()
  const [isVisible, setIsVisible] = useState(false)
  const [isManuallyOpened, setIsManuallyOpened] = useState(false)
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const keysHeldRef = useRef({ ctrl: false, shift: false })

  // Custom tools with Ctrl+Shift shortcuts (matching overrides.tsx)
  const customToolShortcuts: ShortcutItem[] = [
    { id: 'VideoChat', label: 'Video Chat', kbd: '⌃⇧V', key: 'V', icon: '📹', category: 'tool' },
    { id: 'ChatBox', label: 'Chat Box', kbd: '⌃⇧C', key: 'C', icon: '💬', category: 'tool' },
    { id: 'Embed', label: 'Embed', kbd: '⌃⇧E', key: 'E', icon: '🔗', category: 'tool' },
    { id: 'Slide', label: 'Slide', kbd: '⌃⇧S', key: 'S', icon: '📊', category: 'tool' },
    { id: 'Markdown', label: 'Markdown', kbd: '⌃⇧M', key: 'M', icon: '📝', category: 'tool' },
    { id: 'MycrozineTemplate', label: 'Mycrozine', kbd: '⌃⇧Z', key: 'Z', icon: '📰', category: 'tool' },
    { id: 'Prompt', label: 'LLM Prompt', kbd: '⌃⇧L', key: 'L', icon: '🤖', category: 'tool' },
    { id: 'ObsidianNote', label: 'Obsidian Note', kbd: '⌃⇧O', key: 'O', icon: '📓', category: 'tool' },
    { id: 'Transcription', label: 'Transcription', kbd: '⌃⇧T', key: 'T', icon: '🎤', category: 'tool' },
    // { id: 'Holon', label: 'Holon', kbd: '⌃⇧H', key: 'H', icon: '⭕', category: 'tool' }, // Temporarily hidden
    { id: 'FathomMeetings', label: 'Fathom Meetings', kbd: '⌃⇧F', key: 'F', icon: '📅', category: 'tool' },
    { id: 'ImageGen', label: 'Image Gen', kbd: '⌃⇧I', key: 'I', icon: '🖼️', category: 'tool' },
    // { id: 'VideoGen', label: 'Video Gen', kbd: '⌃⇧G', key: 'G', icon: '🎬', category: 'tool' }, // Temporarily hidden
    // { id: 'Multmux', label: 'Terminal', kbd: '⌃⇧K', key: 'K', icon: '💻', category: 'tool' }, // Temporarily hidden
  ]

  // Custom actions with shortcuts (matching overrides.tsx)
  const customActionShortcuts: ShortcutItem[] = [
    { id: 'zoom-to-selection', label: 'Zoom to Selection', kbd: 'Z', key: 'Z', icon: '🔍', category: 'action' },
    { id: 'copy-link', label: 'Copy Link', kbd: '⌃⌥C', key: 'C', icon: '🔗', category: 'action' },
    { id: 'lock-element', label: 'Lock Element', kbd: '⇧L', key: 'L', icon: '🔒', category: 'action' },
    { id: 'search-shapes', label: 'Search Shapes', kbd: 'S', key: 'S', icon: '🔎', category: 'action' },
    { id: 'semantic-search', label: 'Semantic Search', kbd: '⇧S', key: 'S', icon: '🧠', category: 'action' },
    { id: 'ask-ai', label: 'Ask AI About Canvas', kbd: '⇧A', key: 'A', icon: '✨', category: 'action' },
    { id: 'export-pdf', label: 'Export to PDF', kbd: '⌃⌥P', key: 'P', icon: '📄', category: 'action' },
    { id: 'run-llm', label: 'Run LLM on Arrow', kbd: '⌃⌥R', key: 'R', icon: '⚡', category: 'action' },
  ]

  // Handle clicking on a tool/action
  const handleItemClick = useCallback((item: ShortcutItem) => {
    setIsVisible(false)
    setIsManuallyOpened(false)

    if (item.category === 'tool') {
      // Set the current tool
      editor.setCurrentTool(item.id)
    } else {
      // Dispatch keyboard event to trigger the action
      // Simulate the keyboard shortcut
      const event = new KeyboardEvent('keydown', {
        key: item.key,
        code: `Key${item.key}`,
        ctrlKey: item.kbd.includes('⌃'),
        shiftKey: item.kbd.includes('⇧'),
        altKey: item.kbd.includes('⌥'),
        bubbles: true,
      })
      window.dispatchEvent(event)
    }
  }, [editor])

  // Handle manual open via custom event
  useEffect(() => {
    const handleOpenEvent = () => {
      setIsManuallyOpened(true)
      setIsVisible(true)
    }

    window.addEventListener('open-command-palette', handleOpenEvent)
    return () => window.removeEventListener('open-command-palette', handleOpenEvent)
  }, [])

  // Handle Escape key and click outside to close when manually opened
  useEffect(() => {
    if (!isManuallyOpened) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false)
        setIsManuallyOpened(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.command-palette')) return
      setIsVisible(false)
      setIsManuallyOpened(false)
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isManuallyOpened])

  // Handle Ctrl+Shift key press/release
  useEffect(() => {
    const checkAndShowPalette = () => {
      if (keysHeldRef.current.ctrl && keysHeldRef.current.shift) {
        // Clear any existing timeout
        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current)
        }
        // Set a small delay before showing (to avoid flashing on quick combos)
        holdTimeoutRef.current = setTimeout(() => {
          setIsVisible(true)
        }, 300) // 300ms hold to show
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        keysHeldRef.current.ctrl = true
        checkAndShowPalette()
      } else if (e.key === 'Shift') {
        keysHeldRef.current.shift = true
        checkAndShowPalette()
      } else if (isVisible && !isManuallyOpened) {
        // Hide on any other key press (they're using a shortcut) - only if not manually opened
        setIsVisible(false)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        keysHeldRef.current.ctrl = false
      } else if (e.key === 'Shift') {
        keysHeldRef.current.shift = false
      }

      // Hide palette if either key is released - only if not manually opened
      if (!isManuallyOpened && (!keysHeldRef.current.ctrl || !keysHeldRef.current.shift)) {
        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current)
          holdTimeoutRef.current = null
        }
        setIsVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current)
      }
    }
  }, [isVisible, isManuallyOpened])

  if (!isVisible) return null

  return (
    <div
      className="command-palette-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        pointerEvents: isManuallyOpened ? 'auto' : 'none',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="command-palette"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          padding: '24px 32px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '700px',
          width: '90%',
          animation: 'scaleIn 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a1a1a',
            fontFamily: 'Inter, sans-serif',
          }}>
            ⌨️ Command Palette
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '12px',
            color: '#666',
            fontFamily: 'Inter, sans-serif',
          }}>
            Click a button or use Ctrl+Shift + Key to activate
          </p>
        </div>

        {/* Tools Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#10b981',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
            fontFamily: 'Inter, sans-serif',
          }}>
            Tools (Ctrl+Shift + Key)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '8px',
          }}>
            {customToolShortcuts.map(item => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <kbd style={{
                  backgroundColor: '#10b981',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: 'SF Mono, Monaco, monospace',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                  minWidth: '32px',
                  textAlign: 'center',
                }}>
                  {item.key}
                </kbd>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#1a1a1a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {item.label}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions Section */}
        <div>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#6366f1',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
            fontFamily: 'Inter, sans-serif',
          }}>
            Actions
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '8px',
          }}>
            {customActionShortcuts.map(item => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)'
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <kbd style={{
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: 'SF Mono, Monaco, monospace',
                  boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
                  minWidth: '32px',
                  textAlign: 'center',
                }}>
                  {item.key}
                </kbd>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#1a1a1a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    color: '#888',
                    fontFamily: 'SF Mono, Monaco, monospace',
                  }}>
                    {item.kbd}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <p style={{
            margin: 0,
            fontSize: '11px',
            color: '#888',
            fontFamily: 'Inter, sans-serif',
          }}>
            Press <kbd style={{
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '3px',
              padding: '1px 4px',
              fontSize: '10px',
            }}>?</kbd> for full keyboard shortcuts dialog
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
