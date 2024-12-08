import { Editor, TLShapeId } from "tldraw"

export const handleInitialPageLoad = (editor: Editor) => {
  // Wait for editor to be ready
  // if (!editor.isMounted()) {
  //   editor.once("mount", () => handleInitialPageLoad(editor))
  //   return
  // }

  const url = new URL(window.location.href)
  console.log("URL params:", {
    x: url.searchParams.get("x"),
    y: url.searchParams.get("y"),
    zoom: url.searchParams.get("zoom"),
  })

  // Get camera parameters first
  const x = url.searchParams.get("x")
  const y = url.searchParams.get("y")
  const zoom = url.searchParams.get("zoom")

  // Set camera position if coordinates exist
  if (x && y && zoom) {
    console.log("Setting camera to:", {
      x: parseFloat(x),
      y: parseFloat(y),
      z: parseFloat(zoom),
    })

    requestAnimationFrame(() => {
      editor.setCamera({
        x: parseFloat(x),
        y: parseFloat(y),
        z: parseFloat(zoom),
      })
    })
  }

  // Get shape/frame parameters last
  const frameId = url.searchParams.get("frameId")
  const isLocked = url.searchParams.get("isLocked") === "true"

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
}
