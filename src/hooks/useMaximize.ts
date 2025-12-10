import { useState, useCallback, useRef, useEffect } from 'react'
import { Editor, TLShapeId } from 'tldraw'

interface OriginalDimensions {
  x: number
  y: number
  w: number
  h: number
}

interface UseMaximizeOptions {
  /** Editor instance */
  editor: Editor
  /** Shape ID to maximize */
  shapeId: TLShapeId
  /** Current width of the shape */
  currentW: number
  /** Current height of the shape */
  currentH: number
  /** Shape type for updateShape call */
  shapeType: string
  /** Padding from viewport edges in pixels */
  padding?: number
}

interface UseMaximizeReturn {
  /** Whether the shape is currently maximized */
  isMaximized: boolean
  /** Toggle maximize state */
  toggleMaximize: () => void
}

/**
 * Hook to enable maximize/fullscreen functionality for shapes.
 * When maximized, the shape fills the viewport.
 * Press Esc or click maximize again to restore original size.
 */
export function useMaximize({
  editor,
  shapeId,
  currentW,
  currentH,
  shapeType,
  padding = 40,
}: UseMaximizeOptions): UseMaximizeReturn {
  const [isMaximized, setIsMaximized] = useState(false)
  const originalDimensionsRef = useRef<OriginalDimensions | null>(null)

  const toggleMaximize = useCallback(() => {
    if (!editor || !shapeId) return

    const shape = editor.getShape(shapeId)
    if (!shape) return

    if (isMaximized) {
      // Restore original dimensions
      const original = originalDimensionsRef.current
      if (original) {
        editor.updateShape({
          id: shapeId,
          type: shapeType,
          x: original.x,
          y: original.y,
          props: {
            w: original.w,
            h: original.h,
          },
        })
      }
      originalDimensionsRef.current = null
      setIsMaximized(false)
    } else {
      // Store current dimensions before maximizing
      originalDimensionsRef.current = {
        x: shape.x,
        y: shape.y,
        w: currentW,
        h: currentH,
      }

      // Get viewport bounds in page coordinates
      const viewportBounds = editor.getViewportPageBounds()

      // Calculate new dimensions to fill viewport with padding
      const newX = viewportBounds.x + padding
      const newY = viewportBounds.y + padding
      const newW = viewportBounds.width - (padding * 2)
      const newH = viewportBounds.height - (padding * 2)

      editor.updateShape({
        id: shapeId,
        type: shapeType,
        x: newX,
        y: newY,
        props: {
          w: newW,
          h: newH,
        },
      })

      // Center the view on the maximized shape
      editor.centerOnPoint({ x: newX + newW / 2, y: newY + newH / 2 })

      setIsMaximized(true)
    }
  }, [editor, shapeId, shapeType, currentW, currentH, padding, isMaximized])

  // Clean up when shape is deleted or unmounted
  useEffect(() => {
    return () => {
      originalDimensionsRef.current = null
    }
  }, [])

  // Reset maximize state if shape dimensions change externally while maximized
  useEffect(() => {
    if (isMaximized && originalDimensionsRef.current) {
      const shape = editor.getShape(shapeId)
      if (!shape) {
        setIsMaximized(false)
        originalDimensionsRef.current = null
      }
    }
  }, [editor, shapeId, isMaximized])

  return {
    isMaximized,
    toggleMaximize,
  }
}
