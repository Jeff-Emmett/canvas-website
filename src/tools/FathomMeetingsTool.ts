import { StateNode } from "tldraw"
import { findNonOverlappingPosition } from "@/utils/shapeCollisionUtils"

export class FathomMeetingsTool extends StateNode {
  static override id = "fathom-meetings"
  static override initial = "idle"
  static override children = () => [FathomMeetingsIdle]
  
  onSelect() {
    // Don't create a shape immediately when tool is selected
    // The user will create one by clicking on the canvas (onPointerDown in idle state)
  }
}

export class FathomMeetingsIdle extends StateNode {
  static override id = "idle"
  
  tooltipElement?: HTMLDivElement
  mouseMoveHandler?: (e: MouseEvent) => void
  isCreatingShape = false // Flag to prevent multiple shapes from being created

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
    
    // Prevent multiple shapes from being created if user clicks multiple times
    if (this.isCreatingShape) {
      return
    }
    
    // CRITICAL: Only proceed if we have a valid pointer event with a point AND button
    // This prevents shapes from being created when tool is selected (without a click)
    // A real click will have both a point and a button property
    if (!info || !info.point || info.button === undefined) {
      console.warn('⚠️ FathomMeetingsTool: No valid pointer event (missing point or button) - not creating shape. This is expected when tool is first selected.', { 
        hasInfo: !!info, 
        hasPoint: !!info?.point, 
        hasButton: info?.button !== undefined 
      })
      return
    }
    
    // CRITICAL: Ensure this is a primary button click (left mouse button = 0)
    // This prevents accidental triggers from other pointer events
    if (info.button !== 0) {
      return
    }
    
    // CRITICAL: Additional validation - ensure this is a real click on the canvas
    // Check that the event target is the canvas or a canvas child, not a UI element
    if (info.target && typeof info.target === 'object') {
      const target = info.target as HTMLElement
      // If clicking on UI elements (toolbar, menus, etc), don't create shape
      if (target.closest('[data-tldraw-ui]') || 
          target.closest('.tlui-menu') || 
          target.closest('.tlui-toolbar') ||
          target.closest('[role="menu"]') ||
          target.closest('[role="toolbar"]')) {
        return
      }
    }
    
    // Get the click position in page coordinates
    // CRITICAL: Only use info.point - don't use fallback values that might be stale
    // This ensures we only create shapes on actual clicks, not when tool is selected
    let clickX: number | undefined
    let clickY: number | undefined
    
    // Method 1: Use info.point (screen coordinates) and convert to page - this is the ONLY reliable source
    if (info.point) {
      try {
        const pagePoint = this.editor.screenToPage(info.point)
        clickX = pagePoint.x
        clickY = pagePoint.y
      } catch (e) {
        console.error('📍 FathomMeetingsTool: Failed to convert info.point to page coordinates', e)
      }
    }
    
    // CRITICAL: Only create shape if we have valid click coordinates from info.point
    // Do NOT use fallback values (currentPagePoint/originPagePoint) as they may be stale
    // This prevents shapes from being created when tool is selected (without a click)
    if (clickX === undefined || clickY === undefined) {
      console.warn('⚠️ FathomMeetingsTool: No valid click position from info.point - not creating shape. This is expected when tool is first selected.')
      return
    }
    
    // Additional validation: ensure coordinates are reasonable (not 0,0 or extreme values)
    // This catches cases where info.point might exist but has invalid default values
    const viewport = this.editor.getViewportPageBounds()
    const reasonableBounds = {
      minX: viewport.x - viewport.w * 2, // Allow some margin outside viewport
      maxX: viewport.x + viewport.w * 3,
      minY: viewport.y - viewport.h * 2,
      maxY: viewport.y + viewport.h * 3,
    }
    
