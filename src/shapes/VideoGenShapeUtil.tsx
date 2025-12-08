import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState, useRef, useEffect } from "react"
import { getRunPodVideoConfig } from "@/lib/clientConfig"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"

// Type for RunPod job response
interface RunPodJobResponse {
  id?: string
  status?: 'IN_QUEUE' | 'IN_PROGRESS' | 'STARTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  output?: {
    video_url?: string
    url?: string
    [key: string]: any
  } | string
  error?: string
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
      duration: 3,
      model: "wan2.2",
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

      // Check RunPod config
      const runpodConfig = getRunPodVideoConfig()
      if (!runpodConfig) {
        setError("RunPod video endpoint not configured. Please set VITE_RUNPOD_API_KEY and VITE_RUNPOD_VIDEO_ENDPOINT_ID in your .env file.")
        return
      }

      const currentMode = (imageUrl.trim() || imageBase64) ? 'i2v' : 't2v'
      console.log(`🎬 VideoGen: Starting ${currentMode.toUpperCase()} generation`)
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
        const { apiKey, endpointId } = runpodConfig

        // Submit job to RunPod
        console.log('🎬 VideoGen: Submitting to RunPod endpoint:', endpointId)
        const runUrl = `https://api.runpod.ai/v2/${endpointId}/run`

        // Generate a random seed for reproducibility
        const seed = Math.floor(Math.random() * 2147483647)

        // Wan2.2 parameters
        // Note: Portrait orientation (480x832) works better than landscape
        // Length is in frames: 81 frames ≈ 3 seconds at ~27fps output
        const framesPerSecond = 27 // Wan2.2 output fps
        const frameLength = Math.min(Math.max(shape.props.duration * framesPerSecond, 41), 121) // 41-121 frames supported

        // Build input payload based on mode
        const inputPayload: Record<string, any> = {
          prompt: prompt,
          negative_prompt: "blurry, distorted, low quality, static, frozen",
          width: 480,           // Portrait width (Wan2.2 optimal)
          height: 832,          // Portrait height (Wan2.2 optimal)
          length: frameLength,  // Total frames (81 ≈ 3 seconds)
          steps: 10,            // Inference steps (10 is optimal for speed/quality)
          cfg: 2.0,             // CFG scale - lower works better for Wan2.2
          seed: seed,
          context_overlap: 48,  // Frame overlap for temporal consistency
        }

        // Add image for I2V mode
        if (currentMode === 'i2v') {
          if (imageUrl.trim()) {
            inputPayload.image_url = imageUrl
          } else if (imageBase64) {
            // Strip data URL prefix if present, send just the base64
            const base64Data = imageBase64.includes(',')
              ? imageBase64.split(',')[1]
              : imageBase64
            inputPayload.image = base64Data
          }
        }

        const response = await fetch(runUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ input: inputPayload })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`RunPod API error: ${response.status} - ${errorText}`)
        }

        const jobData = await response.json() as RunPodJobResponse
        console.log('🎬 VideoGen: Job submitted:', jobData.id)

        if (!jobData.id) {
          throw new Error('No job ID returned from RunPod')
        }

        // Poll for completion
        // Video generation can take a long time, especially with GPU cold starts:
        // - GPU cold start: 30-120 seconds
        // - Model loading: 30-60 seconds
        // - Actual generation: 60-180 seconds depending on duration
        // Total: up to 6 minutes is reasonable
        const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobData.id}`
        let attempts = 0
        const maxAttempts = 180 // 6 minutes with 2s intervals

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          attempts++

          const statusResponse = await fetch(statusUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          })

          if (!statusResponse.ok) {
            console.warn(`🎬 VideoGen: Poll error (attempt ${attempts}):`, statusResponse.status)
            continue
          }

          const statusData = await statusResponse.json() as RunPodJobResponse
          console.log(`🎬 VideoGen: Poll ${attempts}/${maxAttempts}, status:`, statusData.status)

          if (statusData.status === 'COMPLETED') {
            // Extract video from output - can be URL or base64 data
            let videoData = ''

            if (typeof statusData.output === 'string') {
              // Direct string output - could be URL or base64
              videoData = statusData.output
            } else if (statusData.output?.video) {
              // Base64 video data in output.video field
              videoData = statusData.output.video
            } else if (statusData.output?.video_url) {
              videoData = statusData.output.video_url
            } else if (statusData.output?.url) {
              videoData = statusData.output.url
            }

            if (videoData) {
              // Check if it's base64 data (doesn't start with http)
              let finalUrl = videoData
              if (!videoData.startsWith('http') && !videoData.startsWith('data:')) {
                // Convert base64 to data URL
                finalUrl = `data:video/mp4;base64,${videoData}`
                console.log('✅ VideoGen: Generation complete, converted base64 to data URL')
                console.log('✅ VideoGen: Base64 length:', videoData.length, 'chars')
              } else {
                console.log('✅ VideoGen: Generation complete, URL:', finalUrl.substring(0, 100))
              }

              // Log the data URL prefix to verify format
              console.log('✅ VideoGen: Final URL prefix:', finalUrl.substring(0, 50))

              // Update local state immediately
              setVideoUrl(finalUrl)
              setIsGenerating(false)

              // Get fresh shape data to avoid stale props
              const currentShape = editor.getShape(shape.id)
              if (currentShape) {
                editor.updateShape({
                  id: shape.id,
                  type: shape.type,
                  props: {
                    ...(currentShape as IVideoGen).props,
                    videoUrl: finalUrl,
                    isLoading: false,
                    prompt: prompt,
                    imageUrl: imageUrl,
                    imageBase64: imageBase64
                  }
                })
              }
              return
            } else {
              console.log('⚠️ VideoGen: Completed but no video in output:', JSON.stringify(statusData.output))
              throw new Error('Video generation completed but no video data returned')
            }
          } else if (statusData.status === 'FAILED') {
            throw new Error(statusData.error || 'Video generation failed')
          } else if (statusData.status === 'CANCELLED') {
            throw new Error('Video generation was cancelled')
          }
        }

        throw new Error('Video generation timed out after 6 minutes. The GPU may be busy - try again later.')
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
          title="🎬 Video Generator (Wan2.2)"
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
                        disabled={isGenerating}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
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
                          gap: '6px'
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
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '12px',
                        boxSizing: 'border-box'
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
                      boxSizing: 'border-box'
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
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    onPointerDown={(e) => e.stopPropagation()}
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
                      opacity: isGenerating || !prompt.trim() ? 0.6 : 1
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
                  <div><strong>Wan2.2 Video Generation</strong></div>
                  <div>
                    {mode === 'i2v'
                      ? 'Animates your image based on the motion prompt'
                      : 'Creates video from your text description'
                    }
                  </div>
                  <div style={{ marginTop: '4px' }}>Output: 480x832 portrait | ~3 seconds</div>
                  <div style={{ marginTop: '4px', opacity: 0.8 }}>
                    Processing: 2-6 minutes (includes GPU warm-up)
                  </div>
                </div>
              </>
            )}

            {videoUrl && (
              <>
                <video
                  key={videoUrl.substring(0, 100)} // Force reload when URL changes
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  onPointerDown={(e) => e.stopPropagation()}
                  onLoadedData={() => console.log('🎬 VideoGen: Video loaded successfully')}
                  onError={(e) => console.error('🎬 VideoGen: Video load error:', e)}
                  style={{
                    width: '100%',
                    maxHeight: '280px',
                    borderRadius: '6px',
                    backgroundColor: '#000'
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
                      cursor: 'pointer'
                    }}
                  >
                    New Video
                  </button>

                  <a
                    href={videoUrl}
                    download="generated-video.mp4"
                    onPointerDown={(e) => e.stopPropagation()}
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
                      cursor: 'pointer'
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
