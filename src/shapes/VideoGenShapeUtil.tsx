import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState } from "react"
import { aiOrchestrator, isAIOrchestratorAvailable } from "@/lib/aiOrchestrator"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"

type IVideoGen = TLBaseShape<
  "VideoGen",
  {
    w: number
    h: number
    prompt: string
    videoUrl: string | null
    isLoading: boolean
    error: string | null
    duration: number // seconds
    model: string
    tags: string[]
  }
>

export class VideoGenShape extends BaseBoxShapeUtil<IVideoGen> {
  static override type = "VideoGen" as const

  // Video generation theme color: Purple
  static readonly PRIMARY_COLOR = "#8B5CF6"

  getDefaultProps(): IVideoGen['props'] {
    return {
      w: 500,
      h: 450,
      prompt: "",
      videoUrl: null,
      isLoading: false,
      error: null,
      duration: 3,
      model: "wan2.1-i2v",
      tags: ['video', 'ai-generated']
    }
  }

  getGeometry(shape: IVideoGen): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: IVideoGen) {
    const [prompt, setPrompt] = useState(shape.props.prompt)
    const [isGenerating, setIsGenerating] = useState(shape.props.isLoading)
    const [error, setError] = useState<string | null>(shape.props.error)
    const [videoUrl, setVideoUrl] = useState<string | null>(shape.props.videoUrl)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    const handleGenerate = async () => {
      if (!prompt.trim()) {
        setError("Please enter a prompt")
        return
      }

      console.log('🎬 VideoGen: Starting generation with prompt:', prompt)
      setIsGenerating(true)
      setError(null)

      // Update shape to show loading state
      this.editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, isLoading: true, error: null }
      })

      try {
        // Check if AI Orchestrator is available
        const orchestratorAvailable = await isAIOrchestratorAvailable()

        if (orchestratorAvailable) {
          console.log('🎬 VideoGen: Using AI Orchestrator for video generation')

          // Use AI Orchestrator (always routes to RunPod for video)
          const job = await aiOrchestrator.generateVideo(prompt, {
            model: shape.props.model,
            duration: shape.props.duration,
            wait: true // Wait for completion
          })

          if (job.status === 'completed' && job.result?.video_url) {
            const url = job.result.video_url
            console.log('✅ VideoGen: Generation complete, URL:', url)
            console.log(`💰 VideoGen: Cost: $${job.cost?.toFixed(4) || '0.00'}`)

            setVideoUrl(url)
            setIsGenerating(false)

            // Update shape with video URL
            this.editor.updateShape({
              id: shape.id,
              type: shape.type,
              props: {
                ...shape.props,
                videoUrl: url,
                isLoading: false,
                prompt: prompt
              }
            })
          } else {
            throw new Error('Video generation job did not return a video URL')
          }
        } else {
          throw new Error(
            'AI Orchestrator not available. Please configure VITE_AI_ORCHESTRATOR_URL or set up the orchestrator on your Netcup RS 8000 server.'
          )
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error during video generation'
        console.error('❌ VideoGen: Generation error:', errorMessage)
        setError(errorMessage)
        setIsGenerating(false)

        // Update shape with error
        this.editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props, isLoading: false, error: errorMessage }
        })
      }
    }

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleTagsChange = (newTags: string[]) => {
      this.editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, tags: newTags }
      })
    }

    return (
      <HTMLContainer id={shape.id}>
        <StandardizedToolWrapper
          title="🎬 Video Generator (Wan2.1)"
          primaryColor={VideoGenShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          tags={shape.props.tags}
          onTagsChange={handleTagsChange}
          tagsEditable={true}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: '#555', fontSize: '12px', fontWeight: '600' }}>
                    Video Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the video you want to generate..."
                    disabled={isGenerating}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      minHeight: '80px',
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
                      min="1"
                      max="10"
                      value={shape.props.duration}
                      onChange={(e) => {
                        this.editor.updateShape({
                          id: shape.id,
                          type: shape.type,
                          props: { ...shape.props, duration: parseInt(e.target.value) || 3 }
                        })
                      }}
                      disabled={isGenerating}
                      onPointerDown={(e) => e.stopPropagation()}
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
                    {isGenerating ? 'Generating...' : 'Generate Video'}
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
                  <div><strong>Note:</strong> Video generation uses RunPod GPU</div>
                  <div>Cost: ~$0.50 per video | Processing: 30-90 seconds</div>
                </div>
              </>
            )}

            {videoUrl && (
              <>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  onPointerDown={(e) => e.stopPropagation()}
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
                      this.editor.updateShape({
                        id: shape.id,
                        type: shape.type,
                        props: { ...shape.props, videoUrl: null, prompt: "" }
                      })
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
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
