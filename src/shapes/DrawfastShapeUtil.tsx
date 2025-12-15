/**
 * Drawfast Shape - AI-Enhanced Sketch Frame
 * A drawing frame that captures sketches and generates AI-enhanced versions in real-time
 * Based on draw-fast/tldraw implementation, adapted for canvas-website with Automerge sync
 */

import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from "tldraw"
import { useState, useEffect } from "react"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"
import { useLiveImage, useLiveImageContext } from "../hooks/useLiveImage"

export type IDrawfastShape = TLBaseShape<
  "Drawfast",
  {
    w: number
    h: number
    prompt: string
    generatedImageUrl: string | null
    overlayMode: boolean // true = overlay result on sketch, false = side by side
    isGenerating: boolean
    autoGenerate: boolean // true = real-time, false = manual button
    strength: number // 0-1, how much to transform the sketch
    pinnedToView: boolean
    tags: string[]
  }
>

export class DrawfastShape extends BaseBoxShapeUtil<IDrawfastShape> {
  static override type = "Drawfast" as const

  // Drawfast theme color: Cyan (AI/Creative)
  static readonly PRIMARY_COLOR = "#06b6d4"

  getDefaultProps(): IDrawfastShape["props"] {
    return {
      w: 512,
      h: 512,
      prompt: "",
      generatedImageUrl: null,
      overlayMode: true,
      isGenerating: false,
      autoGenerate: false, // Start with manual mode for easier debugging
      strength: 0.65,
      pinnedToView: false,
      tags: ['ai', 'sketch', 'drawing'],
    }
  }

  // Lock aspect ratio for consistent AI generation
  override isAspectRatioLocked = () => true

  indicator(shape: IDrawfastShape) {
    return (
      <rect
        x={0}
        y={0}
        width={shape.props.w}
        height={shape.props.h}
        fill="none"
        stroke={DrawfastShape.PRIMARY_COLOR}
        strokeWidth={2}
        strokeDasharray="8 4"
      />
    )
  }

