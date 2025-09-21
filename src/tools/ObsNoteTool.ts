import { StateNode } from "tldraw"
import { ObsNoteShape } from "@/shapes/ObsNoteShapeUtil"

export class ObsNoteTool extends StateNode {
  static override id = "obs_note"
  static override initial = "idle"

  onSelect() {
    // Check if there are existing ObsNote shapes on the canvas
    const allShapes = this.editor.getCurrentPageShapes()
    const obsNoteShapes = allShapes.filter(shape => shape.type === 'ObsNote')
    
    if (obsNoteShapes.length > 0) {
      // If ObsNote shapes exist, select them and center the view
      this.editor.setSelectedShapes(obsNoteShapes.map(shape => shape.id))
      this.editor.zoomToFit()
      console.log('🎯 Tool selected - showing existing ObsNote shapes:', obsNoteShapes.length)
      
      // Add refresh all functionality
      this.addRefreshAllListener()
    } else {
      // If no ObsNote shapes exist, don't automatically open vault browser
      // The vault browser will open when the user clicks on the canvas (onPointerDown)
      console.log('🎯 Tool selected - no ObsNote shapes found, waiting for user interaction')
    }
  }

  onPointerDown() {
    // Open vault browser to select notes
    const event = new CustomEvent('open-obsidian-browser')
    window.dispatchEvent(event)
    
    // Don't create any shapes - just open the vault browser
    return
  }

  private addRefreshAllListener() {
    // Listen for refresh-all-obsnotes event
    const handleRefreshAll = async () => {
      console.log('🔄 Refreshing all ObsNote shapes from vault...')
      const shapeUtil = new ObsNoteShape(this.editor)
      shapeUtil.editor = this.editor
      
      const result = await shapeUtil.refreshAllFromVault()
      if (result.success > 0) {
        alert(`✅ Refreshed ${result.success} notes from vault!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`)
      } else {
        alert('❌ Failed to refresh any notes. Check console for details.')
      }
    }

    window.addEventListener('refresh-all-obsnotes', handleRefreshAll)
    
    // Clean up listener when tool is deselected
    const cleanup = () => {
      window.removeEventListener('refresh-all-obsnotes', handleRefreshAll)
    }
    
    // Store cleanup function for later use
    ;(this as any).cleanup = cleanup
  }

  onExit() {
    // Clean up event listeners
    if ((this as any).cleanup) {
      ;(this as any).cleanup()
    }
  }
}
