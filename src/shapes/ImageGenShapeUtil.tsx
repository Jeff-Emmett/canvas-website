import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState } from "react"
import { getRunPodConfig } from "@/lib/clientConfig"
import { aiOrchestrator, isAIOrchestratorAvailable } from "@/lib/aiOrchestrator"

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

type IImageGen = TLBaseShape<
  "ImageGen",
  {
    w: number
    h: number
    prompt: string
    imageUrl: string | null
    isLoading: boolean
    error: string | null
    endpointId?: string // Optional custom endpoint ID
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
  console.log('🔄 ImageGen: Polling job:', jobId)
  
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
      console.log(`🔄 ImageGen: Poll attempt ${attempt + 1}/${maxAttempts}, status:`, data.status)
      console.log(`📋 ImageGen: Full response data:`, JSON.stringify(data, null, 2))
      
      if (data.status === 'COMPLETED') {
        console.log('✅ ImageGen: Job completed, processing output...')
        
        // Extract image URL from various possible response formats
        let imageUrl = ''
        
        // Check if output exists at all
        if (!data.output) {
          // Only retry 2-3 times, then proceed to check alternatives
          if (attempt < 3) {
            console.log(`⏳ ImageGen: COMPLETED but no output yet, waiting briefly (attempt ${attempt + 1}/3)...`)
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          }
          
          // Try alternative ways to get the output - maybe it's at the top level
          console.log('⚠️ ImageGen: No output field found, checking for alternative response formats...')
          console.log('📋 ImageGen: All available fields:', Object.keys(data))
          
          // Check if image data is at top level
          if (data.image) {
            imageUrl = data.image
            console.log('✅ ImageGen: Found image at top level')
          } else if (data.url) {
            imageUrl = data.url
            console.log('✅ ImageGen: Found url at top level')
          } else if (data.result) {
            // Some endpoints return result instead of output
            if (typeof data.result === 'string') {
              imageUrl = data.result
            } else if (data.result.image) {
              imageUrl = data.result.image
            } else if (data.result.url) {
              imageUrl = data.result.url
            }
            console.log('✅ ImageGen: Found result field')
          } else {
            // Last resort: try to fetch output via stream endpoint (some RunPod endpoints use this)
            console.log('⚠️ ImageGen: Trying alternative endpoint to retrieve output...')
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
                console.log('📥 ImageGen: Stream endpoint response:', JSON.stringify(streamData, null, 2))
                
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
                    console.log('✅ ImageGen: Found image URL via stream endpoint')
                    return imageUrl
                  }
                }
              }
            } catch (streamError) {
              console.log('⚠️ ImageGen: Stream endpoint not available or failed:', streamError)
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
          } else if (data.output?.result) {
            // Some formats nest result inside output
            if (typeof data.output.result === 'string') {
              imageUrl = data.output.result
            } else if (data.output.result?.image) {
              imageUrl = data.output.result.image
            } else if (data.output.result?.url) {
              imageUrl = data.output.result.url
            }
          } else if (Array.isArray(data.output?.images) && data.output.images.length > 0) {
            // ComfyUI worker format: { output: { images: [{ filename, type, data }] } }
            const firstImage = data.output.images[0]
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
              console.log('✅ ImageGen: Found image in ComfyUI format (images array)')
            } else if (firstImage.url) {
              imageUrl = firstImage.url
              console.log('✅ ImageGen: Found image URL in ComfyUI format')
            } else if (firstImage.filename) {
              // Try to construct URL from filename (may need endpoint-specific handling)
              console.log('⚠️ ImageGen: Found filename but no URL, filename:', firstImage.filename)
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

  MIN_WIDTH = 300 as const
  MIN_HEIGHT = 300 as const
  DEFAULT_WIDTH = 400 as const
  DEFAULT_HEIGHT = 400 as const

  getDefaultProps(): IImageGen["props"] {
    return {
      w: this.DEFAULT_WIDTH,
      h: this.DEFAULT_HEIGHT,
      prompt: "",
      imageUrl: null,
      isLoading: false,
      error: null,
    }
  }

  getGeometry(shape: IImageGen): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: IImageGen) {
    const [isHovering, setIsHovering] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    const generateImage = async (prompt: string) => {
      console.log("🎨 ImageGen: Generating image with prompt:", prompt)
      
      // Clear any previous errors
      this.editor.updateShape<IImageGen>({
        id: shape.id,
        type: "ImageGen",
        props: { 
          error: null,
          isLoading: true,
          imageUrl: null
        },
      })

      try {
        // Get RunPod configuration
        const runpodConfig = getRunPodConfig()
        const endpointId = shape.props.endpointId || runpodConfig?.endpointId || "tzf1j3sc3zufsy"
        const apiKey = runpodConfig?.apiKey

        // Mock API mode: Return placeholder image without calling RunPod
        if (USE_MOCK_API) {
          console.log("🎭 ImageGen: Using MOCK API mode (no real RunPod call)")
          console.log("🎨 ImageGen: Mock prompt:", prompt)

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Use a placeholder image service
          const mockImageUrl = `https://via.placeholder.com/512x512/4F46E5/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 30))}`

          console.log("✅ ImageGen: Mock image generated:", mockImageUrl)

          this.editor.updateShape<IImageGen>({
            id: shape.id,
            type: "ImageGen",
            props: {
              imageUrl: mockImageUrl,
              isLoading: false,
              error: null
            },
          })

          return
        }

        // Real API mode: Use RunPod
        if (!apiKey) {
          throw new Error("RunPod API key not configured. Please set VITE_RUNPOD_API_KEY environment variable.")
        }

        const url = `https://api.runpod.ai/v2/${endpointId}/run`

        console.log("📤 ImageGen: Sending request to:", url)

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
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
        console.log("📥 ImageGen: Response data:", JSON.stringify(data, null, 2))

        // Handle async job pattern (RunPod often returns job IDs)
        if (data.id && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS' || data.status === 'STARTING')) {
          console.log("⏳ ImageGen: Job queued/in progress, polling job ID:", data.id)
          const imageUrl = await pollRunPodJob(data.id, apiKey, endpointId)
          console.log("✅ ImageGen: Job completed, image URL:", imageUrl)
          
          this.editor.updateShape<IImageGen>({
            id: shape.id,
            type: "ImageGen",
            props: { 
              imageUrl: imageUrl,
              isLoading: false,
              error: null
            },
          })
        } else if (data.output) {
          // Handle direct response
          let imageUrl = ''
          if (typeof data.output === 'string') {
            imageUrl = data.output
          } else if (data.output.image) {
            imageUrl = data.output.image
          } else if (data.output.url) {
            imageUrl = data.output.url
          } else if (Array.isArray(data.output) && data.output.length > 0) {
            const firstItem = data.output[0]
            if (typeof firstItem === 'string') {
              imageUrl = firstItem
            } else if (firstItem.image) {
              imageUrl = firstItem.image
            } else if (firstItem.url) {
              imageUrl = firstItem.url
            }
          }

          if (imageUrl) {
            this.editor.updateShape<IImageGen>({
              id: shape.id,
              type: "ImageGen",
              props: { 
                imageUrl: imageUrl,
                isLoading: false,
                error: null
              },
            })
          } else {
            throw new Error("No image URL found in response")
          }
        } else if (data.error) {
          throw new Error(`RunPod API error: ${data.error}`)
        } else {
          throw new Error("No valid response from RunPod API")
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
        
        this.editor.updateShape<IImageGen>({
          id: shape.id,
          type: "ImageGen",
          props: { 
            isLoading: false,
            error: userFriendlyError
          },
        })
      }
    }

    const handleGenerate = () => {
      if (shape.props.prompt.trim() && !shape.props.isLoading) {
        generateImage(shape.props.prompt)
        this.editor.updateShape<IImageGen>({
          id: shape.id,
          type: "ImageGen",
          props: { prompt: "" },
        })
      }
    }

    return (
      <HTMLContainer
        style={{
          borderRadius: 6,
          border: "1px solid lightgrey",
          padding: 8,
          height: shape.props.h,
          width: shape.props.w,
          pointerEvents: isSelected || isHovering ? "all" : "none",
          backgroundColor: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
      >
        {/* Error Display */}
        {shape.props.error && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              color: "#c33",
              fontSize: "13px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <span style={{ fontSize: "18px", flexShrink: 0 }}>⚠️</span>
            <span style={{ flex: 1, lineHeight: "1.5" }}>{shape.props.error}</span>
            <button
              onClick={() => {
                this.editor.updateShape<IImageGen>({
                  id: shape.id,
                  type: "ImageGen",
                  props: { error: null },
                })
              }}
              style={{
                padding: "4px 8px",
                backgroundColor: "#fcc",
                border: "1px solid #c99",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Image Display */}
        {shape.props.imageUrl && !shape.props.isLoading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <img
              src={shape.props.imageUrl}
              alt={shape.props.prompt || "Generated image"}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
              onError={(_e) => {
                console.error("❌ ImageGen: Failed to load image:", shape.props.imageUrl)
                this.editor.updateShape<IImageGen>({
                  id: shape.id,
                  type: "ImageGen",
                  props: { 
                    error: "Failed to load generated image",
                    imageUrl: null
                  },
                })
              }}
            />
          </div>
        )}

        {/* Loading State */}
        {shape.props.isLoading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: "4px solid #f3f3f3",
                borderTop: "4px solid #007AFF",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <span style={{ color: "#666", fontSize: "14px" }}>
              Generating image...
            </span>
          </div>
        )}

        {/* Empty State */}
        {!shape.props.imageUrl && !shape.props.isLoading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              color: "#999",
              fontSize: "14px",
            }}
          >
            Generated image will appear here
          </div>
        )}

        {/* Input Section */}
        <div
          style={{
            display: "flex",
            gap: 8,
            pointerEvents: isSelected || isHovering ? "all" : "none",
          }}
        >
          <input
            style={{
              flex: 1,
              height: "36px",
              backgroundColor: "rgba(0, 0, 0, 0.05)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: "4px",
              fontSize: 14,
              padding: "0 8px",
            }}
            type="text"
            placeholder="Enter image prompt..."
            value={shape.props.prompt}
            onChange={(e) => {
              this.editor.updateShape<IImageGen>({
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
            onClick={(e) => {
              e.stopPropagation()
            }}
            disabled={shape.props.isLoading}
          />
          <button
            style={{
              height: "36px",
              padding: "0 16px",
              pointerEvents: "all",
              cursor: shape.props.prompt.trim() && !shape.props.isLoading ? "pointer" : "not-allowed",
              backgroundColor: shape.props.prompt.trim() && !shape.props.isLoading ? "#007AFF" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "500",
              fontSize: "14px",
              opacity: shape.props.prompt.trim() && !shape.props.isLoading ? 1 : 0.6,
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
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
            Generate
          </button>
        </div>

        {/* Add CSS for spinner animation */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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

