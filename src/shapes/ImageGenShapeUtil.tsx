import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState } from "react"
import { getRunPodProxyConfig } from "@/lib/clientConfig"
import { aiOrchestrator, isAIOrchestratorAvailable } from "@/lib/aiOrchestrator"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"

// Feature flag: Set to false when AI Orchestrator or RunPod API is ready for production
const USE_MOCK_API = false

// Type definition for RunPod API responses
interface RunPodJobResponse {
  id?: string
  status?: 'IN_QUEUE' | 'IN_PROGRESS' | 'STARTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  output?: string | {
    image?: string
    url?: string
    images?: Array<{ data?: string; url?: string; filename?: string; type?: string }>
    result?: string
    [key: string]: any
  }
  error?: string
  image?: string
  url?: string
  result?: string | {
    image?: string
    url?: string
    [key: string]: any
  }
  [key: string]: any
}

// Individual image entry in the history
interface GeneratedImage {
  id: string
  prompt: string
  imageUrl: string
  timestamp: number
}

type IImageGen = TLBaseShape<
  "ImageGen",
  {
    w: number
    h: number
    prompt: string
    imageHistory: GeneratedImage[] // Thread of all generated images (newest first)
    isLoading: boolean
    loadingPrompt: string | null // The prompt currently being generated
    error: string | null
    endpointId?: string // Optional custom endpoint ID
    tags: string[]
    pinnedToView: boolean
  }
>

