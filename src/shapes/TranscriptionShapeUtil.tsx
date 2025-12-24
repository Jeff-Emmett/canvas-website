import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useWhisperTranscription } from "../hooks/useWhisperTranscriptionSimple"
import { useWebSpeechTranscription } from "../hooks/useWebSpeechTranscription"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"

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
    fixedHeight?: boolean // New property to control resizing
    pinnedToView: boolean
    tags: string[]
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
  onTouchStart?: (e: React.TouchEvent) => void
  onWheel?: (e: React.WheelEvent) => void
}> = ({ value, onChange, onBlur, onKeyDown, style, placeholder, onPointerDown, onTouchStart, onWheel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
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
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      onWheel={onWheel}
      style={{
        ...style,
        touchAction: 'manipulation',
      }}
      placeholder={placeholder}
      autoFocus
    />
  )
}

export class TranscriptionShape extends BaseBoxShapeUtil<ITranscription> {
  static override type = "Transcription" as const

  // Transcription theme color: Orange
  static readonly PRIMARY_COLOR = "#ff9500"

  // Note: props validation is handled by the schema registration in useAutomergeStoreV2

  getDefaultProps(): ITranscription["props"] {
    return {
      w: 500,
      h: 350,
      text: "",
      isEditing: false,
      isTranscribing: false,
      isPaused: false,
      fixedHeight: true, // Start with fixed height
      pinnedToView: false,
      tags: ['transcription'],
    }
  }

