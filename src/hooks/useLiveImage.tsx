/**
 * useLiveImage Hook
 * Captures drawings within a frame shape and sends them to Fal.ai for AI enhancement
 * Based on draw-fast implementation, adapted for canvas-website with Automerge sync
 *
 * SECURITY: All fal.ai API calls go through the Cloudflare Worker proxy
 * API keys are stored server-side, never exposed to the browser
 */

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { Editor, TLShapeId, Box, exportToBlob } from 'tldraw'
import { getFalProxyConfig } from '@/lib/clientConfig'

// Fal.ai model endpoints
const FAL_MODEL_LCM = 'fal-ai/lcm-sd15-i2i' // Fast, real-time (~150ms)
const FAL_MODEL_FLUX_CANNY = 'fal-ai/flux-control-lora-canny/image-to-image' // Higher quality

interface LiveImageContextValue {
  isConnected: boolean
  // Note: apiKey is no longer exposed to the browser
  setApiKey: (key: string) => void
}

const LiveImageContext = createContext<LiveImageContextValue | null>(null)

interface LiveImageProviderProps {
  children: React.ReactNode
  apiKey?: string  // Deprecated - API keys are now server-side
}

/**
 * Provider component that manages Fal.ai connection
 * API keys are now stored server-side and proxied through Cloudflare Worker
 */
export function LiveImageProvider({ children }: LiveImageProviderProps) {
  // Fal.ai is always "connected" via the proxy - actual auth happens server-side
  const [isConnected, setIsConnected] = useState(true)

  // Log that we're using the proxy
  useEffect(() => {
    const { proxyUrl } = getFalProxyConfig()
    console.log('LiveImage: Using fal.ai proxy at', proxyUrl || '(same origin)')
  }, [])

  // setApiKey is now a no-op since keys are server-side
  // Kept for backward compatibility with any code that tries to set a key
  const setApiKey = useCallback((_key: string) => {
    console.warn('LiveImage: setApiKey is deprecated. API keys are now stored server-side.')
  }, [])

  return (
    <LiveImageContext.Provider value={{ isConnected, setApiKey }}>
      {children}
    </LiveImageContext.Provider>
  )
}

export function useLiveImageContext() {
  const context = useContext(LiveImageContext)
  if (!context) {
    throw new Error('useLiveImageContext must be used within a LiveImageProvider')
  }
  return context
}

interface UseLiveImageOptions {
  editor: Editor
  shapeId: TLShapeId
  prompt: string
  enabled?: boolean
  throttleMs?: number
  model?: 'lcm' | 'flux-canny'
  strength?: number
  onResult?: (imageUrl: string) => void
  onError?: (error: Error) => void
}

interface LiveImageState {
  isGenerating: boolean
  lastGeneratedUrl: string | null
  error: string | null
}

/**
 * Hook that watches for drawing changes within a frame and generates AI images
 */
