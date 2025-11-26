import React, { useState, useEffect, useRef } from 'react'
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, Geometry2d, Rectangle2d } from 'tldraw'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'
import { usePinnedToView } from '../hooks/usePinnedToView'

export type IMultmuxShape = TLBaseShape<
  'Multmux',
  {
    w: number
    h: number
    sessionId: string
    sessionName: string
    token: string
    serverUrl: string
    wsUrl: string
    pinnedToView: boolean
    tags: string[]
  }
>

interface SessionResponse {
  id: string
  name: string
  token: string
}

export class MultmuxShape extends BaseBoxShapeUtil<IMultmuxShape> {
  static override type = 'Multmux' as const

  // Terminal theme color: Dark purple/violet
  static readonly PRIMARY_COLOR = "#8b5cf6"

  getDefaultProps(): IMultmuxShape['props'] {
    return {
      w: 800,
      h: 600,
      sessionId: '',
      sessionName: 'New Terminal',
      token: '',
      serverUrl: 'http://localhost:3000',
      wsUrl: 'ws://localhost:3001',
      pinnedToView: false,
      tags: ['terminal', 'multmux'],
    }
  }

  getGeometry(shape: IMultmuxShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: IMultmuxShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [isMinimized, setIsMinimized] = useState(false)
    const [ws, setWs] = useState<WebSocket | null>(null)
    const [output, setOutput] = useState<string[]>([])
    const [input, setInput] = useState('')
    const [connected, setConnected] = useState(false)
    const terminalRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

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

    // WebSocket connection
    useEffect(() => {
      if (!shape.props.token || !shape.props.wsUrl) {
        return
      }

      const websocket = new WebSocket(`${shape.props.wsUrl}?token=${shape.props.token}`)

      websocket.onopen = () => {
        setConnected(true)
        setOutput(prev => [...prev, '✓ Connected to terminal session'])
      }

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'output':
              setOutput(prev => [...prev, message.data])
              break
            case 'joined':
              setOutput(prev => [...prev, `✓ Joined session: ${message.sessionName}`])
              break
            case 'presence':
              if (message.data.action === 'join') {
                setOutput(prev => [...prev, `→ User joined (${message.data.totalClients} total)`])
              } else if (message.data.action === 'leave') {
                setOutput(prev => [...prev, `← User left (${message.data.totalClients} total)`])
              }
              break
            case 'error':
              setOutput(prev => [...prev, `✗ Error: ${message.message}`])
              break
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        setOutput(prev => [...prev, '✗ Connection error'])
        setConnected(false)
      }

      websocket.onclose = () => {
        setConnected(false)
        setOutput(prev => [...prev, '✗ Connection closed'])
      }

      setWs(websocket)

      return () => {
        websocket.close()
      }
    }, [shape.props.token, shape.props.wsUrl])

    // Auto-scroll terminal output
    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    }, [output])

    const handleInputSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (!input || !ws || !connected) return

      // Send input to terminal
      ws.send(JSON.stringify({
        type: 'input',
        data: input + '\n',
        timestamp: Date.now(),
      }))

      setInput('')
    }

    const handleCreateSession = async () => {
      try {
        const response = await fetch(`${shape.props.serverUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: shape.props.sessionName || 'Canvas Terminal',
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create session')
        }

        const session: SessionResponse = await response.json()

        // Update shape with session details
        this.editor.updateShape<IMultmuxShape>({
          id: shape.id,
          type: 'Multmux',
          props: {
            ...shape.props,
            sessionId: session.id,
            sessionName: session.name,
            token: session.token,
          },
        })

        setOutput(prev => [...prev, `✓ Created session: ${session.name}`])
      } catch (error) {
        console.error('Failed to create session:', error)
        setOutput(prev => [...prev, `✗ Failed to create session: ${error}`])
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
                props: {
                  ...shape.props,
                  tags: newTags,
                }
              })
            }}
            tagsEditable={true}
          >
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1e1e2e',
              color: '#cdd6f4',
              padding: '20px',
              fontFamily: 'monospace',
              pointerEvents: 'all',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <h3 style={{ margin: 0, color: '#cba6f7' }}>Setup mulTmux Terminal</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label>
                  Session Name:
                  <input
                    type="text"
                    value={shape.props.sessionName}
                    onChange={(e) => {
                      this.editor.updateShape<IMultmuxShape>({
                        id: shape.id,
                        type: 'Multmux',
                        props: {
                          ...shape.props,
                          sessionName: e.target.value,
                        },
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
                    }}
                    placeholder="Canvas Terminal"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </label>

                <label>
                  Server URL:
                  <input
                    type="text"
                    value={shape.props.serverUrl}
                    onChange={(e) => {
                      this.editor.updateShape<IMultmuxShape>({
                        id: shape.id,
                        type: 'Multmux',
                        props: {
                          ...shape.props,
                          serverUrl: e.target.value,
                        },
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
                    }}
                    placeholder="http://localhost:3000"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </label>

                <label>
                  WebSocket URL:
                  <input
                    type="text"
                    value={shape.props.wsUrl}
                    onChange={(e) => {
                      this.editor.updateShape<IMultmuxShape>({
                        id: shape.id,
                        type: 'Multmux',
                        props: {
                          ...shape.props,
                          wsUrl: e.target.value,
                        },
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
                    }}
                    placeholder="ws://localhost:3001"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </label>

                <button
                  onClick={handleCreateSession}
                  style={{
                    padding: '12px',
                    backgroundColor: '#8b5cf6',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  Create New Session
                </button>

                <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.8 }}>
                  <p>Or paste a session token:</p>
                  <input
                    type="text"
                    placeholder="Paste token here..."
                    onPaste={(e) => {
                      const token = e.clipboardData.getData('text')
                      this.editor.updateShape<IMultmuxShape>({
                        id: shape.id,
                        type: 'Multmux',
                        props: {
                          ...shape.props,
                          token: token.trim(),
                        },
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
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
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
              props: {
                ...shape.props,
                tags: newTags,
              }
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

            {/* Terminal output */}
            <div
              ref={terminalRef}
              style={{
                flex: 1,
                padding: '12px',
                overflowY: 'auto',
                overflowX: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {output.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>

            {/* Input area */}
            <form onSubmit={handleInputSubmit} style={{ display: 'flex', borderTop: '1px solid #45475a' }}>
              <span style={{ padding: '8px 12px', backgroundColor: '#313244', color: '#89b4fa' }}>$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!connected}
                placeholder={connected ? "Type command..." : "Not connected"}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#313244',
                  border: 'none',
                  color: '#cdd6f4',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </form>
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IMultmuxShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onDoubleClick = (shape: IMultmuxShape) => {
    // Focus input on double click
    setTimeout(() => {
      const input = document.querySelector(`[data-shape-id="${shape.id}"] input[type="text"]`) as HTMLInputElement
      input?.focus()
    }, 0)
  }
}
