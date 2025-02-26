import { useEffect } from "react"
import { Editor, TLEventMap, TLFrameShape, TLParentId } from "tldraw"
import { cameraHistory } from "@/ui/cameraUtils"

// Define camera state interface
interface CameraState {
  x: number
  y: number
  z: number
}

const MAX_HISTORY = 10

// Track camera changes
const trackCameraChange = (editor: Editor) => {
  const currentCamera = editor.getCamera()
  const lastPosition = cameraHistory[cameraHistory.length - 1]

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
  // Track camera changes
  useEffect(() => {
    if (!editor) return

    const handler = () => {
      trackCameraChange(editor)
    }

    editor.on("viewportChange" as keyof TLEventMap, handler)
    editor.on("userChangeEnd" as keyof TLEventMap, handler)

    return () => {
      editor.off("viewportChange" as keyof TLEventMap, handler)
      editor.off("userChangeEnd" as keyof TLEventMap, handler)
    }
  }, [editor])

  // Camera control functions
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
