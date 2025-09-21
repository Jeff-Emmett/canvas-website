import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState, useRef, useEffect } from "react"
import { useWhisperTranscription } from "../hooks/useWhisperTranscription"
import { getOpenAIConfig, isOpenAIConfigured } from "../lib/clientConfig"

type ITranscription = TLBaseShape<
  "Transcription",
  {
    w: number
    h: number
    text: string
    isEditing?: boolean
    editingContent?: string
    isTranscribing?: boolean
    isPaused?: boolean
  }
>

// Auto-resizing textarea component (similar to ObsNoteShape)
const AutoResizeTextarea: React.FC<{
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  style: React.CSSProperties
  placeholder?: string
  onPointerDown?: (e: React.PointerEvent) => void
}> = ({ value, onChange, onBlur, onKeyDown, style, placeholder, onPointerDown }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    adjustHeight()
    // Focus the textarea when it mounts
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        adjustHeight()
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      style={style}
      placeholder={placeholder}
      rows={1}
      autoFocus
    />
  )
}

export class TranscriptionShape extends BaseBoxShapeUtil<ITranscription> {
  static override type = "Transcription" as const

  getDefaultProps(): ITranscription["props"] {
    return {
      w: 400,
      h: 100,
      text: "",
      isEditing: false,
      isTranscribing: false,
      isPaused: false,
    }
  }

  component(shape: ITranscription) {
    const { w, h, text, isEditing = false, isTranscribing = false, isPaused = false } = shape.props
    const [isHovering, setIsHovering] = useState(false)
    const [editingContent, setEditingContent] = useState(shape.props.editingContent || text)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Get OpenAI configuration
    const openaiConfig = getOpenAIConfig()
    const isOpenAIConfiguredFlag = isOpenAIConfigured()

    // Whisper transcription hook
    const {
      isRecording,
      isSpeaking,
      isTranscribing: hookIsTranscribing,
      transcript,
      startTranscription,
      stopTranscription,
      pauseTranscription
    } = useWhisperTranscription({
      apiKey: openaiConfig?.apiKey,
      onTranscriptUpdate: (newText: string) => {
        console.log('📝 Whisper transcript updated in TranscriptionShape:', newText)
        // Update the shape with new text
        this.editor.updateShape<ITranscription>({
          id: shape.id,
          type: 'Transcription',
          props: {
            ...shape.props,
            text: newText,
            h: Math.max(100, Math.ceil(newText.length / 50) * 20 + 60) // Dynamic height
          }
        })
      },
      onError: (error: Error) => {
        console.error('❌ Whisper transcription error:', error)
        // Update shape state to stop transcribing on error
        this.editor.updateShape<ITranscription>({
          id: shape.id,
          type: 'Transcription',
          props: {
            ...shape.props,
            isTranscribing: false
          }
        })
      },
      language: 'en',
      enableStreaming: true,
      removeSilence: true
    })
    

    const handleStartEdit = () => {
      setEditingContent(text)
      this.editor.updateShape<ITranscription>({
        id: shape.id,
        type: "Transcription",
        props: {
          ...shape.props,
          isEditing: true,
          editingContent: text,
        },
      })
    }

    const handleSaveEdit = () => {
      this.editor.updateShape<ITranscription>({
        id: shape.id,
        type: "Transcription",
        props: {
          ...shape.props,
          isEditing: false,
          text: editingContent,
          editingContent: undefined,
        },
      })
    }

    const handleCancelEdit = () => {
      this.editor.updateShape<ITranscription>({
        id: shape.id,
        type: "Transcription",
        props: {
          ...shape.props,
          isEditing: false,
          editingContent: undefined,
        },
      })
    }

    const handleTextChange = (newText: string) => {
      setEditingContent(newText)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSaveEdit()
      }
    }

