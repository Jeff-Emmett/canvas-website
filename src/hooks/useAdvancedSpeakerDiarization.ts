import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeakerSegment {
  speaker: string
  text: string
  startTime: number
  endTime: number
  confidence: number
}

interface UseAdvancedSpeakerDiarizationOptions {
  onTranscriptUpdate?: (segments: SpeakerSegment[]) => void
  onError?: (error: Error) => void
  maxSpeakers?: number
  enableRealTime?: boolean
}

export const useAdvancedSpeakerDiarization = ({
  onTranscriptUpdate,
  onError,
  maxSpeakers = 4,
  enableRealTime = false
}: UseAdvancedSpeakerDiarizationOptions = {}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [speakers, setSpeakers] = useState<string[]>([])
  const [segments, setSegments] = useState<SpeakerSegment[]>([])
  const [isSupported, setIsSupported] = useState(false)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])

  // Check if advanced features are supported
  useEffect(() => {
    // Check for Web Audio API support
    const hasWebAudio = !!(window.AudioContext || (window as any).webkitAudioContext)
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    
    setIsSupported(hasWebAudio && hasMediaDevices)
    
    if (!hasWebAudio) {
      onError?.(new Error('Web Audio API is not supported'))
    }
    if (!hasMediaDevices) {
      onError?.(new Error('Media Devices API is not supported'))
    }
  }, [onError])

  // Simple speaker detection based on audio characteristics
  const detectSpeakerCharacteristics = useCallback((audioData: Float32Array) => {
    // Calculate basic audio features
    const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length)
    const maxAmplitude = Math.max(...audioData.map(Math.abs))
    const zeroCrossings = audioData.slice(1).reduce((count, val, i) => 
      count + (Math.sign(val) !== Math.sign(audioData[i]) ? 1 : 0), 0
    )
    
    // Simple speaker identification based on audio characteristics
    const speakerId = `Speaker_${Math.floor(rms * 1000) % maxSpeakers + 1}`
    
    return {
      speakerId,
      confidence: Math.min(rms * 10, 1), // Simple confidence based on RMS
      features: {
        rms,
        maxAmplitude,
        zeroCrossings
      }
    }
  }, [maxSpeakers])

  // Process audio data for speaker diarization
  const processAudioData = useCallback((audioData: Float32Array, timestamp: number) => {
    if (!enableRealTime) return

    const speakerInfo = detectSpeakerCharacteristics(audioData)
    
    // Create a simple segment
    const segment: SpeakerSegment = {
      speaker: speakerInfo.speakerId,
      text: '', // Would need transcription integration
      startTime: timestamp,
      endTime: timestamp + (audioData.length / 16000), // Assuming 16kHz
      confidence: speakerInfo.confidence
    }

    // Update segments
    setSegments(prev => [...prev, segment])
    
    // Update speakers list
    setSpeakers(prev => {
      if (!prev.includes(speakerInfo.speakerId)) {
        return [...prev, speakerInfo.speakerId]
      }
      return prev
    })

    onTranscriptUpdate?.([segment])
  }, [enableRealTime, detectSpeakerCharacteristics, onTranscriptUpdate])

  // Start audio processing
  const startProcessing = useCallback(async () => {
    if (!isSupported) {
      onError?.(new Error('Advanced speaker diarization not supported'))
      return
    }

    try {
      setIsProcessing(true)
      
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      mediaStreamRef.current = stream
      
      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      
      // Create audio source
      const source = audioContext.createMediaStreamSource(stream)
      
      // Create processor for real-time analysis
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer
        const audioData = inputBuffer.getChannelData(0)
        const timestamp = audioContext.currentTime
        
        processAudioData(audioData, timestamp)
      }
      
      // Connect audio nodes
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      console.log('🎤 Advanced speaker diarization started')
      
    } catch (error) {
      console.error('❌ Error starting speaker diarization:', error)
      onError?.(error as Error)
      setIsProcessing(false)
    }
  }, [isSupported, processAudioData, onError])

  // Stop audio processing
  const stopProcessing = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    setIsProcessing(false)
    console.log('🛑 Advanced speaker diarization stopped')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProcessing()
    }
  }, [stopProcessing])

  // Format segments as readable text
  const formatSegmentsAsText = useCallback((segments: SpeakerSegment[]) => {
    return segments.map(segment => 
      `${segment.speaker}: ${segment.text}`
    ).join('\n')
  }, [])

  return {
    isProcessing,
    isSupported,
    speakers,
    segments,
    startProcessing,
    stopProcessing,
    formatSegmentsAsText
  }
}

export default useAdvancedSpeakerDiarization




