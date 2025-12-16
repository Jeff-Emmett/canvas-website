import { useEffect, useRef } from 'react'
import { Editor, TLShapeId, getIndexAbove } from 'tldraw'

export interface PinnedViewOptions {
  /**
   * The position to pin the shape at.
   * - 'current': Keep at current screen position (default)
   * - 'top-center': Pin to top center of viewport
   * - 'bottom-center': Pin to bottom center of viewport
   * - 'center': Pin to center of viewport
   */
  position?: 'current' | 'top-center' | 'bottom-center' | 'center'
  /**
   * Offset from the edge (for top-center, bottom-center positions)
   */
  offsetY?: number
  offsetX?: number
}

/**
 * Hook to manage shapes pinned to the viewport.
 * When a shape is pinned, it stays in the same screen position AND visual size
 * as the camera moves and zooms. Content inside the shape remains unchanged.
 *
 * Uses tldraw's 'tick' event for synchronous updates with the render cycle,
 * ensuring the shape never visually lags behind camera movements.
 */
export function usePinnedToView(
  editor: Editor | null,
  shapeId: string | undefined,
  isPinned: boolean,
  options: PinnedViewOptions = {}
) {
  const { position = 'current', offsetY = 0, offsetX = 0 } = options
  const pinnedScreenPositionRef = useRef<{ x: number; y: number } | null>(null)
  const originalCoordinatesRef = useRef<{ x: number; y: number } | null>(null)
  const wasPinnedRef = useRef<boolean>(false)
  const isUpdatingRef = useRef<boolean>(false)
  const driftAnimationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor || !shapeId) {
      return
    }

    const shape = editor.getShape(shapeId as TLShapeId)
    if (!shape) return

    // If just became pinned (transition from false to true)
    if (isPinned && !wasPinnedRef.current) {
      // Store the original coordinates - these will be restored when unpinned
      originalCoordinatesRef.current = { x: shape.x, y: shape.y }

      // Store the original zoom level in shape meta for CSS transform calculation
      const currentCamera = editor.getCamera()

      // Store original zoom in meta so StandardizedToolWrapper can access it
      editor.updateShape({
        id: shapeId as TLShapeId,
        type: shape.type,
        meta: {
          ...shape.meta,
          pinnedAtZoom: currentCamera.z,
          originalX: shape.x,
          originalY: shape.y,
        },
      })

      // Calculate screen position based on position option
      let screenPoint: { x: number; y: number }
      const viewport = editor.getViewportScreenBounds()
      const shapeWidth = (shape.props as any).w || 0
      const shapeHeight = (shape.props as any).h || 0

      if (position === 'top-center') {
        screenPoint = {
          x: viewport.x + (viewport.w / 2) - (shapeWidth * currentCamera.z / 2) + offsetX,
          y: viewport.y + offsetY,
        }
      } else if (position === 'bottom-center') {
        screenPoint = {
          x: viewport.x + (viewport.w / 2) - (shapeWidth * currentCamera.z / 2) + offsetX,
          y: viewport.y + viewport.h - (shapeHeight * currentCamera.z) - offsetY,
        }
      } else if (position === 'center') {
        screenPoint = {
          x: viewport.x + (viewport.w / 2) - (shapeWidth * currentCamera.z / 2) + offsetX,
          y: viewport.y + (viewport.h / 2) - (shapeHeight * currentCamera.z / 2) + offsetY,
        }
      } else {
        // Default: use current position
        const pagePoint = { x: shape.x, y: shape.y }
        screenPoint = editor.pageToScreen(pagePoint)
      }

      pinnedScreenPositionRef.current = { x: screenPoint.x, y: screenPoint.y }

      // Bring the shape to the front
      try {
        const allShapes = editor.getCurrentPageShapes()
        let highestIndex = shape.index
        for (const s of allShapes) {
          if (s.id !== shape.id && s.index > highestIndex) {
            highestIndex = s.index
          }
        }
        if (highestIndex > shape.index) {
          const newIndex = getIndexAbove(highestIndex)
          editor.updateShape({
            id: shapeId as TLShapeId,
            type: shape.type,
            index: newIndex,
          })
        }
      } catch (error) {
        console.error('Error bringing pinned shape to front:', error)
      }
    }

    // If just became unpinned, animate back to original coordinates
    if (!isPinned && wasPinnedRef.current) {
      // Get original coordinates from meta
      const currentShape = editor.getShape(shapeId as TLShapeId)
      if (currentShape) {
        const originalX = (currentShape.meta as any)?.originalX ?? originalCoordinatesRef.current?.x ?? currentShape.x
        const originalY = (currentShape.meta as any)?.originalY ?? originalCoordinatesRef.current?.y ?? currentShape.y

        const startX = currentShape.x
        const startY = currentShape.y
        const targetX = originalX
        const targetY = originalY

        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2)
        )

        if (distance > 1) {
          // Animation parameters
          const duration = 600 // 600ms for a calm drift
          const startTime = performance.now()

          const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

          const animateDrift = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const easedProgress = easeOutCubic(progress)

            const currentX = startX + (targetX - startX) * easedProgress
            const currentY = startY + (targetY - startY) * easedProgress

            try {
              editor.updateShape({
                id: shapeId as TLShapeId,
                type: currentShape.type,
                x: currentX,
                y: currentY,
              })
            } catch (error) {
              console.error('Error during drift animation:', error)
              driftAnimationRef.current = null
              return
            }

            if (progress < 1) {
              driftAnimationRef.current = requestAnimationFrame(animateDrift)
            } else {
              // Animation complete - clear pinned meta data
              try {
                // Create new meta without pinned properties (don't use undefined)
                const { pinnedAtZoom, originalX, originalY, ...cleanMeta } = (currentShape.meta || {}) as any
                editor.updateShape({
                  id: shapeId as TLShapeId,
                  type: currentShape.type,
                  x: targetX,
                  y: targetY,
                  meta: cleanMeta,
                })
              } catch (error) {
                console.error('Error setting final position:', error)
              }
              driftAnimationRef.current = null
            }
          }

          driftAnimationRef.current = requestAnimationFrame(animateDrift)
        } else {
          // Distance is too small, just set directly and clear meta
          try {
            // Create new meta without pinned properties (don't use undefined)
            const { pinnedAtZoom, originalX, originalY, ...cleanMeta } = (currentShape.meta || {}) as any
            editor.updateShape({
              id: shapeId as TLShapeId,
              type: currentShape.type,
              x: targetX,
              y: targetY,
              meta: cleanMeta,
            })
          } catch (error) {
            console.error('Error restoring original coordinates:', error)
          }
        }
      }

      // Clear refs
      setTimeout(() => {
        pinnedScreenPositionRef.current = null
        originalCoordinatesRef.current = null
      }, 50)
    }

    wasPinnedRef.current = isPinned

    if (!isPinned) {
      return
    }

    // Use tldraw's tick event for synchronous updates with the render cycle
    // This ensures the shape position is updated BEFORE rendering, eliminating visual lag
    const handleTick = () => {
      if (isUpdatingRef.current || !editor || !shapeId || !isPinned) {
        return
      }

      const currentShape = editor.getShape(shapeId as TLShapeId)
      if (!currentShape) {
        return
      }

      // Get the target screen position
      let pinnedScreenPos: { x: number; y: number }

      if (position !== 'current') {
        const viewport = editor.getViewportScreenBounds()
        const currentCamera = editor.getCamera()
        const shapeWidth = (currentShape.props as any).w || 0
        const shapeHeight = (currentShape.props as any).h || 0
        const pinnedAtZoom = (currentShape.meta as any)?.pinnedAtZoom || currentCamera.z

        // For preset positions, account for the visual scale
        const visualScale = pinnedAtZoom / currentCamera.z
        const visualWidth = shapeWidth * visualScale
        const visualHeight = shapeHeight * visualScale

        if (position === 'top-center') {
          pinnedScreenPos = {
            x: viewport.x + (viewport.w / 2) - (visualWidth * currentCamera.z / 2) + offsetX,
            y: viewport.y + offsetY,
          }
        } else if (position === 'bottom-center') {
          pinnedScreenPos = {
            x: viewport.x + (viewport.w / 2) - (visualWidth * currentCamera.z / 2) + offsetX,
            y: viewport.y + viewport.h - (visualHeight * currentCamera.z) - offsetY,
          }
        } else if (position === 'center') {
          pinnedScreenPos = {
            x: viewport.x + (viewport.w / 2) - (visualWidth * currentCamera.z / 2) + offsetX,
            y: viewport.y + (viewport.h / 2) - (visualHeight * currentCamera.z / 2) + offsetY,
          }
        } else {
          pinnedScreenPos = pinnedScreenPositionRef.current!
        }
      } else {
        if (!pinnedScreenPositionRef.current) {
          return
        }
        pinnedScreenPos = pinnedScreenPositionRef.current
      }

      try {
        // Convert screen position back to page coordinates
        const newPagePoint = editor.screenToPage(pinnedScreenPos)

        // Check if position needs updating (with small tolerance to avoid unnecessary updates)
        const deltaX = Math.abs(currentShape.x - newPagePoint.x)
        const deltaY = Math.abs(currentShape.y - newPagePoint.y)

        if (deltaX > 0.01 || deltaY > 0.01) {
          isUpdatingRef.current = true

          editor.updateShape({
            id: shapeId as TLShapeId,
            type: currentShape.type,
            x: newPagePoint.x,
            y: newPagePoint.y,
          })

          isUpdatingRef.current = false
        }
      } catch (error) {
        console.error('Error updating pinned shape position:', error)
        isUpdatingRef.current = false
      }
    }

    // Subscribe to tick event for synchronous updates
    editor.on('tick', handleTick)

    // Also do an immediate update to sync position
    handleTick()

    return () => {
      if (driftAnimationRef.current) {
        cancelAnimationFrame(driftAnimationRef.current)
        driftAnimationRef.current = null
      }
      editor.off('tick', handleTick)
    }
  }, [editor, shapeId, isPinned, position, offsetX, offsetY])
}
