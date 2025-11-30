import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useCallback, useState } from "react"
import * as React from "react"

export type ISharedPianoShape = TLBaseShape<
  "SharedPiano",
  {
    w: number
    h: number
    isMinimized?: boolean
    interactionState?: {
      scrollPosition?: { x: number; y: number }
    }
  }
>

const getDefaultDimensions = (): { w: number; h: number } => {
  // Default dimensions for the Shared Piano (16:9 ratio)
  return { w: 800, h: 600 }
}

export class SharedPianoShape extends BaseBoxShapeUtil<ISharedPianoShape> {
  static override type = "SharedPiano"

  getDefaultProps(): ISharedPianoShape["props"] {
    const { w, h } = getDefaultDimensions()
    return {
      w,
      h,
      isMinimized: false,
    }
  }

  indicator(shape: ISharedPianoShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        fill="none"
        stroke="var(--color-selected)"
        strokeWidth={2}
      />
    )
  }

  component(shape: ISharedPianoShape) {
    // Guard against undefined shape or props
    if (!shape || !shape.props) {
      return null
    }

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Suppress Chrome Music Lab console errors
    React.useEffect(() => {
      const originalError = console.error
      const originalWarn = console.warn
      
      // Filter out errors from Chrome Music Lab
      const errorHandler = (message: any, ...args: any[]) => {
        const messageStr = String(message)
        if (messageStr.includes('musiclab.chromeexperiments.com') || 
            messageStr.includes('Uncaught (in promise) false')) {
          // Suppress these errors silently
          return
        }
        originalError(message, ...args)
      }
      
      const warnHandler = (message: any, ...args: any[]) => {
        const messageStr = String(message)
        if (messageStr.includes('musiclab.chromeexperiments.com')) {
          // Suppress these warnings silently
          return
        }
        originalWarn(message, ...args)
      }
      
      // Override console methods
      console.error = errorHandler
      console.warn = warnHandler
      
      // Also catch unhandled promise rejections from the iframe
      const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
        const reason = event.reason
        if (reason === false || 
            (typeof reason === 'string' && reason.includes('musiclab.chromeexperiments.com'))) {
          event.preventDefault()
          return
        }
      }
      
      window.addEventListener('unhandledrejection', unhandledRejectionHandler)
      
      return () => {
        // Restore original console methods
        console.error = originalError
        console.warn = originalWarn
        window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
      }
    }, [])

    const handleIframeLoad = useCallback(() => {
      setIsLoading(false)
      setError(null)
    }, [])

    const handleIframeError = useCallback(() => {
      setIsLoading(false)
      setError("Failed to load Shared Piano. Please check your browser permissions for MIDI and audio access.")
    }, [])

    const handleToggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!shape.props) return
      this.editor.updateShape<ISharedPianoShape>({
        id: shape.id,
        type: "SharedPiano",
        props: {
          ...shape.props,
          isMinimized: !shape.props.isMinimized,
        },
      })
    }

    const isMinimized = shape.props?.isMinimized ?? false

    const controls = (
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          display: "flex",
          gap: 4,
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={handleToggleMinimize}
          style={{
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {isMinimized ? "🔽" : "🔼"}
        </button>
      </div>
    )

    const sharedPianoUrl = "https://musiclab.chromeexperiments.com/Shared-Piano/#jQB715bFJ"

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          border: "1px solid var(--color-panel)",
          backgroundColor: "var(--color-background)",
          zIndex: 1,
          pointerEvents: "auto",
        }}
      >
        {controls}
        
        {isMinimized ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            🎹 Shared Piano
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>
            {isLoading && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--color-background)",
                  zIndex: 3,
                  pointerEvents: "auto",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎹</div>
                  <div>Loading Shared Piano...</div>
                </div>
              </div>
            )}
            
            {error && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--color-background)",
                  zIndex: 3,
                  pointerEvents: "auto",
                }}
              >
                <div style={{ textAlign: "center", color: "var(--color-text)" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>❌</div>
                  <div>{error}</div>
                  <button
                    onClick={() => {
                      setIsLoading(true)
                      setError(null)
                      // Force iframe reload
                      const iframe = document.querySelector(`iframe[data-shape-id="${shape.id}"]`) as HTMLIFrameElement
                      if (iframe) {
                        iframe.src = iframe.src
                      }
                    }}
                    style={{
                      marginTop: "8px",
                      padding: "4px 8px",
                      background: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            
            <iframe
              data-shape-id={shape.id}
              src={sharedPianoUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: "8px",
                opacity: isLoading ? 0 : 1,
                transition: "opacity 0.3s ease",
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 2,
                pointerEvents: "auto",
              }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Chrome Music Lab Shared Piano"
              allow="microphone; camera; midi; autoplay; encrypted-media; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            />
          </div>
        )}
      </div>
    )
  }

  override onDoubleClick = (shape: ISharedPianoShape) => {
    // Toggle minimized state on double click
    this.editor.updateShape<ISharedPianoShape>({
      id: shape.id,
      type: "SharedPiano",
      props: {
        ...shape.props,
        isMinimized: !shape.props.isMinimized,
      },
    })
  }

  onPointerDown = (_shape: ISharedPianoShape) => {
    // Handle pointer down events if needed
  }

  override onBeforeCreate = (shape: ISharedPianoShape): ISharedPianoShape | void => {
    // Set default dimensions if not provided
    // Return the modified shape instead of calling updateShape (which causes infinite loops)
    if (!shape.props.w || !shape.props.h) {
      const { w, h } = getDefaultDimensions()
      return {
        ...shape,
        props: {
          ...shape.props,
          w: shape.props.w || w,
          h: shape.props.h || h,
        },
      }
    }
  }

  onBeforeUpdate = (_prev: ISharedPianoShape, _next: ISharedPianoShape) => {
    // Handle any updates if needed
  }
} 