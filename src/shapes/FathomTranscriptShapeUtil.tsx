import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"

type IFathomTranscript = TLBaseShape<
  "FathomTranscript",
  {
    w: number
    h: number
    meetingId: string
    meetingTitle: string
    meetingUrl: string
    summary: string
    transcript: Array<{
      speaker: string
      text: string
      timestamp: string
    }>
    actionItems: Array<{
      text: string
      assignee?: string
      dueDate?: string
    }>
    isExpanded: boolean
    showTranscript: boolean
    showActionItems: boolean
  }
>

export class FathomTranscriptShape extends BaseBoxShapeUtil<IFathomTranscript> {
  static override type = "FathomTranscript" as const

  // Fathom Transcript theme color: Blue (same as FathomMeetings)
  static readonly PRIMARY_COLOR = "#3b82f6"

  getDefaultProps(): IFathomTranscript["props"] {
    return {
      w: 600,
      h: 400,
      meetingId: "",
      meetingTitle: "",
      meetingUrl: "",
      summary: "",
      transcript: [],
      actionItems: [],
      isExpanded: false,
      showTranscript: true,
      showActionItems: true,
    }
  }

  component(shape: IFathomTranscript) {
    const { 
      w, 
      h, 
      meetingId, 
      meetingTitle, 
      meetingUrl, 
      summary, 
      transcript, 
      actionItems,
      isExpanded,
      showTranscript,
      showActionItems
    } = shape.props
    
    const [isHovering, setIsHovering] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    const toggleExpanded = useCallback(() => {
      this.editor.updateShape<IFathomTranscript>({
        id: shape.id,
        type: 'FathomTranscript',
        props: {
          ...shape.props,
          isExpanded: !isExpanded
        }
      })
    }, [shape.id, shape.props, isExpanded])

    const toggleTranscript = useCallback(() => {
      this.editor.updateShape<IFathomTranscript>({
        id: shape.id,
        type: 'FathomTranscript',
        props: {
          ...shape.props,
          showTranscript: !showTranscript
        }
      })
    }, [shape.id, shape.props, showTranscript])

    const toggleActionItems = useCallback(() => {
      this.editor.updateShape<IFathomTranscript>({
        id: shape.id,
        type: 'FathomTranscript',
        props: {
          ...shape.props,
          showActionItems: !showActionItems
        }
      })
    }, [shape.id, shape.props, showActionItems])

    const formatTimestamp = (timestamp: string) => {
      // Convert timestamp to readable format
      const seconds = parseInt(timestamp)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const buttonStyle: React.CSSProperties = {
      padding: '4px 8px',
      fontSize: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: 'white',
      cursor: 'pointer',
    }

    // Custom header content with meeting info and toggle buttons
    const headerContent = (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎥 Fathom Meeting</span>
          {meetingId && <span style={{ fontSize: '10px', color: '#666' }}>#{meetingId}</span>}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleTranscript()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              ...buttonStyle,
              backgroundColor: showTranscript ? '#007bff' : '#6c757d',
              color: 'white',
            }}
          >
            📝 Transcript
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleActionItems()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              ...buttonStyle,
              backgroundColor: showActionItems ? '#28a745' : '#6c757d',
              color: 'white',
            }}
          >
            ✅ Actions
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleExpanded()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              ...buttonStyle,
              backgroundColor: isExpanded ? '#ffc107' : '#6c757d',
              color: 'white',
            }}
          >
            {isExpanded ? '📄 Expanded' : '📄 Compact'}
          </button>
        </div>
      </div>
    )

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const contentStyle: React.CSSProperties = {
      padding: '16px',
      flex: 1,
      overflow: 'auto',
      color: 'black',
      fontSize: '12px',
      lineHeight: '1.4',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }

    const transcriptEntryStyle: React.CSSProperties = {
      marginBottom: '8px',
      padding: '8px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      borderLeft: '3px solid #007bff',
    }

    const actionItemStyle: React.CSSProperties = {
      marginBottom: '6px',
      padding: '6px',
      backgroundColor: '#fff3cd',
      borderRadius: '4px',
      borderLeft: '3px solid #ffc107',
    }

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Fathom Transcript"
          primaryColor={FathomTranscriptShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          headerContent={headerContent}
          editor={this.editor}
          shapeId={shape.id}
        >
        
        <div style={contentStyle}>
          {/* Meeting Title */}
          <div style={{ marginBottom: '8px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
              {meetingTitle || 'Untitled Meeting'}
            </h3>
            {meetingUrl && (
              <a 
                href={meetingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  fontSize: '10px', 
                  color: '#007bff', 
                  textDecoration: 'none' 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                View in Fathom →
              </a>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                📋 Summary
              </h4>
              <div style={{ 
                padding: '8px', 
                backgroundColor: '#e7f3ff', 
                borderRadius: '4px',
                fontSize: '11px',
                lineHeight: '1.4'
              }}>
                {summary}
              </div>
            </div>
          )}

          {/* Action Items */}
          {showActionItems && actionItems.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                ✅ Action Items ({actionItems.length})
              </h4>
              <div style={{ maxHeight: isExpanded ? 'none' : '120px', overflow: 'auto' }}>
                {actionItems.map((item, index) => (
                  <div key={index} style={actionItemStyle}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                      {item.text}
                    </div>
                    {item.assignee && (
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                        👤 {item.assignee}
                      </div>
                    )}
                    {item.dueDate && (
                      <div style={{ fontSize: '10px', color: '#666' }}>
                        📅 {item.dueDate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {showTranscript && transcript.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                💬 Transcript ({transcript.length} entries)
              </h4>
              <div style={{ maxHeight: isExpanded ? 'none' : '200px', overflow: 'auto' }}>
                {transcript.map((entry, index) => (
                  <div key={index} style={transcriptEntryStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#007bff' }}>
                        {entry.speaker}
                      </span>
                      <span style={{ fontSize: '10px', color: '#666' }}>
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                      {entry.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!summary && transcript.length === 0 && actionItems.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              fontSize: '12px',
              padding: '20px',
              fontStyle: 'italic'
            }}>
              No meeting data available
            </div>
          )}
        </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IFathomTranscript) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}

















