// Unified Calendar Tool - Places Calendar shape on canvas
// Supports switching between Browser, Widget, and Year views

import { StateNode } from "tldraw"

export class CalendarTool extends StateNode {
  static override id = "calendar"
  static override initial = "idle"
  static override children = () => [CalendarIdle]
}

export class CalendarIdle extends StateNode {
  static override id = "idle"
  tooltipElement?: HTMLDivElement
  mouseMoveHandler?: (e: MouseEvent) => void
  isCreatingShape = false

  override onEnter = () => {
    // Set cursor to cross
    this.editor.setCursor({ type: "cross", rotation: 0 })

    // Create tooltip element
    this.tooltipElement = document.createElement("div")
    this.tooltipElement.textContent = "Click anywhere to place Calendar"
    this.tooltipElement.style.cssText = `
      position: fixed;
      background: rgba(34, 197, 94, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      white-space: nowrap;
    `
    document.body.appendChild(this.tooltipElement)

    // Update tooltip position on mouse move
    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.tooltipElement) {
        this.tooltipElement.style.left = `${e.clientX + 15}px`
        this.tooltipElement.style.top = `${e.clientY - 35}px`
      }
    }
    document.addEventListener("mousemove", this.mouseMoveHandler)
  }

  override onPointerDown = (info?: any) => {
    // Validate click event
    if (!info?.point || info.button === undefined) return
    if (info.button !== 0) return // Only left mouse button

    // Prevent UI element clicks from creating shapes
    if (info.target?.closest?.("[data-tldraw-ui]")) return

    // Prevent double-creation
    if (this.isCreatingShape) return

    // Convert screen coords to page coords
    const pagePoint = this.editor.screenToPage(info.point)
    this.createCalendarShape(pagePoint.x, pagePoint.y)
  }

  private createCalendarShape(clickX: number, clickY: number) {
    this.isCreatingShape = true

    try {
      // Check if a Calendar already exists - focus it instead of creating new one
      const existingCalendar = this.editor
        .getCurrentPageShapes()
        .find((s) => s.type === "Calendar")

      if (existingCalendar) {
        // Focus existing calendar
        this.editor.setSelectedShapes([existingCalendar.id])
        const bounds = this.editor.getShapePageBounds(existingCalendar.id)
        if (bounds) {
          this.editor.zoomToBounds(bounds, {
            inset: 50,
            animation: { duration: 300, easing: (t) => t * (2 - t) },
          })
        }
        this.editor.setCurrentTool("select")
        setTimeout(() => {
          this.isCreatingShape = false
        }, 200)
        return
      }

      // Default to browser view size
      const shapeWidth = 900
      const shapeHeight = 650

      // Center shape on click
      const baseX = clickX - shapeWidth / 2
      const baseY = clickY - shapeHeight / 2

      const calendarShape = this.editor.createShape({
        type: "Calendar",
        x: baseX,
        y: baseY,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          currentView: "browser",
        },
      })

      // Switch back to select tool
      this.editor.setCurrentTool("select")

      // Reset flag after tool switch
      setTimeout(() => {
        this.isCreatingShape = false
      }, 200)
    } catch (error) {
      console.error("Error creating Calendar shape:", error)
      this.isCreatingShape = false
    }
  }

  override onExit = () => {
    // Clean up tooltip and listeners
    if (this.mouseMoveHandler) {
      document.removeEventListener("mousemove", this.mouseMoveHandler)
      this.mouseMoveHandler = undefined
    }
    if (this.tooltipElement?.parentNode) {
      document.body.removeChild(this.tooltipElement)
      this.tooltipElement = undefined
    }
  }

  // Cancel on escape
  override onCancel = () => {
    this.editor.setCurrentTool("select")
  }
}