  component(shape: IDrawfastShape) {
    const editor = this.editor
    const [isMinimized, setIsMinimized] = useState(false)
    const [localPrompt, setLocalPrompt] = useState(shape.props.prompt)
    const isSelected = editor.getSelectedShapeIds().includes(shape.id)

    // Check if Fal.ai is configured
    let liveImageContext: ReturnType<typeof useLiveImageContext> | null = null
    try {
      liveImageContext = useLiveImageContext()
    } catch {
      // Provider not available, will show setup UI
    }

    // Use pinning hook
    usePinnedToView(editor, shape.id, shape.props.pinnedToView)

    // Use maximize hook
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'Drawfast',
    })

    // Use live image generation (only when auto-generate is on)
    const liveImageState = useLiveImage({
      editor,
      shapeId: shape.id,
      prompt: shape.props.prompt,
      enabled: shape.props.autoGenerate && !!liveImageContext?.isConnected,
      throttleMs: 500,
      model: 'lcm',
      strength: shape.props.strength,
      onResult: (imageUrl) => {
        editor.updateShape<IDrawfastShape>({
          id: shape.id,
          type: 'Drawfast',
          props: {
            generatedImageUrl: imageUrl,
            isGenerating: false,
          },
        })
      },
      onError: (error) => {
        console.error('Drawfast generation error:', error)
        editor.updateShape<IDrawfastShape>({
          id: shape.id,
          type: 'Drawfast',
          props: {
            isGenerating: false,
          },
        })
      },
    })

    // Sync local prompt with shape prop
    useEffect(() => {
      setLocalPrompt(shape.props.prompt)
    }, [shape.props.prompt])

    const handleClose = () => {
      editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      editor.updateShape<IDrawfastShape>({
        id: shape.id,
        type: shape.type,
        props: {
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handlePromptChange = (newPrompt: string) => {
      setLocalPrompt(newPrompt)
    }

    const handlePromptSubmit = () => {
      editor.updateShape<IDrawfastShape>({
        id: shape.id,
        type: 'Drawfast',
        props: {
          prompt: localPrompt,
        },
      })
    }

    const handleToggleOverlay = () => {
      editor.updateShape<IDrawfastShape>({
        id: shape.id,
        type: 'Drawfast',
        props: {
          overlayMode: !shape.props.overlayMode,
        },
      })
    }

    const handleToggleAutoGenerate = () => {
      editor.updateShape<IDrawfastShape>({
        id: shape.id,
        type: 'Drawfast',
        props: {
          autoGenerate: !shape.props.autoGenerate,
        },
      })
    }

    const handleManualGenerate = async () => {
      if (!liveImageContext?.isConnected) {
        alert('Please configure your Fal.ai API key first')
        return
      }

      editor.updateShape<IDrawfastShape>({
        id: shape.id,
        type: 'Drawfast',
        props: {
          isGenerating: true,
        },
      })

      // The useLiveImage hook will handle the generation when we trigger it
      // For manual mode, we'll call the generation directly
      try {
        const { fal } = await import('@fal-ai/client')

        // Get shapes inside this frame
        const bounds = editor.getShapePageBounds(shape.id)
        if (!bounds) return

        const allShapes = editor.getCurrentPageShapes()
        const childShapes = allShapes.filter(s => {
          if (s.id === shape.id) return false
          const shapeBounds = editor.getShapePageBounds(s.id)
          if (!shapeBounds) return false
          return bounds.contains(shapeBounds) || bounds.collides(shapeBounds)
        })

        if (childShapes.length === 0) {
          console.log('Drawfast: No shapes to capture')
          editor.updateShape<IDrawfastShape>({
            id: shape.id,
            type: 'Drawfast',
            props: { isGenerating: false },
          })
          return
        }

        // Export shapes to blob
        const { exportToBlob } = await import('tldraw')
        const blob = await exportToBlob({
          editor,
          ids: childShapes.map(s => s.id),
          format: 'jpeg',
          opts: {
            background: true,
            padding: 0,
            scale: 1,
          },
        })

        // Convert to data URL
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        const fullPrompt = shape.props.prompt
          ? `${shape.props.prompt}, hd, award-winning, impressive, detailed`
          : 'hd, award-winning, impressive, detailed illustration'

        console.log('Drawfast: Generating with prompt:', fullPrompt)

        const result = await fal.subscribe('fal-ai/lcm-sd15-i2i', {
          input: {
            prompt: fullPrompt,
            image_url: imageDataUrl,
            strength: shape.props.strength,
            sync_mode: true,
            seed: 42,
            num_inference_steps: 4,
            guidance_scale: 1,
            enable_safety_checks: false,
          },
          pollInterval: 1000,
          logs: true,
        })

        // Extract image URL
        let imageUrl: string | null = null
        const data = result.data as any
        if (data?.images?.[0]?.url) {
          imageUrl = data.images[0].url
        } else if (data?.images?.[0]) {
          imageUrl = data.images[0]
        } else if (data?.image?.url) {
          imageUrl = data.image.url
        } else if (data?.image) {
          imageUrl = data.image
        }

        if (imageUrl) {
          console.log('Drawfast: Generated image:', imageUrl)
          editor.updateShape<IDrawfastShape>({
            id: shape.id,
            type: 'Drawfast',
            props: {
              generatedImageUrl: imageUrl,
              isGenerating: false,
            },
          })
        } else {
          throw new Error('No image URL in response')
        }
      } catch (error) {
        console.error('Drawfast generation error:', error)
        editor.updateShape<IDrawfastShape>({
          id: shape.id,
          type: 'Drawfast',
          props: { isGenerating: false },
        })
      }
    }

    const handleStrengthChange = (newStrength: number) => {
      editor.updateShape<IDrawfastShape>({
        id: shape.id,
        type: 'Drawfast',
        props: {
          strength: newStrength,
        },
      })
    }

    // Custom header content
    const headerContent = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span style={{ fontSize: '14px' }}>✏️</span>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Drawfast</span>
        {(shape.props.isGenerating || liveImageState.isGenerating) && (
          <span style={{
            fontSize: '10px',
            color: DrawfastShape.PRIMARY_COLOR,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            Generating...
          </span>
        )}
      </div>
    )

    // Show API key setup if not configured
    const showApiKeySetup = !liveImageContext?.isConnected

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="Drawfast"
          headerContent={headerContent}
          primaryColor={DrawfastShape.PRIMARY_COLOR}
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
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            editor.updateShape<IDrawfastShape>({
              id: shape.id,
              type: 'Drawfast',
              props: { tags: newTags },
            })
          }}
          tagsEditable={true}
        >
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#1a1a2e',
            overflow: 'hidden',
          }}>
            {/* Drawing Area / Result Display */}
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fff',
              overflow: 'hidden',
            }}>
              {/* Generated Image (if available and overlay mode) */}
              {shape.props.generatedImageUrl && shape.props.overlayMode && (
                <img
                  src={shape.props.generatedImageUrl}
                  alt="AI Generated"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    opacity: 0.9,
                    zIndex: 10,
                  }}
                />
              )}

              {/* Instructions when empty */}
              {!shape.props.generatedImageUrl && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: '14px',
                  padding: '20px',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>✏️</div>
                  <div>Draw inside this frame</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#999' }}>
                    Use the pencil, pen, or other tools to sketch
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {(shape.props.isGenerating || liveImageState.isGenerating) && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '16px 24px',
                  borderRadius: '8px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    border: '3px solid rgba(255,255,255,0.3)',
                    borderTopColor: DrawfastShape.PRIMARY_COLOR,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Generating...
                </div>
              )}
            </div>

            {/* Side-by-side result (when not overlay mode) */}
            {shape.props.generatedImageUrl && !shape.props.overlayMode && (
              <div style={{
                height: '40%',
                borderTop: '2px solid #333',
                backgroundColor: '#111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src={shape.props.generatedImageUrl}
                  alt="AI Generated"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}

            {/* Controls */}
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#1a1a2e',
              borderTop: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {/* API Key Setup */}
              {showApiKeySetup && (
                <div style={{
                  padding: '8px',
                  backgroundColor: '#2a2a3e',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#aaa',
                }}>
                  <div style={{ marginBottom: '4px', color: '#ff9500' }}>
                    Fal.ai API key not configured
                  </div>
                  <input
                    type="password"
                    placeholder="Enter FAL_KEY..."
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #444',
                      backgroundColor: '#1a1a2e',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value
                        if (value && liveImageContext) {
                          liveImageContext.setApiKey(value)
                        }
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <div style={{ marginTop: '4px', fontSize: '10px' }}>
                    Get your key at <a href="https://fal.ai" target="_blank" style={{ color: DrawfastShape.PRIMARY_COLOR }}>fal.ai</a>
                  </div>
                </div>
              )}

              {/* Prompt Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={localPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  onBlur={handlePromptSubmit}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                      handlePromptSubmit()
                      if (!shape.props.autoGenerate) {
                        handleManualGenerate()
                      }
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Describe the style..."
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    backgroundColor: '#2a2a3e',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                {!shape.props.autoGenerate && (
                  <button
                    onClick={handleManualGenerate}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={shape.props.isGenerating || !liveImageContext?.isConnected}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: shape.props.isGenerating ? '#444' : DrawfastShape.PRIMARY_COLOR,
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: shape.props.isGenerating ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {shape.props.isGenerating ? '...' : '✨ Generate'}
                  </button>
                )}
              </div>

              {/* Settings Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '11px',
                color: '#888',
              }}>
                {/* Strength Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Strength:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={shape.props.strength}
                    onChange={(e) => handleStrengthChange(parseFloat(e.target.value))}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ width: '60px', accentColor: DrawfastShape.PRIMARY_COLOR }}
                  />
                  <span>{Math.round(shape.props.strength * 100)}%</span>
                </div>

                {/* Auto-generate toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shape.props.autoGenerate}
                    onChange={handleToggleAutoGenerate}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ accentColor: DrawfastShape.PRIMARY_COLOR }}
                  />
                  Real-time
                </label>

                {/* Overlay toggle */}
                <button
                  onClick={handleToggleOverlay}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    backgroundColor: shape.props.overlayMode ? DrawfastShape.PRIMARY_COLOR : '#2a2a3e',
                    color: '#fff',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {shape.props.overlayMode ? 'Overlay' : 'Side-by-side'}
                </button>
              </div>
            </div>
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
}
