import { StateNode } from "tldraw"
import { ObsNoteShape } from "@/shapes/ObsNoteShapeUtil"
import { findNonOverlappingPosition } from "@/utils/shapeCollisionUtils"

export class ObsNoteTool extends StateNode {
  static override id = "obs_note"
  static override initial = "idle"
  static override children = () => [ObsNoteIdle]

  onSelect() {
    // Check if there are existing ObsNote shapes on the canvas
    const allShapes = this.editor.getCurrentPageShapes()
    const obsNoteShapes = allShapes.filter(shape => shape.type === 'ObsNote')
    
    if (obsNoteShapes.length > 0) {
      // If ObsNote shapes exist, select them and center the view
      this.editor.setSelectedShapes(obsNoteShapes.map(shape => shape.id))
      this.editor.zoomToFit()
      
      // Add refresh all functionality
      this.addRefreshAllListener()
    }
  }
}

export class ObsNoteIdle extends StateNode {
  static override id = "idle"
  
  tooltipElement?: HTMLDivElement
  mouseMoveHandler?: (e: MouseEvent) => void

  override onEnter = () => {
    // Set cursor to cross (looks like +)
    this.editor.setCursor({ type: "cross", rotation: 0 })
    
    // Create tooltip element
    this.tooltipElement = document.createElement('div')
    this.tooltipElement.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      white-space: nowrap;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `
    this.tooltipElement.textContent = 'Click anywhere to place tool'
    
    // Add tooltip to DOM
    document.body.appendChild(this.tooltipElement)
    
    // Function to update tooltip position
    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.tooltipElement) {
        const x = e.clientX + 15
        const y = e.clientY - 35
        
        // Keep tooltip within viewport bounds
        const rect = this.tooltipElement.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        let finalX = x
        let finalY = y
        
        // Adjust if tooltip would go off the right edge
        if (x + rect.width > viewportWidth) {
          finalX = e.clientX - rect.width - 15
        }
        
        // Adjust if tooltip would go off the bottom edge
        if (y + rect.height > viewportHeight) {
          finalY = e.clientY - rect.height - 15
        }
        
        // Ensure tooltip doesn't go off the top or left
        finalX = Math.max(10, finalX)
        finalY = Math.max(10, finalY)
        
        this.tooltipElement.style.left = `${finalX}px`
        this.tooltipElement.style.top = `${finalY}px`
      }
    }
    
    // Add mouse move listener
    document.addEventListener('mousemove', this.mouseMoveHandler)
  }

  override onPointerDown = () => {
    // Get the click position in page coordinates
    const { currentPagePoint } = this.editor.inputs
    
    // Create an ObsidianBrowser shape on the canvas at the click location
    this.createObsidianBrowserShape(currentPagePoint.x, currentPagePoint.y)
  }
  
  override onExit = () => {
    this.cleanupTooltip()
  }
  
  private cleanupTooltip = () => {
    // Remove mouse move listener
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = undefined
    }
    
    // Remove tooltip element
    if (this.tooltipElement) {
      document.body.removeChild(this.tooltipElement)
      this.tooltipElement = undefined
    }
  }

  private createObsidianBrowserShape(clickX?: number, clickY?: number) {
    try {
      // Check if ObsidianBrowser already exists
      const allShapes = this.editor.getCurrentPageShapes()
      const existingBrowserShapes = allShapes.filter(shape => shape.type === 'ObsidianBrowser')
      
      if (existingBrowserShapes.length > 0) {
        // If a browser already exists, just select it
        console.log('✅ ObsidianBrowser already exists, selecting it')
        this.editor.setSelectedShapes([existingBrowserShapes[0].id])
        this.editor.setCurrentTool('select')
        return
      }

      // No existing browser, create a new one
      // Standardized size: 800x600
      const shapeWidth = 800
      const shapeHeight = 600
      
      let finalX: number
      let finalY: number
      
      if (clickX !== undefined && clickY !== undefined) {
        // User clicked - ALWAYS use that exact position (centered on click), no collision detection
        // This ensures the shape appears exactly where the user clicked, regardless of overlaps
        finalX = clickX - shapeWidth / 2 // Center the shape on click
        finalY = clickY - shapeHeight / 2 // Center the shape on click
      } else {
        // Fallback to viewport center if no click coordinates, with collision detection
        const viewport = this.editor.getViewportPageBounds()
        const centerX = viewport.x + viewport.w / 2
        const centerY = viewport.y + viewport.h / 2
        const baseX = centerX - shapeWidth / 2
        const baseY = centerY - shapeHeight / 2
        
        // Use collision detection for fallback case
        const position = findNonOverlappingPosition(
          this.editor,
          baseX,
          baseY,
          shapeWidth,
          shapeHeight
        )
        finalX = position.x
        finalY = position.y
      }

      const browserShape = this.editor.createShape({
        type: 'ObsidianBrowser',
        x: finalX,
        y: finalY,
        props: {
          w: shapeWidth,
          h: shapeHeight,
        }
      })

      // Select the new shape and switch to select tool
      this.editor.setSelectedShapes([`shape:${browserShape.id}`] as any)
      this.editor.setCurrentTool('select')

    } catch (error) {
      console.error('❌ Error creating ObsidianBrowser shape:', error)
    }
  }

  private addRefreshAllListener() {
    // Listen for refresh-all-obsnotes event
    const handleRefreshAll = async () => {
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
