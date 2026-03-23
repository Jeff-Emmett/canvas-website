import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  createShapeId,
  Box,
  IndexKey,
  TLParentId,
} from "tldraw"
import React, { useState } from "react"
import { MeetingIntelligencePanel } from "../components/MeetingIntelligencePanel"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"
import { FathomNoteShape } from "./FathomNoteShapeUtil"

// Meeting Intelligence API base URL
const MI_API_URL = 'https://meets-api.rspace.online'

type IMeetingIntelligenceBrowser = TLBaseShape<
  "MeetingIntelligenceBrowser",
  {
    w: number
    h: number
    pinnedToView: boolean
    tags: string[]
  }
>

export class MeetingIntelligenceBrowserShape extends BaseBoxShapeUtil<IMeetingIntelligenceBrowser> {
  static override type = "MeetingIntelligenceBrowser" as const

  getDefaultProps(): IMeetingIntelligenceBrowser["props"] {
    return {
      w: 800,
      h: 600,
      pinnedToView: false,
      tags: ['meeting-intelligence', 'meetings', 'transcription'],
    }
  }

  // Meeting Intelligence theme: purple
  static readonly PRIMARY_COLOR = "#8b5cf6"

  component(shape: IMeetingIntelligenceBrowser) {
    const { w, h } = shape.props
    const [isOpen, setIsOpen] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: w,
      currentH: h,
      shapeType: 'MeetingIntelligenceBrowser',
    })

    const handleClose = () => {
      setIsOpen(false)
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IMeetingIntelligenceBrowser>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handleMeetingSelect = async (
      meeting: any,
      options: { summary: boolean; transcript: boolean; speakers: boolean },
    ) => {
      try {
        const meetingId = meeting.id
        if (!meetingId) {
          console.error('No meeting ID found:', meeting)
          return
        }

        const meetingTitle = meeting.title || 'Untitled Meeting'

        // Helper to format date
        const formatDate = (dateStr?: string): string => {
          if (!dateStr) return ''
          try {
            const d = new Date(dateStr)
            return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
          } catch { return '' }
        }
        const meetingDate = formatDate(meeting.created_at)

        // Fetch requested data in parallel
        const [summaryRes, transcriptRes, speakersRes]: [any, any, any] = await Promise.all([
          options.summary
            ? fetch(`${MI_API_URL}/meetings/${meetingId}/summary`).then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null),
          options.transcript
            ? fetch(`${MI_API_URL}/meetings/${meetingId}/transcript`).then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null),
          options.speakers
            ? fetch(`${MI_API_URL}/meetings/${meetingId}/speakers`).then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null),
        ])

        // Position notes next to the browser
        const browserBounds = this.editor.getShapePageBounds(shape.id)
        const spacing = 30
        let startX = browserBounds ? browserBounds.x + browserBounds.w + spacing : 0
        const startY = browserBounds ? browserBounds.y : 0

        const shapeWidth = 500
        const shapeHeight = 600
        const hSpacing = 20

        // Find existing MI shapes for this meeting to avoid overlap
        const allShapes = this.editor.getCurrentPageShapes()
        const existingForMeeting = allShapes.filter(s => {
          if (s.type !== 'FathomNote') return false
          const noteId = (s as any).props?.noteId || ''
          return noteId.includes(`mi-${meetingId}`)
        })
        if (existingForMeeting.length > 0) {
          let rightmost = startX
          existingForMeeting.forEach(s => {
            const b = this.editor.getShapePageBounds(s.id)
            if (b) rightmost = Math.max(rightmost, b.x + b.w)
          })
          startX = rightmost + hSpacing
        }

        let currentX = startX
        const shapesToCreate: any[] = []

        // Summary note
        if (summaryRes) {
          const summaryText = summaryRes.summary_text || summaryRes.summary || summaryRes.overview || ''
          const actionItems = summaryRes.action_items || []
          const decisions = summaryRes.decisions || []
          const keyPoints = summaryRes.key_points || []

          let content = ''
          if (meetingDate) {
            content += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
  <h1 style="margin:0;font-size:18px;font-weight:bold;flex:1;">${meetingTitle}: Summary</h1>
  <span style="font-size:11px;color:#666;margin-left:12px;">${meetingDate}</span>
</div>\n\n`
          } else {
            content += `# ${meetingTitle}: Summary\n\n`
          }
          if (summaryText) content += `${summaryText}\n\n`
          if (keyPoints.length > 0) {
            content += `## Key Points\n${keyPoints.map((p: any) => `- ${typeof p === 'string' ? p : p.text || p.point || ''}`).join('\n')}\n\n`
          }
          if (decisions.length > 0) {
            content += `## Decisions\n${decisions.map((d: any) => `- ${typeof d === 'string' ? d : d.text || d.decision || ''}`).join('\n')}\n\n`
          }
          if (actionItems.length > 0) {
            content += `## Action Items\n${actionItems.map((a: any) => `- [ ] ${a.task || a.text || a.description || ''}`).join('\n')}\n\n`
          }

          shapesToCreate.push({
            ...FathomNoteShape.createFromData(
              { id: `mi-summary-${meetingId}`, title: 'Meeting Summary', content, tags: ['meeting-intelligence', 'summary'], primaryColor: '#8b5cf6' },
              currentX, startY
            ),
            props: {
              ...FathomNoteShape.createFromData(
                { id: `mi-summary-${meetingId}`, title: 'Meeting Summary', content, tags: ['meeting-intelligence', 'summary'], primaryColor: '#8b5cf6' },
                currentX, startY
              ).props,
              w: shapeWidth, h: shapeHeight,
            },
          })
          currentX += shapeWidth + hSpacing
        }

        // Transcript note
        if (transcriptRes) {
          const segments = Array.isArray(transcriptRes) ? transcriptRes : (transcriptRes.segments || transcriptRes.transcript || [])

          let content = ''
          if (meetingDate) {
            content += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
  <h1 style="margin:0;font-size:18px;font-weight:bold;flex:1;">${meetingTitle}: Transcript</h1>
  <span style="font-size:11px;color:#666;margin-left:12px;">${meetingDate}</span>
</div>\n\n`
          } else {
            content += `# ${meetingTitle}: Transcript\n\n`
          }

          if (segments.length > 0) {
            content += segments.map((seg: any) => {
              const speaker = seg.speaker_label || seg.speaker || seg.name || 'Unknown'
              const text = seg.text || seg.content || ''
              const start = seg.start_time != null ? `${Math.floor(seg.start_time / 60)}:${String(Math.floor(seg.start_time % 60)).padStart(2, '0')}` : ''
              return start ? `**${speaker}** (${start}): ${text}` : `**${speaker}**: ${text}`
            }).join('\n\n')
          } else {
            content += '*No transcript segments available.*'
          }

          shapesToCreate.push({
            ...FathomNoteShape.createFromData(
              { id: `mi-transcript-${meetingId}`, title: 'Meeting Transcript', content, tags: ['meeting-intelligence', 'transcript'], primaryColor: '#2563eb' },
              currentX, startY
            ),
            props: {
              ...FathomNoteShape.createFromData(
                { id: `mi-transcript-${meetingId}`, title: 'Meeting Transcript', content, tags: ['meeting-intelligence', 'transcript'], primaryColor: '#2563eb' },
                currentX, startY
              ).props,
              w: shapeWidth, h: shapeHeight,
            },
          })
          currentX += shapeWidth + hSpacing
        }

        // Speakers note
        if (speakersRes) {
          const speakers = Array.isArray(speakersRes) ? speakersRes : (speakersRes.speakers || [])

          let content = ''
          if (meetingDate) {
            content += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
  <h1 style="margin:0;font-size:18px;font-weight:bold;flex:1;">${meetingTitle}: Speakers</h1>
  <span style="font-size:11px;color:#666;margin-left:12px;">${meetingDate}</span>
</div>\n\n`
          } else {
            content += `# ${meetingTitle}: Speakers\n\n`
          }

          if (speakers.length > 0) {
            content += speakers.map((s: any) => {
              const name = s.speaker_label || s.name || s.label || 'Unknown'
              const time = s.speaking_time || s.speaking_time_seconds || 0
              const mins = Math.floor(time / 60)
              const secs = Math.floor(time % 60)
              const segments = s.segment_count || s.segments || '—'
              return `### ${name}\n- Speaking time: ${mins}m ${secs}s\n- Segments: ${segments}`
            }).join('\n\n')
          } else {
            content += '*No speaker data available.*'
          }

          shapesToCreate.push({
            ...FathomNoteShape.createFromData(
              { id: `mi-speakers-${meetingId}`, title: 'Meeting Speakers', content, tags: ['meeting-intelligence', 'speakers'], primaryColor: '#059669' },
              currentX, startY
            ),
            props: {
              ...FathomNoteShape.createFromData(
                { id: `mi-speakers-${meetingId}`, title: 'Meeting Speakers', content, tags: ['meeting-intelligence', 'speakers'], primaryColor: '#059669' },
                currentX, startY
              ).props,
              w: shapeWidth, h: shapeHeight,
            },
          })
        }

        // Create all shapes at once
        if (shapesToCreate.length > 0) {
          this.editor.createShapes(shapesToCreate)

          // Zoom to show results
          setTimeout(() => {
            const firstBounds = this.editor.getShapePageBounds(shapesToCreate[0].id)
            if (firstBounds && browserBounds) {
              const combined = Box.Common([browserBounds, firstBounds])
              this.editor.zoomToBounds(combined, {
                inset: 50,
                animation: { duration: 500, easing: (t) => t * (2 - t) },
              })
            }
            this.editor.setSelectedShapes([shapesToCreate[0].id] as any)
            this.editor.setCurrentTool('select')
          }, 50)
        }
      } catch (error) {
        console.error('Error creating Meeting Intelligence shapes:', error)
      }
    }

    if (!isOpen) return null

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Meeting Intelligence"
          primaryColor={MeetingIntelligenceBrowserShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IMeetingIntelligenceBrowser>({
              id: shape.id,
              type: 'MeetingIntelligenceBrowser',
              props: { ...shape.props, tags: newTags },
            })
          }}
          tagsEditable={true}
        >
          <MeetingIntelligencePanel
            onClose={handleClose}
            onMeetingSelect={handleMeetingSelect}
            shapeMode={true}
          />
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IMeetingIntelligenceBrowser) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
