import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  createShapeId,
  Box,
} from "tldraw"
import React, { useState, useContext } from "react"
import { FathomMeetingsPanel } from "../components/FathomMeetingsPanel"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { FathomNoteShape } from "./FathomNoteShapeUtil"
import { WORKER_URL, LOCAL_WORKER_URL } from "../constants/workerUrl"
import { getFathomApiKey } from "../lib/fathomApiKey"
import { AuthContext } from "../context/AuthContext"

type IFathomMeetingsBrowser = TLBaseShape<
  "FathomMeetingsBrowser",
  {
    w: number
    h: number
    pinnedToView: boolean
    tags: string[]
  }
>

export class FathomMeetingsBrowserShape extends BaseBoxShapeUtil<IFathomMeetingsBrowser> {
  static override type = "FathomMeetingsBrowser" as const

  getDefaultProps(): IFathomMeetingsBrowser["props"] {
    return {
      w: 800,
      h: 600,
      pinnedToView: false,
      tags: ['fathom', 'meetings', 'browser'],
    }
  }

  // Fathom theme color: Blue (Rainbow)
  static readonly PRIMARY_COLOR = "#3b82f6"

  component(shape: IFathomMeetingsBrowser) {
    const { w, h } = shape.props
    const [isOpen, setIsOpen] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const handleClose = () => {
      setIsOpen(false)
      // Delete the browser shape immediately so it's tracked in undo/redo history
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IFathomMeetingsBrowser>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    // Wrapper component to access auth context and create handler
    const FathomBrowserContent: React.FC = () => {
      const authContext = useContext(AuthContext)
      const fallbackSession = {
        username: '',
        authed: false,
        loading: false,
        backupCreated: null,
      }
      const session = authContext?.session || fallbackSession

      const handleMeetingSelect = async (
        meeting: any,
        options: { summary: boolean; transcript: boolean; actionItems: boolean; video: boolean },
        format: 'fathom' | 'note'
      ) => {
        try {
          // CRITICAL: Store meeting data immediately to avoid closure issues
          // Extract all needed values before any async operations
          const meetingRecordingId = meeting?.recording_id
          const meetingTitle = meeting?.title
          
          if (!meetingRecordingId) {
            console.error('❌ No recording_id found in meeting object:', meeting)
            return
          }
          
          // Log to verify the correct meeting is being received
          console.log('🔵 handleMeetingSelect called with meeting:', {
            recording_id: meetingRecordingId,
            title: meetingTitle,
            options,
            fullMeetingObject: meeting
          })
          
          // Get API key from user identity
          const apiKey = getFathomApiKey(session.username)
          if (!apiKey) {
            console.error('No Fathom API key found')
            return
          }

        // IMPORTANT: Each meeting row fetches its own data using the meeting's recording_id
        // This ensures each meeting's buttons pull data from the correct Fathom API endpoint
        // Always fetch full meeting details from API (summary and action items are included by default)
        // Only include transcript parameter if transcript is specifically requested
        const includeTranscript = options.transcript
        
        // Use the stored meetingRecordingId (already extracted above)
        console.log('🔵 Fetching data for meeting recording_id:', meetingRecordingId)
        
        let response
        try {
          // Fetch data for THIS specific meeting using its recording_id
          const apiUrl = `${WORKER_URL}/fathom/meetings/${meetingRecordingId}${includeTranscript ? '?include_transcript=true' : ''}`
          console.log('🔵 API URL:', apiUrl)
          response = await fetch(apiUrl, {
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json'
            }
          })
        } catch (error) {
          // Use the stored meetingRecordingId to ensure we fetch the correct meeting
          response = await fetch(`${LOCAL_WORKER_URL}/fathom/meetings/${meetingRecordingId}${includeTranscript ? '?include_transcript=true' : ''}`, {
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json'
            }
          })
        }

        if (!response.ok) {
          console.error(`Failed to fetch meeting details: ${response.status}`)
          return
        }

        const fullMeeting = await response.json() as any

        // Debug: Log the meeting response structure
        console.log('Full meeting response:', fullMeeting)
        console.log('Meeting keys:', Object.keys(fullMeeting))
        console.log('Has default_summary:', !!fullMeeting.default_summary)
        console.log('Has action_items:', !!fullMeeting.action_items)
        if (fullMeeting.default_summary) {
          console.log('default_summary structure:', fullMeeting.default_summary)
        }
        if (fullMeeting.action_items) {
          console.log('action_items length:', fullMeeting.action_items.length)
        }

        // Helper function to format date as YYYY.MM.DD
        const formatDateForTitle = (dateString: string | undefined): string => {
          if (!dateString) return ''
          try {
            const date = new Date(dateString)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}.${month}.${day}`
          } catch {
            return ''
          }
        }

        // Get meeting name and date for title formatting
        // Use the stored meetingRecordingId to ensure we're using the correct meeting
        // Also use the stored meetingTitle as fallback
        const meetingName = fullMeeting.title || meetingTitle || 'Meeting'
        const meetingDate = formatDateForTitle(fullMeeting.recording_start_time || fullMeeting.created_at)

        // Get browser shape bounds for positioning
        const browserShapeBounds = this.editor.getShapePageBounds(shape.id)
        let startX: number
        let startY: number

        if (!browserShapeBounds) {
          const viewport = this.editor.getViewportPageBounds()
          startX = viewport.x + viewport.w / 2
          startY = viewport.y + viewport.h / 2
        } else {
          // Position notes close to the browser (reduced spacing for closer positioning)
          const browserSpacing = 30
          startX = browserShapeBounds.x + browserShapeBounds.w + browserSpacing
          startY = browserShapeBounds.y
        }

        // Track existing shapes by meeting ID for proper grouping
        const allShapes = this.editor.getCurrentPageShapes()
        const browserSpacing = 30
        const expectedStartX = browserShapeBounds ? browserShapeBounds.x + browserShapeBounds.w + browserSpacing : startX
        
        // Find existing shapes for this specific meeting
        // Use meetingRecordingId to ensure we're using the correct meeting ID
        const currentMeetingId = meetingRecordingId
        const existingShapesForThisMeeting = allShapes.filter(s => {
          if (s.type !== 'FathomNote') return false
          // Check if shape belongs to this meeting by checking the noteId prop
          const noteId = (s as any).props?.noteId || ''
          return noteId.includes(`fathom-${currentMeetingId}`) || noteId.includes(`fathom-summary-${currentMeetingId}`) || 
                 noteId.includes(`fathom-transcript-${currentMeetingId}`) || noteId.includes(`fathom-actions-${currentMeetingId}`)
        })

        // Find all existing Fathom shapes to determine vertical positioning
        const allExistingFathomShapes = allShapes.filter(s => {
          if (s.type !== 'FathomNote') return false
          const noteId = (s as any).props?.noteId || ''
          return noteId.startsWith('fathom-')
        })

        // Calculate which meeting row this is (0 = first meeting row)
        const meetingIds = new Set<string>()
        allExistingFathomShapes.forEach(s => {
          const noteId = (s as any).props?.noteId || ''
          const match = noteId.match(/fathom-(?:summary|transcript|actions)-(.+)/)
          if (match) {
            meetingIds.add(match[1])
          }
        })
        const meetingRowIndex = Array.from(meetingIds).indexOf(currentMeetingId)
        const actualMeetingRowIndex = meetingRowIndex >= 0 ? meetingRowIndex : meetingIds.size

        // Shape dimensions - all shapes are the same size
        const shapeWidth = 500
        const shapeHeight = 600
        const horizontalSpacing = 20
        const verticalSpacing = 30 // Space between meeting rows

        const shapesToCreate: any[] = []

        // Calculate Y position for this meeting's shapes
        // If this meeting already has shapes, use the Y position of the first existing shape
        // Otherwise, calculate based on meeting row index
        let baseY: number
        if (existingShapesForThisMeeting.length > 0) {
          // Use the Y position of existing shapes for this meeting to ensure they're on the same line
          const firstExistingShapeBounds = this.editor.getShapePageBounds(existingShapesForThisMeeting[0].id)
          baseY = firstExistingShapeBounds ? firstExistingShapeBounds.y : startY + actualMeetingRowIndex * (shapeHeight + verticalSpacing)
        } else {
          // New meeting row - calculate position based on row index
          baseY = startY + actualMeetingRowIndex * (shapeHeight + verticalSpacing)
        }

        // Calculate horizontal positions for this meeting's shapes
        // Summary, Transcript, Action Items will be side by side on the same horizontal line
        // Each meeting row is positioned below the previous one
        let currentX = startX
        
        // If this meeting already has shapes, position new shapes after the existing ones
        if (existingShapesForThisMeeting.length > 0) {
          // Find the rightmost existing shape for this meeting
          let rightmostX = startX
          existingShapesForThisMeeting.forEach(s => {
            const bounds = this.editor.getShapePageBounds(s.id)
            if (bounds) {
              const shapeRight = bounds.x + bounds.w
              if (shapeRight > rightmostX) {
                rightmostX = shapeRight
              }
            }
          })
          // Start new shapes after the rightmost existing shape
          currentX = rightmostX + horizontalSpacing
        }

        // Create shapes for each selected data type in button order: Summary, Transcript, Action Items
        // Position shapes horizontally for the same meeting, vertically for different meetings
        // Blue shades match button colors: Summary (#3b82f6), Transcript (#2563eb), Actions (#1d4ed8)
        
        if (options.summary) {
          // Check for summary in various possible formats from Fathom API
          const summaryText = fullMeeting.default_summary?.markdown_formatted || 
                             fullMeeting.default_summary?.text || 
                             fullMeeting.summary?.markdown_formatted ||
                             fullMeeting.summary?.text ||
                             fullMeeting.summary ||
                             ''
          
          if (summaryText) {
            const xPos = currentX
            const yPos = baseY

            // Create Fathom note shape for summary with lightest blue (#3b82f6)
            // Format: date in top right, title in content
            const contentWithHeader = meetingDate 
              ? `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
  <h1 style="margin: 0; font-size: 18px; font-weight: bold; flex: 1;">${meetingName}: Fathom Summary</h1>
  <span style="font-size: 11px; color: #666; margin-left: 12px;">${meetingDate}</span>
</div>\n\n${summaryText}`
              : `# ${meetingName}: Fathom Summary\n\n${summaryText}`
            const noteShape = FathomNoteShape.createFromData(
              {
                id: `fathom-summary-${meetingRecordingId}`,
                title: 'Fathom Meeting Object: Summary',
                content: contentWithHeader,
                tags: ['fathom', 'summary'],
                primaryColor: '#3b82f6', // Lightest blue - matches Summary button
              },
              xPos,
              yPos
            )
            // Update the shape dimensions - all shapes same size
            const updatedNoteShape = {
              ...noteShape,
              props: {
                ...noteShape.props,
                w: shapeWidth,
                h: shapeHeight,
              }
            }
            shapesToCreate.push(updatedNoteShape)
            currentX += shapeWidth + horizontalSpacing
          } else {
            console.warn('Summary requested but no summary data found in meeting response')
          }
        }

        if (options.transcript) {
          // Check for transcript data
          const transcript = fullMeeting.transcript || []
          
          if (transcript.length > 0) {
            const xPos = currentX
            const yPos = baseY

            // Create Fathom note shape for transcript with medium blue (#2563eb)
            const transcriptText = transcript.map((entry: any) => {
              const speaker = entry.speaker?.display_name || 'Unknown'
              const text = entry.text || ''
              const timestamp = entry.timestamp || ''
              return timestamp ? `**${speaker}** (${timestamp}): ${text}` : `**${speaker}**: ${text}`
            }).join('\n\n')

            // Format: date in top right, title in content
            const contentWithHeader = meetingDate 
              ? `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
  <h1 style="margin: 0; font-size: 18px; font-weight: bold; flex: 1;">${meetingName}: Fathom Transcript</h1>
  <span style="font-size: 11px; color: #666; margin-left: 12px;">${meetingDate}</span>
</div>\n\n${transcriptText}`
              : `# ${meetingName}: Fathom Transcript\n\n${transcriptText}`
            const noteShape = FathomNoteShape.createFromData(
              {
                id: `fathom-transcript-${meetingRecordingId}`,
                title: 'Fathom Meeting Object: Transcript',
                content: contentWithHeader,
                tags: ['fathom', 'transcript'],
                primaryColor: '#2563eb', // Medium blue - matches Transcript button
              },
              xPos,
              yPos
            )
            // Update the shape dimensions - same size as others
            const updatedNoteShape = {
              ...noteShape,
              props: {
                ...noteShape.props,
                w: shapeWidth,
                h: shapeHeight,
              }
            }
            shapesToCreate.push(updatedNoteShape)
            currentX += shapeWidth + horizontalSpacing
          } else {
            console.warn('Transcript requested but no transcript data found in meeting response')
          }
        }

        if (options.actionItems) {
          // Check for action items in various possible formats from Fathom API
          const actionItems = fullMeeting.action_items || fullMeeting.actionItems || []
          
          if (actionItems.length > 0) {
            const xPos = currentX
            const yPos = baseY

            // Create Fathom note shape for action items with darker blue (#1d4ed8)
            const actionItemsText = actionItems.map((item: any) => {
              const description = item.description || item.text || item.title || ''
              const assignee = item.assignee?.name || item.assignee || item.owner?.name || item.owner || ''
              const dueDate = item.due_date || item.dueDate || item.due || ''
              let itemText = `- [ ] ${description}`
              if (assignee) itemText += ` (@${assignee})`
              if (dueDate) itemText += ` - Due: ${dueDate}`
              return itemText
            }).join('\n')

            // Format: date in top right, title in content
            const contentWithHeader = meetingDate 
              ? `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
  <h1 style="margin: 0; font-size: 18px; font-weight: bold; flex: 1;">${meetingName}: Fathom Action Items</h1>
  <span style="font-size: 11px; color: #666; margin-left: 12px;">${meetingDate}</span>
</div>\n\n${actionItemsText}`
              : `# ${meetingName}: Fathom Action Items\n\n${actionItemsText}`
            const noteShape = FathomNoteShape.createFromData(
              {
                id: `fathom-actions-${meetingRecordingId}`,
                title: 'Fathom Meeting Object: Action Items',
                content: contentWithHeader,
                tags: ['fathom', 'action-items'],
                primaryColor: '#1d4ed8', // Darker blue - matches Action Items button
              },
              xPos,
              yPos
            )
            // Update the shape dimensions - same size as others
            const updatedNoteShape = {
              ...noteShape,
              props: {
                ...noteShape.props,
                w: shapeWidth,
                h: shapeHeight,
              }
            }
            shapesToCreate.push(updatedNoteShape)
            currentX += shapeWidth + horizontalSpacing
          } else {
            console.warn('Action items requested but no action items found in meeting response')
          }
        }

        if (options.video) {
          // Open Fathom video URL directly in a new tab instead of creating a note shape
          // Try multiple sources for the correct video URL
          // The Fathom API may provide url, share_url, or we may need to construct from call_id or id
          const callId = fullMeeting.call_id || 
                        fullMeeting.id || 
                        fullMeeting.recording_id || 
                        meeting.call_id || 
                        meeting.id || 
                        meeting.recording_id
          
          // Check if URL fields contain valid meeting URLs (contain /calls/)
          const isValidMeetingUrl = (url: string) => url && url.includes('/calls/')
          
          // Prioritize valid meeting URLs, then construct from call ID
          const videoUrl = (fullMeeting.url && isValidMeetingUrl(fullMeeting.url)) ? fullMeeting.url :
                          (fullMeeting.share_url && isValidMeetingUrl(fullMeeting.share_url)) ? fullMeeting.share_url :
                          (meeting.url && isValidMeetingUrl(meeting.url)) ? meeting.url :
                          (meeting.share_url && isValidMeetingUrl(meeting.share_url)) ? meeting.share_url :
                          (callId ? `https://fathom.video/calls/${callId}` : null)
          
          if (videoUrl) {
            console.log('Opening Fathom video URL:', videoUrl, 'for meeting:', { callId, recording_id: meeting.recording_id })
            window.open(videoUrl, '_blank', 'noopener,noreferrer')
          } else {
            console.error('Could not determine Fathom video URL for meeting:', { meeting, fullMeeting })
          }
        }

        // Create all shapes at once
        if (shapesToCreate.length > 0) {
          this.editor.createShapes(shapesToCreate)
          
          // Animate camera to the first created note

          // Animate camera to show the note
          setTimeout(() => {
            const firstShapeId = shapesToCreate[0].id
            // getShapePageBounds works with raw ID, setSelectedShapes needs "shape:" prefix
            const rawShapeId = firstShapeId.startsWith('shape:') ? firstShapeId.replace('shape:', '') : firstShapeId
            const shapeIdWithPrefix = `shape:${rawShapeId}`
            
            const firstShapeBounds = this.editor.getShapePageBounds(rawShapeId)
            
            if (firstShapeBounds) {
              let boundsToShow = firstShapeBounds
              
              if (browserShapeBounds) {
                const minX = Math.min(browserShapeBounds.x, firstShapeBounds.x)
                const maxX = Math.max(browserShapeBounds.x + browserShapeBounds.w, firstShapeBounds.x + firstShapeBounds.w)
                const minY = Math.min(browserShapeBounds.y, firstShapeBounds.y)
                const maxY = Math.max(browserShapeBounds.y + browserShapeBounds.h, firstShapeBounds.y + firstShapeBounds.h)
                
                boundsToShow = Box.Common([browserShapeBounds, firstShapeBounds])
              }
              
              this.editor.zoomToBounds(boundsToShow, {
                inset: 50,
                animation: {
                  duration: 500,
                  easing: (t) => t * (2 - t),
                },
              })
            }
            
            this.editor.setSelectedShapes([shapeIdWithPrefix] as any)
            this.editor.setCurrentTool('select')
          }, 50)
        }
      } catch (error) {
        console.error('Error creating Fathom meeting shapes:', error)
      }
    }

      if (!isOpen) {
        return null
      }

      return (
        <HTMLContainer style={{ width: w, height: h }}>
          <StandardizedToolWrapper
            title="Fathom Meetings"
            primaryColor={FathomMeetingsBrowserShape.PRIMARY_COLOR}
            isSelected={isSelected}
            width={w}
            height={h}
            onClose={handleClose}
            onMinimize={handleMinimize}
            isMinimized={isMinimized}
            editor={this.editor}
            shapeId={shape.id}
            isPinnedToView={shape.props.pinnedToView}
            onPinToggle={handlePinToggle}
            tags={shape.props.tags}
            onTagsChange={(newTags) => {
              this.editor.updateShape<IFathomMeetingsBrowser>({
                id: shape.id,
                type: 'FathomMeetingsBrowser',
                props: {
                  ...shape.props,
                  tags: newTags,
                }
              })
            }}
            tagsEditable={true}
          >
            <FathomMeetingsPanel
              onClose={handleClose}
              onMeetingSelect={handleMeetingSelect}
              shapeMode={true}
            />
          </StandardizedToolWrapper>
        </HTMLContainer>
      )
    }

    return <FathomBrowserContent />
  }

  indicator(shape: IFathomMeetingsBrowser) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
