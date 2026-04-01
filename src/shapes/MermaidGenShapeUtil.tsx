import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from "tldraw"
import React, { useState, useEffect, useRef, useCallback } from "react"
import { getOllamaConfig } from "@/lib/clientConfig"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"

const MERMAID_ANIMATOR_URL = "https://mermaid.jeffemmett.com"

interface MermaidDiagram {
  id: string
  prompt: string
  source: string
  svgHtml: string | null
  gifBase64: string | null
  timestamp: number
}

type IMermaidGen = TLBaseShape<
  "MermaidGen",
  {
    w: number
    h: number
    prompt: string
    diagramSource: string
    diagramHistory: MermaidDiagram[]
    isLoading: boolean
    loadingPrompt: string | null
    error: string | null
    animationMode: "progressive" | "template" | "sequence"
    animationDelay: number
    theme: "default" | "dark" | "forest" | "neutral"
    showCode: boolean
    tags: string[]
    pinnedToView: boolean
  }
>

/**
 * Render mermaid code to SVG using the mermaid library (client-side).
 * Dynamically imports mermaid to avoid SSR issues.
 */
async function renderMermaidSvg(code: string, theme: string = "default"): Promise<string> {
  const mermaid = (await import("mermaid")).default
  mermaid.initialize({ startOnLoad: false, theme: theme as any, securityLevel: "loose" })
  const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const { svg } = await mermaid.render(id, code)
  return svg
}

export class MermaidGenShape extends BaseBoxShapeUtil<IMermaidGen> {
  static override type = "MermaidGen" as const

  static readonly PRIMARY_COLOR = "#7C3AED"

  MIN_WIDTH = 400 as const
  MIN_HEIGHT = 350 as const
  DEFAULT_WIDTH = 600 as const
  DEFAULT_HEIGHT = 500 as const

  getDefaultProps(): IMermaidGen["props"] {
    return {
      w: this.DEFAULT_WIDTH,
      h: this.DEFAULT_HEIGHT,
      prompt: "",
      diagramSource: "",
      diagramHistory: [],
      isLoading: false,
      loadingPrompt: null,
      error: null,
      animationMode: "progressive",
      animationDelay: 800,
      theme: "default",
      showCode: false,
      tags: ["diagram", "mermaid", "ai-generated"],
      pinnedToView: false,
    }
  }

