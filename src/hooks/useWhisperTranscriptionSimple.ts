import { useCallback, useEffect, useRef, useState } from 'react'
import { pipeline, env } from '@xenova/transformers'
import { transcribeWithRunPod } from '../lib/runpodApi'
import { isRunPodConfigured } from '../lib/clientConfig'

// Configure the transformers library
env.allowRemoteModels = true
env.allowLocalModels = false
env.useBrowserCache = true
env.useCustomCache = false

// Helper function to detect audio format from blob
function detectAudioFormat(blob: Blob): Promise<string> {
  if (blob.type && blob.type !== 'application/octet-stream') {
    return Promise.resolve(blob.type)
  }
  
  // Try to detect from the first few bytes
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        if (!arrayBuffer || arrayBuffer.byteLength < 4) {
          resolve('audio/webm;codecs=opus') // Default fallback
          return
        }
        
        const uint8Array = new Uint8Array(arrayBuffer.slice(0, 12))
        
        // Check for common audio format signatures
        if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
          resolve('audio/wav')
        } else if (uint8Array[0] === 0x4F && uint8Array[1] === 0x67 && uint8Array[2] === 0x67 && uint8Array[3] === 0x53) {
          resolve('audio/ogg;codecs=opus')
        } else if (uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && uint8Array[2] === 0xDF && uint8Array[3] === 0xA3) {
          resolve('audio/webm;codecs=opus')
        } else {
          resolve('audio/webm;codecs=opus') // Default fallback
        }
      } catch (error) {
        console.warn('⚠️ Error detecting audio format:', error)
        resolve('audio/webm;codecs=opus') // Default fallback
      }
    }
    reader.onerror = () => {
      resolve('audio/webm;codecs=opus') // Default fallback
    }
    reader.readAsArrayBuffer(blob.slice(0, 12))
  })
}

// Convert Float32Array audio data to WAV blob
async function createWavBlob(audioData: Float32Array, sampleRate: number): Promise<Blob> {
  const length = audioData.length
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * 2, true)
  
  // Convert float samples to 16-bit PCM
  let offset = 44
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    offset += 2
  }
  
  return new Blob([buffer], { type: 'audio/wav' })
}

// Simple resampling function for audio data
function resampleAudio(audioData: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  if (fromSampleRate === toSampleRate) {
    return audioData
  }
  
  // Validate input parameters
  if (!audioData || audioData.length === 0) {
    throw new Error('Invalid audio data for resampling')
  }
  
  if (fromSampleRate <= 0 || toSampleRate <= 0) {
    throw new Error('Invalid sample rates for resampling')
  }
  
  const ratio = fromSampleRate / toSampleRate
  const newLength = Math.floor(audioData.length / ratio)
  
  // Ensure we have a valid length
  if (newLength <= 0) {
    throw new Error('Invalid resampled length')
  }
  
  const resampled = new Float32Array(newLength)
  
  for (let i = 0; i < newLength; i++) {
    const sourceIndex = Math.floor(i * ratio)
    // Ensure sourceIndex is within bounds
    if (sourceIndex >= 0 && sourceIndex < audioData.length) {
      resampled[i] = audioData[sourceIndex]
    } else {
      resampled[i] = 0
    }
  }
  
  return resampled
}

interface ModelOption {
  name: string
  options: {
    quantized: boolean
    use_browser_cache: boolean
    use_custom_cache: boolean
  }
}

interface UseWhisperTranscriptionOptions {
  onTranscriptUpdate?: (text: string) => void
  onError?: (error: Error) => void
  language?: string
  enableStreaming?: boolean
  enableAdvancedErrorHandling?: boolean
  modelOptions?: ModelOption[]
  autoInitialize?: boolean // If false, model will only load when startRecording is called
  useRunPod?: boolean // If true, use RunPod WhisperX endpoint instead of local model (defaults to checking if RunPod is configured)
}