  component(shape: ITranscription) {
    const { w, h, text = '', isEditing = false, isTranscribing = false, isPaused = false } = shape.props
    const [isHovering, setIsHovering] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [editingContent, setEditingContent] = useState(shape.props.editingContent || text || '')
    
    const [recordingDuration, setRecordingDuration] = useState(0)
    const [useWebSpeech, setUseWebSpeech] = useState(true) // Use Web Speech API by default
    const [isLiveEditing, setIsLiveEditing] = useState(false) // Allow editing while transcribing
    const [liveEditTranscript, setLiveEditTranscript] = useState('') // Separate transcript for live editing mode
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const isMountedRef = useRef(true)
    const stopRecordingRef = useRef<(() => void | Promise<void>) | null>(null)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: w,
      currentH: h,
      shapeType: 'Transcription',
    })

    // Local Whisper model is always available (no API key needed)
    const isLocalWhisperAvailable = true

    // Memoize the hook options to prevent unnecessary re-renders
    const hookOptions = useMemo(() => ({
      onTranscriptUpdate: (newText: string) => {
        // Always append to existing text for continuous transcription
        const currentText = shape.props.text || ''
        const updatedText = currentText + (currentText ? ' ' : '') + newText
        
        if (!isLiveEditing) {
          // Clean the props to ensure only valid properties are passed
          const cleanProps = {
            ...shape.props,
            text: updatedText
            // Removed h: Math.max(100, Math.ceil(newText.length / 50) * 20 + 60) to prevent auto-resizing
          }
          
          // Remove any undefined or null values that might cause validation issues
          Object.keys(cleanProps).forEach(key => {
            if ((cleanProps as any)[key] === undefined || (cleanProps as any)[key] === null) {
              delete (cleanProps as any)[key]
            }
          })
          
          // Update the shape with appended text
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: cleanProps
          })
          
          // Also update the editing content if it's empty or matches the old text
          if (!editingContent || editingContent === shape.props.text) {
            setEditingContent(updatedText)
          }
        } else {
          // In live editing mode, append to the separate live edit transcript
          const currentLiveTranscript = liveEditTranscript || ''
          const updatedLiveTranscript = currentLiveTranscript + (currentLiveTranscript ? ' ' : '') + newText
          setLiveEditTranscript(updatedLiveTranscript)
          
          // Also update editing content to show the live transcript
          setEditingContent(updatedLiveTranscript)
        }
      },
      onError: (error: Error) => {
        console.error('❌ Whisper transcription error:', error)
        
        // Clean the props to ensure only valid properties are passed
        const cleanProps = {
          ...shape.props,
          isTranscribing: false
        }
        
        // Remove any undefined or null values that might cause validation issues
        Object.keys(cleanProps).forEach(key => {
          if ((cleanProps as any)[key] === undefined || (cleanProps as any)[key] === null) {
            delete (cleanProps as any)[key]
          }
        })
        
        // Update shape state to stop transcribing on error
        this.editor.updateShape<ITranscription>({
          id: shape.id,
          type: 'Transcription',
          props: cleanProps
        })
      },
      language: 'en'
    }), [shape.id, shape.props, isLiveEditing, editingContent, liveEditTranscript])

    // Web Speech API hook for real-time transcription
    const webSpeechOptions = useMemo(() => ({
      onTranscriptUpdate: (newText: string) => {
        // Always append to existing text for continuous transcription
        const currentText = shape.props.text || ''
        const updatedText = currentText + (currentText ? ' ' : '') + newText
        
        if (!isLiveEditing) {
          // Update shape text without changing height
          this.editor.updateShape({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              text: updatedText
              // Removed h: textHeight to prevent auto-resizing
            }
          })
          
          // Also update the editing content if it's empty or matches the old text
          if (!editingContent || editingContent === shape.props.text) {
            setEditingContent(updatedText)
          }
        } else {
          // In live editing mode, append to the separate live edit transcript
          const currentLiveTranscript = liveEditTranscript || ''
          const updatedLiveTranscript = currentLiveTranscript + (currentLiveTranscript ? ' ' : '') + newText
          setLiveEditTranscript(updatedLiveTranscript)
          
          // Also update editing content to show the live transcript
          setEditingContent(updatedLiveTranscript)
        }
      },
      onError: (error: Error) => {
        console.error('Web Speech API error:', error)
        // Update shape state on error
        this.editor.updateShape({
          id: shape.id,
          type: 'Transcription',
          props: {
            ...shape.props,
            isTranscribing: false
          }
        })
      },
      language: 'en-US'
    }), [shape.id, shape.props, isLiveEditing, editingContent, liveEditTranscript])

    const {
      isRecording: webSpeechIsRecording,
      isTranscribing: webSpeechIsTranscribing,
      transcript: webSpeechTranscript,
      interimTranscript,
      isSupported: webSpeechSupported,
      startRecording: webSpeechStartRecording,
      stopRecording: webSpeechStopRecording
    } = useWebSpeechTranscription(webSpeechOptions)

    // Whisper transcription hook for final processing (when Web Speech is disabled)
    // Only auto-initialize if Web Speech is not being used (lazy load to avoid unnecessary model loading)
    const {
      isRecording: whisperIsRecording,
      isTranscribing: whisperIsTranscribing,
      transcript: whisperTranscript,
      startRecording: whisperStartRecording,
      stopRecording: whisperStopRecording,
      pauseRecording: whisperPauseRecording,
      modelLoaded
    } = useWhisperTranscription({
      ...hookOptions,
      enableStreaming: false, // Disable streaming for Whisper when using Web Speech
      autoInitialize: !useWebSpeech // Only auto-initialize if not using Web Speech
    })

    // Use Web Speech API by default, fallback to Whisper
    const isRecording = useWebSpeech ? webSpeechIsRecording : whisperIsRecording
    const hookIsTranscribing = useWebSpeech ? webSpeechIsTranscribing : whisperIsTranscribing
    const transcript = useWebSpeech ? webSpeechTranscript : whisperTranscript
    const currentInterimTranscript = useWebSpeech ? interimTranscript : '' // Only Web Speech has interim transcripts
    const startRecording = useWebSpeech ? webSpeechStartRecording : whisperStartRecording
    const stopRecording = useWebSpeech ? webSpeechStopRecording : whisperStopRecording
    const pauseRecording = useWebSpeech ? null : whisperPauseRecording // Web Speech doesn't have pause, use stop/start instead
    
    // Combine final transcript with interim transcript for real-time display
    const displayText = useMemo(() => {
      const finalText = text || ''
      // Only show interim transcript when recording and it exists
      if (isRecording && currentInterimTranscript && useWebSpeech) {
        return finalText + (finalText ? ' ' : '') + currentInterimTranscript
      }
      return finalText
    }, [text, currentInterimTranscript, isRecording, useWebSpeech])

    // Update the ref whenever stopRecording changes
    useEffect(() => {
      stopRecordingRef.current = stopRecording
    }, [stopRecording])

    // Debug logging to track component lifecycle
    // Removed excessive debug logging

    // Update shape state when recording/transcribing state changes
    useEffect(() => {
      const cleanProps = {
        ...shape.props,
        isTranscribing: hookIsTranscribing || isRecording
      }
      
      // Remove any undefined or null values that might cause validation issues
      Object.keys(cleanProps).forEach(key => {
        if ((cleanProps as any)[key] === undefined || (cleanProps as any)[key] === null) {
          delete (cleanProps as any)[key]
        }
      })
      
      // Only update if the state actually changed
      if (cleanProps.isTranscribing !== shape.props.isTranscribing) {
        // Update the shape state
        this.editor.updateShape<ITranscription>({
          id: shape.id,
          type: 'Transcription',
          props: cleanProps
        })
        
      }
    }, [hookIsTranscribing, isRecording, shape.id]) // Removed shape.props from dependencies
    
    // Listen for custom start-transcription event from the tool
    useEffect(() => {
      const handleStartTranscriptionEvent = (event: CustomEvent) => {
        if (event.detail?.shapeId === shape.id) {
          // Only start if not already transcribing
          if (!hookIsTranscribing) {
            handleTranscriptionToggle()
          }
        }
      }

      window.addEventListener('start-transcription', handleStartTranscriptionEvent as EventListener)
      
      return () => {
        window.removeEventListener('start-transcription', handleStartTranscriptionEvent as EventListener)
      }
    }, [shape.id, hookIsTranscribing])

    // Cleanup transcription when component unmounts
    useEffect(() => {
      return () => {
        if (isMountedRef.current) {
          // Removed debug logging
          isMountedRef.current = false
          if (isRecording && stopRecordingRef.current) {
            stopRecordingRef.current()
          }
        }
      }
    }, []) // Empty dependency array - only run on actual unmount

    // Prevent unnecessary remounting by stabilizing the component
    useEffect(() => {
      // This effect helps prevent the component from remounting unnecessarily
      // Removed debug logging
      isMountedRef.current = true
    }, [shape.id])

    // Update recording duration when recording is active (not transcribing)
    useEffect(() => {
      let interval: NodeJS.Timeout | null = null
      
      if (isRecording && !isPaused) {
        interval = setInterval(() => {
          setRecordingDuration(prev => prev + 1)
        }, 1000)
      } else {
        setRecordingDuration(0)
      }
      
      return () => {
        if (interval) {
          clearInterval(interval)
        }
      }
    }, [isRecording, isPaused])

    const handleStartEdit = () => {
      const currentText = text || ''
      setEditingContent(currentText)
      this.editor.updateShape<ITranscription>({
        id: shape.id,
        type: "Transcription",
        props: {
          ...shape.props,
          isEditing: true,
          editingContent: currentText,
        },
      })
    }

    const handleSaveEdit = () => {
      // Get fresh shape reference to ensure we have the latest state
      const currentShape = this.editor.getShape(shape.id) as ITranscription
      if (!currentShape) {
        console.error('Shape not found when saving')
        return
      }
      
      // Use the latest editingContent state value
      const contentToSave = editingContent
      
      // Clean the props to ensure only valid properties are passed
      const cleanProps = {
        ...currentShape.props,
        isEditing: false,
        text: contentToSave,
        // Remove any invalid properties that might cause validation errors
        editingContent: undefined,
      }
      
      // Remove any undefined or null values that might cause validation issues
      Object.keys(cleanProps).forEach(key => {
        if ((cleanProps as any)[key] === undefined || (cleanProps as any)[key] === null) {
          delete (cleanProps as any)[key]
        }
      })
      
      this.editor.updateShape<ITranscription>({
        id: currentShape.id,
        type: "Transcription",
        props: cleanProps,
      })
    }

    const handleCancelEdit = () => {
      // Clean the props to ensure only valid properties are passed
      const cleanProps = {
        ...shape.props,
        isEditing: false,
        // Remove any invalid properties that might cause validation errors
        editingContent: undefined,
      }
      
      // Remove any undefined or null values that might cause validation issues
      Object.keys(cleanProps).forEach(key => {
        if ((cleanProps as any)[key] === undefined || (cleanProps as any)[key] === null) {
          delete (cleanProps as any)[key]
        }
      })
      
      
      this.editor.updateShape<ITranscription>({
        id: shape.id,
        type: "Transcription",
        props: cleanProps,
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

    const handleWheel = (e: React.WheelEvent) => {
      // Prevent the wheel event from bubbling up to the Tldraw canvas
      e.stopPropagation()
      // The default scroll behavior will handle the actual scrolling
    }

    const handleTranscriptionToggle = useCallback(async () => {
      try {
        if (isRecording) {
          // Currently recording, stop it
          stopRecording()
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              isTranscribing: false,
              isPaused: false
            }
          })
        } else {
          // Not recording, start it (or resume if paused)
          if (isPaused) {
            startRecording()
            this.editor.updateShape<ITranscription>({
              id: shape.id,
              type: 'Transcription',
              props: {
                ...shape.props,
                isTranscribing: true,
                isPaused: false
              }
            })
          } else {
            
            // Clear editing content and live edit transcript when starting new recording session
            if (isLiveEditing) {
              setEditingContent('')
              setLiveEditTranscript('')
            }
            
            startRecording()
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
        }
      } catch (error) {
        console.error('❌ Transcription toggle error:', error)
      }
    }, [isRecording, isPaused, stopRecording, startRecording, shape.id, shape.props, isLiveEditing])

    const handlePauseToggle = useCallback(async () => {
      try {
        if (isPaused) {
          // Currently paused, resume
          if (useWebSpeech) {
            // For Web Speech, restart recording
            startRecording()
          } else if (pauseRecording) {
            // For Whisper, resume from pause (if supported)
            // Note: pauseRecording might not fully support resume, so we restart
            startRecording()
          }
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              isTranscribing: true,
              isPaused: false
            }
          })
        } else {
          // Currently recording, pause it
          if (useWebSpeech) {
            // For Web Speech, stop recording (pause not natively supported)
            stopRecording()
          } else if (pauseRecording) {
            await pauseRecording()
          }
          this.editor.updateShape<ITranscription>({
            id: shape.id,
            type: 'Transcription',
            props: {
              ...shape.props,
              isTranscribing: false,
              isPaused: true
            }
          })
        }
      } catch (error) {
        console.error('❌ Pause toggle error:', error)
      }
    }, [isPaused, useWebSpeech, pauseRecording, startRecording, stopRecording, shape.id, shape.props])

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<ITranscription>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }


    const contentStyle: React.CSSProperties = {
      padding: '12px',
      flex: 1,
      overflow: 'hidden', // Let the inner elements handle scrolling
      color: 'black',
      fontSize: '12px',
      lineHeight: '1.4',
      cursor: isEditing ? 'text' : 'pointer',
      transition: 'background-color 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
    }

    const textareaStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      border: 'none',
      outline: 'none',
      resize: 'none',
      fontFamily: 'inherit',
      fontSize: '12px',
      lineHeight: '1.4',
      color: 'black',
      backgroundColor: 'transparent',
      padding: '4px',
      margin: 0,
      position: 'relative',
      boxSizing: 'border-box',
      overflowY: 'auto',
      overflowX: 'hidden',
      zIndex: 1000,
      pointerEvents: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      cursor: 'text',
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
      pointerEvents: 'auto', // Ensure button can receive clicks
      touchAction: 'manipulation',
      minWidth: '44px',
      minHeight: '32px',
    }

    // Custom header content with status indicators and controls
    const headerContent = (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
        <span>
          🎤 Transcription 
          {!useWebSpeech && !modelLoaded && <span style={{color: '#ffa500', fontSize: '8px'}}>(Loading Model...)</span>}
          {useWebSpeech && !webSpeechSupported && <span style={{color: '#ff4444', fontSize: '8px'}}>(Web Speech Not Supported)</span>}
          {isRecording && !isPaused && (
            <span style={{color: '#ff4444', fontSize: '10px', marginLeft: '8px'}}>
              🔴 Recording {recordingDuration}s
            </span>
          )}
          {isPaused && (
            <span style={{color: '#ffa500', fontSize: '10px', marginLeft: '8px'}}>
              ⏸️ Paused
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {isEditing && (
            <>
              <button
                style={buttonStyle}
                onClick={handleSaveEdit}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleSaveEdit()
                }}
              >
                Save
              </button>
              <button
                style={buttonStyle}
                onClick={handleCancelEdit}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleCancelEdit()
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    )

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Transcription"
          primaryColor={TranscriptionShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          headerContent={headerContent}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<ITranscription>({
              id: shape.id,
              type: 'Transcription',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
        
        <div style={contentStyle}>
          {isEditing || isLiveEditing ? (
            <AutoResizeTextarea
              value={editingContent}
              onChange={handleTextChange}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              style={textareaStyle}
              placeholder=""
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onWheel={handleWheel}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                cursor: "text",
                overflowY: "auto",
                overflowX: "hidden",
                padding: "4px",
                boxSizing: "border-box",
                position: "relative",
                pointerEvents: "auto"
              }}
              onWheel={handleWheel}
              onClick={handleStartEdit}
              title="Click to edit transcription"
            >
              {displayText || ""}
            </div>
          )}
        </div>
        {!isEditing && (
          <div style={editControlsStyle}>
            <button
              style={{
                ...buttonStyle,
                background: isRecording
                  ? "#ff4444"  // Red when recording
                  : isPaused
                  ? "#ffa500"  // Orange when paused
                  : (useWebSpeech ? webSpeechSupported : modelLoaded) ? "#007bff" : "#6c757d",  // Blue when ready to start, gray when loading
                color: "white",
                border: isRecording
                  ? "1px solid #cc0000"  // Red border when recording
                  : isPaused
                  ? "1px solid #cc8500"  // Orange border when paused
                  : (useWebSpeech ? webSpeechSupported : modelLoaded) ? "1px solid #0056b3" : "1px solid #495057",  // Blue border when ready, gray when loading
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (useWebSpeech ? webSpeechSupported : modelLoaded) {
                  handleTranscriptionToggle()
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
              }}
              onTouchEnd={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (useWebSpeech ? webSpeechSupported : modelLoaded) {
                  handleTranscriptionToggle()
                }
              }}
              disabled={useWebSpeech ? !webSpeechSupported : !modelLoaded}
              title={useWebSpeech ? (!webSpeechSupported ? "Web Speech API not supported" : "") : (!modelLoaded ? "Whisper model is loading - Please wait..." : "")}
            >
              {(() => {
                if (isPaused) {
                  return "Resume"
                }
                const buttonText = isRecording
                  ? "Stop"
                  : "Start"
                return buttonText
              })()}
            </button>
            {isRecording && !isPaused && (
              <button
                style={{
                  ...buttonStyle,
                  background: "#ffa500",
                  color: "white",
                  border: "1px solid #cc8500",
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePauseToggle()
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handlePauseToggle()
                }}
                title="Pause transcription"
              >
                Pause
              </button>
            )}
          </div>
        )}
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: ITranscription) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
