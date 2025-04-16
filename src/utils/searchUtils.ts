import { Editor } from "tldraw"

export const searchText = (editor: Editor) => {
  // Switch to select tool first
  editor.setCurrentTool('select')

  const searchTerm = prompt("Enter search text:")
  if (!searchTerm) return

  const shapes = editor.getCurrentPageShapes()
  const matchingShapes = shapes.filter(shape => {
    if (!shape.props) return false
    
    const textProperties = [
      (shape.props as any).text,           
      (shape.props as any).name,           
      (shape.props as any).value,          
      (shape.props as any).url,            
      (shape.props as any).description,    
      (shape.props as any).content,        
    ]

    const termLower = searchTerm.toLowerCase()
    return textProperties.some(prop => 
      typeof prop === 'string' && 
      prop.toLowerCase().includes(termLower)
    )
  })

  if (matchingShapes.length > 0) {
    editor.selectNone()
    editor.setSelectedShapes(matchingShapes)
    
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
      targetZoom = Math.min(
        (viewportPageBounds.width * 0.8) / commonBounds.width,
        (viewportPageBounds.height * 0.8) / commonBounds.height,
        40
      )
    } else if (widthRatio > 1 || heightRatio > 1) {
      targetZoom = Math.min(
        (viewportPageBounds.width * 0.7) / commonBounds.width,
        (viewportPageBounds.height * 0.7) / commonBounds.height,
        0.125
      )
    } else {
      targetZoom = Math.min(
        (viewportPageBounds.width * 0.8) / commonBounds.width,
        (viewportPageBounds.height * 0.8) / commonBounds.height,
        20
      )
    }

    // Zoom to the common bounds
    editor.zoomToBounds(commonBounds, {
      targetZoom,
      inset: widthRatio > 1 || heightRatio > 1 ? 20 : 50,
      animation: {
        duration: 400,
        easing: (t) => t * (2 - t),
      },
    })

    // Update URL with new camera position and first selected shape ID
    const newCamera = editor.getCamera()
    const url = new URL(window.location.href)
    url.searchParams.set("shapeId", matchingShapes[0].id)
    url.searchParams.set("x", newCamera.x.toString())
    url.searchParams.set("y", newCamera.y.toString())
    url.searchParams.set("zoom", newCamera.z.toString())
    window.history.replaceState(null, "", url.toString())
  } else {
    alert("No matches found")
  }
}