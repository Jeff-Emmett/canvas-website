import { useCallback, useEffect, useRef, useState } from 'react'
import { getOpenAIConfig, isOpenAIConfigured } from '../lib/clientConfig'

interface UseWhisperTranscriptionOptions {
  apiKey?: string
  onTranscriptUpdate?: (text: string) => void
  onError?: (error: Error) => void
  language?: string
  enableStreaming?: boolean
  removeSilence?: boolean
}

export const useWhisperTranscription = ({
  apiKey,
  onTranscriptUpdate,
  onError,
  language = 'en',
  enableStreaming: _enableStreaming = true,
  removeSilence: _removeSilence = true
}: UseWhisperTranscriptionOptions = {}) => {
  const transcriptRef = useRef('')
  const isRecordingRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Get OpenAI API key from user profile settings
  const openaiConfig = getOpenAIConfig()
  const isConfigured = isOpenAIConfigured()

  // Custom state management
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState({ text: '' })

  // Custom startRecording implementation
  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting custom recording...')
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream
      
      // Debug the audio stream
      console.log('🎤 Audio stream created:', stream)
      console.log('🎤 Audio tracks:', stream.getAudioTracks().length)
      console.log('🎤 Track settings:', stream.getAudioTracks()[0]?.getSettings())
      
      // Set up audio level monitoring
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / bufferLength
        console.log('🎵 Audio level:', average.toFixed(2))
        if (mediaRecorderRef.current?.state === 'recording') {
          requestAnimationFrame(checkAudioLevel)
        }
      }
      checkAudioLevel()
      
      // Create MediaRecorder with fallback options
      let mediaRecorder: MediaRecorder
      const options = [
        { mimeType: 'audio/webm;codecs=opus' },
        { mimeType: 'audio/webm' },
        { mimeType: 'audio/mp4' },
        { mimeType: 'audio/wav' }
      ]
      
      for (const option of options) {
        if (MediaRecorder.isTypeSupported(option.mimeType)) {
          console.log('🎵 Using MIME type:', option.mimeType)
          mediaRecorder = new MediaRecorder(stream, option)
          break
        }
      }
      
      if (!mediaRecorder!) {
        throw new Error('No supported audio format found')
      }
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        console.log('🎵 Data available event fired!')
        console.log('🎵 Data size:', event.data.size, 'bytes')
        console.log('🎵 MediaRecorder state:', mediaRecorder.state)
        console.log('🎵 Event data type:', event.data.type)
        console.log('🎵 Current chunks count:', audioChunksRef.current.length)
        
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('✅ Chunk added successfully, total chunks:', audioChunksRef.current.length)
        } else {
          console.log('⚠️ Empty data chunk received - this might be normal for the first chunk')
        }
      }
      
      // Handle MediaRecorder errors
      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event)
      }
      
      // Handle MediaRecorder state changes
      mediaRecorder.onstart = () => {
        console.log('🎤 MediaRecorder started')
      }
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...')
        console.log('🛑 Total chunks collected:', audioChunksRef.current.length)
        console.log('🛑 Chunk sizes:', audioChunksRef.current.map(chunk => chunk.size))
        setTranscribing(true)
        
        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          console.log('🎵 Audio blob created:', audioBlob.size, 'bytes')
          console.log('🎵 Audio chunks collected:', audioChunksRef.current.length)
          console.log('🎵 Blob type:', audioBlob.type)
          
          if (audioBlob.size === 0) {
            console.error('❌ No audio data recorded!')
            console.error('❌ Chunks:', audioChunksRef.current)
            console.error('❌ Stream active:', streamRef.current?.active)
            console.error('❌ Stream tracks:', streamRef.current?.getTracks().length)
            throw new Error('No audio data was recorded. Please check microphone permissions and try again.')
          }
          
          // Transcribe with OpenAI
          const apiKeyToUse = apiKey || openaiConfig?.apiKey
          console.log('🔑 Using API key:', apiKeyToUse ? 'present' : 'missing')
          console.log('🔑 API key length:', apiKeyToUse?.length || 0)
          
          if (!apiKeyToUse) {
            throw new Error('No OpenAI API key available')
          }
          
          const formData = new FormData()
          formData.append('file', audioBlob, 'recording.webm')
          formData.append('model', 'whisper-1')
          formData.append('language', language)
          formData.append('response_format', 'text')
          
          console.log('📤 Sending request to OpenAI API...')
          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeyToUse}`,
            },
            body: formData
          })
          
          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
          }
          
          const transcriptionText = await response.text()
          console.log('🎯 TRANSCRIPTION RESULT:', transcriptionText)
          
          setTranscript({ text: transcriptionText })
          onTranscriptUpdate?.(transcriptionText)
          
        } catch (error) {
          console.error('❌ Transcription error:', error)
          onError?.(error as Error)
        } finally {
          setTranscribing(false)
        }
      }
      
      // Start recording with timeslice to get data chunks
      mediaRecorder.start(1000) // 1-second chunks
      setRecording(true)
      isRecordingRef.current = true
      console.log('✅ Custom recording started with 1000ms timeslice')
      console.log('🎤 MediaRecorder state after start:', mediaRecorder.state)
      console.log('🎤 MediaRecorder mimeType:', mediaRecorder.mimeType)
      
      // Auto-stop after 10 seconds for testing (increased time)
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('⏰ Auto-stopping recording after 10 seconds...')
          mediaRecorderRef.current.stop()
        }
      }, 10000)
      
      // Add a test to check if we're getting any data after 2 seconds
      setTimeout(() => {
        console.log('🧪 2-second test - chunks collected so far:', audioChunksRef.current.length)
        console.log('🧪 2-second test - chunk sizes:', audioChunksRef.current.map(chunk => chunk.size))
        console.log('🧪 2-second test - MediaRecorder state:', mediaRecorderRef.current?.state)
      }, 2000)
      
    } catch (error) {
      console.error('❌ Error starting custom recording:', error)
      onError?.(error as Error)
    }
  }, [apiKey, openaiConfig?.apiKey, language, onTranscriptUpdate, onError])

  // Custom stopRecording implementation
  const stopRecording = useCallback(async () => {
    try {
      console.log('🛑 Stopping custom recording...')
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      setRecording(false)
      isRecordingRef.current = false
      console.log('✅ Custom recording stopped')
      
    } catch (error) {
      console.error('❌ Error stopping custom recording:', error)
      onError?.(error as Error)
    }
  }, [onError])

  // Custom pauseRecording implementation (placeholder)
  const pauseRecording = useCallback(async () => {
    console.log('⏸️ Pause recording not implemented in custom version')
  }, [])

  // Update transcript when it changes
  useEffect(() => {
    if (transcript?.text && transcript.text !== transcriptRef.current) {
      console.log('✅ New transcript text received:', transcript.text)
      console.log('🎯 TRANSCRIPT EMITTED TO CONSOLE:', transcript.text)
      transcriptRef.current = transcript.text
      onTranscriptUpdate?.(transcript.text)
    }
  }, [transcript?.text, onTranscriptUpdate])

  // Handle recording state changes
  useEffect(() => {
    isRecordingRef.current = recording
  }, [recording])

  // Check if OpenAI is configured
  useEffect(() => {
    if (!isConfigured && !apiKey) {
      onError?.(new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your environment variables.'))
    }
  }, [isConfigured, apiKey, onError])

  const startTranscription = useCallback(async () => {
    try {
      console.log('🎤 Starting custom Whisper transcription...')
      
      // Check if OpenAI is configured
      if (!isConfigured && !apiKey) {
        console.error('❌ No OpenAI API key found')
        onError?.(new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your environment variables.'))
        return
      }
      
      await startRecording()
      console.log('✅ Custom Whisper transcription started')
      
    } catch (error) {
      console.error('❌ Error starting custom Whisper transcription:', error)
      onError?.(error as Error)
    }
  }, [startRecording, onError, apiKey, isConfigured])

  const stopTranscription = useCallback(async () => {
    try {
      console.log('🛑 Stopping custom Whisper transcription...')
      await stopRecording()
      console.log('✅ Custom Whisper transcription stopped')
    } catch (error) {
      console.error('❌ Error stopping custom Whisper transcription:', error)
      onError?.(error as Error)
    }
  }, [stopRecording, onError])

  const pauseTranscription = useCallback(async () => {
    try {
      console.log('⏸️ Pausing custom Whisper transcription...')
      await pauseRecording()
      console.log('✅ Custom Whisper transcription paused')
    } catch (error) {
      console.error('❌ Error pausing custom Whisper transcription:', error)
      onError?.(error as Error)
    }
  }, [pauseRecording, onError])

  return {
    // State
    isRecording: recording,
    isSpeaking: speaking,
    isTranscribing: transcribing,
    transcript: transcript?.text || '',
    
    // Actions
    startTranscription,
    stopTranscription,
    pauseTranscription,
    
    // Raw functions for advanced usage
    startRecording,
    stopRecording,
    pauseRecording,
  }
}