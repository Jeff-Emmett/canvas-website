import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState } from "react"
import { getWorkerApiUrl } from "@/lib/clientConfig"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"

// Blender render presets
type BlenderPreset = 'abstract' | 'geometric' | 'landscape' | 'text3d' | 'particles'

// Individual render entry in the history
interface GeneratedRender {
  id: string
  prompt: string
  preset: BlenderPreset
  imageUrl: string
  timestamp: number
  renderTime?: number
  seed?: number
}

type IBlenderGen = TLBaseShape<
  "BlenderGen",
  {
    w: number
    h: number
    prompt: string
    preset: BlenderPreset
    complexity: number // 1-10
    text3dContent: string // For text3d preset
    seed: number | null // For reproducibility
    renderHistory: GeneratedRender[]
    isLoading: boolean
    loadingPrompt: string | null
    progress: number // 0-100
    error: string | null
    tags: string[]
    pinnedToView: boolean
  }
>

export class BlenderGenShape extends BaseBoxShapeUtil<IBlenderGen> {
  static override type = "BlenderGen" as const

  // Blender theme color: Orange/3D
  static readonly PRIMARY_COLOR = "#E87D0D"

  MIN_WIDTH = 320 as const
  MIN_HEIGHT = 400 as const
  DEFAULT_WIDTH = 420 as const
  DEFAULT_HEIGHT = 500 as const

  getDefaultProps(): IBlenderGen["props"] {
    return {
      w: this.DEFAULT_WIDTH,
      h: this.DEFAULT_HEIGHT,
      prompt: "",
      preset: "abstract",
      complexity: 5,
      text3dContent: "",
      seed: null,
      renderHistory: [],
      isLoading: false,
      loadingPrompt: null,
      progress: 0,
      error: null,
      tags: ['3d', 'blender', 'render'],
      pinnedToView: false,
    }
  }