  getGeometry(shape: IMermaidGen): Geometry2d {
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    })
  }

  component(shape: IMermaidGen) {
    const editor = this.editor
    const isSelected = editor.getSelectedShapeIds().includes(shape.id)

    usePinnedToView(editor, shape.id, shape.props.pinnedToView)

    const { isMaximized, toggleMaximize } = useMaximize({
      editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: "MermaidGen",
    })

    const handlePinToggle = () => {
      editor.updateShape<IMermaidGen>({
        id: shape.id,
        type: "MermaidGen",
        props: { pinnedToView: !shape.props.pinnedToView },
      })
    }

    const [isMinimized, setIsMinimized] = useState(false)
    const [svgPreview, setSvgPreview] = useState<string | null>(null)
    const [isAnimating, setIsAnimating] = useState(false)
    const svgContainerRef = useRef<HTMLDivElement>(null)

    const handleClose = () => editor.deleteShape(shape.id)
    const handleMinimize = () => setIsMinimized(!isMinimized)

    const handleTagsChange = (newTags: string[]) => {
      editor.updateShape<IMermaidGen>({
        id: shape.id,
        type: "MermaidGen",
        props: { tags: newTags },
      })
    }

    // Re-render SVG when diagramSource or theme changes
    useEffect(() => {
      if (!shape.props.diagramSource) {
        setSvgPreview(null)
        return
      }
      let cancelled = false
      renderMermaidSvg(shape.props.diagramSource, shape.props.theme)
        .then((svg) => {
          if (!cancelled) setSvgPreview(svg)
        })
        .catch((err) => {
          if (!cancelled) setSvgPreview(null)
          console.error("Mermaid render error:", err)
        })
      return () => { cancelled = true }
    }, [shape.props.diagramSource, shape.props.theme])

    // Generate diagram from prompt via Ollama
    const generateDiagram = useCallback(async (prompt: string) => {
      const ollamaConfig = getOllamaConfig()
      if (!ollamaConfig) {
        editor.updateShape<IMermaidGen>({
          id: shape.id,
          type: "MermaidGen",
          props: { error: "Ollama not configured" },
        })
        return
      }

      editor.updateShape<IMermaidGen>({
        id: shape.id,
        type: "MermaidGen",
        props: { isLoading: true, loadingPrompt: prompt, error: null },
      })

      try {
        const response = await fetch(`${ollamaConfig.url}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama3.1:8b",
            prompt: `Generate a Mermaid diagram for: ${prompt}\n\nRules:\n- Output ONLY valid mermaid diagram code\n- No explanation, no markdown fences, no comments\n- Use graph TD, sequenceDiagram, classDiagram, flowchart, etc. as appropriate\n- Keep it clear and well-structured`,
            system: "You are a Mermaid diagram generator. Output ONLY valid mermaid diagram code, no explanation, no markdown code fences.",
            stream: false,
          }),
        })

        if (!response.ok) {
          throw new Error(`Ollama error: ${response.status}`)
        }

        const data = (await response.json()) as { response?: string }
        let mermaidCode = (data.response || "").trim()

        // Strip markdown fences if the model included them
        mermaidCode = mermaidCode
          .replace(/^```mermaid\s*/i, "")
          .replace(/^```\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim()

        if (!mermaidCode) {
          throw new Error("No diagram code returned from LLM")
        }

        // Render SVG to validate
        const svg = await renderMermaidSvg(mermaidCode, shape.props.theme)

        const currentShape = editor.getShape<IMermaidGen>(shape.id)
        const currentHistory = currentShape?.props.diagramHistory || []

        const newDiagram: MermaidDiagram = {
          id: `dia-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          prompt,
          source: mermaidCode,
          svgHtml: svg,
          gifBase64: null,
          timestamp: Date.now(),
        }

        editor.updateShape<IMermaidGen>({
          id: shape.id,
          type: "MermaidGen",
          props: {
            diagramSource: mermaidCode,
            diagramHistory: [newDiagram, ...currentHistory],
            isLoading: false,
            loadingPrompt: null,
            error: null,
          },
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        editor.updateShape<IMermaidGen>({
          id: shape.id,
          type: "MermaidGen",
          props: { isLoading: false, loadingPrompt: null, error: `Error: ${msg}` },
        })
      }
    }, [editor, shape.id, shape.props.theme])

    // Animate GIF via mermaid-animator API
    const animateGif = useCallback(async () => {
      if (!shape.props.diagramSource) return

      setIsAnimating(true)
      editor.updateShape<IMermaidGen>({
        id: shape.id,
        type: "MermaidGen",
        props: { error: null },
      })

      try {
        const response = await fetch(`${MERMAID_ANIMATOR_URL}/api/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: shape.props.diagramSource,
            mode: shape.props.animationMode,
            delay: shape.props.animationDelay,
            theme: shape.props.theme,
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Animation API error: ${response.status} - ${errText}`)
        }

        const data = (await response.json()) as { gif: string; frames: number; width: number; height: number }

        // Update the latest history entry with the GIF
        const currentShape = editor.getShape<IMermaidGen>(shape.id)
        const history = [...(currentShape?.props.diagramHistory || [])]
        if (history.length > 0) {
          history[0] = { ...history[0], gifBase64: data.gif }
        }

        editor.updateShape<IMermaidGen>({
          id: shape.id,
          type: "MermaidGen",
          props: { diagramHistory: history },
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        editor.updateShape<IMermaidGen>({
          id: shape.id,
          type: "MermaidGen",
          props: { error: `Animation error: ${msg}` },
        })
      } finally {
        setIsAnimating(false)
      }
    }, [editor, shape.id, shape.props.diagramSource, shape.props.animationMode, shape.props.animationDelay, shape.props.theme])

    const handleGenerate = () => {
      if (shape.props.prompt.trim() && !shape.props.isLoading) {
        generateDiagram(shape.props.prompt)
        editor.updateShape<IMermaidGen>({
          id: shape.id,
          type: "MermaidGen",
          props: { prompt: "" },
        })
      }
    }

    // Handle code edit and live re-render
    const handleCodeChange = useCallback(async (newCode: string) => {
      editor.updateShape<IMermaidGen>({
        id: shape.id,
        type: "MermaidGen",
        props: { diagramSource: newCode },
      })
    }, [editor, shape.id])

    const latestGif = shape.props.diagramHistory[0]?.gifBase64

    return (
      <HTMLContainer id={shape.id}>
        <StandardizedToolWrapper
          title="Mermaid Generator"
          primaryColor={MermaidGenShape.PRIMARY_COLOR}
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
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                Mermaid Generator
                <span style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  color: MermaidGenShape.PRIMARY_COLOR,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}>
                  Generating...
                </span>
              </span>
            ) : undefined
          }
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "12px",
              gap: "10px",
              overflow: "auto",
              backgroundColor: "#fafafa",
            }}
          >
            {/* Preview Area */}
            <div
              ref={svgContainerRef}
              style={{
                flex: 1,
                minHeight: "120px",
                backgroundColor: "#fff",
                borderRadius: "6px",
                border: "1px solid #e0e0e0",
                overflow: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Loading spinner */}
              {shape.props.isLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40,
                    border: "4px solid #f3f3f3",
                    borderTop: `4px solid ${MermaidGenShape.PRIMARY_COLOR}`,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }} />
                  <span style={{ color: "#666", fontSize: "14px" }}>
                    {shape.props.loadingPrompt ? `Generating: ${shape.props.loadingPrompt.slice(0, 40)}...` : "Generating diagram..."}
                  </span>
                </div>
              )}

              {/* Animated GIF (takes priority over SVG when available) */}
              {!shape.props.isLoading && latestGif && (
                <img
                  src={`data:image/gif;base64,${latestGif}`}
                  alt="Animated diagram"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              )}

              {/* SVG preview */}
              {!shape.props.isLoading && !latestGif && svgPreview && (
                <div
                  dangerouslySetInnerHTML={{ __html: svgPreview }}
                  style={{ maxWidth: "100%", maxHeight: "100%", overflow: "auto", padding: "8px" }}
                />
              )}

              {/* Animating overlay */}
              {isAnimating && (
                <div style={{
                  position: "absolute", inset: 0,
                  backgroundColor: "rgba(255,255,255,0.85)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <div style={{
                    width: 32, height: 32,
                    border: "3px solid #f3f3f3",
                    borderTop: `3px solid ${MermaidGenShape.PRIMARY_COLOR}`,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }} />
                  <span style={{ color: "#666", fontSize: "12px" }}>Creating animation...</span>
                </div>
              )}

              {/* Empty state */}
              {!shape.props.isLoading && !svgPreview && !latestGif && (
                <span style={{ color: "#999", fontSize: "14px" }}>
                  Describe a diagram or write mermaid code below
                </span>
              )}
            </div>

            {/* Controls Bar */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
                flexShrink: 0,
              }}
            >
              {/* Mode selector */}
              <select
                value={shape.props.animationMode}
                onChange={(e) => {
                  editor.updateShape<IMermaidGen>({
                    id: shape.id,
                    type: "MermaidGen",
                    props: { animationMode: e.target.value as any },
                  })
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  padding: "4px 8px", fontSize: "12px",
                  border: "1px solid #ddd", borderRadius: "4px",
                  backgroundColor: "#fff", cursor: "pointer",
                }}
              >
                <option value="progressive">Progressive</option>
                <option value="template">Template</option>
                <option value="sequence">Sequence</option>
              </select>

              {/* Delay slider */}
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#666" }}>
                Delay:
                <input
                  type="range"
                  min={100}
                  max={2000}
                  step={100}
                  value={shape.props.animationDelay}
                  onChange={(e) => {
                    editor.updateShape<IMermaidGen>({
                      id: shape.id,
                      type: "MermaidGen",
                      props: { animationDelay: Number(e.target.value) },
                    })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ width: "80px", cursor: "pointer" }}
                />
                <span style={{ minWidth: "36px" }}>{shape.props.animationDelay}ms</span>
              </label>

              {/* Theme picker */}
              <select
                value={shape.props.theme}
                onChange={(e) => {
                  editor.updateShape<IMermaidGen>({
                    id: shape.id,
                    type: "MermaidGen",
                    props: { theme: e.target.value as any },
                  })
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  padding: "4px 8px", fontSize: "12px",
                  border: "1px solid #ddd", borderRadius: "4px",
                  backgroundColor: "#fff", cursor: "pointer",
                }}
              >
                <option value="default">Default</option>
                <option value="dark">Dark</option>
                <option value="forest">Forest</option>
                <option value="neutral">Neutral</option>
              </select>

              {/* Toggle code/prompt button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  editor.updateShape<IMermaidGen>({
                    id: shape.id,
                    type: "MermaidGen",
                    props: { showCode: !shape.props.showCode },
                  })
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  padding: "4px 10px", fontSize: "12px",
                  border: "1px solid #ddd", borderRadius: "4px",
                  backgroundColor: shape.props.showCode ? MermaidGenShape.PRIMARY_COLOR : "#fff",
                  color: shape.props.showCode ? "#fff" : "#666",
                  cursor: "pointer", fontWeight: 500,
                  marginLeft: "auto",
                }}
              >
                {shape.props.showCode ? "Prompt" : "Code"}
              </button>
            </div>

            {/* Input Section — prompt mode or code editor mode */}
            {shape.props.showCode ? (
              /* Code editor */
              <textarea
                style={{
                  minHeight: "80px",
                  height: "100px",
                  backgroundColor: "#1e1e2e",
                  color: "#cdd6f4",
                  border: "1px solid #45475a",
                  borderRadius: "6px",
                  fontSize: 13,
                  padding: "10px",
                  fontFamily: "monospace",
                  resize: "vertical",
                  lineHeight: "1.5",
                  flexShrink: 0,
                }}
                value={shape.props.diagramSource}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="graph TD&#10;  A[Start] --> B[End]"
                spellCheck={false}
              />
            ) : (
              /* Prompt input */
              <div
                style={{
                  display: "flex",
                  flexDirection: shape.props.w < 400 ? "column" : "row",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <textarea
                  style={{
                    flex: 1,
                    minHeight: "48px",
                    height: "48px",
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
                  placeholder="Describe the diagram you want..."
                  value={shape.props.prompt}
                  onChange={(e) => {
                    editor.updateShape<IMermaidGen>({
                      id: shape.id,
                      type: "MermaidGen",
                      props: { prompt: e.target.value },
                    })
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleGenerate()
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  disabled={shape.props.isLoading}
                />
                <button
                  style={{
                    height: "48px",
                    padding: "0 16px",
                    cursor: shape.props.prompt.trim() && !shape.props.isLoading ? "pointer" : "not-allowed",
                    backgroundColor: shape.props.prompt.trim() && !shape.props.isLoading ? MermaidGenShape.PRIMARY_COLOR : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    opacity: shape.props.prompt.trim() && !shape.props.isLoading ? 1 : 0.6,
                    touchAction: "manipulation",
                    minWidth: shape.props.w < 400 ? "100%" : "100px",
                    minHeight: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleGenerate()
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleGenerate()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleGenerate()
                  }}
                  disabled={shape.props.isLoading || !shape.props.prompt.trim()}
                >
                  Generate
                </button>
              </div>
            )}

            {/* Action Buttons — Animate + Download */}
            {shape.props.diagramSource && (
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); animateGif() }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  disabled={isAnimating || !shape.props.diagramSource}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    backgroundColor: isAnimating ? "#ccc" : "#fff",
                    border: `1px solid ${MermaidGenShape.PRIMARY_COLOR}`,
                    borderRadius: "6px",
                    cursor: isAnimating ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: MermaidGenShape.PRIMARY_COLOR,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    minHeight: "40px",
                  }}
                >
                  {isAnimating ? "Animating..." : "Animate GIF"}
                </button>

                {latestGif && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const link = document.createElement("a")
                      link.href = `data:image/gif;base64,${latestGif}`
                      const slug = (shape.props.diagramHistory[0]?.prompt || "diagram")
                        .slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                      link.download = `${slug}-${new Date().toISOString().slice(0, 10)}.gif`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      backgroundColor: MermaidGenShape.PRIMARY_COLOR,
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      minHeight: "40px",
                    }}
                  >
                    Download GIF
                  </button>
                )}
              </div>
            )}

            {/* History */}
            {shape.props.diagramHistory.length > 1 && (
              <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: "6px" }}>
                  History ({shape.props.diagramHistory.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflow: "auto" }}>
                  {shape.props.diagramHistory.slice(1).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 8px",
                        backgroundColor: "#fff",
                        borderRadius: "4px",
                        border: "1px solid #e8e8e8",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        editor.updateShape<IMermaidGen>({
                          id: shape.id,
                          type: "MermaidGen",
                          props: { diagramSource: item.source },
                        })
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {item.gifBase64 ? (
                        <img
                          src={`data:image/gif;base64,${item.gifBase64}`}
                          alt=""
                          style={{ width: 40, height: 30, objectFit: "cover", borderRadius: 3 }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 30, backgroundColor: "#f0f0f0", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#aaa" }}>
                          SVG
                        </div>
                      )}
                      <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#555" }}>
                        {item.prompt || item.source.slice(0, 50)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newHistory = shape.props.diagramHistory.filter((d) => d.id !== item.id)
                          editor.updateShape<IMermaidGen>({
                            id: shape.id,
                            type: "MermaidGen",
                            props: { diagramHistory: newHistory },
                          })
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          padding: "2px 6px", backgroundColor: "transparent",
                          border: "none", cursor: "pointer", color: "#bbb", fontSize: "14px",
                        }}
                        title="Remove"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
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
                <span style={{ flex: 1, lineHeight: "1.4" }}>{shape.props.error}</span>
                <button
                  onClick={() => {
                    editor.updateShape<IMermaidGen>({
                      id: shape.id,
                      type: "MermaidGen",
                      props: { error: null },
                    })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    padding: "2px 6px",
                    backgroundColor: "#fcc",
                    border: "1px solid #c99",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "10px",
                    flexShrink: 0,
                    minWidth: "32px",
                    minHeight: "32px",
                  }}
                >
                  x
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

  override indicator(shape: IMermaidGen) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={6}
      />
    )
  }
}
