import React, { useState, useEffect, useRef } from 'react'
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, Geometry2d, Rectangle2d, T, createShapePropsMigrationIds, createShapePropsMigrationSequence } from 'tldraw'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'
import { usePinnedToView } from '../hooks/usePinnedToView'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export type IMultmuxShape = TLBaseShape<
  'Multmux',
  {
    w: number
    h: number
    sessionId: string
    sessionName: string
    token: string
    serverUrl: string
    pinnedToView: boolean
    tags: string[]
  }
>

interface SessionResponse {
  id: string
  name: string
  token: string
}

interface SessionListItem {
  id: string
  name: string
  createdAt: string
  clientCount: number
}

// Helper to convert HTTP URL to WebSocket URL
function httpToWs(httpUrl: string): string {
  return httpUrl
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
    .replace(/\/?$/, '/ws')
}

// Migration versions for Multmux shape
const versions = createShapePropsMigrationIds('Multmux', {
  AddMissingProps: 1,
  RemoveWsUrl: 2,
  UpdateServerPort: 3,
})

// Migrations to handle shapes with missing/undefined props
export const multmuxShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: versions.AddMissingProps,
      up: (props: any) => {
        return {
          w: props.w ?? 800,
          h: props.h ?? 600,
          sessionId: props.sessionId ?? '',
          sessionName: props.sessionName ?? 'New Terminal',
          token: props.token ?? '',
          serverUrl: props.serverUrl ?? 'http://localhost:3002',
          wsUrl: props.wsUrl ?? 'ws://localhost:3002',
          pinnedToView: props.pinnedToView ?? false,
          tags: Array.isArray(props.tags) ? props.tags : ['terminal', 'multmux'],
        }
      },
      down: (props: any) => props,
    },
    {
      id: versions.RemoveWsUrl,
      up: (props: any) => {
        // Remove wsUrl, it's now derived from serverUrl
        const { wsUrl, ...rest } = props
        return {
          ...rest,
          serverUrl: rest.serverUrl ?? 'http://localhost:3002',
        }
      },
      down: (props: any) => ({
        ...props,
        wsUrl: httpToWs(props.serverUrl || 'http://localhost:3002'),
      }),
    },
    {
      id: versions.UpdateServerPort,
      up: (props: any) => {
        // Update old port 3000 to new port 3002
        let serverUrl = props.serverUrl ?? 'http://localhost:3002'
        if (serverUrl === 'http://localhost:3000') {
          serverUrl = 'http://localhost:3002'
        }
        return {
          ...props,
          serverUrl,
        }
      },
      down: (props: any) => props,
    },
  ],
})

export class MultmuxShape extends BaseBoxShapeUtil<IMultmuxShape> {
  static override type = 'Multmux' as const

  static override props = {
    w: T.number,
    h: T.number,
    sessionId: T.string,
    sessionName: T.string,
    token: T.string,
    serverUrl: T.string,
    pinnedToView: T.boolean,
    tags: T.arrayOf(T.string),
  }

  static override migrations = multmuxShapeMigrations

  // Terminal theme color: Dark purple/violet
  static readonly PRIMARY_COLOR = "#8b5cf6"

  getDefaultProps(): IMultmuxShape['props'] {
    return {
      w: 800,
      h: 600,
      sessionId: '',
      sessionName: '',
      token: '',
      serverUrl: 'http://localhost:3002',
      pinnedToView: false,
      tags: ['terminal', 'multmux'],
    }
  }

