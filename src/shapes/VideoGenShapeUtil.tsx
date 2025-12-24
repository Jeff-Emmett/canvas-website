import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState, useRef, useEffect } from "react"
import { getFalConfig } from "@/lib/clientConfig"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"

// Type for fal.ai queue response
interface FalQueueResponse {
  request_id?: string
  status?: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  logs?: Array<{ message: string; timestamp: string }>
  error?: string
  video?: { url: string }
  // Additional fields for WAN models
  output?: { video?: { url: string } }
}

type IVideoGen = TLBaseShape<
  "VideoGen",
  {
    w: number
    h: number
    prompt: string
    imageUrl: string // Input image URL for I2V generation
    imageBase64: string // Uploaded image as base64 for I2V generation
    videoUrl: string | null
    isLoading: boolean
    error: string | null
    duration: number // seconds
    model: string
    tags: string[]
    pinnedToView: boolean
  }
>

export class VideoGenShape extends BaseBoxShapeUtil<IVideoGen> {
  static override type = "VideoGen" as const

  // Video generation theme color: Purple
  static readonly PRIMARY_COLOR = "#8B5CF6"

  getDefaultProps(): IVideoGen['props'] {
    return {
      w: 500,
      h: 540,
      prompt: "",
      imageUrl: "", // Input image URL for I2V generation
      imageBase64: "", // Uploaded image as base64
      videoUrl: null,
      isLoading: false,
      error: null,
      duration: 4,
      model: "wan-i2v", // fal.ai model: wan-i2v, wan-t2v, kling, minimax
      tags: ['video', 'ai-generated'],
      pinnedToView: false
    }
  }