    if (clickX < reasonableBounds.minX || clickX > reasonableBounds.maxX || 
        clickY < reasonableBounds.minY || clickY > reasonableBounds.maxY) {
      console.warn('⚠️ FathomMeetingsTool: Click position outside reasonable bounds - not creating shape', { 
        clickX, 
        clickY, 
        bounds: reasonableBounds 
      })
      return
    }
    
    // CRITICAL: Final validation - ensure this is a deliberate click, not a programmatic trigger
    // Check that we have valid, non-zero coordinates (0,0 is often a default/fallback value)
    if (clickX === 0 && clickY === 0) {
      console.warn('⚠️ FathomMeetingsTool: Click position is (0,0) - likely not a real click, ignoring')
      return
    }
    
    // CRITICAL: Only create shape if tool is actually active (not just selected)
    // Double-check that we're in the idle state and tool is properly selected
    const currentTool = this.editor.getCurrentToolId()
    if (currentTool !== 'fathom-meetings') {
      console.warn('⚠️ FathomMeetingsTool: Tool not active, ignoring click', { currentTool })
      return
    }
    
    // Create a new FathomMeetingsBrowser shape at the click location
    this.createFathomMeetingsBrowserShape(clickX, clickY)
  }
  
  onSelect() {
    // Don't create a shape immediately when tool is selected
    // The user will create one by clicking on the canvas (onPointerDown)
  }
  
  override onExit = () => {
    this.cleanupTooltip()
    // Reset flag when exiting the tool
    this.isCreatingShape = false
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

  private createFathomMeetingsBrowserShape(clickX: number, clickY: number) {
    // Set flag to prevent multiple shapes from being created
    this.isCreatingShape = true
    
    try {
      
      // Store current camera position to prevent it from changing
      const currentCamera = this.editor.getCamera()
      this.editor.stopCameraAnimation()
      
      // Standardized size: 800x600
      const shapeWidth = 800
      const shapeHeight = 600
      
      // Position new browser shape at click location (centered on click)
      const baseX = clickX - shapeWidth / 2 // Center the shape on click
      const baseY = clickY - shapeHeight / 2 // Center the shape on click

      // User clicked - ALWAYS use that exact position, no collision detection
      // This ensures the shape appears exactly where the user clicked
      const finalX = baseX
      const finalY = baseY
        clickPosition: { x: clickX, y: clickY }, 
        shapePosition: { x: finalX, y: finalY },
        shapeSize: { w: shapeWidth, h: shapeHeight }
      })

      
      const browserShape = this.editor.createShape({
        type: 'FathomMeetingsBrowser',
        x: finalX,
        y: finalY,
        props: {
          w: shapeWidth,
          h: shapeHeight,
        }
      })

      
      // Restore camera position if it changed
      const newCamera = this.editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }

      // Select the new shape and switch to select tool immediately
      // This ensures the tool switches right after shape creation
      // Ensure shape ID has the "shape:" prefix (required by TLDraw validation)
      const shapeId = browserShape.id.startsWith('shape:') 
        ? browserShape.id 
        : `shape:${browserShape.id}`
      const cameraBeforeSelect = this.editor.getCamera()
      this.editor.stopCameraAnimation()
      this.editor.setSelectedShapes([shapeId] as any)
      this.editor.setCurrentTool('select')
      
      // Restore camera if it changed during selection
      const cameraAfterSelect = this.editor.getCamera()
      if (cameraBeforeSelect.x !== cameraAfterSelect.x || cameraBeforeSelect.y !== cameraAfterSelect.y || cameraBeforeSelect.z !== cameraAfterSelect.z) {
        this.editor.setCamera(cameraBeforeSelect, { animation: { duration: 0 } })
      }
      
      // Reset flag after a short delay to allow the tool switch to complete
      setTimeout(() => {
        this.isCreatingShape = false
      }, 200)

    } catch (error) {
      console.error('❌ Error creating FathomMeetingsBrowser shape:', error)
      // Reset flag on error
      this.isCreatingShape = false
      throw error // Re-throw to see the full error
    }
  }
}

