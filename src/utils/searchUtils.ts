import { Editor, TLShape } from "tldraw"
import { semanticSearch, SemanticSearchResult } from "@/lib/semanticSearch"
import { canvasAI } from "@/lib/canvasAI"

/**
 * Basic text search (substring matching)
 */
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
      // For geo shapes, also check meta.text
      shape.type === 'geo' ? (shape.meta as any)?.text : undefined,
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

/**
 * Semantic search using AI embeddings
 * Finds conceptually similar content, not just exact text matches
 */
export const searchSemantic = async (
  editor: Editor,
  query?: string,
  onResults?: (results: SemanticSearchResult[]) => void
): Promise<SemanticSearchResult[]> => {
  // Initialize semantic search with editor
  semanticSearch.setEditor(editor)

  // Get query from user if not provided
  const searchQuery = query || prompt("Enter semantic search query:")
  if (!searchQuery) return []

  // Switch to select tool
  editor.setCurrentTool('select')

  try {
    // Search for semantically similar shapes
    const results = await semanticSearch.search(searchQuery, 10, 0.25)

    if (results.length === 0) {
      alert("No semantically similar shapes found. Try indexing the canvas first.")
      return []
    }

    // Select matching shapes
    const shapeIds = results.map(r => r.shapeId)
    editor.selectNone()
    editor.setSelectedShapes(shapeIds)

    // Zoom to show results
    const bounds = editor.getSelectionPageBounds()
    if (bounds) {
      const viewportBounds = editor.getViewportPageBounds()
      const widthRatio = bounds.width / viewportBounds.width
      const heightRatio = bounds.height / viewportBounds.height

      let targetZoom
      if (widthRatio < 0.1 || heightRatio < 0.1) {
        targetZoom = Math.min(
          (viewportBounds.width * 0.8) / bounds.width,
          (viewportBounds.height * 0.8) / bounds.height,
          40
        )
      } else if (widthRatio > 1 || heightRatio > 1) {
        targetZoom = Math.min(
          (viewportBounds.width * 0.7) / bounds.width,
          (viewportBounds.height * 0.7) / bounds.height,
          0.125
        )
      } else {
        targetZoom = Math.min(
          (viewportBounds.width * 0.8) / bounds.width,
          (viewportBounds.height * 0.8) / bounds.height,
          20
        )
      }

      editor.zoomToBounds(bounds, {
        targetZoom,
        inset: widthRatio > 1 || heightRatio > 1 ? 20 : 50,
        animation: {
          duration: 400,
          easing: (t) => t * (2 - t),
        },
      })
    }

    // Callback with results
    onResults?.(results)

    return results
  } catch (error) {
    console.error('Semantic search error:', error)
    alert(`Semantic search error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return []
  }
}

/**
 * Index the canvas for semantic search
 * Should be called periodically or when canvas content changes significantly
 */
export const indexCanvasForSearch = async (
  editor: Editor,
  onProgress?: (progress: number) => void
): Promise<void> => {
  semanticSearch.setEditor(editor)
  await semanticSearch.indexCanvas(onProgress)
}

/**
 * Ask AI about the canvas content
 */
export const askCanvasAI = async (
  editor: Editor,
  question?: string,
  onToken?: (partial: string, done?: boolean) => void
): Promise<string> => {
  canvasAI.setEditor(editor)

  const query = question || prompt("Ask about the canvas:")
  if (!query) return ''

  try {
    const result = await canvasAI.query(query, onToken)

    // If we have relevant shapes, select them
    if (result.relevantShapes.length > 0) {
      const shapeIds = result.relevantShapes.map(r => r.shapeId)
      editor.setSelectedShapes(shapeIds)
    }

    return result.answer
  } catch (error) {
    console.error('Canvas AI error:', error)
    const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    onToken?.(errorMsg, true)
    return errorMsg
  }
}

/**
 * Get a summary of the canvas
 */
export const summarizeCanvas = async (
  editor: Editor,
  onToken?: (partial: string, done?: boolean) => void
): Promise<string> => {
  canvasAI.setEditor(editor)
  return canvasAI.summarize(onToken)
}

/**
 * Explain what's visible in the current viewport
 */
export const explainViewport = async (
  editor: Editor,
  onToken?: (partial: string, done?: boolean) => void
): Promise<string> => {
  canvasAI.setEditor(editor)
  return canvasAI.explainViewport(onToken)
}

/**
 * Find shapes similar to the current selection
 */
export const findSimilarToSelection = async (
  editor: Editor
): Promise<SemanticSearchResult[]> => {
  canvasAI.setEditor(editor)

  const results = await canvasAI.getSimilarToSelected(5)

  if (results.length > 0) {
    // Add similar shapes to selection
    const currentSelection = editor.getSelectedShapeIds()
    const newSelection = [...currentSelection, ...results.map(r => r.shapeId)]
    editor.setSelectedShapes(newSelection)
  }

  return results
}

/**
 * Clean up stale embeddings
 */
export const cleanupSearchIndex = async (editor: Editor): Promise<number> => {
  semanticSearch.setEditor(editor)
  return semanticSearch.cleanupStaleEmbeddings()
}

/**
 * Clear all search index data
 */
export const clearSearchIndex = async (): Promise<void> => {
  return semanticSearch.clearIndex()
}