import React, { useState, useEffect } from 'react'
import { useEditor } from 'tldraw'

/** Shape of a meeting from the Meeting Intelligence API */
interface MIMeeting {
  id: string
  title: string
  status: string
  duration_seconds?: number
  participants?: string[]
  created_at: string
  has_transcript?: boolean
  has_summary?: boolean
  speaker_count?: number
}

interface MeetingIntelligencePanelProps {
  onClose?: () => void
  onMeetingSelect?: (
    meeting: MIMeeting,
    options: { summary: boolean; transcript: boolean; speakers: boolean },
  ) => void
  shapeMode?: boolean
}

// Meeting Intelligence API base URL
const MI_API_URL = 'https://meets-api.rspace.online'

function formatDuration(seconds?: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return '#10b981'
    case 'recording': return '#ef4444'
    case 'transcribing': case 'diarizing': return '#f59e0b'
    case 'summarizing': return '#8b5cf6'
    default: return '#6b7280'
  }
}

export function MeetingIntelligencePanel({ onMeetingSelect }: MeetingIntelligencePanelProps) {
  const editor = useEditor()
  const [meetings, setMeetings] = useState<MIMeeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${MI_API_URL}/meetings`)
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json() as any
      // API may return { meetings: [...] } or [...]
      const list = Array.isArray(data) ? data : (data.meetings || [])
      setMeetings(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [])

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontSize: '13px',
    color: '#1a1a1a',
    backgroundColor: '#fff',
  }

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  }

  const listStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  }

  const cardStyle: React.CSSProperties = {
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#fafafa',
    cursor: 'default',
  }

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: color,
  })

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: color,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  })

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Meeting Intelligence</span>
        <button
          onClick={fetchMeetings}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ ...btnStyle('#6b7280'), padding: '4px 8px' }}
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div style={listStyle}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
            Loading meetings...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#ef4444' }}>
            {error}
            <br />
            <button
              onClick={fetchMeetings}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...btnStyle('#6b7280'), marginTop: '8px' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && meetings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
            No meetings found
          </div>
        )}

        {meetings.map((m) => (
          <div key={m.id} style={cardStyle}>
            {/* Meeting title + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', flex: 1 }}>
                {m.title || 'Untitled Meeting'}
              </span>
              <span style={badgeStyle(statusColor(m.status))}>
                {m.status}
              </span>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
              <span>{formatDate(m.created_at)}</span>
              <span>{formatDuration(m.duration_seconds)}</span>
              {m.speaker_count != null && <span>{m.speaker_count} speakers</span>}
            </div>

            {/* Pull buttons */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {m.has_summary && (
                <button
                  style={btnStyle('#8b5cf6')}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMeetingSelect?.(m, { summary: true, transcript: false, speakers: false })
                  }}
                >
                  Summary
                </button>
              )}
              {m.has_transcript && (
                <button
                  style={btnStyle('#2563eb')}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMeetingSelect?.(m, { summary: false, transcript: true, speakers: false })
                  }}
                >
                  Transcript
                </button>
              )}
              {(m.speaker_count ?? 0) > 0 && (
                <button
                  style={btnStyle('#059669')}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMeetingSelect?.(m, { summary: false, transcript: false, speakers: true })
                  }}
                >
                  Speakers
                </button>
              )}
              {/* Pull All — only if multiple types available */}
              {(m.has_summary || m.has_transcript) && (
                <button
                  style={btnStyle('#1e293b')}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMeetingSelect?.(m, {
                      summary: !!m.has_summary,
                      transcript: !!m.has_transcript,
                      speakers: (m.speaker_count ?? 0) > 0,
                    })
                  }}
                >
                  Pull All
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
