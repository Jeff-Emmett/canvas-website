import { useEffect } from "react"
import { Editor, TLEventMap, TLFrameShape, TLParentId, TLShapeId } from "tldraw"
import { useSearchParams } from "react-router-dom"

// Define camera state interface
interface CameraState {
  x: number
  y: number
  z: number
}

const MAX_HISTORY = 10
let cameraHistory: CameraState[] = []

// TODO: use this

// Improved camera change tracking with debouncing
const trackCameraChange = (editor: Editor) => {
  const currentCamera = editor.getCamera()
  const lastPosition = cameraHistory[cameraHistory.length - 1]

  // Store any viewport change that's not from a revert operation
  if (
    !lastPosition ||
    currentCamera.x !== lastPosition.x ||
    currentCamera.y !== lastPosition.y ||
    currentCamera.z !== lastPosition.z
  ) {
    cameraHistory.push({ ...currentCamera })
    if (cameraHistory.length > MAX_HISTORY) {
      cameraHistory.shift()
    }
  }
}

export function useCameraControls(editor: Editor | null) {
  const [searchParams] = useSearchParams()

  // Handle URL-based camera positioning
  useEffect(() => {
    if (!editor || !editor.store || !editor.getInstanceState().isFocused) {
      console.log("Editor not ready:", {
        editor: !!editor,
        store: !!editor?.store,
        isFocused: editor?.getInstanceState().isFocused,
      })
      return
    }

    const x = searchParams.get("x")
    const y = searchParams.get("y")
    const zoom = searchParams.get("zoom")
    const frameId = searchParams.get("frameId")
    const isLocked = searchParams.get("isLocked") === "true"

    console.log("Setting camera:", { x, y, zoom, frameId, isLocked })

    // Set camera position if coordinates exist
    if (x && y && zoom) {
      const position = {
        x: Math.round(parseFloat(x)),
        y: Math.round(parseFloat(y)),
        z: Math.round(parseFloat(zoom)),
      }
      console.log("Camera position:", position)

      requestAnimationFrame(() => {
        editor.setCamera(position, { animation: { duration: 0 } })

        // Apply camera lock immediately after setting position if needed
        if (isLocked) {
          editor.setCameraOptions({ isLocked: true })
        }

        console.log("Current camera:", editor.getCamera())
      })
    }

    // Handle frame-specific logic
    if (frameId) {
      const frame = editor.getShape(frameId as TLShapeId)
      if (frame) {
        editor.select(frameId as TLShapeId)

        // If x/y/zoom are not provided in URL, zoom to frame bounds
        if (!x || !y || !zoom) {
          const bounds = editor.getShapePageBounds(frame)!
          const viewportPageBounds = editor.getViewportPageBounds()
          const targetZoom = Math.min(
            viewportPageBounds.width / bounds.width,
            viewportPageBounds.height / bounds.height,
            1, // Cap at 1x zoom, matching lockCameraToFrame
          )

          editor.zoomToBounds(bounds, {
            animation: { duration: 0 },
            targetZoom,
          })
        }

        // Apply camera lock after camera is positioned
        if (isLocked) {
          requestAnimationFrame(() => {
            editor.setCameraOptions({ isLocked: true })
          })
        }
      }
    }
  }, [editor, searchParams])

  // Track camera changes
  useEffect(() => {
    if (!editor) return

    const handler = () => {
      trackCameraChange(editor)
    }

    // Track both viewport changes and user interaction end
    editor.on("viewportChange" as keyof TLEventMap, handler)
    editor.on("userChangeEnd" as keyof TLEventMap, handler)

    return () => {
      editor.off("viewportChange" as keyof TLEventMap, handler)
      editor.off("userChangeEnd" as keyof TLEventMap, handler)
    }
  }, [editor])

  // Enhanced camera control functions
  return {
    zoomToFrame: (frameId: string) => {
      if (!editor) return
      const frame = editor.getShape(frameId as TLParentId) as TLFrameShape
      if (!frame) return

      editor.zoomToBounds(editor.getShapePageBounds(frame)!, {
        inset: 32,
        animation: { duration: 500 },
      })
    },

    copyLocationLink: () => {
      if (!editor) return
      const camera = editor.getCamera()
      const url = new URL(window.location.href)
      url.searchParams.set("x", Math.round(camera.x).toString())
      url.searchParams.set("y", Math.round(camera.y).toString())
      url.searchParams.set("zoom", Math.round(camera.z).toString())
      navigator.clipboard.writeText(url.toString())
    },

    copyFrameLink: (frameId: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set("frameId", frameId)
      navigator.clipboard.writeText(url.toString())
    },

    revertCamera: () => {
      if (!editor || cameraHistory.length === 0) return
      const previousCamera = cameraHistory.pop()
      if (previousCamera) {
        editor.setCamera(previousCamera, { animation: { duration: 200 } })
      }
    },
  }
}
