import React, { useState, useEffect } from 'react'

export interface TmuxSession {
  name: string
  windows: number
  created: string
  attached: boolean
}

interface SessionBrowserProps {
  onSelectSession: (sessionId: string) => void
  onCreateSession: (sessionName: string) => void
  onRefresh?: () => void
}

export const SessionBrowser: React.FC<SessionBrowserProps> = ({
  onSelectSession,
  onCreateSession,
  onRefresh
}) => {
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newSessionName, setNewSessionName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual worker endpoint
      const response = await fetch('/terminal/sessions')

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`)
      }

      const data = await response.json() as { sessions?: TmuxSession[] }
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Error fetching tmux sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
      // For development: show mock data
      setSessions([
        { name: 'canvas-main', windows: 3, created: '2025-01-19T10:00:00Z', attached: true },
        { name: 'dev-session', windows: 1, created: '2025-01-19T09:30:00Z', attached: false },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAttach = (sessionName: string) => {
    onSelectSession(sessionName)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSessionName.trim()) return

    onCreateSession(newSessionName.trim())
    setNewSessionName('')
    setShowCreateForm(false)
  }

  const handleRefresh = () => {
    fetchSessions()
    onRefresh?.()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        padding: '16px',
        overflow: 'auto',
        pointerEvents: 'all',
        touchAction: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          tmux Sessions
        </h3>
        <button
          onClick={handleRefresh}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#d4d4d4',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            pointerEvents: 'all',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          🔄 Refresh
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
          Loading sessions...
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#3a1f1f',
            border: '1px solid #cd3131',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {!isLoading && sessions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
          No tmux sessions found. Create a new one to get started.
        </div>
      )}

      {!isLoading && sessions.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', marginBottom: '16px' }}>
          {sessions.map((session) => (
            <div
              key={session.name}
              style={{
                backgroundColor: '#2d2d2d',
                border: '1px solid #444',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#444'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: session.attached ? '#10b981' : '#666',
                      display: 'inline-block',
                    }}
                  />
                  <strong style={{ fontSize: '14px' }}>{session.name}</strong>
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginLeft: '16px' }}>
                  {session.windows} window{session.windows !== 1 ? 's' : ''} • Created {formatDate(session.created)}
                </div>
              </div>
              <button
                onClick={() => handleAttach(session.name)}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  pointerEvents: 'all',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0ea472'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#10b981'
                }}
              >
                Attach
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #444', paddingTop: '16px' }}>
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: '2px dashed #444',
              borderRadius: '6px',
              color: '#10b981',
              padding: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              pointerEvents: 'all',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981'
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#444'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            + Create New Session
          </button>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Enter session name..."
              autoFocus
              style={{
                backgroundColor: '#2d2d2d',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#d4d4d4',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
                pointerEvents: 'all',
                touchAction: 'manipulation',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#10b981'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#444'
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  pointerEvents: 'all',
                }}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewSessionName('')
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  color: '#d4d4d4',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  pointerEvents: 'all',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
