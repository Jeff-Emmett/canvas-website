import { Editor, TLFrameShape, TLParentId, TLShape, TLShapeId } from "tldraw"

export const cameraHistory: { x: number; y: number; z: number }[] = []
const MAX_HISTORY = 10 // Keep last 10 camera positions

const frameObservers = new Map<string, ResizeObserver>()

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
  url.searchParams.set("x", Math.round(newCamera.x).toString())
  url.searchParams.set("y", Math.round(newCamera.y).toString())
  url.searchParams.set("zoom", Math.round(newCamera.z).toString())
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
    const url = new URL(baseUrl)
    const camera = editor.getCamera()

    // Round camera values to integers
    url.searchParams.set("x", Math.round(camera.x).toString())
    url.searchParams.set("y", Math.round(camera.y).toString())
    url.searchParams.set("zoom", Math.round(camera.z).toString())

    const selectedIds = editor.getSelectedShapeIds()
    if (selectedIds.length > 0) {
      url.searchParams.set("shapeId", selectedIds[0].toString())
    }

    const finalUrl = url.toString()
    console.log("Final URL to copy:", finalUrl)

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(finalUrl)
    } else {
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

// Add this function to create lock indicators
const createLockIndicator = (editor: Editor, shape: TLShape) => {
  const lockIndicator = document.createElement('div')
  lockIndicator.id = `lock-indicator-${shape.id}`
  lockIndicator.className = 'lock-indicator'
  lockIndicator.innerHTML = '🔒'
  
  // Set styles to position at top-right of shape
  lockIndicator.style.position = 'absolute'
  lockIndicator.style.right = '3px'
  lockIndicator.style.top = '3px'
  lockIndicator.style.pointerEvents = 'all'
  lockIndicator.style.zIndex = '99999'
  lockIndicator.style.background = 'white'
  lockIndicator.style.border = '1px solid #ddd'
  lockIndicator.style.borderRadius = '4px'
  lockIndicator.style.padding = '4px'
  lockIndicator.style.cursor = 'pointer'
  lockIndicator.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'
  lockIndicator.style.fontSize = '12px'
  lockIndicator.style.lineHeight = '1'
  lockIndicator.style.display = 'flex'
  lockIndicator.style.alignItems = 'center'
  lockIndicator.style.justifyContent = 'center'
  lockIndicator.style.width = '20px'
  lockIndicator.style.height = '20px'
  lockIndicator.style.userSelect = 'none'
  
  // Add hover effect
  lockIndicator.onmouseenter = () => {
    lockIndicator.style.backgroundColor = '#f0f0f0'
  }
  lockIndicator.onmouseleave = () => {
    lockIndicator.style.backgroundColor = 'white'
  }
  
  // Add tooltip and click handlers with stopPropagation
  lockIndicator.title = 'Unlock shape'
  
  lockIndicator.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    unlockElement(editor, shape.id)
  }, true)

  lockIndicator.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    e.preventDefault()
  }, true)

  lockIndicator.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    e.preventDefault()
  }, true)

  const shapeElement = document.querySelector(`[data-shape-id="${shape.id}"]`)
  if (shapeElement) {
    shapeElement.appendChild(lockIndicator)
  }
}

// Modify lockElement to use the new function
export const lockElement = async (editor: Editor) => {
  const selectedShapes = editor.getSelectedShapes()
  if (selectedShapes.length === 0) return

  try {
    selectedShapes.forEach(shape => {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        isLocked: true,
        meta: {
          ...shape.meta,
          isLocked: true,
          canInteract: true,    // Allow interactions
          canMove: false,       // Prevent moving
          canResize: false,     // Prevent resizing
          canEdit: true,        // Allow text editing
          canUpdateProps: true  // Allow updating props (for prompt inputs/outputs)
          //TO DO: FIX TEXT INPUT ON LOCKED ELEMENTS (e.g. prompt shape) AND ATTACH TO SCREEN EDGE
        }
      })
      createLockIndicator(editor, shape)
    })
  } catch (error) {
    console.error("Failed to lock elements:", error)
  }
}

export const unlockElement = (editor: Editor, shapeId: string) => {
  const indicator = document.getElementById(`lock-indicator-${shapeId}`)
  if (indicator) {
    indicator.remove()
  }

  const shape = editor.getShape(shapeId as TLShapeId)
  if (shape) {
    editor.updateShape({
      id: shapeId as TLShapeId,
      type: shape.type,
      isLocked: false,
      meta: {
        ...shape.meta,
        isLocked: false,
        canInteract: true,
        canMove: true,
        canResize: true,
        canEdit: true,
        canUpdateProps: true
      }
    })
  }
}

// Initialize lock indicators based on stored state
export const initLockIndicators = (editor: Editor) => {
  editor.getCurrentPageShapes().forEach(shape => {
    if (shape.isLocked || shape.meta?.isLocked) {
      createLockIndicator(editor, shape)
    }
  })
}

export const setInitialCameraFromUrl = (editor: Editor) => {
  const url = new URL(window.location.href)
  const x = url.searchParams.get("x")
  const y = url.searchParams.get("y")
  const zoom = url.searchParams.get("zoom")
  const shapeId = url.searchParams.get("shapeId")
  const frameId = url.searchParams.get("frameId")

  console.log('Setting initial camera from URL:', { x, y, zoom, shapeId, frameId })

  if (x && y && zoom) {
    editor.stopCameraAnimation()
    editor.setCamera(
      {
        x: Math.round(parseFloat(x)),
        y: Math.round(parseFloat(y)),
        z: Math.round(parseFloat(zoom))
      },
      { animation: { duration: 0 } }
    )
  }

  // Handle shape/frame selection and zoom
  if (shapeId) {
    editor.select(shapeId as TLShapeId)
    const bounds = editor.getSelectionPageBounds()
    if (bounds && !x && !y && !zoom) {
      zoomToSelection(editor)
    }
  } else if (frameId) {
    editor.select(frameId as TLShapeId)
    const frame = editor.getShape(frameId as TLShapeId)
    if (frame && !x && !y && !zoom) {
      const bounds = editor.getShapePageBounds(frame as TLShape)
      if (bounds) {
        editor.zoomToBounds(bounds, {
          targetZoom: 1,
          animation: { duration: 0 },
        })
      }
    }
  }
}

export const zoomToFrame = (editor: Editor, frameId: string) => {
  if (!editor) return
  const frame = editor.getShape(frameId as TLParentId) as TLFrameShape
  if (!frame) return

  editor.zoomToBounds(editor.getShapePageBounds(frame)!, {
    inset: 32,
    animation: { duration: 500 },
  })
}

export const copyFrameLink = (_editor: Editor, frameId: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set("frameId", frameId)
  navigator.clipboard.writeText(url.toString())
}

// Initialize lock indicators and watch for changes
export const watchForLockedShapes = (editor: Editor) => {
  editor.on('change', () => {
    editor.getCurrentPageShapes().forEach(shape => {
      const hasIndicator = document.getElementById(`lock-indicator-${shape.id}`)
      if (shape.isLocked && !hasIndicator) {
        createLockIndicator(editor, shape)
      } else if (!shape.isLocked && hasIndicator) {
        hasIndicator.remove()
      }
    })
  })
}
