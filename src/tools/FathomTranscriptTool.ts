import { StateNode } from "tldraw"
import { findNonOverlappingPosition } from "@/utils/shapeCollisionUtils"

export class FathomTranscriptTool extends StateNode {
  static override id = "fathom-transcript"
  static override initial = "idle"

  onSelect() {
    // Create a new Fathom transcript shape
    this.createFathomTranscriptShape()
  }

  onPointerDown() {
    // Create a new Fathom transcript shape at the click location
    this.createFathomTranscriptShape()
  }

  private createFathomTranscriptShape() {
    try {
      // Get the current viewport center
      const viewport = this.editor.getViewportPageBounds()
      const centerX = viewport.x + viewport.w / 2
      const centerY = viewport.y + viewport.h / 2

      // Base position (centered on viewport)
      const baseX = centerX - 300 // Center the 600px wide shape
      const baseY = centerY - 200 // Center the 400px tall shape
      
      // Find a non-overlapping position
      const shapeWidth = 600
      const shapeHeight = 400
      const position = findNonOverlappingPosition(
        this.editor,
        baseX,
        baseY,
        shapeWidth,
        shapeHeight
      )
      
      const fathomShape = this.editor.createShape({
        type: 'FathomTranscript',
        x: position.x,
        y: position.y,
        props: {
          w: 600,
          h: 400,
          meetingId: '',
          meetingTitle: 'New Fathom Meeting',
          meetingUrl: '',
          summary: '',
          transcript: [],
          actionItems: [],
          isExpanded: false,
          showTranscript: true,
          showActionItems: true,
        }
      })
      
      console.log('✅ Created Fathom transcript shape:', fathomShape.id)

      // Select the new shape and switch to select tool
      this.editor.setSelectedShapes([`shape:${fathomShape.id}`] as any)
      this.editor.setCurrentTool('select')

    } catch (error) {
      console.error('❌ Error creating Fathom transcript shape:', error)
    }
  }
}