  getGeometry(shape: IVideoGen): Geometry2d {
    // Ensure minimum dimensions for proper hit testing
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    })
  }

  component(shape: IVideoGen) {
    // Capture editor reference to avoid stale 'this' during drag operations
    const editor = this.editor

    // Debug: log what's in shape props on each render
    console.log('🎬 VideoGen render - shape.props.videoUrl:', shape.props.videoUrl?.substring(0, 80) || 'null')

    const [prompt, setPrompt] = useState(shape.props.prompt)
    const [imageUrl, setImageUrl] = useState(shape.props.imageUrl)
    const [imageBase64, setImageBase64] = useState(shape.props.imageBase64)
    const [isGenerating, setIsGenerating] = useState(shape.props.isLoading)
    const [error, setError] = useState<string | null>(shape.props.error)
    const [videoUrl, setVideoUrl] = useState<string | null>(shape.props.videoUrl)
    const [isMinimized, setIsMinimized] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isSelected = editor.getSelectedShapeIds().includes(shape.id)

    // Determine mode based on whether an image is provided
    const hasImage = imageUrl.trim() || imageBase64
    const mode = hasImage ? 'i2v' : 't2v'

    // Sync video URL from shape props when it changes externally
    // This ensures the displayed video matches the shape's stored videoUrl
    useEffect(() => {
      if (shape.props.videoUrl !== videoUrl) {
        console.log('🎬 VideoGen: Syncing videoUrl from shape props:', shape.props.videoUrl?.substring(0, 50))
        setVideoUrl(shape.props.videoUrl)
      }
    }, [shape.props.videoUrl])

    // Pin to view functionality
    usePinnedToView(editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'VideoGen',
    })

    const handlePinToggle = () => {
      editor.updateShape<IVideoGen>({
        id: shape.id,
        type: "VideoGen",
        props: { pinnedToView: !shape.props.pinnedToView },
      })
    }

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file (JPEG, PNG, etc.)')
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be less than 10MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setImageBase64(base64)
        setImageUrl('') // Clear URL if uploading
        setError(null)
      }
      reader.onerror = () => {
        setError('Failed to read image file')
      }
      reader.readAsDataURL(file)
    }

    const handleGenerate = async () => {
      if (!prompt.trim()) {
        setError("Please enter a prompt describing the video")
        return
      }

      // Validate image URL if provided
      if (imageUrl.trim()) {
        try {
          new URL(imageUrl)
        } catch {
          setError("Please enter a valid image URL (must start with http:// or https://)")
          return
        }
      }

      // Check fal.ai config
      const falConfig = getFalConfig()
      if (!falConfig) {
        setError("fal.ai not configured. Please set VITE_FAL_API_KEY in your .env file.")
        return
      }

      const currentMode = (imageUrl.trim() || imageBase64) ? 'i2v' : 't2v'
      console.log(`🎬 VideoGen: Starting ${currentMode.toUpperCase()} generation via fal.ai`)
      console.log('🎬 VideoGen: Prompt:', prompt)
      if (currentMode === 'i2v') {
        console.log('🎬 VideoGen: Image source:', imageUrl ? 'URL' : 'Uploaded')
      }

      // Clear any existing video and set loading state
      setIsGenerating(true)
      setError(null)
      setVideoUrl(null) // Clear old video immediately

      // Update shape to show loading state and clear old video
      const currentShape = editor.getShape(shape.id) as IVideoGen | undefined
      if (currentShape) {
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: {
            ...currentShape.props,
            isLoading: true,
            error: null,
            videoUrl: null // Clear old video from shape props
          }
        })
      }

      try {
        const { apiKey } = falConfig

        // Choose fal.ai endpoint based on mode
        // WAN 2.1 models: fast startup, good quality
        const endpoint = currentMode === 'i2v' ? 'fal-ai/wan-i2v' : 'fal-ai/wan-t2v'

        console.log('🎬 VideoGen: Submitting to fal.ai endpoint:', endpoint)
        const submitUrl = `https://queue.fal.run/${endpoint}`

        // Build input payload for fal.ai
        const inputPayload: Record<string, any> = {
          prompt: prompt,
          negative_prompt: "blurry, distorted, low quality, static, frozen, watermark",
          num_frames: 81, // ~4 seconds at 24fps
          fps: 24,
          guidance_scale: 5.0,
          num_inference_steps: 30,
        }

        // Add image for I2V mode
        if (currentMode === 'i2v') {
          if (imageUrl.trim()) {
            inputPayload.image_url = imageUrl
          } else if (imageBase64) {
            // fal.ai accepts data URLs directly
            inputPayload.image_url = imageBase64
          }
        }

        // Submit to fal.ai queue
        const response = await fetch(submitUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(inputPayload)
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`fal.ai API error: ${response.status} - ${errorText}`)
        }

        const jobData = await response.json() as FalQueueResponse
        console.log('🎬 VideoGen: Job submitted:', jobData.request_id)

        if (!jobData.request_id) {
          throw new Error('No request_id returned from fal.ai')
        }

        // Poll for completion
        // fal.ai is generally faster than RunPod due to warm instances
        // Typical times: 30-90 seconds for video generation
        const statusUrl = `https://queue.fal.run/${endpoint}/requests/${jobData.request_id}/status`
        let attempts = 0
        const maxAttempts = 120 // 4 minutes with 2s intervals

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          attempts++

          const statusResponse = await fetch(statusUrl, {
            headers: { 'Authorization': `Key ${apiKey}` }
          })

          if (!statusResponse.ok) {
            console.warn(`🎬 VideoGen: Poll error (attempt ${attempts}):`, statusResponse.status)
            continue
          }

          const statusData = await statusResponse.json() as FalQueueResponse
          console.log(`🎬 VideoGen: Poll ${attempts}/${maxAttempts}, status:`, statusData.status)

          if (statusData.status === 'COMPLETED') {
            // Fetch the result
            const resultUrl = `https://queue.fal.run/${endpoint}/requests/${jobData.request_id}`
            const resultResponse = await fetch(resultUrl, {
              headers: { 'Authorization': `Key ${apiKey}` }
            })

            if (!resultResponse.ok) {
              throw new Error(`Failed to fetch result: ${resultResponse.status}`)
            }

            const resultData = await resultResponse.json() as { video?: { url: string }; output?: { video?: { url: string } } }
            console.log('🎬 VideoGen: Result data:', JSON.stringify(resultData).substring(0, 200))

            // Extract video URL from result
            const videoResultUrl = resultData.video?.url || resultData.output?.video?.url

            if (videoResultUrl) {
              console.log('✅ VideoGen: Generation complete, URL:', videoResultUrl.substring(0, 100))

              // Update local state immediately
              setVideoUrl(videoResultUrl)
              setIsGenerating(false)

              // Get fresh shape data to avoid stale props
              const currentShape = editor.getShape(shape.id)
              if (currentShape) {
                editor.updateShape({
                  id: shape.id,
                  type: shape.type,
                  props: {
                    ...(currentShape as IVideoGen).props,
                    videoUrl: videoResultUrl,
                    isLoading: false,
                    prompt: prompt,
                    imageUrl: imageUrl,
                    imageBase64: imageBase64
                  }
                })
              }
              return
            } else {
              console.log('⚠️ VideoGen: Completed but no video in result:', JSON.stringify(resultData))
              throw new Error('Video generation completed but no video URL returned')
            }
          } else if (statusData.status === 'FAILED') {
            throw new Error(statusData.error || 'Video generation failed')
          }
        }

        throw new Error('Video generation timed out after 4 minutes. Please try again.')
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error during video generation'
        console.error('❌ VideoGen: Generation error:', errorMessage)
        setError(errorMessage)
        setIsGenerating(false)

        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props, isLoading: false, error: errorMessage }
        })
      }
    }

    const handleClose = () => {
      editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleTagsChange = (newTags: string[]) => {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, tags: newTags }
      })
    }

    return (
      <HTMLContainer id={shape.id}>
        <StandardizedToolWrapper
          title="🎬 Video Generator (fal.ai)"
          primaryColor={VideoGenShape.PRIMARY_COLOR}
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
          tags={shape.props.tags}
          onTagsChange={handleTagsChange}
          tagsEditable={true}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          headerContent={
            isGenerating ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎬 Video Generator
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  color: VideoGenShape.PRIMARY_COLOR,
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
            padding: '16px',
            gap: '12px',
            overflow: 'auto',
            backgroundColor: '#fafafa'
          }}>
            {!videoUrl && (
              <>
                {/* Mode indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: mode === 'i2v' ? '#e8f4fd' : '#f0e8fd',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: mode === 'i2v' ? '#1976d2' : '#7c3aed'
                }}>
                  <span style={{ fontWeight: '600' }}>
                    {mode === 'i2v' ? '🖼️ Image-to-Video' : '✨ Text-to-Video'}
                  </span>
                  <span style={{ opacity: 0.8 }}>
                    {mode === 'i2v' ? '(animates your image)' : '(generates from text only)'}
                  </span>
                </div>

                {/* Image Input Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#555', fontSize: '12px', fontWeight: '600' }}>
                    Source Image (optional)
                  </label>

                  {/* Image preview or upload area */}
                  {(imageUrl || imageBase64) ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={imageBase64 || imageUrl}
                        alt="Preview"
                        style={{
                          width: '100%',
                          maxHeight: '100px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          backgroundColor: '#f5f5f5'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          setError('Failed to load image from URL')
                        }}
                      />
                      <button
                        onClick={() => {
                          setImageUrl('')
                          setImageBase64('')
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        disabled={isGenerating}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          touchAction: 'manipulation',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Upload button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          fileInputRef.current?.click()
                        }}
                        disabled={isGenerating}
                        style={{
                          flex: 1,
                          padding: '12px',
                          backgroundColor: '#f5f5f5',
                          border: '2px dashed #ccc',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          touchAction: 'manipulation',
                          minHeight: '44px',
                        }}
                      >
                        📤 Upload Image
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                    </div>
                  )}

                  {/* URL input (collapsible) */}
                  {!imageBase64 && (
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value)
                        setImageBase64('')
                      }}
                      placeholder="Or paste image URL..."
                      disabled={isGenerating}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                        touchAction: 'manipulation',
                        minHeight: '44px',
                      }}
                    />
                  )}
                </div>

                {/* Prompt */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#555', fontSize: '12px', fontWeight: '600' }}>
                    {mode === 'i2v' ? 'Motion Prompt *' : 'Video Prompt *'}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'i2v'
                      ? "Describe the motion (e.g., 'gentle camera pan, wind blowing')"
                      : "Describe the video scene (e.g., 'a cat walking through a forest')"
                    }
                    disabled={isGenerating}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      minHeight: '50px',
                      padding: '10px',
                      backgroundColor: '#fff',
                      color: '#333',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      touchAction: 'manipulation',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#555', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="4"
                      value={shape.props.duration}
                      onChange={(e) => {
                        editor.updateShape({
                          id: shape.id,
                          type: shape.type,
                          props: { ...shape.props, duration: parseInt(e.target.value) || 3 }
                        })
                      }}
                      disabled={isGenerating}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        touchAction: 'manipulation',
                        minHeight: '44px',
                      }}
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      if (!isGenerating && prompt.trim()) {
                        handleGenerate()
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      padding: '8px 20px',
                      backgroundColor: isGenerating ? '#ccc' : VideoGenShape.PRIMARY_COLOR,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      opacity: isGenerating || !prompt.trim() ? 0.6 : 1,
                      touchAction: 'manipulation',
                      minHeight: '44px',
                    }}
                  >
                    {isGenerating ? 'Generating...' : (mode === 'i2v' ? 'Animate Image' : 'Generate Video')}
                  </button>
                </div>

                {error && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    color: '#c33',
                    borderRadius: '6px',
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Error:</strong> {error}
                  </div>
                )}

                <div style={{
                  marginTop: 'auto',
                  padding: '12px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#666',
                  lineHeight: '1.5'
                }}>
                  <div><strong>fal.ai WAN 2.1 Video Generation</strong></div>
                  <div>
                    {mode === 'i2v'
                      ? 'Animates your image based on the motion prompt'
                      : 'Creates video from your text description'
                    }
                  </div>
                  <div style={{ marginTop: '4px' }}>Output: ~4 seconds | Fast startup</div>
                  <div style={{ marginTop: '4px', opacity: 0.8 }}>
                    Processing: 30-90 seconds (no cold start)
                  </div>
                </div>
              </>
            )}

            {videoUrl && (
              <>
                <video
                  key={videoUrl.substring(0, 100)} // Force reload when URL changes
                  src={videoUrl}
                  crossOrigin="anonymous"
                  controls
                  autoPlay
                  loop
                  playsInline
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onLoadedData={() => console.log('🎬 VideoGen: Video loaded successfully')}
                  onError={(e) => console.error('🎬 VideoGen: Video load error:', e)}
                  style={{
                    width: '100%',
                    maxHeight: '280px',
                    borderRadius: '6px',
                    backgroundColor: '#000',
                    touchAction: 'manipulation',
                  }}
                />

                <div style={{
                  padding: '10px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#555',
                  wordBreak: 'break-word'
                }}>
                  <strong>Prompt:</strong> {shape.props.prompt || prompt}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setVideoUrl(null)
                      setPrompt("")
                      setImageUrl("")
                      setImageBase64("")
                      editor.updateShape({
                        id: shape.id,
                        type: shape.type,
                        props: { ...shape.props, videoUrl: null, prompt: "", imageUrl: "", imageBase64: "" }
                      })
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#e0e0e0',
                      color: '#333',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      minHeight: '44px',
                    }}
                  >
                    New Video
                  </button>

                  <a
                    href={videoUrl}
                    download="generated-video.mp4"
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: VideoGenShape.PRIMARY_COLOR,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textAlign: 'center',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Download
                  </a>
                </div>
              </>
            )}
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IVideoGen) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}
