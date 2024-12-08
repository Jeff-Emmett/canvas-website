import { Editor, TLShapeId } from "tldraw"

export const handleInitialPageLoad = (editor: Editor) => {
  const url = new URL(window.location.href)

  // Get camera parameters first
  const x = url.searchParams.get("x")
  const y = url.searchParams.get("y")
  const zoom = url.searchParams.get("zoom")

  // Get shape/frame parameters last
  const frameId = url.searchParams.get("frameId")
  const shapeId = url.searchParams.get("shapeId")
  const isLocked = url.searchParams.get("isLocked") === "true"

  // Wait for next tick to ensure editor is ready
  requestAnimationFrame(() => {
    // Set camera position if coordinates exist
    if (x && y && zoom) {
      editor.setCamera({
        x: parseFloat(x),
        y: parseFloat(y),
        z: parseFloat(zoom),
      })
    }

    // Handle frame-specific logic
    if (frameId) {
      const frame = editor.getShape(frameId as TLShapeId)
      if (frame) {
        editor.select(frameId as TLShapeId)

        // If x/y/zoom are not provided in URL, zoom to frame bounds
        if (!x || !y || !zoom) {
          editor.zoomToBounds(editor.getShapePageBounds(frame)!, {
            animation: { duration: 0 },
            targetZoom: 1,
          })
        }

        // Apply camera lock after camera is positioned
        if (isLocked) {
          // Use requestAnimationFrame to ensure camera is set before locking
          requestAnimationFrame(() => {
            editor.setCameraOptions({
              isLocked: true,
              // Optional: you may want to also set these options for locked frames
              //shouldSnapToGrid: false,
              //shouldUseEdgeScrolling: false,
            })
          })
        }
      } else {
        console.warn("Frame not found:", frameId)
      }
    }
    // Handle shape-specific logic
    else if (shapeId) {
      const shape = editor.getShape(shapeId as TLShapeId)
      if (shape) {
        editor.select(shapeId as TLShapeId)
      } else {
        console.warn("Shape not found:", shapeId)
      }
    }
  })
}
