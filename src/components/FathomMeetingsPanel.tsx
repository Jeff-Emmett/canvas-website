import React, { useState, useEffect, useContext, useRef } from 'react'
import { useEditor } from 'tldraw'
import { createShapeId } from 'tldraw'
import { WORKER_URL, LOCAL_WORKER_URL } from '../constants/workerUrl'
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey } from '../lib/fathomApiKey'
import { AuthContext } from '../context/AuthContext'

interface FathomMeeting {
  recording_id: number
  title: string
  meeting_title?: string
  url: string
  share_url?: string
  created_at: string
  scheduled_start_time?: string
  scheduled_end_time?: string
  recording_start_time?: string
  recording_end_time?: string
  transcript?: any[]
  transcript_language?: string
  default_summary?: {
    template_name?: string
    markdown_formatted?: string
  }
  action_items?: any[]
  calendar_invitees?: Array<{
    name: string
    email: string
    is_external: boolean
  }>
  recorded_by?: {
    name: string
    email: string
    team?: string
  }
  call_id?: string | number
  id?: string | number
}

interface FathomMeetingsPanelProps {
  onClose?: () => void
  onMeetingSelect?: (meeting: FathomMeeting, options: { summary: boolean; transcript: boolean; actionItems: boolean; video: boolean }, format: 'fathom' | 'note') => void
  shapeMode?: boolean
}

