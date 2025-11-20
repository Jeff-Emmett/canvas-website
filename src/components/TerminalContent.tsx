import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { SessionBrowser, TmuxSession } from './SessionBrowser'

interface TerminalContentProps {
  sessionId: string
  collaborationMode: boolean
  ownerId: string
  fontFamily: string
  fontSize: number
  theme: "dark" | "light"
  isMinimized: boolean
  width: number
  height: number
  onSessionChange: (newSessionId: string) => void
  onCollaborationToggle: () => void
}

export const TerminalContent: React.FC<TerminalContentProps> = ({
  sessionId,
  collaborationMode,
  ownerId,
  fontFamily,
  fontSize,
  theme,
  isMinimized,
  width,
  height,
  onSessionChange,
  onCollaborationToggle
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [showSessionBrowser, setShowSessionBrowser] = useState(!sessionId)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get current user ID (TODO: replace with actual auth)
  const currentUserId = 'user-123' // Placeholder
  const isOwner = ownerId === currentUserId || !ownerId
  const canInput = isOwner || collaborationMode

  // Theme colors
  const themes = {
    dark: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      cursorAccent: '#1e1e1e',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    },
    light: {
      background: '#ffffff',
      foreground: '#333333',
      cursor: '#000000',
      cursorAccent: '#ffffff',
      selection: '#add6ff',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#555555',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#14ce14',
      brightYellow: '#b5ba00',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#a5a5a5'
    }
  }

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || isMinimized || showSessionBrowser) return

    // Create terminal instance
    const term = new Terminal({
      theme: themes[theme],
      fontFamily,
      fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      tabStopWidth: 4,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)

    fitAddonRef.current = fitAddon
    termRef.current = term

    // Fit terminal to container
    try {
      fitAddon.fit()
    } catch (err) {
      console.error('Error fitting terminal:', err)
    }

    // Handle user input
    term.onData((data) => {
      if (!canInput) {
        term.write('\r\n\x1b[33m[Terminal is read-only. Owner must enable collaboration mode.]\x1b[0m\r\n')
        return
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: data,
          sessionId
        }))
      }
    })

    // Cleanup
    return () => {
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, isMinimized, showSessionBrowser, fontFamily, fontSize, theme, canInput])

  // Connect to WebSocket
  useEffect(() => {
    if (!sessionId || showSessionBrowser || isMinimized) return

    connectWebSocket()

    return () => {
      disconnectWebSocket()
    }
  }, [sessionId, showSessionBrowser, isMinimized])

  // Handle resize
  useEffect(() => {
    if (!fitAddonRef.current || isMinimized || showSessionBrowser) return

    const resizeTimeout = setTimeout(() => {
      try {
        fitAddonRef.current?.fit()

        // Send resize event to backend
        if (termRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: termRef.current.cols,
            rows: termRef.current.rows,
            sessionId
          }))
        }
      } catch (err) {
        console.error('Error resizing terminal:', err)
      }
    }, 100)

    return () => clearTimeout(resizeTimeout)
  }, [width, height, isMinimized, showSessionBrowser, sessionId])

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setError(null)

    try {
      // TODO: Replace with actual worker URL
      const wsUrl = `wss://${window.location.host}/terminal/ws/${sessionId}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setReconnectAttempt(0)

        // Initialize session
        ws.send(JSON.stringify({
          type: 'init',
          sessionId,
          cols: termRef.current?.cols || 80,
          rows: termRef.current?.rows || 24
        }))

        if (termRef.current) {
          termRef.current.write('\r\n\x1b[32m[Connected to tmux session: ' + sessionId + ']\x1b[0m\r\n')
        }
      }

      ws.onmessage = (event) => {
        try {
          if (event.data instanceof Blob) {
            // Binary data
            const reader = new FileReader()
            reader.onload = () => {
              const text = reader.result as string
              termRef.current?.write(text)
            }
            reader.readAsText(event.data)
          } else {
            // Text data (could be JSON or terminal output)
            try {
              const msg = JSON.parse(event.data)
              handleServerMessage(msg)
            } catch {
              // Plain text terminal output
              termRef.current?.write(event.data)
            }
          }
        } catch (err) {
          console.error('Error processing message:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        setError('Connection error')
      }

      ws.onclose = () => {
        console.log('WebSocket closed')
        setIsConnected(false)
        wsRef.current = null

        if (termRef.current) {
          termRef.current.write('\r\n\x1b[31m[Disconnected from terminal]\x1b[0m\r\n')
        }

        // Attempt reconnection
        attemptReconnect()
      }
    } catch (err) {
      console.error('Error connecting WebSocket:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
  }

  const attemptReconnect = () => {
    if (reconnectAttempt >= 5) {
      setError('Connection lost. Max reconnection attempts reached.')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 16000)
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/5)`)

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempt(prev => prev + 1)
      connectWebSocket()
    }, delay)
  }

  const handleServerMessage = (msg: any) => {
    switch (msg.type) {
      case 'output':
        if (msg.data && termRef.current) {
          const data = typeof msg.data === 'string'
            ? msg.data
            : new Uint8Array(msg.data)
          termRef.current.write(data)
        }
        break

      case 'status':
        if (msg.status === 'disconnected') {
          setError('Session disconnected')
        }
        break

      case 'error':
        setError(msg.message || 'Unknown error')
        if (termRef.current) {
          termRef.current.write(`\r\n\x1b[31m[Error: ${msg.message}]\x1b[0m\r\n`)
        }
        break

      default:
        console.log('Unhandled message type:', msg.type)
    }
  }

  const handleSelectSession = (newSessionId: string) => {
    setShowSessionBrowser(false)
    onSessionChange(newSessionId)
  }

  const handleCreateSession = async (sessionName: string) => {
    try {
      // TODO: Replace with actual worker endpoint
      const response = await fetch('/terminal/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName })
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data = await response.json()
      setShowSessionBrowser(false)
      onSessionChange(sessionName)
    } catch (err) {
      console.error('Error creating session:', err)
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  const handleDetach = () => {
    disconnectWebSocket()
    setShowSessionBrowser(true)
    onSessionChange('')
  }

  if (isMinimized) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themes[theme].background,
          color: themes[theme].foreground,
          fontSize: '13px',
          pointerEvents: 'all',
        }}
      >
        Terminal minimized
      </div>
    )
  }

  if (showSessionBrowser) {
    return (
      <SessionBrowser
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
      />
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themes[theme].background,
        position: 'relative',
        pointerEvents: 'all',
        touchAction: 'auto',
      }}
    >
      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f0f0f0',
          borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
          fontSize: '11px',
          color: themes[theme].foreground,
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#10b981' : '#cd3131',
                display: 'inline-block',
                marginRight: '4px',
              }}
            />
            {sessionId}
          </span>
          {!canInput && (
            <span
              style={{
                backgroundColor: theme === 'dark' ? '#3a3a1f' : '#fff3cd',
                color: theme === 'dark' ? '#e5e510' : '#856404',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
              }}
            >
              🔒 Read-only
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwner && (
            <button
              onClick={onCollaborationToggle}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                color: collaborationMode ? '#10b981' : '#666',
                cursor: 'pointer',
                fontSize: '10px',
                padding: '2px 6px',
                pointerEvents: 'all',
              }}
              title={collaborationMode ? 'Collaboration enabled' : 'Collaboration disabled'}
            >
              👥 {collaborationMode ? 'ON' : 'OFF'}
            </button>
          )}
          <button
            onClick={handleDetach}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '2px 6px',
              pointerEvents: 'all',
            }}
            title="Switch session"
          >
            ↩ Switch
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            backgroundColor: '#3a1f1f',
            color: '#f14c4c',
            padding: '8px 12px',
            fontSize: '12px',
            borderBottom: '1px solid #cd3131',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '4px',
        }}
      />
    </div>
  )
}
