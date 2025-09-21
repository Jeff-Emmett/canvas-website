import { StateNode } from "tldraw"
import { TranscriptionShape } from "@/shapes/TranscriptionShapeUtil"
import { useWhisperTranscription } from "@/hooks/useWhisperTranscription"
import { getOpenAIConfig, isOpenAIConfigured } from "@/lib/clientConfig"

export class TranscriptionTool extends StateNode {
  static override id = "transcription"
  static override initial = "idle"

  onSelect() {
    // Check if there are existing Transcription shapes on the canvas
    const allShapes = this.editor.getCurrentPageShapes()
    const transcriptionShapes = allShapes.filter(shape => shape.type === 'Transcription')
    
    if (transcriptionShapes.length > 0) {
      // If Transcription shapes exist, select them and center the view
      this.editor.setSelectedShapes(transcriptionShapes.map(shape => `shape:${shape.id}`) as any)
      this.editor.zoomToFit()
      console.log('🎯 Transcription tool selected - showing existing Transcription shapes:', transcriptionShapes.length)
    } else {
      // If no Transcription shapes exist, create a new one
      console.log('🎯 Transcription tool selected - creating new Transcription shape')
      this.createTranscriptionShape()
    }
  }

  onPointerDown() {
    // Create a new transcription shape at the click location
    this.createTranscriptionShape()
  }

  private createTranscriptionShape() {
    try {
      // Get the current viewport center
      const viewport = this.editor.getViewportPageBounds()
      const centerX = viewport.x + viewport.w / 2
      const centerY = viewport.y + viewport.h / 2

      // Find existing transcription shapes to calculate stacking position
      const allShapes = this.editor.getCurrentPageShapes()
      const existingTranscriptionShapes = allShapes.filter(s => s.type === 'Transcription')
      
      // Position new transcription shape
      const xPosition = centerX - 200 // Center the 400px wide shape
      const yPosition = centerY - 100 + (existingTranscriptionShapes.length * 250) // Stack vertically
      
      const transcriptionShape = this.editor.createShape({
        type: 'Transcription',
        x: xPosition,
        y: yPosition,
        props: {
          w: 400,
          h: 200,
          text: '🎤 Transcription Ready\n\nClick the "Start Transcription" button to begin...',
          isEditing: false
        }
      })
      
      console.log('✅ Created transcription shape:', transcriptionShape.id)
      
      // Select the new shape
      this.editor.setSelectedShapes([`shape:${transcriptionShape.id}`] as any)
      
    } catch (error) {
      console.error('❌ Error creating transcription shape:', error)
    }
  }
}
