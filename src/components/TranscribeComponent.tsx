import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ITranscribeShape, TranscribeShapeUtil } from '../shapes/TranscribeShapeUtil'
import { useEditor } from '@tldraw/tldraw'

interface TranscribeComponentProps {
  shape: ITranscribeShape
  util: TranscribeShapeUtil
}

interface Participant {
  id: string
  name: string
  isSpeaking: boolean
  lastSpoken: string
  transcript: string
}

export function TranscribeComponent({ shape }: TranscribeComponentProps) {
  const editor = useEditor()
  const [isRecording, setIsRecording] = useState(shape.props.isRecording)
  const [transcript, setTranscript] = useState(shape.props.transcript)
  const [participants, setParticipants] = useState<Participant[]>(() => 
    shape.props.participants.map(p => ({
      id: p.id,
      name: p.name,
      isSpeaking: p.isSpeaking,
      lastSpoken: p.lastSpoken,
      transcript: ''
    }))
  )
  const [isPaused, setIsPaused] = useState(false)
  const [userHasScrolled, setUserHasScrolled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  
  const transcriptRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const localTranscriptRef = useRef<string>('')

  // Immediate update for critical state changes (recording start/stop)
  const updateShapePropsImmediate = useCallback((updates: Partial<ITranscribeShape['props']>) => {
    try {
      // Only update if the editor is still valid and the shape exists
      const currentShape = editor.getShape(shape.id)
      if (currentShape) {
        console.log('🔄 Updating shape props immediately:', updates)
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            ...updates
          }
        })
        console.log('✅ Shape props updated successfully')
      } else {
        console.log('⚠️ Shape no longer exists, skipping immediate update')
      }
    } catch (error) {
      console.error('❌ Error in immediate update:', error)
      console.error('❌ Update data:', updates)
      console.error('❌ Shape data:', shape)
    }
  }, [editor, shape])

  // Simple transcript update strategy like other shapes use
  const updateTranscriptLocal = useCallback((newTranscript: string) => {
    console.log('📝 Updating transcript:', newTranscript.length, 'chars')
    
    // Always update local state immediately for responsive UI
    localTranscriptRef.current = newTranscript
    
    // Use requestAnimationFrame for smooth updates like PromptShape does
    requestAnimationFrame(() => {
      try {
        const currentShape = editor.getShape(shape.id)
        if (currentShape) {
          console.log('🔄 Updating transcript in shape:', {
            transcriptLength: newTranscript.length,
            participantsCount: participants.length,
            shapeId: shape.id
          })
          editor.updateShape({
            id: shape.id,
            type: shape.type,
            props: {
              ...shape.props,
              transcript: newTranscript,
              participants: participants
            }
          })
          console.log('✅ Transcript updated successfully')
        } else {
          console.log('⚠️ Shape not found for transcript update')
        }
      } catch (error) {
        console.error('❌ Error updating transcript:', error)
        console.error('❌ Transcript data:', newTranscript.slice(0, 100) + '...')
        console.error('❌ Participants data:', participants)
      }
    })
  }, [editor, shape, participants])

  // Check if Web Speech API is supported
  useEffect(() => {
    const checkSupport = () => {
      if ('webkitSpeechRecognition' in window) {
        setIsSupported(true)
        return (window as any).webkitSpeechRecognition
      } else if ('SpeechRecognition' in window) {
        setIsSupported(true)
        return (window as any).SpeechRecognition
      } else {
        setIsSupported(false)
        setError('Speech recognition not supported in this browser')
        return null
      }
    }

    const SpeechRecognition = checkSupport()
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      setupSpeechRecognition()
    }
  }, [])



  const setupSpeechRecognition = useCallback(() => {
    console.log('🔧 Setting up speech recognition...')
    if (!recognitionRef.current) {
      console.log('❌ No recognition ref available')
      return
    }

    const recognition = recognitionRef.current
    console.log('✅ Recognition ref found, configuring...')
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US' // Fixed to English
    
    console.log('🔧 Recognition configured:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang
    })

    recognition.onstart = () => {
      console.log('🎯 Speech recognition onstart event fired')
      console.log('Setting isRecording to true')
      setIsRecording(true)
      updateShapePropsImmediate({ isRecording: true })
      console.log('✅ Recording state updated')
    }

    recognition.onresult = (event: any) => {
      console.log('🎤 Speech recognition onresult event fired', event)
      console.log('Event details:', {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length,
        hasResults: !!event.results
      })
      
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        console.log(`📝 Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`)
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        console.log('✅ Final transcript:', finalTranscript)
        // Use functional update to avoid dependency on current transcript state
        setTranscript(prevTranscript => {
          const newTranscript = prevTranscript + finalTranscript + '\n'
          console.log('📝 Updating transcript:', { 
            prevLength: prevTranscript.length, 
            newLength: newTranscript.length,
            prevText: prevTranscript.slice(-50), // Last 50 chars
            newText: newTranscript.slice(-50)   // Last 50 chars
          })
          // Update shape props with the new transcript using local-first update
          updateTranscriptLocal(newTranscript)
          return newTranscript
        })
        
        // Add to participants if we can identify who's speaking
        addParticipantTranscript('Speaker', finalTranscript)
      }

      if (interimTranscript) {
        console.log('⏳ Interim transcript:', interimTranscript)
      }

      // Smart auto-scroll: only scroll if user hasn't manually scrolled away
      if (!userHasScrolled && transcriptRef.current) {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
        console.log('📜 Auto-scrolled to bottom')
      }
    }

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error)
      setError(`Recognition error: ${event.error}`)
      setIsRecording(false)
      updateShapePropsImmediate({ isRecording: false })
    }

    recognition.onend = () => {
      console.log('🛑 Speech recognition ended')
      setIsRecording(false)
      updateShapePropsImmediate({ isRecording: false })
    }
  }, [updateShapePropsImmediate])

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting recording...')
      console.log('Recognition ref exists:', !!recognitionRef.current)
      console.log('Current recognition state:', recognitionRef.current?.state || 'unknown')
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      console.log('✅ Microphone access granted')
      
      if (recognitionRef.current) {
        console.log('🎯 Starting speech recognition...')
        console.log('Recognition settings:', {
          continuous: recognitionRef.current.continuous,
          interimResults: recognitionRef.current.interimResults,
          lang: recognitionRef.current.lang
        })
        recognitionRef.current.start()
        console.log('✅ Speech recognition start() called')
      } else {
        console.error('❌ Recognition ref is null')
        setError('Speech recognition not initialized')
      }
    } catch (err) {
      console.error('❌ Error accessing microphone:', err)
      setError('Unable to access microphone. Please check permissions.')
    }
  }, [])

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      console.log('⏸️ Pausing transcription...')
      recognitionRef.current.stop()
      setIsPaused(true)
    }
  }, [isRecording])

  const resumeRecording = useCallback(async () => {
    if (recognitionRef.current && isPaused) {
      console.log('▶️ Resuming transcription...')
      try {
        recognitionRef.current.start()
        setIsPaused(false)
      } catch (err) {
        console.error('❌ Error resuming transcription:', err)
        setError('Unable to resume transcription')
      }
    }
  }, [isPaused])

  // Auto-start transcription if isRecording is true from the beginning
  useEffect(() => {
    console.log('🔍 Auto-start useEffect triggered:', {
      isSupported,
      hasRecognition: !!recognitionRef.current,
      shapeIsRecording: shape.props.isRecording,
      componentIsRecording: isRecording
    })
    
    if (isSupported && recognitionRef.current && shape.props.isRecording && !isRecording) {
      console.log('🚀 Auto-starting transcription from shape props...')
      setTimeout(() => {
        startRecording()
      }, 1000) // Small delay to ensure everything is set up
    }
  }, [isSupported, startRecording, shape.props.isRecording, isRecording])

  // Add global error handler for sync errors
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.message && event.message.includes('INVALID_RECORD')) {
        console.error('🚨 INVALID_RECORD sync error detected:', event.message)
        console.error('🚨 Error details:', event.error)
        setError('Sync error detected. Please refresh the page.')
      }
    }

    window.addEventListener('error', handleGlobalError)
    return () => window.removeEventListener('error', handleGlobalError)
  }, [])

  const addParticipantTranscript = useCallback((speakerName: string, text: string) => {
    setParticipants(prev => {
      const existing = prev.find(p => p.name === speakerName)
      const newParticipants = existing 
        ? prev.map(p => 
            p.name === speakerName 
              ? { ...p, lastSpoken: text, transcript: p.transcript + '\n' + text }
              : p
          )
        : [...prev, {
            id: Date.now().toString(),
            name: speakerName,
            isSpeaking: false,
            lastSpoken: text,
            transcript: text
          }]
      
      // Don't update shape props for participants immediately - let it batch with transcript
      // This reduces the number of shape updates
      
      return newParticipants
    })
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setParticipants([])
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: {
        ...shape.props,
        transcript: '',
        participants: []
      }
    })
  }, [editor, shape])

  const copyTranscript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      console.log('✅ Transcript copied to clipboard')
      // You could add a temporary "Copied!" message here if desired
    } catch (err) {
      console.error('❌ Failed to copy transcript:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = transcript
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      console.log('✅ Transcript copied using fallback method')
    }
  }, [transcript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
      // Cleanup completed
      // Ensure final transcript is saved
      if (localTranscriptRef.current) {
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            transcript: localTranscriptRef.current
          }
        })
      }
    }
  }, [editor, shape])

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    if (transcriptRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold
      
      if (isAtBottom) {
        setUserHasScrolled(false) // User is back at bottom, re-enable auto-scroll
      } else {
        setUserHasScrolled(true) // User has scrolled away, disable auto-scroll
      }
    }
  }, [])

  if (!isSupported) {
    return (
      <div className="transcribe-container" style={{ width: shape.props.w, height: shape.props.h }}>
        <div className="transcribe-error">
          <p>Speech recognition not supported in this browser.</p>
          <p>Please use Chrome or a WebKit-based browser.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="transcribe-container" style={{ width: shape.props.w, height: shape.props.h }}>
      {/* Header */}
      <div className="transcribe-header">
        <h3>Live Transcription</h3>
      </div>

      {/* Recording Controls - Simplified */}
      <div className="transcribe-controls">
        {!isRecording && !isPaused ? (
          <button 
            onClick={startRecording}
            className="transcribe-btn start-btn"
          >
            🎤 Start Recording
          </button>
        ) : isPaused ? (
          <button 
            onClick={resumeRecording}
            className="transcribe-btn resume-btn"
          >
            ▶️ Resume
          </button>
        ) : (
          <button 
            onClick={pauseRecording}
            className="transcribe-btn pause-btn"
          >
            ⏸️ Pause
          </button>
        )}
        
        <button 
          onClick={copyTranscript}
          className="transcribe-btn copy-btn"
          disabled={!transcript}
        >
          📋 Copy
        </button>
      </div>

      {/* Status */}
      <div className="transcribe-status">
        {isRecording && !isPaused && (
          <div className="recording-indicator">
            <span className="pulse">🔴</span> Recording...
          </div>
        )}
        {isPaused && (
          <div className="paused-indicator">
            <span>⏸️</span> Paused
          </div>
        )}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Participants */}
      {participants.length > 0 && (
        <div className="participants-section">
          <h4>Participants ({participants.length})</h4>
          <div className="participants-list">
            {participants.map(participant => (
              <div key={participant.id} className="participant">
                <span className="participant-name">{participant.name}</span>
                <span className="participant-status">
                  {participant.isSpeaking ? '🔊 Speaking' : '🔇 Silent'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="transcript-section">
        <h4>Live Transcript</h4>
        <div 
          ref={transcriptRef}
          className="transcript-content"
          onScroll={handleScroll}
          style={{ 
            height: Math.max(100, shape.props.h - 200),
            overflowY: 'auto'
          }}
        >
          {(transcript || localTranscriptRef.current) ? (
            <pre className="transcript-text">
              {transcript || localTranscriptRef.current}
              {/* Debug info */}
              <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
                Debug: {transcript.length} chars (local: {localTranscriptRef.current.length}), 
                isRecording: {isRecording.toString()}
              </div>
            </pre>
          ) : (
            <p className="transcript-placeholder">
              Start recording to see live transcription... (Debug: transcript length = {transcript.length})
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
