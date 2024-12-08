import { Editor } from "tldraw"

export const cameraHistory: { x: number; y: number; z: number }[] = []
const MAX_HISTORY = 10 // Keep last 10 camera positions

// Helper function to store camera position
const storeCameraPosition = (editor: Editor) => {
  const currentCamera = editor.getCamera()
  // Only store if there's a meaningful change from the last position
  const lastPosition = cameraHistory[cameraHistory.length - 1]
  if (
    !lastPosition ||
    Math.abs(lastPosition.x - currentCamera.x) > 1 ||
    Math.abs(lastPosition.y - currentCamera.y) > 1 ||
    Math.abs(lastPosition.z - currentCamera.z) > 0.1
  ) {
    cameraHistory.push({ ...currentCamera })
    if (cameraHistory.length > MAX_HISTORY) {
      cameraHistory.shift()
    }
    console.log("Stored camera position:", currentCamera)
  }
}

export const zoomToSelection = (editor: Editor) => {
  // Store camera position before zooming
  storeCameraPosition(editor)

  // Get all selected shape IDs
  const selectedIds = editor.getSelectedShapeIds()
  if (selectedIds.length === 0) return

  // Get the common bounds that encompass all selected shapes
  const commonBounds = editor.getSelectionPageBounds()
  if (!commonBounds) return

  // Calculate viewport dimensions
  const viewportPageBounds = editor.getViewportPageBounds()

  // Calculate the ratio of selection size to viewport size
  const widthRatio = commonBounds.width / viewportPageBounds.width
  const heightRatio = commonBounds.height / viewportPageBounds.height

  // Calculate target zoom based on selection size
  let targetZoom
  if (widthRatio < 0.1 || heightRatio < 0.1) {
    // For very small selections, zoom in up to 20x
    targetZoom = Math.min(
      (viewportPageBounds.width * 0.8) / commonBounds.width,
      (viewportPageBounds.height * 0.8) / commonBounds.height,
      40, // Max zoom of 20x for small selections
    )
  } else if (widthRatio > 1 || heightRatio > 1) {
    // For selections larger than viewport, zoom out more
    targetZoom = Math.min(
      (viewportPageBounds.width * 0.7) / commonBounds.width,
      (viewportPageBounds.height * 0.7) / commonBounds.height,
      0.125, // Min zoom of 1/8x for large selections (reciprocal of 8)
    )
  } else {
    // For medium-sized selections, allow up to 10x zoom
    targetZoom = Math.min(
      (viewportPageBounds.width * 0.8) / commonBounds.width,
      (viewportPageBounds.height * 0.8) / commonBounds.height,
      20, // Medium zoom level
    )
  }

  // Zoom to the common bounds
  editor.zoomToBounds(commonBounds, {
    targetZoom,
    inset: widthRatio > 1 || heightRatio > 1 ? 20 : 50, // Less padding for large selections
    animation: {
      duration: 400,
      easing: (t) => t * (2 - t),
    },
  })

  // Update URL with new camera position and first selected shape ID
  const newCamera = editor.getCamera()
  const url = new URL(window.location.href)
  url.searchParams.set("shapeId", selectedIds[0].toString())
  url.searchParams.set("x", newCamera.x.toString())
  url.searchParams.set("y", newCamera.y.toString())
  url.searchParams.set("zoom", newCamera.z.toString())
  window.history.replaceState(null, "", url.toString())
}

export const revertCamera = (editor: Editor) => {
  if (cameraHistory.length > 0) {
    const previousCamera = cameraHistory.pop()
    if (previousCamera) {
      // Get current viewport bounds
      const viewportPageBounds = editor.getViewportPageBounds()

      // Create bounds that center on the previous camera position
      const targetBounds = {
        x: previousCamera.x - viewportPageBounds.width / 2 / previousCamera.z,
        y: previousCamera.y - viewportPageBounds.height / 2 / previousCamera.z,
        w: viewportPageBounds.width / previousCamera.z,
        h: viewportPageBounds.height / previousCamera.z,
      }

      // Use the same zoom animation as zoomToShape
      editor.zoomToBounds(targetBounds, {
        targetZoom: previousCamera.z,
        animation: {
          duration: 400,
          easing: (t) => t * (2 - t),
        },
      })

      console.log("Reverted to camera position:", previousCamera)
    }
  } else {
    console.log("No camera history available")
  }
}

export const copyLinkToCurrentView = async (editor: Editor) => {
  console.log("Starting copyLinkToCurrentView")

  if (!editor.store.serialize()) {
    console.warn("Store not ready")
    return
  }

  try {
    const baseUrl = `${window.location.origin}${window.location.pathname}`
    console.log("Base URL:", baseUrl)

    const url = new URL(baseUrl)
    const camera = editor.getCamera()
    console.log("Current camera position:", {
      x: camera.x,
      y: camera.y,
      zoom: camera.z,
    })

    // Set camera parameters first
    url.searchParams.set("x", camera.x.toString())
    url.searchParams.set("y", camera.y.toString())
    url.searchParams.set("zoom", camera.z.toString())

    // Add shape ID last if needed
    const selectedIds = editor.getSelectedShapeIds()
    if (selectedIds.length > 0) {
      url.searchParams.set("shapeId", selectedIds[0].toString())
    }

    const finalUrl = url.toString()
    console.log("Final URL to copy:", finalUrl)

    if (navigator.clipboard && window.isSecureContext) {
      console.log("Using modern clipboard API...")
      await navigator.clipboard.writeText(finalUrl)
      console.log("URL copied successfully using clipboard API")
    } else {
      console.log("Falling back to legacy clipboard method...")
      const textArea = document.createElement("textarea")
      textArea.value = finalUrl
      document.body.appendChild(textArea)
      try {
        await navigator.clipboard.writeText(textArea.value)
      } catch (err) {
        console.error("Clipboard API failed:", err)
      }
      document.body.removeChild(textArea)
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error)
    alert("Failed to copy link. Please check clipboard permissions.")
  }
}

/** TODO: doesnt UNlock */
export const lockCameraToFrame = async (editor: Editor) => {
  const selectedShapes = editor.getSelectedShapes()
  if (selectedShapes.length === 0) return
  const selectedShape = selectedShapes[0]
  const isFrame = selectedShape.type === "frame"
  const bounds = editor.getShapePageBounds(selectedShape)
  if (!isFrame || !bounds) return

  try {
    const baseUrl = `${window.location.origin}${window.location.pathname}`
    const url = new URL(baseUrl)

    // Calculate zoom level to fit the frame
    const viewportPageBounds = editor.getViewportPageBounds()
    const targetZoom = Math.min(
      viewportPageBounds.width / bounds.width,
      viewportPageBounds.height / bounds.height,
      1, // Cap at 1x zoom
    )

    // Set camera parameters first
    url.searchParams.set("x", bounds.x.toString())
    url.searchParams.set("y", bounds.y.toString())
    url.searchParams.set("zoom", targetZoom.toString())

    // Add frame-specific parameters last
    url.searchParams.set("isLocked", "true")
    url.searchParams.set("frameId", selectedShape.id)

    const finalUrl = url.toString()

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(finalUrl)
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = finalUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    }
  } catch (error) {
    console.error("Failed to copy frame link:", error)
    alert("Failed to copy frame link. Please check clipboard permissions.")
  }
}
