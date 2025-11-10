import { useState, useRef, useCallback, useEffect } from 'react'

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    maxAlternatives: number
    start(): void
    stop(): void
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
    onend: ((this: SpeechRecognition, ev: Event) => any) | null
  }
  
  interface SpeechRecognitionEvent extends Event {
    resultIndex: number
    results: SpeechRecognitionResultList
  }
  
  interface SpeechRecognitionErrorEvent extends Event {
    error: string
  }
  
  interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }
  
  interface SpeechRecognitionResult {
    readonly length: number
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
    readonly isFinal: boolean
  }
  
  interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }
  
  var SpeechRecognition: {
    prototype: SpeechRecognition
    new(): SpeechRecognition
  }
}

interface UseWebSpeechTranscriptionOptions {
  onTranscriptUpdate?: (text: string) => void
  onError?: (error: Error) => void
  language?: string
  continuous?: boolean
  interimResults?: boolean
}

export const useWebSpeechTranscription = ({
  onTranscriptUpdate,
  onError,
  language = 'en-US',
  continuous = true,
  interimResults = true
}: UseWebSpeechTranscriptionOptions = {}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')
  const lastSpeechTimeRef = useRef<number>(0)
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastConfidenceRef = useRef<number>(0)
  const speakerChangeThreshold = 0.3 // Threshold for detecting speaker changes

  // Function to add line breaks after pauses and improve punctuation
  const processTranscript = useCallback((text: string, isFinal: boolean = false, _confidence?: number) => {
    if (!text.trim()) return text

    let processedText = text.trim()
    
    // Add punctuation if missing at the end
    if (isFinal && processedText && !/[.!?]$/.test(processedText)) {
      processedText += '.'
    }
    
    // Add line break if there's been a pause (for final results)
    if (isFinal) {
      const now = Date.now()
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current
      
      // If more than 3 seconds since last speech, add a line break
      if (timeSinceLastSpeech > 3000 && lastSpeechTimeRef.current > 0) {
        processedText = '\n' + processedText
      }
      
      lastSpeechTimeRef.current = now
    }
    
    return processedText
  }, [])

  // Function to detect speaker changes based on confidence and timing
  const detectSpeakerChange = useCallback((confidence: number) => {
    if (lastConfidenceRef.current === 0) {
      lastConfidenceRef.current = confidence
      return false
    }
    
    const confidenceDiff = Math.abs(confidence - lastConfidenceRef.current)
    const now = Date.now()
    const timeSinceLastSpeech = now - lastSpeechTimeRef.current
    
    // Detect speaker change if confidence changes significantly and there's been a pause
    const isSpeakerChange = confidenceDiff > speakerChangeThreshold && timeSinceLastSpeech > 1000
    
    if (isSpeakerChange) {
        // Reduced debug logging
      lastConfidenceRef.current = confidence
      return true
    }
    
    lastConfidenceRef.current = confidence
    return false
  }, [speakerChangeThreshold])

  // Function to handle pause detection
  const handlePauseDetection = useCallback(() => {
    // Clear existing timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
    }
    
    // Set new timeout for pause detection
    pauseTimeoutRef.current = setTimeout(() => {
      const now = Date.now()
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current
      
      // If more than 2 seconds of silence, add a line break to interim transcript
      if (timeSinceLastSpeech > 2000 && lastSpeechTimeRef.current > 0) {
        const currentTranscript = finalTranscriptRef.current + '\n'
        setTranscript(currentTranscript)
        onTranscriptUpdate?.(currentTranscript)
        // Reduced debug logging
      }
    }, 2000) // Check after 2 seconds of silence
  }, [onTranscriptUpdate])

  // Check if Web Speech API is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setIsSupported(true)
      // Reduced debug logging
    } else {
      setIsSupported(false)
      console.log('❌ Web Speech API is not supported')
      onError?.(new Error('Web Speech API is not supported in this browser'))
    }
  }, [onError])

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (!isSupported) return null

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      console.log('🎤 Web Speech API started')
      setIsRecording(true)
      setIsTranscribing(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // Update final transcript with processing
      if (finalTranscript) {
        // Get confidence from the first result
        const confidence = event.results[event.results.length - 1]?.[0]?.confidence || 0
        
        // Detect speaker change
        const isSpeakerChange = detectSpeakerChange(confidence)
        
        // Add speaker indicator if change detected
        let speakerPrefix = ''
        if (isSpeakerChange) {
          speakerPrefix = '\n[Speaker Change]\n'
        }
        
        const processedFinal = processTranscript(finalTranscript, true, confidence)
        const newText = speakerPrefix + processedFinal
        finalTranscriptRef.current += newText
        setTranscript(finalTranscriptRef.current)
        onTranscriptUpdate?.(newText) // Only send the new text portion
        console.log(`✅ Final transcript: "${processedFinal}" (confidence: ${confidence.toFixed(2)})`)
        
        // Trigger pause detection
        handlePauseDetection()
      }

      // Update interim transcript
      if (interimTranscript) {
        const processedInterim = processTranscript(interimTranscript, false)
        interimTranscriptRef.current = processedInterim
        setInterimTranscript(processedInterim)
        console.log(`🔄 Interim transcript: "${processedInterim}"`)
      }
    }

    recognition.onerror = (event) => {
      console.error('❌ Web Speech API error:', event.error)
      setIsRecording(false)
      setIsTranscribing(false)
      onError?.(new Error(`Speech recognition error: ${event.error}`))
    }

    recognition.onend = () => {
      console.log('🛑 Web Speech API ended')
      setIsRecording(false)
      setIsTranscribing(false)
    }

    return recognition
  }, [isSupported, continuous, interimResults, language, onTranscriptUpdate, onError])

  // Start recording
  const startRecording = useCallback(() => {
    if (!isSupported) {
      onError?.(new Error('Web Speech API is not supported'))
      return
    }

    try {
      console.log('🎤 Starting Web Speech API recording...')
      
      // Don't reset transcripts for continuous transcription - keep existing content
      // finalTranscriptRef.current = ''
      // interimTranscriptRef.current = ''
      // setTranscript('')
      // setInterimTranscript('')
      lastSpeechTimeRef.current = 0
      lastConfidenceRef.current = 0
      
      // Clear any existing pause timeout
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current)
        pauseTimeoutRef.current = null
      }

      // Initialize and start recognition
      const recognition = initializeRecognition()
      if (recognition) {
        recognitionRef.current = recognition
        recognition.start()
      }
    } catch (error) {
      console.error('❌ Error starting Web Speech API:', error)
      onError?.(error as Error)
    }
  }, [isSupported, initializeRecognition, onError])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      console.log('🛑 Stopping Web Speech API recording...')
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  // Cleanup
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    
    // Clear pause timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
      pauseTimeoutRef.current = null
    }
    
    setIsRecording(false)
    setIsTranscribing(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    isRecording,
    isTranscribing,
    transcript,
    interimTranscript,
    isSupported,
    startRecording,
    stopRecording,
    cleanup
  }
}

// Export as default for compatibility
export default useWebSpeechTranscription
