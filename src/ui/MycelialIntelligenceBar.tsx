import React, { useState, useRef, useEffect, useCallback } from "react"
import { useEditor } from "tldraw"
import { canvasAI, useCanvasAI } from "@/lib/canvasAI"
import { useWebSpeechTranscription } from "@/hooks/useWebSpeechTranscription"

// Microphone icon component
const MicrophoneIcon = ({ isListening, isDark }: { isListening: boolean; isDark: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={isListening ? "#10b981" : "currentColor"}
    style={{
      filter: isListening ? 'drop-shadow(0 0 8px #10b981)' : 'none',
      transition: 'all 0.3s ease'
    }}
  >
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
)

// Send icon component
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

// Expand/collapse icon
const ExpandIcon = ({ isExpanded }: { isExpanded: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{
      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.3s ease'
    }}
  >
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
  </svg>
)

// Hook to detect dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'))
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}

const ACCENT_COLOR = "#10b981" // Emerald green

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export function MycelialIntelligenceBar() {
  const editor = useEditor()
  const isDark = useDarkMode()
  const inputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [prompt, setPrompt] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [streamingResponse, setStreamingResponse] = useState("")
  const [indexingProgress, setIndexingProgress] = useState(0)
  const [isIndexing, setIsIndexing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  // Initialize canvas AI with editor
  useCanvasAI(editor)

  // Theme-aware colors
  const colors = {
    background: 'rgba(255, 255, 255, 0.98)',
    backgroundHover: 'rgba(255, 255, 255, 1)',
    border: 'rgba(229, 231, 235, 0.8)',
    borderHover: 'rgba(209, 213, 219, 1)',
    text: '#18181b',
    textMuted: '#71717a',
    inputBg: 'rgba(244, 244, 245, 0.8)',
    inputBorder: 'rgba(228, 228, 231, 1)',
    inputText: '#18181b',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)',
    shadowHover: '0 12px 40px rgba(0, 0, 0, 0.15), 0 6px 20px rgba(0, 0, 0, 0.1)',
    userBubble: 'rgba(16, 185, 129, 0.1)',
    assistantBubble: 'rgba(244, 244, 245, 0.8)',
  }

  // Voice transcription
  const handleTranscriptUpdate = useCallback((text: string) => {
    setPrompt(prev => (prev + text).trim())
  }, [])

  const {
    isRecording,
    isSupported: isVoiceSupported,
    startRecording,
    stopRecording,
  } = useWebSpeechTranscription({
    onTranscriptUpdate: handleTranscriptUpdate,
    continuous: false,
    interimResults: true,
  })

  // Update isListening state when recording changes
  useEffect(() => {
    setIsListening(isRecording)
  }, [isRecording])

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [conversationHistory, streamingResponse])

  // Click outside to collapse - detects clicks on canvas or outside the MI bar
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      // Check if click is outside the MI bar container
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    // Use pointerdown to catch clicks before they reach canvas
    document.addEventListener('pointerdown', handleClickOutside, true)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true)
    }
  }, [isExpanded])

  // Handle voice toggle
  const toggleVoice = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || isLoading) return

    // Clear prompt immediately
    setPrompt('')

    const newHistory: ConversationMessage[] = [
      ...conversationHistory,
      { role: 'user', content: trimmedPrompt }
    ]

    setConversationHistory(newHistory)
    setIsLoading(true)
    setIsExpanded(true)
    setStreamingResponse("")

    try {
      const { isIndexing: currentlyIndexing } = canvasAI.getIndexingStatus()
      if (!currentlyIndexing) {
        setIsIndexing(true)

        await canvasAI.indexCanvas((progress) => {
          setIndexingProgress(progress)
        })

        setIsIndexing(false)
        setIndexingProgress(100)
      }

      let fullResponse = ''
      await canvasAI.query(
        trimmedPrompt,
        (partial, done) => {
          fullResponse = partial
          setStreamingResponse(partial)
          if (done) {
            setIsLoading(false)
          }
        }
      )

      const updatedHistory: ConversationMessage[] = [
        ...newHistory,
        { role: 'assistant', content: fullResponse }
      ]

      setConversationHistory(updatedHistory)
      setStreamingResponse("")
      setIsLoading(false)

    } catch (error) {
      console.error('Mycelial Intelligence query error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'

      const errorHistory: ConversationMessage[] = [
        ...newHistory,
        { role: 'assistant', content: `Error: ${errorMessage}` }
      ]

      setConversationHistory(errorHistory)
      setStreamingResponse("")
      setIsLoading(false)
    }
  }, [prompt, isLoading, conversationHistory])

  // Toggle expanded state
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const collapsedHeight = 48
  const expandedHeight = 400
  const barWidth = 520
  const height = isExpanded ? expandedHeight : collapsedHeight

  return (
    <div
      ref={containerRef}
      className="mycelial-intelligence-bar"
      style={{
        position: 'fixed',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: barWidth,
        height,
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: isHovering ? colors.backgroundHover : colors.background,
          borderRadius: isExpanded ? '20px' : '24px',
          border: `1px solid ${isHovering ? colors.borderHover : colors.border}`,
          boxShadow: isHovering ? colors.shadowHover : colors.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Collapsed: Single-line prompt bar */}
        {!isExpanded && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px 6px 14px',
            height: '100%',
          }}>
            {/* Mushroom + Brain icon */}
            <span style={{
              fontSize: '16px',
              opacity: 0.9,
              flexShrink: 0,
            }}>
              🍄🧠
            </span>

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              placeholder="Ask mi anything about this workspace..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '8px 4px',
                fontSize: '14px',
                color: colors.inputText,
                outline: 'none',
              }}
            />

            {/* Indexing indicator */}
            {isIndexing && (
              <span style={{
                color: ACCENT_COLOR,
                fontSize: '11px',
                whiteSpace: 'nowrap',
                opacity: 0.8,
              }}>
                {Math.round(indexingProgress)}%
              </span>
            )}

            {/* Voice button (compact) */}
            {isVoiceSupported && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleVoice()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isRecording
                    ? `rgba(16, 185, 129, 0.15)`
                    : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRecording ? ACCENT_COLOR : colors.textMuted,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                <MicrophoneIcon isListening={isRecording} isDark={isDark} />
              </button>
            )}

            {/* Send button (compact, pill shape) */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSubmit()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!prompt.trim() || isLoading}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '17px',
                border: 'none',
                background: prompt.trim() && !isLoading
                  ? ACCENT_COLOR
                  : colors.inputBg,
                cursor: prompt.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: prompt.trim() && !isLoading ? 'white' : colors.textMuted,
                transition: 'all 0.2s ease',
                flexShrink: 0,
                opacity: prompt.trim() && !isLoading ? 1 : 0.5,
              }}
              title="Send"
            >
              <SendIcon />
            </button>

            {/* Expand button if there's history */}
            {conversationHistory.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: ACCENT_COLOR,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                title="View conversation"
              >
                <ExpandIcon isExpanded={false} />
              </button>
            )}
          </div>
        )}

        {/* Expanded: Header + Conversation + Input */}
        {isExpanded && (
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: `1px solid ${colors.border}`,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ fontSize: '16px' }}>🍄🧠</span>
                <span style={{
                  color: colors.text,
                  fontSize: '13px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}>
                  <span style={{ fontStyle: 'italic', opacity: 0.85 }}>ask your mycelial intelligence anything about this workspace</span>
                </span>
                {isIndexing && (
                  <span style={{
                    color: colors.textMuted,
                    fontSize: '11px',
                    marginLeft: '4px',
                  }}>
                    Indexing... {Math.round(indexingProgress)}%
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textMuted,
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
                title="Collapse"
              >
                <ExpandIcon isExpanded={true} />
              </button>
            </div>

            {/* Conversation area */}
            <div
              ref={chatContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {conversationHistory.length === 0 && !streamingResponse && (
                <div style={{
                  color: colors.textMuted,
                  fontSize: '13px',
                  textAlign: 'center',
                  padding: '20px 16px',
                }}>
                  I can search, summarize, and find connections across all your workspace content.
                </div>
              )}

              {conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    backgroundColor: msg.role === 'user' ? colors.userBubble : colors.assistantBubble,
                    border: `1px solid ${msg.role === 'user' ? 'rgba(16, 185, 129, 0.2)' : colors.border}`,
                    color: colors.text,
                    fontSize: '13px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              ))}

              {/* Streaming response */}
              {streamingResponse && (
                <div style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: '14px 14px 14px 4px',
                  backgroundColor: colors.assistantBubble,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: '13px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                }}>
                  {streamingResponse}
                  {isLoading && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '14px',
                      backgroundColor: ACCENT_COLOR,
                      marginLeft: '2px',
                      animation: 'blink 1s infinite',
                    }} />
                  )}
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingResponse && (
                <div style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  gap: '5px',
                  padding: '8px 12px',
                }}>
                  <span className="loading-dot" style={{ backgroundColor: ACCENT_COLOR }} />
                  <span className="loading-dot" style={{ backgroundColor: ACCENT_COLOR, animationDelay: '0.2s' }} />
                  <span className="loading-dot" style={{ backgroundColor: ACCENT_COLOR, animationDelay: '0.4s' }} />
                </div>
              )}
            </div>

            {/* Input area (expanded) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderTop: `1px solid ${colors.border}`,
            }}>
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Ask a follow-up..."
                style={{
                  flex: 1,
                  background: colors.inputBg,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '18px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  color: colors.inputText,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
              />

              {/* Voice input button */}
              {isVoiceSupported && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleVoice()
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: `1px solid ${isRecording ? ACCENT_COLOR : colors.inputBorder}`,
                    background: isRecording
                      ? `rgba(16, 185, 129, 0.1)`
                      : colors.inputBg,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isRecording ? ACCENT_COLOR : colors.textMuted,
                    transition: 'all 0.2s ease',
                    boxShadow: isRecording ? `0 0 12px rgba(16, 185, 129, 0.3)` : 'none',
                    flexShrink: 0,
                  }}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  <MicrophoneIcon isListening={isRecording} isDark={isDark} />
                </button>
              )}

              {/* Send button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSubmit()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!prompt.trim() || isLoading}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: prompt.trim() && !isLoading
                    ? ACCENT_COLOR
                    : colors.inputBg,
                  cursor: prompt.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: prompt.trim() && !isLoading ? 'white' : colors.textMuted,
                  transition: 'all 0.2s ease',
                  boxShadow: prompt.trim() && !isLoading
                    ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                    : 'none',
                  flexShrink: 0,
                }}
                title="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