    const handleTranscriptionToggle = async () => {
      try {
        if (isTranscribing && !isPaused) {
          // Currently transcribing, pause it
          console.log('⏸️ Pausing transcription...')
          pauseTranscription()
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              isPaused: true
            }
          })
        } else if (isTranscribing && isPaused) {
          // Currently paused, resume it
          console.log('▶️ Resuming transcription...')
          startTranscription()
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              isPaused: false
            }
          })
        } else {
          // Not transcribing, start it
          console.log('🎤 Starting transcription...')
          startTranscription()
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              isTranscribing: true,
              isPaused: false
            }
          })
        }
      } catch (error) {
        console.error('❌ Transcription toggle error:', error)
      }
    }

    const handleStopTranscription = async () => {
      try {
        console.log('🛑 Stopping transcription...')
        stopTranscription()
        this.editor.updateShape<ITranscription>({
          id: shape.id,
          type: 'Transcription',
          props: {
            ...shape.props,
            isTranscribing: false,
            isPaused: false
          }
        })
      } catch (error) {
        console.error('❌ Stop transcription error:', error)
      }
    }

    const wrapperStyle: React.CSSProperties = {
      width: w,
      height: h,
      backgroundColor: isHovering ? "#f8f9fa" : "white",
      border: isSelected ? '2px solid #007acc' : (isHovering ? "2px solid #007bff" : "1px solid #ccc"),
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: isSelected ? '0 0 0 2px #007acc' : '0 2px 4px rgba(0,0,0,0.1)',
      cursor: isSelected ? 'move' : 'pointer',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "Inter, sans-serif",
      fontSize: "14px",
      lineHeight: "1.4",
      color: "black",
      transition: "all 0.2s ease",
    }

    const headerStyle: React.CSSProperties = {
      padding: '8px 12px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #e0e0e0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: '16px',
      fontSize: '12px',
      fontWeight: 'bold',
      color: '#666',
    }

    const contentStyle: React.CSSProperties = {
      padding: '12px',
      flex: 1,
      overflow: 'auto',
      color: 'black',
      fontSize: '12px',
      lineHeight: '1.4',
      cursor: isEditing ? 'text' : 'pointer',
      transition: 'background-color 0.2s ease',
    }

    const textareaStyle: React.CSSProperties = {
      width: '100%',
      minHeight: '60px',
      border: 'none',
      outline: 'none',
      resize: 'none',
      fontFamily: 'inherit',
      fontSize: '12px',
      lineHeight: '1.4',
      color: 'black',
      backgroundColor: 'transparent',
      padding: 0,
      margin: 0,
      position: 'relative',
      zIndex: 1000,
      pointerEvents: 'auto',
    }

    const editControlsStyle: React.CSSProperties = {
      display: 'flex',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: '#f8f9fa',
      borderTop: '1px solid #e0e0e0',
      position: 'relative',
      zIndex: 1000,
      pointerEvents: 'auto',
    }

    const buttonStyle: React.CSSProperties = {
      padding: '4px 8px',
      fontSize: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: 'white',
      cursor: 'pointer',
      zIndex: 1000,
      position: 'relative',
    }

    return (
      <HTMLContainer
        style={wrapperStyle}
        onDoubleClick={handleStartEdit}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div style={headerStyle}>
          <span>🎤 Transcription</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {!isEditing && (
              <>
                <button
                  style={{
                    ...buttonStyle,
                    background: isTranscribing 
                      ? (isPaused ? "#ffa500" : "#ff4444") 
                      : "#007bff",
                    color: "white",
                    border: isTranscribing 
                      ? (isPaused ? "1px solid #cc8400" : "1px solid #cc0000") 
                      : "1px solid #0056b3",
                  }}
                  onClick={handleTranscriptionToggle}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={!isOpenAIConfiguredFlag}
                  title={!isOpenAIConfiguredFlag ? "OpenAI API key not configured" : ""}
                >
                  {isTranscribing 
                    ? (isPaused ? "Resume" : "Pause") 
                    : "Start"}
                </button>
                {isTranscribing && (
                  <button
                    style={{
                      ...buttonStyle,
                      background: "#dc3545",
                      color: "white",
                      border: "1px solid #c82333",
                    }}
                    onClick={handleStopTranscription}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Stop transcription"
                  >
                    Stop
                  </button>
                )}
              </>
            )}
            {isEditing && (
              <>
                <button
                  style={buttonStyle}
                  onClick={handleSaveEdit}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Save
                </button>
                <button
                  style={buttonStyle}
                  onClick={handleCancelEdit}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
        
        <div style={contentStyle}>
          {isEditing ? (
            <AutoResizeTextarea
              value={editingContent}
              onChange={handleTextChange}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              style={textareaStyle}
              placeholder="Transcription will appear here..."
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                cursor: "text",
              }}
            >
              {text || (isHovering ? "Double-click to edit transcription..." : 
                isTranscribing ? "🎤 Listening... Speak now..." : 
                "Click 'Start' to begin transcription...")}
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: ITranscription) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