  getGeometry(shape: IBlenderGen): Geometry2d {
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    })
  }

  component(shape: IBlenderGen) {
    const editor = this.editor
    const isSelected = editor.getSelectedShapeIds().includes(shape.id)

    usePinnedToView(editor, shape.id, shape.props.pinnedToView)

    const { isMaximized, toggleMaximize } = useMaximize({
      editor: editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'BlenderGen',
    })

    const handlePinToggle = () => {
      editor.updateShape<IBlenderGen>({
        id: shape.id,
        type: "BlenderGen",
        props: { pinnedToView: !shape.props.pinnedToView },
      })
    }

    const presets: { id: BlenderPreset; label: string; icon: string; description: string }[] = [
      { id: 'abstract', label: 'Abstract', icon: '🔮', description: 'Random geometric shapes' },
      { id: 'geometric', label: 'Geometric', icon: '📐', description: 'Grid-based patterns' },
      { id: 'landscape', label: 'Landscape', icon: '🏔️', description: 'Procedural terrain' },
      { id: 'text3d', label: '3D Text', icon: 'Aa', description: 'Metallic 3D text' },
      { id: 'particles', label: 'Particles', icon: '✨', description: 'Particle effects' },
    ]

    const generateRender = async () => {
      const prompt = shape.props.preset === 'text3d'
        ? shape.props.text3dContent || 'BLENDER'
        : shape.props.prompt || shape.props.preset

      editor.updateShape<IBlenderGen>({
        id: shape.id,
        type: "BlenderGen",
        props: {
          error: null,
          isLoading: true,
          loadingPrompt: prompt,
          progress: 0,
        },
      })

      try {
        const workerUrl = getWorkerApiUrl()
        const url = `${workerUrl}/api/blender/render`

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            preset: shape.props.preset,
            text: shape.props.preset === 'text3d' ? (shape.props.text3dContent || 'BLENDER') : undefined,
            complexity: shape.props.complexity,
            seed: shape.props.seed,
            resolution: "1920x1080",
            samples: 64,
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
        }

        const data = await response.json() as { imageUrl?: string; renderTime?: number; seed?: number; error?: string }

        if (data.imageUrl) {
          const currentShape = editor.getShape<IBlenderGen>(shape.id)
          const currentHistory = currentShape?.props.renderHistory || []

          const newRender: GeneratedRender = {
            id: `render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            prompt: prompt,
            preset: shape.props.preset,
            imageUrl: data.imageUrl,
            timestamp: Date.now(),
            renderTime: data.renderTime,
            seed: data.seed,
          }

          editor.updateShape<IBlenderGen>({
            id: shape.id,
            type: "BlenderGen",
            props: {
              renderHistory: [newRender, ...currentHistory],
              isLoading: false,
              loadingPrompt: null,
              progress: 100,
              error: null,
            },
          })
        } else if (data.error) {
          throw new Error(data.error)
        } else {
          throw new Error("No image returned from Blender API")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error("BlenderGen: Error:", errorMessage)

        editor.updateShape<IBlenderGen>({
          id: shape.id,
          type: "BlenderGen",
          props: {
            isLoading: false,
            loadingPrompt: null,
            progress: 0,
            error: `Render failed: ${errorMessage}`,
          },
        })
      }
    }

    const handleGenerate = () => {
      if (!shape.props.isLoading) {
        generateRender()
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
      editor.updateShape<IBlenderGen>({
        id: shape.id,
        type: "BlenderGen",
        props: { tags: newTags },
      })
    }

    return (
      <HTMLContainer id={shape.id}>
        <StandardizedToolWrapper
          title="🎬 Blender 3D"
          primaryColor={BlenderGenShape.PRIMARY_COLOR}
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
                🎬 Blender 3D
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  color: BlenderGenShape.PRIMARY_COLOR,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}>
                  Rendering...
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
            backgroundColor: '#1a1a1a'
          }}>
            {/* Preset Selection */}
            <div style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
            }}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    editor.updateShape<IBlenderGen>({
                      id: shape.id,
                      type: "BlenderGen",
                      props: { preset: preset.id },
                    })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '70px',
                    padding: '8px 10px',
                    backgroundColor: shape.props.preset === preset.id ? BlenderGenShape.PRIMARY_COLOR : '#2a2a2a',
                    border: shape.props.preset === preset.id ? `2px solid ${BlenderGenShape.PRIMARY_COLOR}` : '2px solid #3a3a3a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: shape.props.preset === preset.id ? '#fff' : '#aaa',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.15s',
                  }}
                  title={preset.description}
                >
                  <span style={{ fontSize: '16px' }}>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            {/* Text3D Input (shown only for text3d preset) */}
            {shape.props.preset === 'text3d' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>
                  3D Text Content
                </label>
                <input
                  type="text"
                  style={{
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#fff',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Enter text to render in 3D..."
                  value={shape.props.text3dContent}
                  onChange={(e) => {
                    editor.updateShape<IBlenderGen>({
                      id: shape.id,
                      type: "BlenderGen",
                      props: { text3dContent: e.target.value },
                    })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter' && !shape.props.isLoading) {
                      handleGenerate()
                    }
                  }}
                />
              </div>
            )}

            {/* Complexity Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>
                  Complexity
                </label>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {shape.props.complexity}/10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={shape.props.complexity}
                onChange={(e) => {
                  editor.updateShape<IBlenderGen>({
                    id: shape.id,
                    type: "BlenderGen",
                    props: { complexity: parseInt(e.target.value) },
                  })
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  accentColor: BlenderGenShape.PRIMARY_COLOR,
                }}
              />
            </div>

            {/* Render Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleGenerate()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={shape.props.isLoading}
              style={{
                padding: '12px 20px',
                backgroundColor: shape.props.isLoading ? '#444' : BlenderGenShape.PRIMARY_COLOR,
                border: 'none',
                borderRadius: '8px',
                cursor: shape.props.isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s',
                opacity: shape.props.isLoading ? 0.7 : 1,
              }}
            >
              {shape.props.isLoading ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid #fff",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Rendering...
                </>
              ) : (
                <>
                  <span>🎬</span>
                  Render 3D Scene
                </>
              )}
            </button>

            {/* Render History */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflow: 'auto',
              minHeight: 0,
            }}>
              {/* Loading State */}
              {shape.props.isLoading && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#2a2a2a",
                  borderRadius: "6px",
                  border: '1px solid #3a3a3a',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '24px',
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        border: "4px solid #3a3a3a",
                        borderTop: `4px solid ${BlenderGenShape.PRIMARY_COLOR}`,
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span style={{ color: "#aaa", fontSize: "14px" }}>
                      Rendering 3D scene...
                    </span>
                    <span style={{ color: "#666", fontSize: "11px" }}>
                      This may take 30-60 seconds
                    </span>
                  </div>
                  {shape.props.loadingPrompt && (
                    <div style={{
                      borderTop: '1px solid #3a3a3a',
                      padding: '8px 10px',
                      backgroundColor: '#222',
                      fontSize: '11px',
                      color: '#888',
                    }}>
                      <span style={{ fontWeight: 500, color: '#666' }}>Preset: </span>
                      {shape.props.preset}
                      {shape.props.preset === 'text3d' && ` - "${shape.props.loadingPrompt}"`}
                    </div>
                  )}
                </div>
              )}

              {/* Render History */}
              {shape.props.renderHistory.map((render, index) => (
                <div
                  key={render.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#2a2a2a",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: index === 0 && !shape.props.isLoading ? `2px solid ${BlenderGenShape.PRIMARY_COLOR}` : '1px solid #3a3a3a',
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    maxHeight: index === 0 ? '250px' : '120px',
                    backgroundColor: '#1a1a1a',
                  }}>
                    <img
                      src={render.imageUrl}
                      alt={render.prompt}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                      onError={() => {
                        const newHistory = shape.props.renderHistory.filter(r => r.id !== render.id)
                        editor.updateShape<IBlenderGen>({
                          id: shape.id,
                          type: "BlenderGen",
                          props: { renderHistory: newHistory },
                        })
                      }}
                    />
                  </div>
                  <div style={{
                    borderTop: '1px solid #3a3a3a',
                    padding: '8px 10px',
                    backgroundColor: '#222',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#888',
                      display: 'flex',
                      gap: '12px',
                    }}>
                      <span><strong>Preset:</strong> {render.preset}</span>
                      {render.seed && <span><strong>Seed:</strong> {render.seed}</span>}
                      {render.renderTime && <span><strong>Time:</strong> {render.renderTime}s</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const link = document.createElement('a')
                          link.href = render.imageUrl
                          link.download = `blender-${render.preset}-${render.timestamp}.png`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: BlenderGenShape.PRIMARY_COLOR,
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
                        }}
                      >
                        <span>⬇️</span> Download
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newHistory = shape.props.renderHistory.filter(r => r.id !== render.id)
                          editor.updateShape<IBlenderGen>({
                            id: shape.id,
                            type: "BlenderGen",
                            props: { renderHistory: newHistory },
                          })
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#333',
                          border: '1px solid #444',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: '#999',
                        }}
                        title="Remove from history"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {shape.props.renderHistory.length === 0 && !shape.props.isLoading && !shape.props.error && (
                <div style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#2a2a2a",
                  borderRadius: "6px",
                  color: "#666",
                  fontSize: "13px",
                  border: '1px solid #3a3a3a',
                  minHeight: '120px',
                  gap: '8px',
                }}>
                  <span style={{ fontSize: '32px' }}>🎬</span>
                  <span>Select a preset and click Render</span>
                </div>
              )}
            </div>

            {/* Error Display */}
            {shape.props.error && (
              <div style={{
                padding: "8px 12px",
                backgroundColor: "#3a2020",
                border: "1px solid #5a3030",
                borderRadius: "6px",
                color: "#f88",
                fontSize: "12px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}>
                <span style={{ fontSize: "14px" }}>⚠️</span>
                <span style={{ flex: 1 }}>{shape.props.error}</span>
                <button
                  onClick={() => {
                    editor.updateShape<IBlenderGen>({
                      id: shape.id,
                      type: "BlenderGen",
                      props: { error: null },
                    })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    padding: "2px 6px",
                    backgroundColor: "#5a3030",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "10px",
                    color: "#f88",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

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

  override indicator(shape: IBlenderGen) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={6}
      />
    )
  }
}