export function FathomMeetingsPanel({ onClose, onMeetingSelect, shapeMode = false }: FathomMeetingsPanelProps) {
  const editor = useEditor()
  // Safely get auth context - may not be available during SVG export
  const authContext = useContext(AuthContext)
  const fallbackSession = {
    username: undefined as string | undefined,
  }
  const session = authContext?.session || fallbackSession
  
  const [apiKey, setApiKey] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [meetings, setMeetings] = useState<FathomMeeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Removed dropdown state - using buttons instead

  const fetchMeetings = async (keyToUse?: string) => {
    const key = keyToUse || apiKey
    if (!key) {
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
            'X-Api-Key': key,
            'Content-Type': 'application/json'
          }
        })
      } catch (error) {
        response = await fetch(`${LOCAL_WORKER_URL}/fathom/meetings`, {
          headers: {
            'X-Api-Key': key,
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
      saveFathomApiKey(apiKey, session.username)
      setShowApiKeyInput(false)
      fetchMeetings(apiKey)
    }
  }

  // Track if we've already loaded meetings for the current user to prevent multiple API calls
  const hasLoadedRef = useRef<string | undefined>(undefined)
  const hasMountedRef = useRef(false)
  
  useEffect(() => {
    // Only run once on mount, don't re-fetch when session.username changes
    if (hasMountedRef.current) {
      return // Already loaded, don't refresh
    }
    hasMountedRef.current = true
    
    // Always check user profile first for API key, then fallback to global storage
    const username = session.username
    const storedApiKey = getFathomApiKey(username)
    if (storedApiKey) {
      setApiKey(storedApiKey)
      setShowApiKeyInput(false)
      // Automatically fetch meetings when API key is available
      // Only fetch once per user to prevent unnecessary API calls
      if (hasLoadedRef.current !== username) {
        hasLoadedRef.current = username
        fetchMeetings(storedApiKey)
      }
    } else {
      setShowApiKeyInput(true)
      hasLoadedRef.current = undefined
    }
  }, []) // Empty dependency array - only run once on mount

  // Handler for individual data type buttons - creates shapes directly
  const handleDataButtonClick = async (meeting: FathomMeeting, dataType: 'summary' | 'transcript' | 'actionItems' | 'video') => {
    // Log to verify the correct meeting is being used
      recording_id: meeting.recording_id,
      title: meeting.title,
      dataType
    })
    
    if (!onMeetingSelect) {
      // Fallback for non-browser mode
      const options = {
        summary: dataType === 'summary',
        transcript: dataType === 'transcript',
        actionItems: dataType === 'actionItems',
        video: dataType === 'video',
      }
      await addMeetingToCanvas(meeting, options)
      return
    }

    // Browser mode - use callback with specific data type
    // IMPORTANT: Pass the meeting object directly to ensure each button uses its own meeting's data
    const options = {
      summary: dataType === 'summary',
      transcript: dataType === 'transcript',
      actionItems: dataType === 'actionItems',
      video: dataType === 'video',
    }
    // Always use 'note' format for summary, transcript, and action items (same behavior)
    // Video opens URL directly, so format doesn't matter for it
    const format = 'note'
    onMeetingSelect(meeting, options, format)
  }

  const formatMeetingDataAsMarkdown = (fullMeeting: any, meeting: FathomMeeting, options: { summary: boolean; transcript: boolean; actionItems: boolean; video: boolean }): string => {
    const parts: string[] = []
    
    // Title
    parts.push(`# ${fullMeeting.title || meeting.meeting_title || meeting.title || 'Meeting'}\n`)
    
    // Video link if selected
    if (options.video && (fullMeeting.url || meeting.url)) {
      parts.push(`**Video:** [Watch Recording](${fullMeeting.url || meeting.url})\n`)
    }
    
    // Summary if selected
    if (options.summary && fullMeeting.default_summary?.markdown_formatted) {
      parts.push(`## Summary\n\n${fullMeeting.default_summary.markdown_formatted}\n`)
    }
    
    // Action Items if selected
    if (options.actionItems && fullMeeting.action_items && fullMeeting.action_items.length > 0) {
      parts.push(`## Action Items\n\n`)
      fullMeeting.action_items.forEach((item: any) => {
        const description = item.description || item.text || ''
        const assignee = item.assignee?.name || item.assignee || ''
        const dueDate = item.due_date || ''
        parts.push(`- [ ] ${description}`)
        if (assignee) parts[parts.length - 1] += ` (@${assignee})`
        if (dueDate) parts[parts.length - 1] += ` - Due: ${dueDate}`
        parts[parts.length - 1] += '\n'
      })
      parts.push('\n')
    }
    
    // Transcript if selected
    if (options.transcript && fullMeeting.transcript && fullMeeting.transcript.length > 0) {
      parts.push(`## Transcript\n\n`)
      fullMeeting.transcript.forEach((entry: any) => {
        const speaker = entry.speaker?.display_name || 'Unknown'
        const text = entry.text || ''
        const timestamp = entry.timestamp || ''
        if (timestamp) {
          parts.push(`**${speaker}** (${timestamp}): ${text}\n\n`)
        } else {
          parts.push(`**${speaker}**: ${text}\n\n`)
        }
      })
    }
    
    return parts.join('')
  }

  const addMeetingToCanvas = async (meeting: FathomMeeting, options: { summary: boolean; transcript: boolean; actionItems: boolean; video: boolean }) => {
    try {
      // If video is selected, just open the Fathom URL directly
      if (options.video) {
        // Try multiple sources for the correct video URL
        // The Fathom API may provide url, share_url, or we may need to construct from call_id or id
        const callId = meeting.call_id || 
                      meeting.id || 
                      meeting.recording_id
        
        // Check if URL fields contain valid meeting URLs (contain /calls/)
        const isValidMeetingUrl = (url: string) => url && url.includes('/calls/')
        
        // Prioritize valid meeting URLs, then construct from call ID
        const videoUrl = (meeting.url && isValidMeetingUrl(meeting.url)) ? meeting.url :
                        (meeting.share_url && isValidMeetingUrl(meeting.share_url)) ? meeting.share_url :
                        (callId ? `https://fathom.video/calls/${callId}` : null)
        
        if (videoUrl) {
          window.open(videoUrl, '_blank', 'noopener,noreferrer')
        } else {
          console.error('Could not determine Fathom video URL for meeting:', meeting)
        }
        return
      }

      // Only fetch transcript if transcript is selected
      const includeTranscript = options.transcript
      
      // Fetch full meeting details
      let response
      try {
        response = await fetch(`${WORKER_URL}/fathom/meetings/${meeting.recording_id}${includeTranscript ? '?include_transcript=true' : ''}`, {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json'
          }
        })
      } catch (error) {
        response = await fetch(`${LOCAL_WORKER_URL}/fathom/meetings/${meeting.recording_id}${includeTranscript ? '?include_transcript=true' : ''}`, {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json'
          }
        })
      }

      if (!response.ok) {
        setError(`Failed to fetch meeting details: ${response.status}`)
        return
      }

      const fullMeeting = await response.json() as any
      
      // If onMeetingSelect callback is provided, use it (browser mode - creates separate shapes)
      if (onMeetingSelect) {
        // Default to 'note' format for text data
        onMeetingSelect(meeting, options, 'note')
        // Browser stays open, don't close
        return
      }
      
      // Fallback: create shape directly (for non-browser mode, like modal)
      // Default to note format
      const markdownContent = formatMeetingDataAsMarkdown(fullMeeting, meeting, options)
      const title = fullMeeting.title || meeting.meeting_title || meeting.title || 'Fathom Meeting'
      
      const shapeId = createShapeId()
      editor.createShape({
        id: shapeId,
        type: 'ObsNote',
        x: 100,
        y: 100,
        props: {
          w: 400,
          h: 500,
          color: 'black',
          size: 'm',
          font: 'sans',
          textAlign: 'start',
          scale: 1,
          noteId: `fathom-${meeting.recording_id}`,
          title: title,
          content: markdownContent,
          tags: ['fathom', 'meeting'],
          showPreview: true,
          backgroundColor: '#ffffff',
          textColor: '#000000',
          isEditing: false,
          editingContent: '',
          isModified: false,
          originalContent: markdownContent,
          pinnedToView: false,
        }
      })
      
      // Only close if not in shape mode (browser stays open)
      if (!shapeMode && onClose) {
        onClose()
      }
    } catch (error) {
      console.error('Error adding meeting to canvas:', error)
      setError(`Failed to add meeting: ${(error as Error).message}`)
    }
  }

  // Removed dropdown click-outside handler - no longer needed with button-based interface

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
    <div 
      style={contentStyle} 
      onClick={(e) => {
        // Prevent clicks from interfering with shape selection or resetting data
        if (!shapeMode) {
          e.stopPropagation()
        }
        // In shape mode, allow normal interaction but don't reset data
      }}
      onMouseDown={(e) => {
        // Prevent shape deselection when clicking inside the browser content
        if (shapeMode) {
          e.stopPropagation()
        }
      }}
    >
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
                  pointerEvents: 'auto',
                  touchAction: 'manipulation'
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
                onClick={() => fetchMeetings(apiKey)}
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
                  // Remove API key from user-specific storage
                  removeFathomApiKey(session.username)
                  setApiKey('')
                  setMeetings([])
                  setShowApiKeyInput(true)
                  hasLoadedRef.current = undefined
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
                    key={meeting.recording_id}
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
                          <div>⏱️ Duration: {meeting.recording_start_time && meeting.recording_end_time 
                            ? formatDuration(Math.floor((new Date(meeting.recording_end_time).getTime() - new Date(meeting.recording_start_time).getTime()) / 1000))
                            : 'N/A'}</div>
                        </div>
                        {meeting.default_summary?.markdown_formatted && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#333', 
                            marginBottom: '8px',
                            userSelect: 'text',
                            cursor: 'text'
                          }}>
                            <strong>Summary:</strong> {meeting.default_summary.markdown_formatted.substring(0, 100)}...
                          </div>
                        )}
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'row', 
                        gap: '6px',
                        marginLeft: '10px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          onClick={() => handleDataButtonClick(meeting, 'summary')}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            opacity: loading ? 0.6 : 1
                          }}
                          title="Add Summary as Note"
                        >
                          📄 Summary
                        </button>
                        <button
                          onClick={() => handleDataButtonClick(meeting, 'transcript')}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            opacity: loading ? 0.6 : 1
                          }}
                          title="Add Transcript as Note"
                        >
                          📝 Transcript
                        </button>
                        <button
                          onClick={() => handleDataButtonClick(meeting, 'actionItems')}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#1d4ed8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            opacity: loading ? 0.6 : 1
                          }}
                          title="Add Action Items as Note"
                        >
                          ✅ Actions
                        </button>
                        <button
                          onClick={() => handleDataButtonClick(meeting, 'video')}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#1e40af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            opacity: loading ? 0.6 : 1
                          }}
                          title="Add Video as Embed"
                        >
                          🎥 Video
                        </button>
                      </div>
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

