export const useWhisperTranscription = ({
  onTranscriptUpdate,
  onError,
  language = 'en',
  enableStreaming = false,
  enableAdvancedErrorHandling = false,
  modelOptions,
  autoInitialize = true, // Default to true for backward compatibility
  useRunPod = undefined // If undefined, auto-detect based on configuration
}: UseWhisperTranscriptionOptions = {}) => {
  // Auto-detect RunPod usage if not explicitly set
  const shouldUseRunPod = useRunPod !== undefined ? useRunPod : isRunPodConfigured()
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [modelLoaded, setModelLoaded] = useState(false)
  
  const transcriberRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isRecordingRef = useRef(false)
  const transcriptRef = useRef('')
  const streamingTranscriptRef = useRef('')
  const periodicTranscriptionRef = useRef<NodeJS.Timeout | null>(null)
  const lastTranscriptionTimeRef = useRef<number>(0)
  const lastSpeechTimeRef = useRef<number>(0)
  const previousTranscriptLengthRef = useRef<number>(0) // Track previous transcript length for continuous transcription

  // Function to process transcript with line breaks and punctuation
  const processTranscript = useCallback((text: string, isStreaming: boolean = false) => {
    if (!text.trim()) return text

    let processedText = text.trim()
    
    // Add punctuation if missing at the end
    if (!/[.!?]$/.test(processedText)) {
      processedText += '.'
    }
    
    // Add line break if there's been a pause (for streaming)
    if (isStreaming) {
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

  // Initialize transcriber with optional advanced error handling
  const initializeTranscriber = useCallback(async () => {
    // Skip model loading if using RunPod
    if (shouldUseRunPod) {
      console.log('🚀 Using RunPod WhisperX endpoint - skipping local model loading')
      setModelLoaded(true) // Mark as "loaded" since we don't need a local model
      return null
    }
    
    if (transcriberRef.current) return transcriberRef.current
    
    try {
      console.log('🤖 Loading Whisper model...')
      
      // Check if we're running in a CORS-restricted environment
      if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        console.warn('⚠️ Running from file:// protocol - CORS issues may occur')
        console.warn('💡 Consider running from a local development server for better compatibility')
      }
      
      if (enableAdvancedErrorHandling && modelOptions) {
        // Use advanced model loading with fallbacks
        let transcriber = null
        let lastError = null
        
        for (const modelOption of modelOptions) {
          try {
            console.log(`🔄 Trying model: ${modelOption.name}`)
            transcriber = await pipeline('automatic-speech-recognition', modelOption.name, {
              ...modelOption.options,
              progress_callback: (progress: any) => {
                if (progress.status === 'downloading') {
                  console.log(`📦 Downloading model: ${progress.file} (${Math.round(progress.progress * 100)}%)`)
                }
              }
            })
            console.log(`✅ Successfully loaded model: ${modelOption.name}`)
            break
          } catch (error) {
            console.warn(`⚠️ Failed to load model ${modelOption.name}:`, error)
            lastError = error
            continue
          }
        }
        
        if (!transcriber) {
          throw lastError || new Error('Failed to load any model')
        }
        
        transcriberRef.current = transcriber
        setModelLoaded(true)
        return transcriber
      } else {
        // Simple model loading (default behavior) with fallback
        const modelOptions = [
          'Xenova/whisper-tiny.en',
          'Xenova/whisper-tiny'
        ]
        
        let transcriber = null
        let lastError = null
        
        for (const modelName of modelOptions) {
          try {
            // Reduced debug logging
            
            const loadPromise = pipeline('automatic-speech-recognition', modelName, {
        quantized: true,
              progress_callback: (progress: any) => {
                if (progress.status === 'downloading') {
                  console.log(`📦 Downloading model: ${progress.file} (${Math.round(progress.progress * 100)}%)`)
                } else if (progress.status === 'loading') {
                  console.log(`🔄 Loading model: ${progress.file}`)
                }
              }
            })
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Model loading timeout')), 60000) // 60 seconds timeout
            )
            
            transcriber = await Promise.race([loadPromise, timeoutPromise])
      
      transcriberRef.current = transcriber
      setModelLoaded(true)
            console.log(`✅ Whisper model loaded: ${modelName}`)
      
      return transcriber
          } catch (error) {
            // Reduced error logging - only show final error
            lastError = error
            continue
          }
        }
        
        // If all models failed, throw the last error
        throw lastError || new Error('Failed to load any Whisper model')
      }
    } catch (error) {
      console.error('❌ Failed to load model:', error)
      onError?.(error as Error)
      throw error
    }
  }, [onError, enableAdvancedErrorHandling, modelOptions])

  // Handle streaming transcript updates
  const handleStreamingTranscriptUpdate = useCallback((newText: string) => {
    if (newText.trim()) {
      const newTextTrimmed = newText.trim()
      const currentTranscript = streamingTranscriptRef.current.trim()
      
      if (currentTranscript === '') {
        streamingTranscriptRef.current = newTextTrimmed
      } else {
        // Check if the new text is already contained in the current transcript
        if (!currentTranscript.includes(newTextTrimmed)) {
          streamingTranscriptRef.current = currentTranscript + ' ' + newTextTrimmed
        } else {
          // Find the best overlap point to avoid duplicates
          const words = newTextTrimmed.split(' ')
          const currentWords = currentTranscript.split(' ')
          
          let overlapIndex = 0
          let maxOverlap = 0
          
          for (let i = 1; i <= Math.min(words.length, currentWords.length); i++) {
            const currentEnd = currentWords.slice(-i).join(' ')
            const newStart = words.slice(0, i).join(' ')
            
            if (currentEnd === newStart && i > maxOverlap) {
              maxOverlap = i
              overlapIndex = i
            }
          }
          
          if (overlapIndex > 0 && overlapIndex < words.length) {
            const newPart = words.slice(overlapIndex).join(' ')
            streamingTranscriptRef.current = currentTranscript + ' ' + newPart
          }
        }
      }
      
      const processedTranscript = processTranscript(streamingTranscriptRef.current, true)
      streamingTranscriptRef.current = processedTranscript
      setTranscript(processedTranscript)
      
      // Only send the new portion for continuous transcription
      const newTextPortion = processedTranscript.substring(previousTranscriptLengthRef.current)
      if (newTextPortion.trim()) {
        onTranscriptUpdate?.(newTextPortion)
        previousTranscriptLengthRef.current = processedTranscript.length
      }
      
      console.log(`📝 Real-time transcript updated: "${newTextTrimmed}" -> Total: "${processedTranscript}"`)
      console.log(`🔄 Streaming transcript state updated, calling onTranscriptUpdate with: "${processedTranscript}"`)
    }
  }, [onTranscriptUpdate, processTranscript])

  // Process accumulated audio chunks for streaming transcription
  const processAccumulatedAudioChunks = useCallback(async () => {
    try {
      // Throttle transcription requests
      const now = Date.now()
      if (now - (lastTranscriptionTimeRef.current || 0) < 800) { // Reduced to 0.8 seconds for better responsiveness
        return // Skip if less than 0.8 seconds since last transcription
      }
      
      const chunks = audioChunksRef.current || []
      if (chunks.length === 0 || chunks.length < 2) {
        console.log(`⚠️ Not enough chunks for real-time processing: ${chunks.length}`)
        return
      }
      
      // Take the last 4-5 chunks for balanced processing (1-2 seconds)
      const recentChunks = chunks.slice(-5)
      const validChunks = recentChunks.filter(chunk => chunk && chunk.size > 2000) // Filter out small chunks
      
      if (validChunks.length < 2) {
        console.log(`⚠️ Not enough valid chunks for real-time processing: ${validChunks.length}`)
        return
      }
      
      const totalSize = validChunks.reduce((sum, chunk) => sum + chunk.size, 0)
      if (totalSize < 20000) { // Increased to 20KB for reliable decoding
        console.log(`⚠️ Not enough audio data for real-time processing: ${totalSize} bytes`)
        return
      }
      
      // Use the MIME type from the MediaRecorder, not individual chunks
      let mimeType = 'audio/webm;codecs=opus' // Default to WebM
      if (mediaRecorderRef.current && mediaRecorderRef.current.mimeType) {
        mimeType = mediaRecorderRef.current.mimeType
      }
      
      console.log(`🔄 Real-time processing ${validChunks.length} chunks, total size: ${totalSize} bytes, type: ${mimeType}`)
      console.log(`🔄 Chunk sizes:`, validChunks.map(c => c.size))
      console.log(`🔄 Chunk types:`, validChunks.map(c => c.type))
      
      // Create a more robust blob with proper headers
      const tempBlob = new Blob(validChunks, { type: mimeType })
      
      // Validate blob size
      if (tempBlob.size < 10000) {
        console.log(`⚠️ Blob too small for processing: ${tempBlob.size} bytes`)
        return
      }
      
      const audioBuffer = await tempBlob.arrayBuffer()
      
      // Validate audio buffer
      if (audioBuffer.byteLength < 10000) {
        console.log(`⚠️ Audio buffer too small: ${audioBuffer.byteLength} bytes`)
        return
      }
      
      const audioContext = new AudioContext()
      let audioBufferFromBlob: AudioBuffer
      
      try {
        // Try to decode the audio buffer
        audioBufferFromBlob = await audioContext.decodeAudioData(audioBuffer)
        console.log(`✅ Successfully decoded real-time audio buffer: ${audioBufferFromBlob.length} samples`)
      } catch (decodeError) {
        console.log('⚠️ Real-time chunk decode failed, trying alternative approach:', decodeError)
        
        // Try alternative approach: create a new blob with different MIME type
        try {
          const alternativeBlob = new Blob(validChunks, { type: 'audio/webm' })
          const alternativeBuffer = await alternativeBlob.arrayBuffer()
          audioBufferFromBlob = await audioContext.decodeAudioData(alternativeBuffer)
          console.log(`✅ Successfully decoded with alternative approach: ${audioBufferFromBlob.length} samples`)
        } catch (altError) {
          console.log('⚠️ Alternative decode also failed, skipping:', altError)
          await audioContext.close()
          return
        }
      }
      
      await audioContext.close()
      
      const audioData = audioBufferFromBlob.getChannelData(0)
      if (!audioData || audioData.length === 0) {
        return
      }
      
      // Resample if necessary
      let processedAudioData: Float32Array = audioData
      if (audioBufferFromBlob.sampleRate !== 16000) {
        processedAudioData = resampleAudio(audioData as Float32Array, audioBufferFromBlob.sampleRate, 16000)
      }
      
      // Check for meaningful audio content
      const rms = Math.sqrt(processedAudioData.reduce((sum, val) => sum + val * val, 0) / processedAudioData.length)
      const maxAmplitude = Math.max(...processedAudioData.map(Math.abs))
      const dynamicRange = maxAmplitude - Math.min(...processedAudioData.map(Math.abs))
      
      console.log(`🔊 Real-time audio analysis: RMS=${rms.toFixed(6)}, Max=${maxAmplitude.toFixed(6)}, Range=${dynamicRange.toFixed(6)}`)
      
      if (rms < 0.001) {
        console.log('⚠️ Audio too quiet for transcription (RMS < 0.001)')
        return // Skip very quiet audio
      }
      
      if (dynamicRange < 0.01) {
        console.log('⚠️ Audio has very low dynamic range, may be mostly noise')
        return
      }
      
      // Ensure reasonable length for real-time processing (max 2 seconds for balanced speed)
      const maxRealtimeSamples = 32000 // 2 seconds at 16kHz
      if (processedAudioData.length > maxRealtimeSamples) {
        processedAudioData = processedAudioData.slice(-maxRealtimeSamples)
      }
      
      if (processedAudioData.length < 2000) { // Increased to 2 second minimum for reliable processing
        return // Skip very short audio
      }
      
      console.log(`🎵 Real-time audio: ${processedAudioData.length} samples (${(processedAudioData.length / 16000).toFixed(2)}s)`)
      
      let transcriptionText = ''
      
      // Use RunPod if configured, otherwise use local model
      if (shouldUseRunPod) {
        console.log('🚀 Using RunPod WhisperX API for real-time transcription...')
        // Convert processed audio data back to blob for RunPod
        const wavBlob = await createWavBlob(processedAudioData, 16000)
        transcriptionText = await transcribeWithRunPod(wavBlob, language)
      } else {
        // Use local Whisper model
        if (!transcriberRef.current) {
          console.log('⚠️ Transcriber not available for real-time processing')
          return
        }
        const result = await transcriberRef.current(processedAudioData, {
          language: language,
          task: 'transcribe',
          return_timestamps: false,
          chunk_length_s: 5,        // Longer chunks for better context
          stride_length_s: 2,       // Larger stride for better coverage
          no_speech_threshold: 0.3, // Higher threshold to reduce noise
          logprob_threshold: -0.8,  // More sensitive detection
          compression_ratio_threshold: 2.0 // More permissive for real-time
        })
        
        transcriptionText = result?.text || ''
      }
      if (transcriptionText.trim()) {
        lastTranscriptionTimeRef.current = Date.now()
        console.log(`✅ Real-time transcript: "${transcriptionText.trim()}"`)
        console.log(`🔄 Calling handleStreamingTranscriptUpdate with: "${transcriptionText.trim()}"`)
        handleStreamingTranscriptUpdate(transcriptionText.trim())
      } else {
        console.log('⚠️ No real-time transcription text produced, trying fallback parameters...')
        
        // Try with more permissive parameters for real-time processing (only for local model)
        if (!shouldUseRunPod && transcriberRef.current) {
          try {
            const fallbackResult = await transcriberRef.current(processedAudioData, {
              task: 'transcribe',
              return_timestamps: false,
              chunk_length_s: 3,        // Shorter chunks for fallback
              stride_length_s: 1,       // Smaller stride for fallback
              no_speech_threshold: 0.1, // Very low threshold for fallback
              logprob_threshold: -1.2,  // Very sensitive for fallback
              compression_ratio_threshold: 2.5 // Very permissive for fallback
            })
            
            const fallbackText = fallbackResult?.text || ''
            if (fallbackText.trim()) {
              console.log(`✅ Fallback real-time transcript: "${fallbackText.trim()}"`)
              lastTranscriptionTimeRef.current = Date.now()
              handleStreamingTranscriptUpdate(fallbackText.trim())
            } else {
              console.log('⚠️ Fallback transcription also produced no text')
            }
          } catch (fallbackError) {
            console.log('⚠️ Fallback transcription failed:', fallbackError)
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing accumulated audio chunks:', error)
    }
  }, [handleStreamingTranscriptUpdate, language, shouldUseRunPod])

  // Process recorded audio chunks (final processing)
  const processAudioChunks = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('⚠️ No audio chunks to process')
      return
    }
    
    // For local model, ensure transcriber is loaded
    if (!shouldUseRunPod) {
      if (!transcriberRef.current) {
        console.log('⚠️ No transcriber available')
        return
      }
      
      // Ensure model is loaded
      if (!modelLoaded) {
        console.log('⚠️ Model not loaded yet, waiting...')
        try {
          await initializeTranscriber()
        } catch (error) {
          console.error('❌ Failed to initialize transcriber:', error)
          onError?.(error as Error)
          return
        }
      }
    }

    try {
      setIsTranscribing(true)
      console.log('🔄 Processing final audio chunks...')
      
      // Create a blob from all chunks with proper MIME type detection
      let mimeType = 'audio/webm;codecs=opus'
      if (audioChunksRef.current.length > 0 && audioChunksRef.current[0].type) {
        mimeType = audioChunksRef.current[0].type
      }
      
      // Filter out small chunks that might be corrupted
      const validChunks = audioChunksRef.current.filter(chunk => chunk && chunk.size > 1000)
      
      if (validChunks.length === 0) {
        console.log('⚠️ No valid audio chunks to process')
        return
      }
      
      console.log(`🔄 Processing ${validChunks.length} valid chunks out of ${audioChunksRef.current.length} total chunks`)
      
      const audioBlob = new Blob(validChunks, { type: mimeType })
      
      // Validate blob size
      if (audioBlob.size < 10000) {
        console.log(`⚠️ Audio blob too small for processing: ${audioBlob.size} bytes`)
        return
      }
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer()
      
      // Validate array buffer
      if (arrayBuffer.byteLength < 10000) {
        console.log(`⚠️ Audio buffer too small: ${arrayBuffer.byteLength} bytes`)
        return
      }
      
      // Create audio context to convert to Float32Array
      const audioContext = new AudioContext()
      
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        console.log(`✅ Successfully decoded final audio buffer: ${audioBuffer.length} samples`)
      } catch (decodeError) {
        console.error('❌ Failed to decode final audio buffer:', decodeError)
        
        // Try alternative approach with different MIME type
        try {
          console.log('🔄 Trying alternative MIME type for final processing...')
          const alternativeBlob = new Blob(validChunks, { type: 'audio/webm' })
          const alternativeBuffer = await alternativeBlob.arrayBuffer()
          audioBuffer = await audioContext.decodeAudioData(alternativeBuffer)
          console.log(`✅ Successfully decoded with alternative approach: ${audioBuffer.length} samples`)
        } catch (altError) {
          console.error('❌ Alternative decode also failed:', altError)
          await audioContext.close()
          throw new Error('Failed to decode audio data. The audio format may not be supported or the data may be corrupted.')
        }
      }
      
      await audioContext.close()
      
      // Get the first channel as Float32Array
      const audioData = audioBuffer.getChannelData(0)
      
      console.log(`🔍 Audio buffer info: sampleRate=${audioBuffer.sampleRate}, length=${audioBuffer.length}, duration=${audioBuffer.duration}s`)
      console.log(`🔍 Audio data: length=${audioData.length}, first 10 values:`, Array.from(audioData.slice(0, 10)))
      
      // Check for meaningful audio content
      const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length)
      console.log(`🔊 Audio RMS level: ${rms.toFixed(6)}`)
      
      if (rms < 0.001) {
        console.log('⚠️ Audio appears to be mostly silence (RMS < 0.001)')
      }
      
      // Resample if necessary
      let processedAudioData: Float32Array = audioData
      if (audioBuffer.sampleRate !== 16000) {
        console.log(`🔄 Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz`)
        processedAudioData = resampleAudio(audioData as Float32Array, audioBuffer.sampleRate, 16000)
      }
      
      console.log(`🎵 Processing audio: ${processedAudioData.length} samples (${(processedAudioData.length / 16000).toFixed(2)}s)`)
      
      console.log('🔄 Starting transcription...')
      
      let newText = ''
      
      // Use RunPod if configured, otherwise use local model
      if (shouldUseRunPod) {
        console.log('🚀 Using RunPod WhisperX API...')
        // Convert processed audio data back to blob for RunPod
        // Create a WAV blob from the Float32Array
        const wavBlob = await createWavBlob(processedAudioData, 16000)
        newText = await transcribeWithRunPod(wavBlob, language)
        console.log('✅ RunPod transcription result:', newText)
      } else {
        // Use local Whisper model
        if (!transcriberRef.current) {
          throw new Error('Transcriber not initialized')
        }
        const result = await transcriberRef.current(processedAudioData, {
          language: language,
          task: 'transcribe',
          return_timestamps: false
        })
        
        console.log('🔍 Transcription result:', result)
        newText = result?.text?.trim() || ''
      }
      if (newText) {
          const processedText = processTranscript(newText, enableStreaming)
          
          if (enableStreaming) {
            // For streaming mode, merge with existing streaming transcript
            handleStreamingTranscriptUpdate(processedText)
          } else {
            // For non-streaming mode, append to existing transcript
            const currentTranscript = transcriptRef.current
            const updatedTranscript = currentTranscript ? `${currentTranscript} ${processedText}` : processedText
            
            transcriptRef.current = updatedTranscript
            setTranscript(updatedTranscript)
            
            // Only send the new portion for continuous transcription
            const newTextPortion = updatedTranscript.substring(previousTranscriptLengthRef.current)
            if (newTextPortion.trim()) {
              onTranscriptUpdate?.(newTextPortion)
              previousTranscriptLengthRef.current = updatedTranscript.length
            }
        
            console.log(`✅ Transcription: "${processedText}" -> Total: "${updatedTranscript}"`)
          }
      } else {
        console.log('⚠️ No transcription text produced')
        console.log('🔍 Full transcription result object:', result)
        
        // Try alternative transcription parameters (only for local model)
        if (!shouldUseRunPod && transcriberRef.current) {
          console.log('🔄 Trying alternative transcription parameters...')
          try {
            const altResult = await transcriberRef.current(processedAudioData, {
              task: 'transcribe',
              return_timestamps: false
            })
            console.log('🔍 Alternative transcription result:', altResult)
            
            if (altResult?.text?.trim()) {
            const processedAltText = processTranscript(altResult.text, enableStreaming)
            console.log('✅ Alternative transcription successful:', processedAltText)
            const currentTranscript = transcriptRef.current
            const updatedTranscript = currentTranscript ? `${currentTranscript} ${processedAltText}` : processedAltText
            
            transcriptRef.current = updatedTranscript
            setTranscript(updatedTranscript)
            
            // Only send the new portion for continuous transcription
            const newTextPortion = updatedTranscript.substring(previousTranscriptLengthRef.current)
            if (newTextPortion.trim()) {
              onTranscriptUpdate?.(newTextPortion)
              previousTranscriptLengthRef.current = updatedTranscript.length
            }
          }
          } catch (altError) {
            console.log('⚠️ Alternative transcription also failed:', altError)
          }
        }
      }
      
      // Clear processed chunks
      audioChunksRef.current = []
      
    } catch (error) {
      console.error('❌ Error processing audio:', error)
      onError?.(error as Error)
    } finally {
      setIsTranscribing(false)
    }
  }, [transcriberRef, language, onTranscriptUpdate, onError, enableStreaming, handleStreamingTranscriptUpdate, modelLoaded, initializeTranscriber, shouldUseRunPod])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting recording...')
      console.log('🔍 enableStreaming in startRecording:', enableStreaming)
      
      // Ensure model is loaded before starting (skip for RunPod)
      if (!shouldUseRunPod && !modelLoaded) {
        console.log('🔄 Model not loaded, initializing...')
        await initializeTranscriber()
      } else if (shouldUseRunPod) {
        // For RunPod, just mark as ready
        setModelLoaded(true)
      }
      
      // Don't reset transcripts for continuous transcription - keep existing content
      // transcriptRef.current = ''
      // streamingTranscriptRef.current = ''
      // setTranscript('')
      lastSpeechTimeRef.current = 0
      audioChunksRef.current = []
      lastTranscriptionTimeRef.current = 0
      
      // Clear any existing periodic transcription timer
      if (periodicTranscriptionRef.current) {
        clearInterval(periodicTranscriptionRef.current)
        periodicTranscriptionRef.current = null
      }
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      })
      
      streamRef.current = stream
      
      // Create MediaRecorder with fallback options
      let mediaRecorder: MediaRecorder
      const options = [
        { mimeType: 'audio/webm;codecs=opus' },
        { mimeType: 'audio/webm' },
        { mimeType: 'audio/ogg;codecs=opus' },
        { mimeType: 'audio/ogg' },
        { mimeType: 'audio/wav' },
        { mimeType: 'audio/mp4' }
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
      
      // Store the MIME type for later use
      const mimeType = mediaRecorder.mimeType
      console.log('🎵 Final MIME type:', mimeType)
      
      mediaRecorderRef.current = mediaRecorder
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Validate chunk before adding
          if (event.data.size > 1000) { // Only add chunks with meaningful size
          audioChunksRef.current.push(event.data)
            console.log(`📦 Received chunk ${audioChunksRef.current.length}, size: ${event.data.size} bytes, type: ${event.data.type}`)
            
            // Limit the number of chunks to prevent memory issues
            if (audioChunksRef.current.length > 20) {
              audioChunksRef.current = audioChunksRef.current.slice(-15) // Keep last 15 chunks
            }
          } else {
            console.log(`⚠️ Skipping small chunk: ${event.data.size} bytes`)
          }
        }
      }
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log('🛑 Recording stopped, processing audio...')
        processAudioChunks()
      }
      
      // Handle MediaRecorder state changes
      mediaRecorder.onstart = () => {
        console.log('🎤 MediaRecorder started')
        console.log('🔍 enableStreaming value:', enableStreaming)
        setIsRecording(true)
        isRecordingRef.current = true
        
        // Start periodic transcription processing for streaming mode
        if (enableStreaming) {
          console.log('🔄 Starting streaming transcription (every 0.8 seconds)')
          periodicTranscriptionRef.current = setInterval(() => {
            console.log('🔄 Interval triggered, isRecordingRef.current:', isRecordingRef.current)
            if (isRecordingRef.current) {
              console.log('🔄 Running periodic streaming transcription...')
              processAccumulatedAudioChunks()
            } else {
              console.log('⚠️ Not running transcription - recording stopped')
            }
          }, 800) // Update every 0.8 seconds for better responsiveness
        } else {
          console.log('ℹ️ Streaming transcription disabled - enableStreaming is false')
        }
      }
      
      // Start recording with appropriate timeslice
      const timeslice = enableStreaming ? 1000 : 2000 // Larger chunks for more stable processing
      console.log(`🎵 Starting recording with ${timeslice}ms timeslice`)
      mediaRecorder.start(timeslice)
      isRecordingRef.current = true
      setIsRecording(true)
      
      console.log('✅ Recording started - MediaRecorder state:', mediaRecorder.state)
      
    } catch (error) {
      console.error('❌ Error starting recording:', error)
      onError?.(error as Error)
    }
  }, [processAudioChunks, processAccumulatedAudioChunks, onError, enableStreaming, modelLoaded, initializeTranscriber, shouldUseRunPod])

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      console.log('🛑 Stopping recording...')
      
      // Clear periodic transcription timer
      if (periodicTranscriptionRef.current) {
        clearInterval(periodicTranscriptionRef.current)
        periodicTranscriptionRef.current = null
      }
      
      if (mediaRecorderRef.current && isRecordingRef.current) {
        mediaRecorderRef.current.stop()
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      isRecordingRef.current = false
      setIsRecording(false)
      
      console.log('✅ Recording stopped')
      
    } catch (error) {
      console.error('❌ Error stopping recording:', error)
      onError?.(error as Error)
    }
  }, [onError])

  // Pause recording (placeholder for compatibility)
  const pauseRecording = useCallback(async () => {
    console.log('⏸️ Pause recording not implemented')
  }, [])

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up transcription resources...')
    
    // Stop recording if active
    if (isRecordingRef.current) {
      setIsRecording(false)
      isRecordingRef.current = false
    }
    
    // Clear periodic transcription timer
    if (periodicTranscriptionRef.current) {
      clearInterval(periodicTranscriptionRef.current)
      periodicTranscriptionRef.current = null
    }
    
    // Stop MediaRecorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Clear chunks
    audioChunksRef.current = []
    
    console.log('✅ Cleanup completed')
  }, [])

  // Convenience functions for compatibility
  const startTranscription = useCallback(async () => {
    try {
      console.log('🎤 Starting transcription...')
      
      // Reset all transcription state for clean start
      streamingTranscriptRef.current = ''
      setTranscript('')
      setIsRecording(false)
      isRecordingRef.current = false
      lastTranscriptionTimeRef.current = 0
      
      // Clear any existing timers
      if (periodicTranscriptionRef.current) {
        clearInterval(periodicTranscriptionRef.current)
        periodicTranscriptionRef.current = null
      }
      
      // Initialize the model if not already loaded (skip for RunPod)
      if (!shouldUseRunPod && !modelLoaded) {
        await initializeTranscriber()
      } else if (shouldUseRunPod) {
        setModelLoaded(true)
      }
      
      await startRecording()
      console.log('✅ Transcription started')
      
    } catch (error) {
      console.error('❌ Error starting transcription:', error)
      onError?.(error as Error)
    }
  }, [startRecording, onError, modelLoaded, initializeTranscriber])

  const stopTranscription = useCallback(async () => {
    try {
      console.log('🛑 Stopping transcription...')
      await stopRecording()
      console.log('✅ Transcription stopped')
    } catch (error) {
      console.error('❌ Error stopping transcription:', error)
      onError?.(error as Error)
    }
  }, [stopRecording, onError])

  const pauseTranscription = useCallback(async () => {
    try {
      console.log('⏸️ Pausing transcription...')
      await pauseRecording()
      console.log('✅ Transcription paused')
    } catch (error) {
      console.error('❌ Error pausing transcription:', error)
      onError?.(error as Error)
    }
  }, [pauseRecording, onError])

  // Initialize model on mount (only if autoInitialize is true)
  useEffect(() => {
    if (autoInitialize) {
      initializeTranscriber().catch(console.warn)
    }
  }, [initializeTranscriber, autoInitialize, shouldUseRunPod])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    // State
    isRecording,
    isSpeaking,
    isTranscribing,
    transcript,
    modelLoaded,
    
    // Actions
    startTranscription,
    stopTranscription,
    pauseTranscription,
    
    // Raw functions for advanced usage
    startRecording,
    stopRecording,
    pauseRecording,
    cleanup
  }
}

// Export both the new consolidated hook and the old name for backward compatibility
export const useWhisperTranscriptionSimple = useWhisperTranscription