export function useLiveImage({
  editor,
  shapeId,
  prompt,
  enabled = true,
  throttleMs = 500,
  model = 'lcm',
  strength = 0.65,
  onResult,
  onError,
}: UseLiveImageOptions): LiveImageState {
  const [state, setState] = useState<LiveImageState>({
    isGenerating: false,
    lastGeneratedUrl: null,
    error: null,
  })

  const requestVersionRef = useRef(0)
  const lastRequestTimeRef = useRef(0)
  const pendingRequestRef = useRef<NodeJS.Timeout | null>(null)
  const context = useContext(LiveImageContext)

  // Get shapes that intersect with this frame
  const getChildShapes = useCallback(() => {
    const shape = editor.getShape(shapeId)
    if (!shape) return []

    const bounds = editor.getShapePageBounds(shapeId)
    if (!bounds) return []

    // Find all shapes that intersect with this frame
    const allShapes = editor.getCurrentPageShapes()
    return allShapes.filter(s => {
      if (s.id === shapeId) return false // Exclude the frame itself
      const shapeBounds = editor.getShapePageBounds(s.id)
      if (!shapeBounds) return false
      return bounds.contains(shapeBounds) || bounds.collides(shapeBounds)
    })
  }, [editor, shapeId])

  // Capture the drawing as a base64 image
  const captureDrawing = useCallback(async (): Promise<string | null> => {
    try {
      const childShapes = getChildShapes()
      if (childShapes.length === 0) return null

      const shapeIds = childShapes.map(s => s.id)

      // Export shapes to blob
      const blob = await exportToBlob({
        editor,
        ids: shapeIds,
        format: 'jpeg',
        opts: {
          background: true,
          padding: 0,
          scale: 1,
        },
      })

      // Convert blob to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('LiveImage: Failed to capture drawing:', error)
      return null
    }
  }, [editor, getChildShapes])

  // Generate AI image from the sketch via proxy
  const generateImage = useCallback(async () => {
    if (!context?.isConnected || !enabled) {
      return
    }

    const currentVersion = ++requestVersionRef.current

    setState(prev => ({ ...prev, isGenerating: true, error: null }))

    try {
      const imageDataUrl = await captureDrawing()
      if (!imageDataUrl) {
        setState(prev => ({ ...prev, isGenerating: false }))
        return
      }

      // Check if this request is still valid (not superseded by newer request)
      if (currentVersion !== requestVersionRef.current) {
        return
      }

      const modelEndpoint = model === 'flux-canny' ? FAL_MODEL_FLUX_CANNY : FAL_MODEL_LCM

      // Build the full prompt
      const fullPrompt = prompt
        ? `${prompt}, hd, award-winning, impressive, detailed`
        : 'hd, award-winning, impressive, detailed illustration'

      // Use the proxy endpoint instead of calling fal.ai directly
      const { proxyUrl } = getFalProxyConfig()

      const response = await fetch(`${proxyUrl}/subscribe/${modelEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          image_url: imageDataUrl,
          strength: strength,
          sync_mode: true,
          seed: 42,
          num_inference_steps: model === 'lcm' ? 4 : 20,
          guidance_scale: model === 'lcm' ? 1 : 7.5,
          enable_safety_checks: false,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
        throw new Error(errorData.error || `Proxy error: ${response.status}`)
      }

      const data = await response.json() as {
        images?: Array<{ url?: string } | string>
        image?: { url?: string } | string
        output?: { url?: string } | string
      }

      // Check if this result is still relevant
      if (currentVersion !== requestVersionRef.current) {
        return
      }

      // Extract image URL from result
      let imageUrl: string | null = null

      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        const firstImage = data.images[0]
        imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url || null
      } else if (data.image) {
        imageUrl = typeof data.image === 'string' ? data.image : data.image?.url || null
      } else if (data.output) {
        imageUrl = typeof data.output === 'string' ? data.output : data.output?.url || null
      }

      if (imageUrl) {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          lastGeneratedUrl: imageUrl,
          error: null,
        }))
        onResult?.(imageUrl)
      } else {
        throw new Error('No image URL in response')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('LiveImage: Generation failed:', errorMessage)

      if (currentVersion === requestVersionRef.current) {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          error: errorMessage,
        }))
        onError?.(error instanceof Error ? error : new Error(errorMessage))
      }
    }
  }, [context?.isConnected, enabled, captureDrawing, model, prompt, strength, onResult, onError])

  // Throttled generation trigger
  const triggerGeneration = useCallback(() => {
    if (!enabled) return

    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTimeRef.current

    // Clear any pending request
    if (pendingRequestRef.current) {
      clearTimeout(pendingRequestRef.current)
    }

    if (timeSinceLastRequest >= throttleMs) {
      // Enough time has passed, generate immediately
      lastRequestTimeRef.current = now
      generateImage()
    } else {
      // Schedule generation after throttle period
      const delay = throttleMs - timeSinceLastRequest
      pendingRequestRef.current = setTimeout(() => {
        lastRequestTimeRef.current = Date.now()
        generateImage()
      }, delay)
    }
  }, [enabled, throttleMs, generateImage])

  // Watch for changes to shapes within the frame
  useEffect(() => {
    if (!enabled) return

    const handleChange = () => {
      triggerGeneration()
    }

    // Subscribe to store changes
    const unsubscribe = editor.store.listen(handleChange, {
      source: 'user',
      scope: 'document',
    })

    return () => {
      unsubscribe()
      if (pendingRequestRef.current) {
        clearTimeout(pendingRequestRef.current)
      }
    }
  }, [editor, enabled, triggerGeneration])

  return state
}

/**
 * Convert SVG string to JPEG data URL (fast method)
 */
async function svgToJpegDataUrl(
  svgString: string,
  width: number,
  height: number,
  quality: number = 0.3
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Fill with white background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, width, height)

      // Draw the SVG
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      URL.revokeObjectURL(url)
      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG'))
    }

    img.src = url
  })
}
