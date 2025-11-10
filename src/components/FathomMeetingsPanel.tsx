import React, { useState, useEffect } from 'react'
import { useEditor } from 'tldraw'
import { createShapeId } from 'tldraw'
import { WORKER_URL, LOCAL_WORKER_URL } from '../constants/workerUrl'

interface FathomMeeting {
  id: string
  title: string
  url: string
  created_at: string
  duration: number
  summary?: {
    markdown_formatted: string
  }
}

interface FathomMeetingsPanelProps {
  onClose: () => void
  shapeMode?: boolean
}

export function FathomMeetingsPanel({ onClose, shapeMode = false }: FathomMeetingsPanelProps) {
  const editor = useEditor()
  const [apiKey, setApiKey] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [meetings, setMeetings] = useState<FathomMeeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if API key is already stored
    const storedApiKey = localStorage.getItem('fathom_api_key')
    if (storedApiKey) {
      setApiKey(storedApiKey)
      fetchMeetings()
    } else {
      setShowApiKeyInput(true)
    }
  }, [])

  const fetchMeetings = async () => {
    if (!apiKey) {
      setError('Please enter your Fathom API key')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Try production worker first, fallback to local if needed
      let response
      try {
        response = await fetch(`${WORKER_URL}/fathom/meetings`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      } catch (error) {
        console.log('Production worker failed, trying local worker...')
        response = await fetch(`${LOCAL_WORKER_URL}/fathom/meetings`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      }

      if (!response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json() as { error?: string }
          setError(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
        } else {
          setError(`HTTP ${response.status}: ${response.statusText}`)
        }
        return
      }

      const data = await response.json() as { data?: FathomMeeting[] }
      setMeetings(data.data || [])
    } catch (error) {
      console.error('Error fetching meetings:', error)
      setError(`Failed to fetch meetings: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveApiKey = () => {
    if (apiKey) {
      localStorage.setItem('fathom_api_key', apiKey)
      setShowApiKeyInput(false)
      fetchMeetings()
    }
  }

  const addMeetingToCanvas = async (meeting: FathomMeeting) => {
    try {
      // Fetch full meeting details
      let response
      try {
        response = await fetch(`${WORKER_URL}/fathom/meetings/${meeting.id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      } catch (error) {
        console.log('Production worker failed, trying local worker...')
        response = await fetch(`${LOCAL_WORKER_URL}/fathom/meetings/${meeting.id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      }

      if (!response.ok) {
        setError(`Failed to fetch meeting details: ${response.status}`)
        return
      }

      const fullMeeting = await response.json() as any
      
      // Create Fathom transcript shape
      const shapeId = createShapeId()
      editor.createShape({
        id: shapeId,
        type: 'FathomTranscript',
        x: 100,
        y: 100,
        props: {
          meetingId: fullMeeting.id || '',
          meetingTitle: fullMeeting.title || '',
          meetingUrl: fullMeeting.url || '',
          summary: fullMeeting.default_summary?.markdown_formatted || '',
          transcript: fullMeeting.transcript?.map((entry: any) => ({
            speaker: entry.speaker?.display_name || 'Unknown',
            text: entry.text,
            timestamp: entry.timestamp
          })) || [],
          actionItems: fullMeeting.action_items?.map((item: any) => ({
            text: item.text,
            assignee: item.assignee,
            dueDate: item.due_date
          })) || [],
          isExpanded: false,
          showTranscript: true,
          showActionItems: true,
        }
      })

      onClose()
    } catch (error) {
      console.error('Error adding meeting to canvas:', error)
      setError(`Failed to add meeting: ${(error as Error).message}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // If in shape mode, don't use modal overlay
  const contentStyle: React.CSSProperties = shapeMode ? {
    backgroundColor: 'white',
    padding: '20px',
    width: '100%',
    height: '100%',
    overflow: 'auto',
    position: 'relative',
    userSelect: 'text',
    display: 'flex',
    flexDirection: 'column',
  } : {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '600px',
    maxHeight: '80vh',
    width: '90%',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    position: 'relative',
    zIndex: 10001,
    userSelect: 'text'
  }

  const content = (
    <div style={contentStyle} onClick={(e) => shapeMode ? undefined : e.stopPropagation()}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
          🎥 Fathom Meetings
        </h2>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '5px',
            position: 'relative',
            zIndex: 10002,
            pointerEvents: 'auto'
          }}
        >
          ✕
        </button>
      </div>

        {showApiKeyInput ? (
          <div>
            <p style={{ 
              marginBottom: '10px', 
              fontSize: '14px',
              userSelect: 'text',
              cursor: 'text'
            }}>
              Enter your Fathom API key to access your meetings:
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your Fathom API key"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '10px',
                position: 'relative',
                zIndex: 10002,
                pointerEvents: 'auto',
                userSelect: 'text',
                cursor: 'text'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={saveApiKey}
                disabled={!apiKey}
                style={{
                  padding: '8px 16px',
                  backgroundColor: apiKey ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: apiKey ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  zIndex: 10002,
                  pointerEvents: 'auto'
                }}
              >
                Save & Load Meetings
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 10002,
                  pointerEvents: 'auto'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={fetchMeetings}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: loading ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  zIndex: 10002,
                  pointerEvents: 'auto'
                }}
              >
                {loading ? 'Loading...' : 'Refresh Meetings'}
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('fathom_api_key')
                  setApiKey('')
                  setShowApiKeyInput(true)
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 10002,
                  pointerEvents: 'auto'
                }}
              >
                Change API Key
              </button>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '20px',
                border: '1px solid #f5c6cb',
                userSelect: 'text',
                cursor: 'text'
              }}>
                {error}
              </div>
            )}

            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {meetings.length === 0 ? (
                <p style={{ 
                  textAlign: 'center', 
                  color: '#666', 
                  fontStyle: 'italic',
                  userSelect: 'text',
                  cursor: 'text'
                }}>
                  No meetings found. Click "Refresh Meetings" to load your Fathom meetings.
                </p>
              ) : (
                meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '10px',
                      backgroundColor: '#f8f9fa',
                      userSelect: 'text',
                      cursor: 'text'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, userSelect: 'text', cursor: 'text' }}>
                        <h3 style={{ 
                          margin: '0 0 8px 0', 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          userSelect: 'text',
                          cursor: 'text'
                        }}>
                          {meeting.title}
                        </h3>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#666', 
                          marginBottom: '8px',
                          userSelect: 'text',
                          cursor: 'text'
                        }}>
                          <div>📅 {formatDate(meeting.created_at)}</div>
                          <div>⏱️ Duration: {formatDuration(meeting.duration)}</div>
                        </div>
                        {meeting.summary && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#333', 
                            marginBottom: '8px',
                            userSelect: 'text',
                            cursor: 'text'
                          }}>
                            <strong>Summary:</strong> {meeting.summary.markdown_formatted.substring(0, 100)}...
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => addMeetingToCanvas(meeting)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginLeft: '10px',
                          position: 'relative',
                          zIndex: 10002,
                          pointerEvents: 'auto'
                        }}
                      >
                        Add to Canvas
                      </button>
                    </div>
                  </div>
                ))
              )}
          </div>
        </>
      )}
    </div>
  )

  // If in shape mode, return content directly
  if (shapeMode) {
    return content
  }

  // Otherwise, return with modal overlay
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      {content}
    </div>
  )
}
