  getGeometry(shape: IMultmuxShape): Geometry2d {
    // Ensure minimum dimensions for proper hit testing
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    })
  }

  component(shape: IMultmuxShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [isMinimized, setIsMinimized] = useState(false)
    const [ws, setWs] = useState<WebSocket | null>(null)
    const [connected, setConnected] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [sessions, setSessions] = useState<SessionListItem[]>([])
    const [loadingSessions, setLoadingSessions] = useState(false)
    const [sessionName, setSessionName] = useState('')
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Runtime fix: correct old serverUrl port (3000 -> 3002)
    // This handles shapes that may not have been migrated yet
    useEffect(() => {
      if (shape.props.serverUrl === 'http://localhost:3000') {
        this.editor.updateShape<IMultmuxShape>({
          id: shape.id,
          type: 'Multmux',
          props: {
            ...shape.props,
            serverUrl: 'http://localhost:3002',
          },
        })
      }
    }, [shape.props.serverUrl])

    const handleClose = () => {
      if (ws) {
        ws.close()
      }
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IMultmuxShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    // Fetch available sessions
    const fetchSessions = async () => {
      setLoadingSessions(true)
      try {
        const response = await fetch(`${shape.props.serverUrl}/api/sessions`)
        if (response.ok) {
          const data = await response.json() as { sessions?: SessionListItem[] }
          setSessions(data.sessions || [])
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      } finally {
        setLoadingSessions(false)
      }
    }

    // Initialize xterm.js terminal
    useEffect(() => {
      if (!shape.props.token || !terminalRef.current || xtermRef.current) {
        return
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e2e',
          foreground: '#cdd6f4',
          cursor: '#f5e0dc',
          cursorAccent: '#1e1e2e',
          black: '#45475a',
          red: '#f38ba8',
          green: '#a6e3a1',
          yellow: '#f9e2af',
          blue: '#89b4fa',
          magenta: '#cba6f7',
          cyan: '#94e2d5',
          white: '#bac2de',
          brightBlack: '#585b70',
          brightRed: '#f38ba8',
          brightGreen: '#a6e3a1',
          brightYellow: '#f9e2af',
          brightBlue: '#89b4fa',
          brightMagenta: '#cba6f7',
          brightCyan: '#94e2d5',
          brightWhite: '#a6adc8',
        },
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalRef.current)

      // Small delay to ensure container is sized
      setTimeout(() => {
        fitAddon.fit()
      }, 100)

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      return () => {
        term.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }, [shape.props.token])

    // Fit terminal when shape resizes
    useEffect(() => {
      if (fitAddonRef.current && xtermRef.current) {
        setTimeout(() => {
          fitAddonRef.current?.fit()
        }, 50)
      }
    }, [shape.props.w, shape.props.h, isMinimized])

    // WebSocket connection
    useEffect(() => {
      if (!shape.props.token || !shape.props.serverUrl) {
        return
      }

      const wsUrl = httpToWs(shape.props.serverUrl)
      const websocket = new WebSocket(`${wsUrl}?token=${shape.props.token}`)

      websocket.onopen = () => {
        setConnected(true)
        xtermRef.current?.writeln('\r\n\x1b[32m✓ Connected to terminal session\x1b[0m\r\n')
      }

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'output':
              // Write terminal output directly to xterm
              xtermRef.current?.write(message.data)
              break
            case 'joined':
              xtermRef.current?.writeln(`\r\n\x1b[32m✓ Joined session: ${message.sessionName}\x1b[0m\r\n`)
              break
            case 'presence':
              if (message.data.action === 'join') {
                xtermRef.current?.writeln(`\r\n\x1b[33m→ User joined (${message.data.totalClients} total)\x1b[0m`)
              } else if (message.data.action === 'leave') {
                xtermRef.current?.writeln(`\r\n\x1b[33m← User left (${message.data.totalClients} total)\x1b[0m`)
              }
              break
            case 'error':
              xtermRef.current?.writeln(`\r\n\x1b[31m✗ Error: ${message.message}\x1b[0m\r\n`)
              break
            // Ignore 'input' messages from other clients (they're just for awareness)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        xtermRef.current?.writeln('\r\n\x1b[31m✗ Connection error\x1b[0m\r\n')
        setConnected(false)
      }

      websocket.onclose = () => {
        setConnected(false)
        xtermRef.current?.writeln('\r\n\x1b[31m✗ Connection closed\x1b[0m\r\n')
      }

      setWs(websocket)

      return () => {
        websocket.close()
      }
    }, [shape.props.token, shape.props.serverUrl])

    // Handle terminal input - send keystrokes to server
    useEffect(() => {
      if (!xtermRef.current || !ws) return

      const disposable = xtermRef.current.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'input',
            data: data,
            timestamp: Date.now(),
          }))
        }
      })

      return () => {
        disposable.dispose()
      }
    }, [ws])

    const handleCreateSession = async () => {
      try {
        const response = await fetch(`${shape.props.serverUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sessionName || `Terminal ${new Date().toLocaleTimeString()}`,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create session')
        }

        const session: SessionResponse = await response.json()

        // CRITICAL: Ensure all props are defined - undefined values cause ValidationError
        // Explicitly build props object with all required values to prevent undefined from slipping through
        this.editor.updateShape<IMultmuxShape>({
          id: shape.id,
          type: 'Multmux',
          props: {
            w: shape.props.w ?? 800,
            h: shape.props.h ?? 600,
            sessionId: session.id ?? '',
            sessionName: session.name ?? '',
            token: session.token ?? '',
            serverUrl: shape.props.serverUrl ?? 'http://localhost:3002',
            pinnedToView: shape.props.pinnedToView ?? false,
            tags: Array.isArray(shape.props.tags) ? shape.props.tags : ['terminal', 'multmux'],
          },
        })

        // Session created - terminal will connect via WebSocket
        console.log('✓ Created session:', session.name)
      } catch (error) {
        console.error('Failed to create session:', error)
      }
    }

    const handleJoinSession = async (sessionId: string) => {
      try {
        const response = await fetch(`${shape.props.serverUrl}/api/sessions/${sessionId}/join`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to join session')
        }

        const data = await response.json() as { name?: string; token?: string }

        // CRITICAL: Ensure all props are defined - undefined values cause ValidationError
        this.editor.updateShape<IMultmuxShape>({
          id: shape.id,
          type: 'Multmux',
          props: {
            w: shape.props.w ?? 800,
            h: shape.props.h ?? 600,
            sessionId: sessionId ?? '',
            sessionName: data.name ?? 'Joined Session',
            token: data.token ?? '',
            serverUrl: shape.props.serverUrl ?? 'http://localhost:3002',
            pinnedToView: shape.props.pinnedToView ?? false,
            tags: Array.isArray(shape.props.tags) ? shape.props.tags : ['terminal', 'multmux'],
          },
        })
      } catch (error) {
        console.error('Failed to join session:', error)
      }
    }

    // If no token, show setup UI
    if (!shape.props.token) {
      return (
        <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
          <StandardizedToolWrapper
            title="mulTmux Terminal"
            primaryColor={MultmuxShape.PRIMARY_COLOR}
            isSelected={isSelected}
            width={shape.props.w}
            height={shape.props.h}
            onClose={handleClose}
            onMinimize={handleMinimize}
            isMinimized={isMinimized}
            editor={this.editor}
            shapeId={shape.id}
            isPinnedToView={shape.props.pinnedToView}
            onPinToggle={handlePinToggle}
            tags={shape.props.tags}
            onTagsChange={(newTags) => {
              this.editor.updateShape<IMultmuxShape>({
                id: shape.id,
                type: 'Multmux',
                props: { ...shape.props, tags: newTags }
              })
            }}
            tagsEditable={true}
          >
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1e1e2e',
              color: '#cdd6f4',
              padding: '24px',
              fontFamily: 'monospace',
              pointerEvents: 'all',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ margin: '0 0 8px 0', color: '#cba6f7', fontSize: '24px' }}>mulTmux</h2>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '14px' }}>Collaborative Terminal Sessions</p>
              </div>

              {/* Create Session */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Session name (optional)"
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#313244',
                    border: '1px solid #45475a',
                    borderRadius: '8px',
                    color: '#cdd6f4',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <button
                  onClick={handleCreateSession}
                  style={{
                    padding: '14px 20px',
                    backgroundColor: '#8b5cf6',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    transition: 'background-color 0.2s',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  + Create New Session
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#45475a' }} />
                <span style={{ opacity: 0.5, fontSize: '12px' }}>OR JOIN EXISTING</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#45475a' }} />
              </div>

              {/* Join Session */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                <button
                  onClick={fetchSessions}
                  disabled={loadingSessions}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#313244',
                    border: '1px solid #45475a',
                    borderRadius: '8px',
                    color: '#cdd6f4',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {loadingSessions ? 'Loading...' : 'Refresh Sessions'}
                </button>

                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  backgroundColor: '#313244',
                  borderRadius: '8px',
                  padding: '8px',
                }}>
                  {sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
                      No active sessions
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleJoinSession(session.id)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          marginBottom: '4px',
                          backgroundColor: '#45475a',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#cdd6f4',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'monospace',
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontWeight: 'bold' }}>{session.name}</div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                          {session.clientCount} connected
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Advanced Settings */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#89b4fa',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    padding: '4px 0',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {showAdvanced ? '▼' : '▶'} Advanced Settings
                </button>
                {showAdvanced && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '12px', opacity: 0.7 }}>
                      Server URL:
                      <input
                        type="text"
                        value={shape.props.serverUrl}
                        onChange={(e) => {
                          this.editor.updateShape<IMultmuxShape>({
                            id: shape.id,
                            type: 'Multmux',
                            props: { ...shape.props, serverUrl: e.target.value },
                          })
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginTop: '4px',
                          backgroundColor: '#313244',
                          border: '1px solid #45475a',
                          borderRadius: '4px',
                          color: '#cdd6f4',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </StandardizedToolWrapper>
        </HTMLContainer>
      )
    }

    // Show terminal UI when connected
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title={`mulTmux: ${shape.props.sessionName}`}
          primaryColor={MultmuxShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IMultmuxShape>({
              id: shape.id,
              type: 'Multmux',
              props: { ...shape.props, tags: newTags }
            })
          }}
          tagsEditable={true}
        >
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1e1e2e',
            color: '#cdd6f4',
            fontFamily: 'monospace',
            fontSize: '14px',
            pointerEvents: 'all',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Status bar */}
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#313244',
              borderBottom: '1px solid #45475a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>
                {connected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>
                Session: {shape.props.sessionId.slice(0, 8)}...
              </span>
            </div>

            {/* xterm.js Terminal */}
            <div
              ref={terminalRef}
              style={{
                flex: 1,
                padding: '4px',
                overflow: 'hidden',
              }}
              onPointerDown={(e) => {
                // Allow pointer events for text selection but stop propagation to prevent tldraw interactions
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                // Focus the terminal when clicked
                xtermRef.current?.focus()
              }}
            />
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IMultmuxShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onDoubleClick = (shape: IMultmuxShape) => {
    setTimeout(() => {
      const input = document.querySelector(`[data-shape-id="${shape.id}"] input[type="text"]`) as HTMLInputElement
      input?.focus()
    }, 0)
  }
}
