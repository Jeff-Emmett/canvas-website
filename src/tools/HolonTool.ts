import { StateNode } from "tldraw"
import { HolonShape } from "@/shapes/HolonShapeUtil"
import { holosphereService } from "@/lib/HoloSphereService"

export class HolonTool extends StateNode {
  static override id = "Holon"
  static override initial = "idle"
  static override children = () => [HolonIdle]
}

export class HolonIdle extends StateNode {
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

  override onPointerDown = (info?: any) => {
    // Get the click position in page coordinates
    // Try multiple methods to ensure we get the correct click position
    let clickX: number | undefined
    let clickY: number | undefined
    
    // Method 1: Try info.point (screen coordinates) and convert to page
    if (info?.point) {
      try {
        const pagePoint = this.editor.screenToPage(info.point)
        clickX = pagePoint.x
        clickY = pagePoint.y
      } catch (e) {
      }
    }
    
    // Method 2: Use currentPagePoint from editor inputs (most reliable)
    if (clickX === undefined || clickY === undefined) {
      const { currentPagePoint } = this.editor.inputs
      if (currentPagePoint && currentPagePoint.x !== undefined && currentPagePoint.y !== undefined) {
        clickX = currentPagePoint.x
        clickY = currentPagePoint.y
      }
    }
    
    // Method 3: Try originPagePoint as last resort
    if (clickX === undefined || clickY === undefined) {
      const { originPagePoint } = this.editor.inputs
      if (originPagePoint && originPagePoint.x !== undefined && originPagePoint.y !== undefined) {
        clickX = originPagePoint.x
        clickY = originPagePoint.y
      }
    }
    
    if (clickX === undefined || clickY === undefined) {
      console.error('❌ HolonTool: Could not determine click position!', { info, inputs: this.editor.inputs })
    }
    
    // Create a new Holon shape at the click location
    this.createHolonShape(clickX, clickY)
  }
  
  override onExit = () => {
    this.cleanupTooltip()
    // Clean up event listeners
    if ((this as any).cleanup) {
      ;(this as any).cleanup()
    }
  }
  
  private cleanupTooltip = () => {
    // Remove mouse move listener
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = undefined
    }
    
    // Remove tooltip element (safely check if it exists in DOM)
    if (this.tooltipElement) {
      try {
        if (this.tooltipElement.parentNode) {
          document.body.removeChild(this.tooltipElement)
        }
      } catch (e) {
        // Element might already be removed, ignore error
      }
      this.tooltipElement = undefined
    }
  }

  private createHolonShape(clickX?: number, clickY?: number) {
    try {
      // Store current camera position to prevent it from changing
      const currentCamera = this.editor.getCamera()
      this.editor.stopCameraAnimation()
      
      // Standardized size: 700x400 (matches default props to fit ID and button)
      const shapeWidth = 700
      const shapeHeight = 400
      
      // Use click position if available, otherwise fall back to viewport center
      let baseX: number
      let baseY: number
      
      if (clickX !== undefined && clickY !== undefined) {
        // Position new Holon shape at click location (centered on click)
        baseX = clickX - shapeWidth / 2 // Center the shape on click
        baseY = clickY - shapeHeight / 2 // Center the shape on click
      } else {
        // Fallback to viewport center if no click coordinates
        const viewport = this.editor.getViewportPageBounds()
        const centerX = viewport.x + viewport.w / 2
        const centerY = viewport.y + viewport.h / 2
        baseX = centerX - shapeWidth / 2 // Center the shape
        baseY = centerY - shapeHeight / 2 // Center the shape
      }
      
      // Find existing Holon shapes for naming
      const allShapes = this.editor.getCurrentPageShapes()
      const existingHolonShapes = allShapes.filter(s => s.type === 'Holon')
      
      // ALWAYS use click position directly when provided - user clicked where they want it
      // Skip collision detection entirely for user clicks to ensure it appears exactly where clicked
      let finalX = baseX
      let finalY = baseY
      
      if (clickX !== undefined && clickY !== undefined) {
        // User clicked - ALWAYS use that exact position, no collision detection
        // This ensures the shape appears exactly where the user clicked
        finalX = baseX
        finalY = baseY
          clickPosition: { x: clickX, y: clickY }, 
          shapePosition: { x: finalX, y: finalY },
          shapeSize: { w: shapeWidth, h: shapeHeight }
        })
      } else {
        // For fallback (no click), use base position directly
        finalX = baseX
        finalY = baseY
      }
      
      // Default coordinates (can be changed by user)
      const defaultLat = 40.7128 // NYC
      const defaultLng = -74.0060
      const defaultResolution = 7 // City level
      
      
      const holonShape = this.editor.createShape({
        type: 'Holon',
        x: finalX,
        y: finalY,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          name: `Holon ${existingHolonShapes.length + 1}`,
          description: '',
          latitude: defaultLat,
          longitude: defaultLng,
          resolution: defaultResolution,
          holonId: '',
          isConnected: false,
          isEditing: true,
          selectedLens: 'general',
          data: {},
          connections: [],
          lastUpdated: Date.now()
        }
      })
      
      
      // Restore camera position if it changed
      const newCamera = this.editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }
      
      // Don't select the new shape - let it be created without selection like other tools
      // Clean up tooltip before switching tools
      this.cleanupTooltip()
      // Switch back to selector tool after creating the shape
      this.editor.setCurrentTool('select')
      
    } catch (error) {
      console.error('❌ Error creating Holon shape:', error)
    }
  }
  
  onSelect() {
    // Check if there are existing Holon shapes on the canvas
    const allShapes = this.editor.getCurrentPageShapes()
    const holonShapes = allShapes.filter(shape => shape.type === 'Holon')
    
    if (holonShapes.length > 0) {
      // If Holon shapes exist, select them and center the view
      this.editor.setSelectedShapes(holonShapes.map(shape => shape.id))
      this.editor.zoomToFit()
      
      // Add refresh all functionality
      this.addRefreshAllListener()
    } else {
      // If no Holon shapes exist, don't automatically create one
      // The user will create one by clicking on the canvas (onPointerDown)
    }
  }

  private addRefreshAllListener() {
    // Listen for refresh-all-holons event
    const handleRefreshAll = async () => {
      const shapeUtil = new HolonShape(this.editor)
      shapeUtil.editor = this.editor
      
      const allShapes = this.editor.getCurrentPageShapes()
      const holonShapes = allShapes.filter(shape => shape.type === 'Holon')
      
      let successCount = 0
      let failCount = 0
      
      for (const shape of holonShapes) {
        try {
          // Trigger a refresh for each Holon shape
          const event = new CustomEvent('refresh-holon', {
            detail: { shapeId: shape.id }
          })
          window.dispatchEvent(event)
          successCount++
        } catch (error) {
          console.error(`❌ Failed to refresh Holon ${shape.id}:`, error)
          failCount++
        }
      }
      
      if (successCount > 0) {
        alert(`✅ Refreshed ${successCount} Holon shapes!${failCount > 0 ? ` (${failCount} failed)` : ''}`)
      } else {
        alert('❌ Failed to refresh any Holon shapes. Check console for details.')
      }
    }

    window.addEventListener('refresh-all-holons', handleRefreshAll)
    
    // Clean up listener when tool is deselected
    const cleanup = () => {
      window.removeEventListener('refresh-all-holons', handleRefreshAll)
    }
    
    // Store cleanup function for later use
    ;(this as any).cleanup = cleanup
  }
}
