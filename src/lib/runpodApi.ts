/**
 * RunPod API utility functions
 * Handles communication with RunPod WhisperX endpoints
 *
 * SECURITY: All RunPod calls go through the Cloudflare Worker proxy
 * API keys are stored server-side, never exposed to the browser
 */

import { getRunPodProxyConfig } from './clientConfig'

export interface RunPodTranscriptionResponse {
  id?: string
  status?: string
  output?: {
    text?: string
    segments?: Array<{
      start: number
      end: number
      text: string
    }>
  }
  error?: string
}

/**
 * Convert audio blob to base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = reader.result.split(',')[1] || reader.result
        resolve(base64)
      } else {
        reject(new Error('Failed to convert blob to base64'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Send transcription request to RunPod endpoint via proxy
 * Handles both synchronous and asynchronous job patterns
 */
export async function transcribeWithRunPod(
  audioBlob: Blob,
  language?: string
): Promise<string> {
  const { proxyUrl } = getRunPodProxyConfig('whisper')

  // Check audio blob size (limit to ~10MB to prevent issues)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (audioBlob.size > maxSize) {
    throw new Error(`Audio file too large: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${(maxSize / 1024 / 1024).toFixed(2)}MB`)
  }

  // Convert audio blob to base64
  const audioBase64 = await blobToBase64(audioBlob)

  // Detect audio format from blob type
  const audioFormat = audioBlob.type || 'audio/wav'

  // Use proxy endpoint - API key and endpoint ID are handled server-side
  const url = `${proxyUrl}/run`

  // Prepare the request payload
  // WhisperX typically expects audio as base64 or file URL
  // The exact format may vary based on your WhisperX endpoint implementation
  const requestBody = {
    input: {
      audio: audioBase64,
      audio_format: audioFormat,
      language: language || 'en',
      task: 'transcribe'
      // Note: Some WhisperX endpoints may expect different field names
      // Adjust the requestBody structure in this function if needed
    }
  }

  try {
    // Add timeout to prevent hanging requests (30 seconds for initial request)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Authorization is handled by the proxy server-side
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string; details?: string }
      console.error('RunPod API error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      throw new Error(`RunPod API error: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`)
    }

    const data: RunPodTranscriptionResponse = await response.json()


    // Handle async job pattern (RunPod often returns job IDs)
    if (data.id && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS')) {
      return await pollRunPodJob(data.id, proxyUrl)
    }

    // Handle direct response
    if (data.output?.text) {
      return data.output.text.trim()
    }

    // Handle error response
    if (data.error) {
      throw new Error(`RunPod transcription error: ${data.error}`)
    }

    // Fallback: try to extract text from segments
    if (data.output?.segments && data.output.segments.length > 0) {
      return data.output.segments.map(seg => seg.text).join(' ').trim()
    }

    // Check if response has unexpected structure
    console.warn('Unexpected RunPod response structure:', data)
    throw new Error('No transcription text found in RunPod response. Check endpoint response format.')
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('RunPod request timed out after 30 seconds')
    }
    console.error('RunPod transcription error:', error)
    throw error
  }
}

/**
 * Poll RunPod job status until completion via proxy
 */
async function pollRunPodJob(
  jobId: string,
  proxyUrl: string,
  maxAttempts: number = 120, // Increased to 120 attempts (2 minutes at 1s intervals)
  pollInterval: number = 1000
): Promise<string> {
  // Use proxy endpoint for status checks
  const statusUrl = `${proxyUrl}/status/${jobId}`


  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Add timeout for each status check (5 seconds)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(statusUrl, {
        method: 'GET',
        // Authorization is handled by the proxy server-side
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string; details?: string }
        console.error(`Job status check failed (attempt ${attempt + 1}/${maxAttempts}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })

        // Don't fail immediately on 404 - job might still be processing
        if (response.status === 404 && attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          continue
        }

        throw new Error(`Failed to check job status: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`)
      }

      const data: RunPodTranscriptionResponse = await response.json()


      if (data.status === 'COMPLETED') {

        if (data.output?.text) {
          return data.output.text.trim()
        }
        if (data.output?.segments && data.output.segments.length > 0) {
          return data.output.segments.map(seg => seg.text).join(' ').trim()
        }

        // Log the full response for debugging
        console.error('Job completed but no transcription found. Full response:', JSON.stringify(data, null, 2))
        throw new Error('Job completed but no transcription text found in response')
      }

      if (data.status === 'FAILED') {
        const errorMsg = data.error || 'Unknown error'
        console.error('Job failed:', errorMsg)
        throw new Error(`Job failed: ${errorMsg}`)
      }

      // Job still in progress, wait and retry
      if (attempt % 10 === 0) {
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`Status check timed out (attempt ${attempt + 1}/${maxAttempts})`)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          continue
        }
        throw new Error('Status check timed out multiple times')
      }

      if (attempt === maxAttempts - 1) {
        throw error
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error(`Job polling timeout after ${maxAttempts} attempts (${(maxAttempts * pollInterval / 1000).toFixed(0)} seconds)`)
}
