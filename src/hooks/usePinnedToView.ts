import { useEffect, useRef } from 'react'
import { Editor, TLShapeId } from 'tldraw'

/**
 * Hook to manage shapes pinned to the viewport.
 * When a shape is pinned, it stays in the same screen position as the camera moves.
 */
export function usePinnedToView(editor: Editor | null, shapeId: string | undefined, isPinned: boolean) {
  const pinnedScreenPositionRef = useRef<{ x: number; y: number } | null>(null)
  const originalCoordinatesRef = useRef<{ x: number; y: number } | null>(null)
  const originalSizeRef = useRef<{ w: number; h: number } | null>(null)
  const originalZoomRef = useRef<number | null>(null)
  const wasPinnedRef = useRef<boolean>(false)
  const isUpdatingRef = useRef<boolean>(false)
  const animationFrameRef = useRef<number | null>(null)
  const lastCameraRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const pendingUpdateRef = useRef<{ x: number; y: number } | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const driftAnimationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor || !shapeId) {
      return
    }

    const shape = editor.getShape(shapeId as TLShapeId)
    if (!shape) return

    // If just became pinned (transition from false to true), capture the current screen position
    if (isPinned && !wasPinnedRef.current) {
      // Store the original coordinates - these will be restored when unpinned
      originalCoordinatesRef.current = { x: shape.x, y: shape.y }
      
      // Store the original size and zoom - needed to maintain constant visual size
      const currentCamera = editor.getCamera()
      originalSizeRef.current = { 
        w: (shape.props as any).w || 0, 
        h: (shape.props as any).h || 0 
      }
      originalZoomRef.current = currentCamera.z
      
      // Get the shape's current page position (top-left corner)
      const pagePoint = { x: shape.x, y: shape.y }
      // Convert to screen coordinates - this is where we want the shape to stay
      const screenPoint = editor.pageToScreen(pagePoint)
      
      pinnedScreenPositionRef.current = { x: screenPoint.x, y: screenPoint.y }
      lastCameraRef.current = { ...currentCamera }
      
      // Bring the shape to the front by setting its index higher than all other shapes
      try {
        const allShapes = editor.getCurrentPageShapes()
        let highestIndex = 'a0'
        
        // Find the highest index among all shapes
        for (const s of allShapes) {
          if (s.index && typeof s.index === 'string') {
            // Compare string indices (fractional indexing)
            // Higher alphabetical order = higher z-index
            if (s.index > highestIndex) {
              highestIndex = s.index
            }
          }
        }
        
        // Bring the shape to the front by manually setting index
        // Note: sendToFront doesn't exist in this version of tldraw, so we use manual index setting
        try {
          // Try to set a safe index value
          // Use conservative values that are known to work (a1, a2, b1, etc.)
          let newIndex: string = 'a2' // Safe default
          
          // Try to find a valid index higher than existing ones
          const allIndices = allShapes
            .map(s => s.index)
            .filter((idx): idx is string => typeof idx === 'string' && /^[a-z]\d+$/.test(idx))
            .sort()
          
          if (allIndices.length > 0) {
            const highest = allIndices[allIndices.length - 1]
            const match = highest.match(/^([a-z])(\d+)$/)
            if (match) {
              const letter = match[1]
              const num = parseInt(match[2], 10)
              // Increment number, or move to next letter if number gets too high
              if (num < 100) {
                newIndex = `${letter}${num + 1}`
              } else if (letter < 'y') {
                const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1)
                newIndex = `${nextLetter}1`
              } else {
                // Use a safe value if we're running out of letters
                newIndex = 'a2'
              }
            }
          }
          
          // Validate before using
          if (/^[a-z]\d+$/.test(newIndex)) {
            editor.updateShape({
              id: shapeId as TLShapeId,
              type: shape.type,
              index: newIndex as any,
            })
          }
        }
      } catch (error) {
        console.error('Error bringing pinned shape to front:', error)
      }
    }

    // If just became unpinned, animate back to original coordinates
    if (!isPinned && wasPinnedRef.current) {
      // Cancel any ongoing pinned position updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      
      // Animate back to original coordinates and size with a calm drift
      if (originalCoordinatesRef.current && originalSizeRef.current && originalZoomRef.current !== null) {
        const currentShape = editor.getShape(shapeId as TLShapeId)
        if (currentShape) {
          const startX = currentShape.x
          const startY = currentShape.y
          const targetX = originalCoordinatesRef.current.x
          const targetY = originalCoordinatesRef.current.y
          
          // Return to the exact original size (not calculated based on current zoom)
          const originalW = originalSizeRef.current.w
          const originalH = originalSizeRef.current.h
          
          // Use the original size directly
          const targetW = originalW
          const targetH = originalH
          
          const currentW = (currentShape.props as any).w || originalW
          const currentH = (currentShape.props as any).h || originalH
          
          const startW = currentW
          const startH = currentH
          
          // Only animate if there's a meaningful distance to travel or size change
          const distance = Math.sqrt(
            Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2)
          )
          const sizeChange = Math.abs(targetW - startW) > 0.1 || Math.abs(targetH - startH) > 0.1
          
          if (distance > 1 || sizeChange) {
            // Animation parameters
            const duration = 600 // 600ms for a calm drift
            const startTime = performance.now()
            
            // Easing function: ease-out for a calm deceleration
            const easeOutCubic = (t: number): number => {
              return 1 - Math.pow(1 - t, 3)
            }
            
            const animateDrift = (currentTime: number) => {
              const elapsed = currentTime - startTime
              const progress = Math.min(elapsed / duration, 1) // Clamp to 0-1
              const easedProgress = easeOutCubic(progress)
              
              // Interpolate position
              const currentX = startX + (targetX - startX) * easedProgress
              const currentY = startY + (targetY - startY) * easedProgress
              
              // Interpolate size
              const currentW = startW + (targetW - startW) * easedProgress
              const currentH = startH + (targetH - startH) * easedProgress
              
              try {
                editor.updateShape({
                  id: shapeId as TLShapeId,
                  type: currentShape.type,
                  x: currentX,
                  y: currentY,
                  props: {
                    ...currentShape.props,
                    w: currentW,
                    h: currentH,
                  },
                })
              } catch (error) {
                console.error('Error during drift animation:', error)
                driftAnimationRef.current = null
                return
              }
              
              // Continue animation if not complete
              if (progress < 1) {
                driftAnimationRef.current = requestAnimationFrame(animateDrift)
              } else {
                // Animation complete - ensure we're exactly at target
                try {
                  editor.updateShape({
                    id: shapeId,
                    type: currentShape.type,
                    x: targetX,
                    y: targetY,
                    props: {
                      ...currentShape.props,
                      w: targetW,
                      h: targetH,
                    },
                  })
                  console.log(`📍 Drifted back to original coordinates: (${targetX}, ${targetY}) and size: (${targetW}, ${targetH})`)
                } catch (error) {
                  console.error('Error setting final position/size:', error)
                }
                driftAnimationRef.current = null
              }
            }
            
            // Start the animation
            driftAnimationRef.current = requestAnimationFrame(animateDrift)
          } else {
            // Distance is too small, just set directly
            try {
              editor.updateShape({
                id: shapeId,
                type: currentShape.type,
                x: targetX,
                y: targetY,
                props: {
                  ...currentShape.props,
                  w: targetW,
                  h: targetH,
                },
              })
            } catch (error) {
              console.error('Error restoring original coordinates/size:', error)
            }
          }
        }
      }
      
      // Clear refs after a short delay to allow animation to start
      setTimeout(() => {
        pinnedScreenPositionRef.current = null
        originalCoordinatesRef.current = null
        originalSizeRef.current = null
        originalZoomRef.current = null
        lastCameraRef.current = null
        pendingUpdateRef.current = null
      }, 50)
    }

    wasPinnedRef.current = isPinned

    if (!isPinned) {
      return
    }

    // Use requestAnimationFrame for smooth, continuous updates
    // Throttle updates to reduce jitter
    const updatePinnedPosition = (timestamp: number) => {
      if (isUpdatingRef.current) {
        animationFrameRef.current = requestAnimationFrame(updatePinnedPosition)
        return
      }
      
      if (!editor || !shapeId || !isPinned) {
        return
      }
      
      const currentShape = editor.getShape(shapeId as TLShapeId)
      if (!currentShape) {
        animationFrameRef.current = requestAnimationFrame(updatePinnedPosition)
        return
      }

      const pinnedScreenPos = pinnedScreenPositionRef.current
      if (!pinnedScreenPos) {
        animationFrameRef.current = requestAnimationFrame(updatePinnedPosition)
        return
      }

      const currentCamera = editor.getCamera()
      const lastCamera = lastCameraRef.current

      // Check if camera has changed significantly
      const cameraChanged = !lastCamera || (
        Math.abs(currentCamera.x - lastCamera.x) > 0.1 ||
        Math.abs(currentCamera.y - lastCamera.y) > 0.1 ||
        Math.abs(currentCamera.z - lastCamera.z) > 0.001
      )

      if (cameraChanged) {
        // Throttle updates to max 60fps (every ~16ms)
        const timeSinceLastUpdate = timestamp - lastUpdateTimeRef.current
        const minUpdateInterval = 16 // ~60fps

        if (timeSinceLastUpdate >= minUpdateInterval) {
          try {
            // Convert the pinned screen position back to page coordinates
            const newPagePoint = editor.screenToPage(pinnedScreenPos)
            
            // Calculate delta
            const deltaX = Math.abs(currentShape.x - newPagePoint.x)
            const deltaY = Math.abs(currentShape.y - newPagePoint.y)
            
            // Check if zoom changed - if so, adjust size to maintain constant visual size
            const zoomChanged = lastCamera && Math.abs(currentCamera.z - lastCamera.z) > 0.001
            let needsSizeUpdate = false
            let newW = (currentShape.props as any).w
            let newH = (currentShape.props as any).h
            
            if (zoomChanged && originalSizeRef.current && originalZoomRef.current !== null) {
              // Calculate the size needed to maintain constant visual size
              // Visual size = page size * zoom
              // To keep visual size constant: new_page_size = (original_page_size * original_zoom) / new_zoom
              const originalW = originalSizeRef.current.w
              const originalH = originalSizeRef.current.h
              const originalZoom = originalZoomRef.current
              const currentZoom = currentCamera.z
              
              newW = (originalW * originalZoom) / currentZoom
              newH = (originalH * originalZoom) / currentZoom
              
              const currentW = (currentShape.props as any).w || originalW
              const currentH = (currentShape.props as any).h || originalH
              
              // Check if size needs updating
              needsSizeUpdate = Math.abs(newW - currentW) > 0.1 || Math.abs(newH - currentH) > 0.1
            }
            
            // Only update if the position would actually change significantly or size needs updating
            if (deltaX > 0.5 || deltaY > 0.5 || needsSizeUpdate) {
              isUpdatingRef.current = true
              
              // Batch the update using editor.batch for smoother updates
              editor.batch(() => {
                const updateData: any = {
                  id: shapeId,
                  type: currentShape.type,
                  x: newPagePoint.x,
                  y: newPagePoint.y,
                }
                
                // Only update size if it changed
                if (needsSizeUpdate) {
                  updateData.props = {
                    ...currentShape.props,
                    w: newW,
                    h: newH,
                  }
                }
                
                editor.updateShape(updateData)
              })
              
              lastUpdateTimeRef.current = timestamp
              isUpdatingRef.current = false
            }

            lastCameraRef.current = { ...currentCamera }
          } catch (error) {
            console.error('Error updating pinned shape position/size:', error)
            isUpdatingRef.current = false
          }
        }
      }

      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(updatePinnedPosition)
    }

    // Start the animation loop
    lastUpdateTimeRef.current = performance.now()
    animationFrameRef.current = requestAnimationFrame(updatePinnedPosition)

    // Also listen for shape changes (in case user drags the shape while pinned)
    // This updates the pinned position to the new location
    const handleShapeChange = (event: any) => {
      if (isUpdatingRef.current) return // Don't update if we're programmatically moving it
      
      if (!editor || !shapeId || !isPinned) return
      
      // Only respond to changes that affect this specific shape
      const changedShapes = event?.changedShapes || event?.shapes || []
      const shapeChanged = changedShapes.some((s: any) => s?.id === (shapeId as TLShapeId))
      
      if (!shapeChanged) return
      
      const currentShape = editor.getShape(shapeId as TLShapeId)
      if (!currentShape) return

      // Update the pinned screen position to the shape's current screen position
      const pagePoint = { x: currentShape.x, y: currentShape.y }
      const screenPoint = editor.pageToScreen(pagePoint)
      pinnedScreenPositionRef.current = { x: screenPoint.x, y: screenPoint.y }
      lastCameraRef.current = { ...editor.getCamera() }
    }

    // Listen for shape updates (when user drags the shape)
    editor.on('change' as any, handleShapeChange)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (driftAnimationRef.current) {
        cancelAnimationFrame(driftAnimationRef.current)
        driftAnimationRef.current = null
      }
      editor.off('change' as any, handleShapeChange)
    }
  }, [editor, shapeId, isPinned])
}

