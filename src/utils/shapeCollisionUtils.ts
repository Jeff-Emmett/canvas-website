import { Editor, TLShape, Box, TLShapeId } from "@tldraw/tldraw"

/**
 * Check if two boxes overlap
 */
function boxesOverlap(
  box1: { x: number; y: number; w: number; h: number },
  box2: { x: number; y: number; w: number; h: number },
  padding: number = 10
): boolean {
  return !(
    box1.x + box1.w + padding < box2.x - padding ||
    box1.x - padding > box2.x + box2.w + padding ||
    box1.y + box1.h + padding < box2.y - padding ||
    box1.y - padding > box2.y + box2.h + padding
  )
}

/**
 * Get the bounding box of a shape
 */
function getShapeBounds(editor: Editor, shape: TLShape | string): Box | null {
  const shapeId = typeof shape === 'string' ? (shape as TLShapeId) : shape.id
  const bounds = editor.getShapePageBounds(shapeId)
  return bounds ?? null
}

/**
 * Check if a shape overlaps with any other custom shapes and move it aside if needed
 */
export function resolveOverlaps(editor: Editor, shapeId: string): void {
  const allShapes = editor.getCurrentPageShapes()
  const customShapeTypes = [
    'ObsNote', 'ObsidianBrowser', 'HolonBrowser', 'VideoChat', 'FathomTranscript',
    'Transcription', 'Holon', 'LocationShare', 'FathomMeetingsBrowser', 'Prompt',
    'Embed', 'Slide', 'Markdown', 'SharedPiano', 'MycrozineTemplate', 'ChatBox'
  ]
  
  const shape = editor.getShape(shapeId)
  if (!shape || !customShapeTypes.includes(shape.type)) return
  
  const shapeBounds = getShapeBounds(editor, shape)
  if (!shapeBounds) return
  
  const shapeBox = {
    x: shape.x,
    y: shape.y,
    w: shapeBounds.w,
    h: shapeBounds.h
  }
  
  // Check all other custom shapes for overlaps
  const otherShapes = allShapes.filter(
    s => s.id !== shapeId && customShapeTypes.includes(s.type)
  )
  
  for (const otherShape of otherShapes) {
    const otherBounds = getShapeBounds(editor, otherShape)
    if (!otherBounds) continue
    
    const otherBox = {
      x: otherShape.x,
      y: otherShape.y,
      w: otherBounds.w,
      h: otherBounds.h
    }
    
    if (boxesOverlap(shapeBox, otherBox, 20)) {
      // Simple solution: move the shape to the right of the overlapping shape
      const newX = otherBox.x + otherBox.w + 20
      const newY = shapeBox.y // Keep same Y position
      
      editor.updateShape({
        id: shapeId as TLShapeId,
        type: shape.type,
        x: newX,
        y: newY,
      })
      
      // Recursively check if the new position also overlaps (shouldn't happen often)
      const newBounds = getShapeBounds(editor, shapeId)
      if (newBounds) {
        const newShapeBox = {
          x: newX,
          y: newY,
          w: newBounds.w,
          h: newBounds.h
        }
        
        // If still overlapping, try moving down instead
        if (boxesOverlap(newShapeBox, otherBox, 20)) {
          const newY2 = otherBox.y + otherBox.h + 20
          editor.updateShape({
            id: shapeId as TLShapeId,
            type: shape.type,
            x: shapeBox.x, // Keep original X
            y: newY2,
          })
        }
      }
      
      // Only resolve one overlap at a time to avoid infinite loops
      break
    }
  }
}

/**
 * Find a non-overlapping position for a new shape using spiral search
 */
export function findNonOverlappingPosition(
  editor: Editor,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
  excludeShapeIds: string[] = []
): { x: number; y: number } {
  const allShapes = editor.getCurrentPageShapes()
  const customShapeTypes = [
    'ObsNote', 'ObsidianBrowser', 'HolonBrowser', 'VideoChat', 'FathomTranscript',
    'Transcription', 'Holon', 'LocationShare', 'FathomMeetingsBrowser', 'Prompt',
    'Embed', 'Slide', 'Markdown', 'SharedPiano', 'MycrozineTemplate', 'ChatBox'
  ]
  
  const existingShapes = allShapes.filter(
    s => !excludeShapeIds.includes(s.id) && customShapeTypes.includes(s.type)
  )
  
  const padding = 20
  const stepSize = Math.max(width, height) + padding
  
  // Helper function to check if a position overlaps with any existing shape
  const positionOverlaps = (x: number, y: number): boolean => {
    const testBox = { x, y, w: width, h: height }
    
    for (const existingShape of existingShapes) {
      const shapeBounds = getShapeBounds(editor, existingShape)
      if (shapeBounds) {
        const existingBox = {
          x: existingShape.x,
          y: existingShape.y,
          w: shapeBounds.w,
          h: shapeBounds.h
        }
        
        if (boxesOverlap(testBox, existingBox, padding)) {
          return true
        }
      }
    }
    
    return false
  }
  
  // First, check the base position
  if (!positionOverlaps(baseX, baseY)) {
    return { x: baseX, y: baseY }
  }
  
  // Spiral search pattern: check positions in expanding circles
  // Try positions: right, down, left, up, then expand radius
  const directions = [
    { dx: stepSize, dy: 0 },      // Right
    { dx: 0, dy: stepSize },      // Down
    { dx: -stepSize, dy: 0 },     // Left
    { dx: 0, dy: -stepSize },     // Up
    { dx: stepSize, dy: stepSize },   // Down-right
    { dx: -stepSize, dy: stepSize },  // Down-left
    { dx: -stepSize, dy: -stepSize }, // Up-left
    { dx: stepSize, dy: -stepSize },  // Up-right
  ]
  
  // Try positions at increasing distances
  for (let radius = 1; radius <= 10; radius++) {
    for (const dir of directions) {
      const testX = baseX + dir.dx * radius
      const testY = baseY + dir.dy * radius
      
      if (!positionOverlaps(testX, testY)) {
        return { x: testX, y: testY }
      }
    }
  }
  
  // If all positions overlap (unlikely), return a position far to the right
  return { x: baseX + stepSize * 10, y: baseY }
}
