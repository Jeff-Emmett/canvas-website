import { StateNode } from "tldraw"
import { TranscriptionShape } from "@/shapes/TranscriptionShapeUtil"
import { getOpenAIConfig, isOpenAIConfigured } from "@/lib/clientConfig"
import { findNonOverlappingPosition } from "@/utils/shapeCollisionUtils"

export class TranscriptionTool extends StateNode {
  static override id = "transcription"
  static override initial = "idle"

  onSelect() {
    // Check if there are existing Transcription shapes on the canvas
    const allShapes = this.editor.getCurrentPageShapes()
    const transcriptionShapes = allShapes.filter(shape => shape.type === 'Transcription')
    
    if (transcriptionShapes.length > 0) {
      // If Transcription shapes exist, start whisper audio processing on the first one
      const firstTranscriptionShape = transcriptionShapes[0]
      console.log('🎯 Transcription tool selected - starting whisper audio processing on existing shape:', firstTranscriptionShape.id)
      
      // Select the first transcription shape
      this.editor.setSelectedShapes([`shape:${firstTranscriptionShape.id}`] as any)

      // Trigger the start transcription by dispatching a custom event
      // This will be caught by the TranscriptionShape component
      const startTranscriptionEvent = new CustomEvent('start-transcription', {
        detail: { shapeId: firstTranscriptionShape.id }
      })
      window.dispatchEvent(startTranscriptionEvent)

      // Center the view on the transcription shape
      this.editor.zoomToFit()

      // Switch back to select tool
      this.editor.setCurrentTool('select')
    } else {
      // If no Transcription shapes exist, create a new one
      console.log('🎯 Transcription tool selected - creating new Transcription shape')
      this.createTranscriptionShape()
    }
  }

  onPointerDown() {
    // Get the click position in page coordinates
    const { currentPagePoint } = this.editor.inputs

    // Create a new transcription shape at the click location
    this.createTranscriptionShape(currentPagePoint.x, currentPagePoint.y)
  }

  private createTranscriptionShape(clickX?: number, clickY?: number) {
    try {
      // Use click position if provided, otherwise use viewport center
      let baseX: number
      let baseY: number

      if (clickX !== undefined && clickY !== undefined) {
        // Position at click location, centered on the cursor
        baseX = clickX - 200 // Center the 400px wide shape
        baseY = clickY - 100 // Center the 200px tall shape
      } else {
        // Fallback to viewport center (for onSelect case)
        const viewport = this.editor.getViewportPageBounds()
        const centerX = viewport.x + viewport.w / 2
        const centerY = viewport.y + viewport.h / 2
        baseX = centerX - 200
        baseY = centerY - 100
      }
      
      // Find a non-overlapping position
      const shapeWidth = 400
      const shapeHeight = 200
      const position = findNonOverlappingPosition(
        this.editor,
        baseX,
        baseY,
        shapeWidth,
        shapeHeight
      )
      
      const transcriptionShape = this.editor.createShape({
        type: 'Transcription',
        x: position.x,
        y: position.y,
        props: {
          w: 400,
          h: 200,
          text: '',
          isEditing: false,
          isTranscribing: false,
          isPaused: false
        }
      })
      
      console.log('✅ Created transcription shape:', transcriptionShape.id)

      // Select the new shape and switch to select tool
      this.editor.setSelectedShapes([`shape:${transcriptionShape.id}`] as any)
      this.editor.setCurrentTool('select')

    } catch (error) {
      console.error('❌ Error creating transcription shape:', error)
    }
  }
}