// Helper function to poll RunPod job status until completion
async function pollRunPodJob(
  jobId: string,
  apiKey: string,
  endpointId: string,
  maxAttempts: number = 60,
  pollInterval: number = 2000
): Promise<string> {
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ ImageGen: Poll error (attempt ${attempt + 1}/${maxAttempts}):`, response.status, errorText)
        throw new Error(`Failed to check job status: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as RunPodJobResponse
      
      if (data.status === 'COMPLETED') {
        
        // Extract image URL from various possible response formats
        let imageUrl = ''
        
        // Check if output exists at all
        if (!data.output) {
          // Only retry 2-3 times, then proceed to check alternatives
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          }
          
          // Try alternative ways to get the output - maybe it's at the top level
          
          // Check if image data is at top level
          if (data.image) {
            imageUrl = data.image
          } else if (data.url) {
            imageUrl = data.url
          } else if (data.result) {
            // Some endpoints return result instead of output
            if (typeof data.result === 'string') {
              imageUrl = data.result
            } else if (data.result.image) {
              imageUrl = data.result.image
            } else if (data.result.url) {
              imageUrl = data.result.url
            }
          } else {
            // Last resort: try to fetch output via stream endpoint (some RunPod endpoints use this)
            try {
              const streamUrl = `https://api.runpod.ai/v2/${endpointId}/stream/${jobId}`
              const streamResponse = await fetch(streamUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiKey}`
                }
              })
              
              if (streamResponse.ok) {
                const streamData = await streamResponse.json() as RunPodJobResponse
                
                if (streamData.output) {
                  if (typeof streamData.output === 'string') {
                    imageUrl = streamData.output
                  } else if (streamData.output.image) {
                    imageUrl = streamData.output.image
                  } else if (streamData.output.url) {
                    imageUrl = streamData.output.url
                  } else if (Array.isArray(streamData.output.images) && streamData.output.images.length > 0) {
                    const firstImage = streamData.output.images[0]
                    if (firstImage.data) {
                      imageUrl = firstImage.data.startsWith('data:') ? firstImage.data : `data:image/${firstImage.type || 'png'};base64,${firstImage.data}`
                    } else if (firstImage.url) {
                      imageUrl = firstImage.url
                    }
                  }
                  
                  if (imageUrl) {
                    return imageUrl
                  }
                }
              }
            } catch (streamError) {
            }
            
            console.error('❌ ImageGen: Job completed but no output field in response after retries:', JSON.stringify(data, null, 2))
            throw new Error(
              'Job completed but no output data found.\n\n' +
              'Possible issues:\n' +
              '1. The RunPod endpoint handler may not be returning output correctly\n' +
              '2. Check the endpoint handler logs in RunPod console\n' +
              '3. Verify the handler returns: { output: { image: "url" } } or { output: "url" }\n' +
              '4. For ComfyUI workers, ensure output.images array is returned\n' +
              '5. The endpoint may need to be reconfigured\n\n' +
              'Response received: ' + JSON.stringify(data, null, 2)
            )
          }
        } else {
          // Extract image URL from various possible response formats
          if (typeof data.output === 'string') {
            imageUrl = data.output
          } else if (data.output?.image) {
            imageUrl = data.output.image
          } else if (data.output?.url) {
            imageUrl = data.output.url
          } else if (data.output?.output) {
            // Handle nested output structure
            if (typeof data.output.output === 'string') {
              imageUrl = data.output.output
            } else if (data.output.output?.image) {
              imageUrl = data.output.output.image
            } else if (data.output.output?.url) {
              imageUrl = data.output.output.url
            }
          } else if (Array.isArray(data.output) && data.output.length > 0) {
            // Handle array responses
            const firstItem = data.output[0]
            if (typeof firstItem === 'string') {
              imageUrl = firstItem
            } else if (firstItem.image) {
              imageUrl = firstItem.image
            } else if (firstItem.url) {
              imageUrl = firstItem.url
            }
          } else if (!Array.isArray(data.output) && data.output?.result) {
            // Some formats nest result inside output
            const outputObj = data.output as { result?: string | { image?: string; url?: string } }
            if (typeof outputObj.result === 'string') {
              imageUrl = outputObj.result
            } else if (outputObj.result?.image) {
              imageUrl = outputObj.result.image
            } else if (outputObj.result?.url) {
              imageUrl = outputObj.result.url
            }
          } else if (!Array.isArray(data.output) && data.output?.images && Array.isArray(data.output.images) && data.output.images.length > 0) {
            // ComfyUI worker format: { output: { images: [{ filename, type, data }] } }
            const outputObj = data.output as { images: Array<{ data?: string; url?: string; type?: string; filename?: string }> }
            const firstImage = outputObj.images[0]
            if (firstImage.data) {
              // Base64 encoded image
              if (firstImage.data.startsWith('data:image')) {
                imageUrl = firstImage.data
              } else if (firstImage.data.startsWith('http')) {
                imageUrl = firstImage.data
              } else {
                // Assume base64 without prefix
                imageUrl = `data:image/${firstImage.type || 'png'};base64,${firstImage.data}`
              }
            } else if (firstImage.url) {
              imageUrl = firstImage.url
            } else if (firstImage.filename) {
              // Try to construct URL from filename (may need endpoint-specific handling)
            }
          }
        }
        
        if (!imageUrl || imageUrl.trim() === '') {
          console.error('❌ ImageGen: No image URL found in response:', JSON.stringify(data, null, 2))
          throw new Error(
            'Job completed but no image URL found in output.\n\n' +
            'Expected formats:\n' +
            '- { output: "https://..." }\n' +
            '- { output: { image: "https://..." } }\n' +
            '- { output: { url: "https://..." } }\n' +
            '- { output: ["https://..."] }\n\n' +
            'Received: ' + JSON.stringify(data, null, 2)
          )
        }
        
        return imageUrl
      }
      
      if (data.status === 'FAILED') {
        console.error('❌ ImageGen: Job failed:', data.error || 'Unknown error')
        throw new Error(`Job failed: ${data.error || 'Unknown error'}`)
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      // If we get COMPLETED status without output, don't retry - fail immediately
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('no output') || errorMessage.includes('no image URL')) {
        console.error('❌ ImageGen: Stopping polling due to missing output data')
        throw error
      }
      
      // For other errors, retry up to maxAttempts
      if (attempt === maxAttempts - 1) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
  
  throw new Error('Job polling timed out')
}

export class ImageGenShape extends BaseBoxShapeUtil<IImageGen> {
  static override type = "ImageGen" as const

  // Image generation theme color: Blue
  static readonly PRIMARY_COLOR = "#007AFF"

  MIN_WIDTH = 300 as const
  MIN_HEIGHT = 300 as const
  DEFAULT_WIDTH = 400 as const
  DEFAULT_HEIGHT = 400 as const

  getDefaultProps(): IImageGen["props"] {
    return {
      w: this.DEFAULT_WIDTH,
      h: this.DEFAULT_HEIGHT,
      prompt: "",
      imageHistory: [],
      isLoading: false,
      loadingPrompt: null,
      error: null,
      tags: ['image', 'ai-generated'],
      pinnedToView: false,
    }
  }

  getGeometry(shape: IImageGen): Geometry2d {
    // Ensure minimum dimensions for proper hit testing
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    })
  }

  component(shape: IImageGen) {
    // Capture editor reference to avoid stale 'this' during drag operations
    const editor = this.editor
    const isSelected = editor.getSelectedShapeIds().includes(shape.id)

    // Pin to view functionality
    usePinnedToView(editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'ImageGen',
    })

    const handlePinToggle = () => {
      editor.updateShape<IImageGen>({
        id: shape.id,
        type: "ImageGen",
        props: { pinnedToView: !shape.props.pinnedToView },
      })
    }

    const generateImage = async (prompt: string) => {

      // Store the prompt being used and clear any previous errors
      editor.updateShape<IImageGen>({
        id: shape.id,
        type: "ImageGen",
        props: {
          error: null,
          isLoading: true,
          loadingPrompt: prompt
        },
      })

      try {
        // Get RunPod proxy configuration - API keys are now server-side
        const { proxyUrl } = getRunPodProxyConfig('image')

        // Mock API mode: Return placeholder image without calling RunPod
        if (USE_MOCK_API) {

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Use a placeholder image service
          const mockImageUrl = `https://via.placeholder.com/512x512/4F46E5/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 30))}`


          // Get current shape to access existing history
          const currentShape = editor.getShape<IImageGen>(shape.id)
          const currentHistory = currentShape?.props.imageHistory || []

          // Create new image entry
          const newImage: GeneratedImage = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            prompt: prompt,
            imageUrl: mockImageUrl,
            timestamp: Date.now()
          }

          editor.updateShape<IImageGen>({
            id: shape.id,
            type: "ImageGen",
            props: {
              imageHistory: [newImage, ...currentHistory], // Prepend new image
              isLoading: false,
              loadingPrompt: null,
              error: null
            },
          })

          return
        }

        // Real API mode: Use RunPod via proxy
        // API key and endpoint ID are handled server-side

        // Use runsync for synchronous execution - returns output directly without polling
        const url = `${proxyUrl}/runsync`


        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
            // Authorization is handled by the proxy server-side
          },
          body: JSON.stringify({
            input: {
              prompt: prompt
            }
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("❌ ImageGen: Error response:", errorText)
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
        }

        const data = await response.json() as RunPodJobResponse

        // With runsync, we get the output directly (no polling needed)
        if (data.output) {
          let imageUrl = ''

          // Handle output.images array format (Automatic1111 endpoint format)
          if (typeof data.output === 'object' && !Array.isArray(data.output) && data.output.images && Array.isArray(data.output.images) && data.output.images.length > 0) {
            const outputObj = data.output as { images: Array<{ data?: string; url?: string } | string> }
            const firstImage = outputObj.images[0]
            // Base64 encoded image string
            if (typeof firstImage === 'string') {
              imageUrl = firstImage.startsWith('data:') ? firstImage : `data:image/png;base64,${firstImage}`
            } else if (firstImage.data) {
              imageUrl = firstImage.data.startsWith('data:') ? firstImage.data : `data:image/png;base64,${firstImage.data}`
            } else if (firstImage.url) {
              imageUrl = firstImage.url
            }
          } else if (typeof data.output === 'string') {
            imageUrl = data.output
          } else if (!Array.isArray(data.output) && data.output.image) {
            imageUrl = data.output.image
          } else if (!Array.isArray(data.output) && data.output.url) {
            imageUrl = data.output.url
          } else if (Array.isArray(data.output) && data.output.length > 0) {
            const firstItem = data.output[0]
            if (typeof firstItem === 'string') {
              imageUrl = firstItem.startsWith('data:') ? firstItem : `data:image/png;base64,${firstItem}`
            } else if (firstItem.image) {
              imageUrl = firstItem.image
            } else if (firstItem.url) {
              imageUrl = firstItem.url
            }
          }

          if (imageUrl) {

            // Get current shape to access existing history
            const currentShape = editor.getShape<IImageGen>(shape.id)
            const currentHistory = currentShape?.props.imageHistory || []

            // Create new image entry
            const newImage: GeneratedImage = {
              id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              prompt: prompt,
              imageUrl: imageUrl,
              timestamp: Date.now()
            }

            editor.updateShape<IImageGen>({
              id: shape.id,
              type: "ImageGen",
              props: {
                imageHistory: [newImage, ...currentHistory], // Prepend new image
                isLoading: false,
                loadingPrompt: null,
                error: null
              },
            })
          } else {
            throw new Error("No image URL found in response output")
          }
        } else if (data.error) {
          throw new Error(`RunPod API error: ${data.error}`)
        } else if (data.status) {
          // Handle RunPod status responses (no output yet)
          const status = data.status.toUpperCase()
          if (status === 'IN_PROGRESS' || status === 'IN_QUEUE') {
            throw new Error(`Image generation timed out (status: ${data.status}). The GPU may be experiencing a cold start. Please try again in a moment.`)
          } else if (status === 'FAILED') {
            throw new Error(`RunPod job failed: ${data.error || 'Unknown error'}`)
          } else if (status === 'CANCELLED') {
            throw new Error('Image generation was cancelled')
          } else {
            throw new Error(`Unexpected RunPod status: ${data.status}`)
          }
        } else {
          // Log full response for debugging
          console.error("❌ ImageGen: Unexpected response structure:", JSON.stringify(data, null, 2))
          throw new Error("No valid response from RunPod API - missing output field. Check console for details.")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error("❌ ImageGen: Error:", errorMessage)
        
        let userFriendlyError = ''
        
        if (errorMessage.includes('API key not configured')) {
          userFriendlyError = '❌ RunPod API key not configured. Please set VITE_RUNPOD_API_KEY environment variable.'
        } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
          userFriendlyError = '❌ API key authentication failed. Please check your RunPod API key.'
        } else if (errorMessage.includes('404')) {
          userFriendlyError = '❌ Endpoint not found. Please check your endpoint ID.'
        } else if (errorMessage.includes('no output data found') || errorMessage.includes('no image URL found')) {
          // For multi-line error messages, show a concise version in the UI
          // The full details are already in the console
          userFriendlyError = '❌ Image generation completed but no image data was returned.\n\n' +
            'This usually means the RunPod endpoint handler is not configured correctly.\n\n' +
            'Please check:\n' +
            '1. RunPod endpoint handler logs\n' +
            '2. Handler returns: { output: { image: "url" } }\n' +
            '3. See browser console for full details'
        } else {
          // Truncate very long error messages for UI display
          const maxLength = 500
          if (errorMessage.length > maxLength) {
            userFriendlyError = `❌ Error: ${errorMessage.substring(0, maxLength)}...\n\n(Full error in console)`
          } else {
            userFriendlyError = `❌ Error: ${errorMessage}`
          }
        }
        
        editor.updateShape<IImageGen>({
          id: shape.id,
          type: "ImageGen",
          props: {
            isLoading: false,
            loadingPrompt: null,
            error: userFriendlyError
          },
        })
      }
    }

    const handleGenerate = () => {
      if (shape.props.prompt.trim() && !shape.props.isLoading) {
        generateImage(shape.props.prompt)
        editor.updateShape<IImageGen>({
          id: shape.id,
          type: "ImageGen",
          props: { prompt: "" },
        })
      }
    }

    const [isMinimized, setIsMinimized] = useState(false)

    const handleClose = () => {
      editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleTagsChange = (newTags: string[]) => {
      editor.updateShape<IImageGen>({
        id: shape.id,
        type: "ImageGen",
        props: { tags: newTags },
      })
    }

    return (
      <HTMLContainer id={shape.id}>
        <StandardizedToolWrapper
          title="🎨 Image Generator"
          primaryColor={ImageGenShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={editor}
          shapeId={shape.id}
          tags={shape.props.tags || []}
          onTagsChange={handleTagsChange}
          tagsEditable={true}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          headerContent={
            shape.props.isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎨 Image Generator
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  color: ImageGenShape.PRIMARY_COLOR,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}>
                  Generating...
                </span>
              </span>
            ) : undefined
          }
        >
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            gap: '12px',
            overflow: 'auto',
            backgroundColor: '#fafafa'
          }}>
            {/* Image Thread - scrollable history of generated images */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflow: 'auto',
                minHeight: 0,
              }}
            >
              {/* Loading State - shown at top when generating */}
              {shape.props.isLoading && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#fff",
                    borderRadius: "6px",
                    border: '1px solid #e0e0e0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '24px',
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        border: "4px solid #f3f3f3",
                        borderTop: `4px solid ${ImageGenShape.PRIMARY_COLOR}`,
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span style={{ color: "#666", fontSize: "14px" }}>
                      Generating image...
                    </span>
                  </div>
                  {shape.props.loadingPrompt && (
                    <div
                      style={{
                        borderTop: '1px solid #e0e0e0',
                        padding: '8px 10px',
                        backgroundColor: '#f8f8f8',
                        fontSize: '11px',
                        color: '#666',
                        lineHeight: '1.3',
                      }}
                    >
                      <span style={{ fontWeight: 500, color: '#888' }}>Prompt: </span>
                      {shape.props.loadingPrompt}
                    </div>
                  )}
                </div>
              )}

              {/* Image History - each image as a card */}
              {shape.props.imageHistory.map((image, index) => (
                <div
                  key={image.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#fff",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: index === 0 && !shape.props.isLoading ? `2px solid ${ImageGenShape.PRIMARY_COLOR}` : '1px solid #e0e0e0',
                  }}
                >
                  {/* Image */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      maxHeight: index === 0 ? '300px' : '150px',
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                      onError={(_e) => {
                        console.error("❌ ImageGen: Failed to load image:", image.imageUrl)
                        // Remove this image from history
                        const newHistory = shape.props.imageHistory.filter(img => img.id !== image.id)
                        editor.updateShape<IImageGen>({
                          id: shape.id,
                          type: "ImageGen",
                          props: { imageHistory: newHistory },
                        })
                      }}
                    />
                  </div>
                  {/* Prompt and action buttons */}
                  <div
                    style={{
                      borderTop: '1px solid #e0e0e0',
                      padding: '8px 10px',
                      backgroundColor: '#f8f8f8',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#666',
                        lineHeight: '1.3',
                        maxHeight: index === 0 ? '40px' : '24px',
                        overflow: 'auto',
                        wordBreak: 'break-word',
                      }}
                      title={image.prompt}
                    >
                      <span style={{ fontWeight: 500, color: '#888' }}>Prompt: </span>
                      {image.prompt}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                      }}
                    >
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            const imageUrl = image.imageUrl
                            if (!imageUrl) return

                            // For base64 images, convert directly
                            if (imageUrl.startsWith('data:')) {
                              const response = await fetch(imageUrl)
                              const blob = await response.blob()
                              await navigator.clipboard.write([
                                new ClipboardItem({ [blob.type]: blob })
                              ])
                            } else {
                              // For URLs, fetch the image first
                              const response = await fetch(imageUrl)
                              const blob = await response.blob()
                              await navigator.clipboard.write([
                                new ClipboardItem({ [blob.type]: blob })
                              ])
                            }
                          } catch (err) {
                            console.error('❌ ImageGen: Failed to copy image:', err)
                            // Fallback: copy the URL
                            await navigator.clipboard.writeText(image.imageUrl)
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#555',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'background-color 0.15s',
                          touchAction: 'manipulation',
                          minHeight: '44px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                      >
                        <span>📋</span> Copy
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const imageUrl = image.imageUrl
                          if (!imageUrl) return

                          // Create download link
                          const link = document.createElement('a')
                          link.href = imageUrl

                          // Generate filename from prompt
                          const promptSlug = (image.prompt || 'image')
                            .slice(0, 30)
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                          const timestamp = new Date(image.timestamp).toISOString().slice(0, 10)
                          link.download = `${promptSlug}-${timestamp}.png`

                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: ImageGenShape.PRIMARY_COLOR,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'opacity 0.15s',
                          touchAction: 'manipulation',
                          minHeight: '44px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                      >
                        <span>⬇️</span> Download
                      </button>
                      {/* Delete button for history items */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newHistory = shape.props.imageHistory.filter(img => img.id !== image.id)
                          editor.updateShape<IImageGen>({
                            id: shape.id,
                            type: "ImageGen",
                            props: { imageHistory: newHistory },
                          })
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#999',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.15s, color 0.15s',
                          touchAction: 'manipulation',
                          minWidth: '44px',
                          minHeight: '44px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fee'
                          e.currentTarget.style.color = '#c33'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fff'
                          e.currentTarget.style.color = '#999'
                        }}
                        title="Remove from history"
                      >
                        <span>🗑️</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {shape.props.imageHistory.length === 0 && !shape.props.isLoading && !shape.props.error && (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    borderRadius: "6px",
                    color: "#999",
                    fontSize: "14px",
                    border: '1px solid #e0e0e0',
                    minHeight: '150px',
                  }}
                >
                  Generated images will appear here
                </div>
              )}
            </div>

            {/* Input Section - Mobile Optimized */}
            <div
              style={{
                display: "flex",
                flexDirection: shape.props.w < 350 ? "column" : "row",
                gap: 8,
                flexShrink: 0,
                padding: "4px 0",
              }}
            >
              <textarea
                style={{
                  flex: 1,
                  minHeight: "48px",
                  height: shape.props.w < 350 ? "60px" : "48px",
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: 14,
                  padding: "12px",
                  touchAction: "manipulation",
                  resize: "none",
                  fontFamily: "inherit",
                  lineHeight: "1.4",
                  WebkitAppearance: "none",
                }}
                placeholder="Describe the image you want to generate..."
                value={shape.props.prompt}
                onChange={(e) => {
                  editor.updateShape<IImageGen>({
                    id: shape.id,
                    type: "ImageGen",
                    props: { prompt: e.target.value },
                  })
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (shape.props.prompt.trim() && !shape.props.isLoading) {
                      handleGenerate()
                    }
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                }}
                disabled={shape.props.isLoading}
              />
              <button
                style={{
                  height: shape.props.w < 350 ? "48px" : "48px",
                  padding: "0 20px",
                  pointerEvents: "all",
                  cursor: shape.props.prompt.trim() && !shape.props.isLoading ? "pointer" : "not-allowed",
                  backgroundColor: shape.props.prompt.trim() && !shape.props.isLoading ? ImageGenShape.PRIMARY_COLOR : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  opacity: shape.props.prompt.trim() && !shape.props.isLoading ? 1 : 0.6,
                  touchAction: "manipulation",
                  minWidth: shape.props.w < 350 ? "100%" : "100px",
                  minHeight: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "background-color 0.15s, transform 0.1s",
                  WebkitTapHighlightColor: "transparent",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (shape.props.prompt.trim() && !shape.props.isLoading) {
                    handleGenerate()
                  }
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  // Visual feedback on touch
                  e.currentTarget.style.transform = "scale(0.98)"
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  e.currentTarget.style.transform = "scale(1)"
                  if (shape.props.prompt.trim() && !shape.props.isLoading) {
                    handleGenerate()
                  }
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (shape.props.prompt.trim() && !shape.props.isLoading) {
                    handleGenerate()
                  }
                }}
                disabled={shape.props.isLoading || !shape.props.prompt.trim()}
              >
                <span style={{ fontSize: "16px" }}>✨</span>
                Generate
              </button>
            </div>

            {/* Error Display - at bottom */}
            {shape.props.error && (
              <div
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#fee",
                  border: "1px solid #fcc",
                  borderRadius: "6px",
                  color: "#c33",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "80px",
                  overflowY: "auto",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
                <span style={{ flex: 1, lineHeight: "1.4" }}>{shape.props.error}</span>
                <button
                  onClick={() => {
                    editor.updateShape<IImageGen>({
                      id: shape.id,
                      type: "ImageGen",
                      props: { error: null },
                    })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  style={{
                    padding: "2px 6px",
                    backgroundColor: "#fcc",
                    border: "1px solid #c99",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "10px",
                    flexShrink: 0,
                    touchAction: "manipulation",
                    minWidth: "32px",
                    minHeight: "32px",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Add CSS for spinner animation */}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  override indicator(shape: IImageGen) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={6}
      />
    )
  }
}

