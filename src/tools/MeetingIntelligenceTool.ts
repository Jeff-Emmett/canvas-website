import { StateNode } from "tldraw"

export class MeetingIntelligenceTool extends StateNode {
  static override id = "meeting-intelligence"
  static override initial = "idle"
  static override children = () => [MeetingIntelligenceIdle]
}

export class MeetingIntelligenceIdle extends StateNode {
  static override id = "idle"

  tooltipElement?: HTMLDivElement
  mouseMoveHandler?: (e: MouseEvent) => void
  isCreatingShape = false

  override onEnter = () => {
    this.editor.setCursor({ type: "cross", rotation: 0 })

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
    this.tooltipElement.textContent = 'Click anywhere to place Meeting Intelligence browser'
    document.body.appendChild(this.tooltipElement)

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.tooltipElement) {
        let x = e.clientX + 15
        let y = e.clientY - 35
        const rect = this.tooltipElement.getBoundingClientRect()
        if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 15
        if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 15
        x = Math.max(10, x)
        y = Math.max(10, y)
        this.tooltipElement.style.left = `${x}px`
        this.tooltipElement.style.top = `${y}px`
      }
    }
    document.addEventListener('mousemove', this.mouseMoveHandler)
  }

  override onPointerDown = (info?: any) => {
    if (this.isCreatingShape) return
    if (!info || !info.point || info.button === undefined) return
    if (info.button !== 0) return

    if (info.target && typeof info.target === 'object') {
      const target = info.target as HTMLElement
      if (target.closest('[data-tldraw-ui]') ||
        target.closest('.tlui-menu') ||
        target.closest('.tlui-toolbar') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="toolbar"]')) {
        return
      }
    }

    let clickX: number | undefined
    let clickY: number | undefined

    if (info.point) {
      try {
        const pagePoint = this.editor.screenToPage(info.point)
        clickX = pagePoint.x
        clickY = pagePoint.y
      } catch (e) {
        console.error('MeetingIntelligenceTool: Failed to convert point', e)
      }
    }

    if (clickX === undefined || clickY === undefined) return
    if (clickX === 0 && clickY === 0) return

    const currentTool = this.editor.getCurrentToolId()
    if (currentTool !== 'meeting-intelligence') return

    this.createShape(clickX, clickY)
  }

  override onExit = () => {
    this.cleanupTooltip()
    this.isCreatingShape = false
  }

  private cleanupTooltip = () => {
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = undefined
    }
    if (this.tooltipElement) {
      document.body.removeChild(this.tooltipElement)
      this.tooltipElement = undefined
    }
  }

  private createShape(clickX: number, clickY: number) {
    this.isCreatingShape = true
    try {
      const currentCamera = this.editor.getCamera()
      this.editor.stopCameraAnimation()

      const shapeWidth = 800
      const shapeHeight = 600
      const finalX = clickX - shapeWidth / 2
      const finalY = clickY - shapeHeight / 2

      const browserShape = this.editor.createShape({
        type: 'MeetingIntelligenceBrowser',
        x: finalX,
        y: finalY,
        props: { w: shapeWidth, h: shapeHeight },
      })

      const newCamera = this.editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }

      const shapeId = browserShape.id.startsWith('shape:') ? browserShape.id : `shape:${browserShape.id}`
      const camBefore = this.editor.getCamera()
      this.editor.stopCameraAnimation()
      this.editor.setSelectedShapes([shapeId] as any)
      this.editor.setCurrentTool('select')

      const camAfter = this.editor.getCamera()
      if (camBefore.x !== camAfter.x || camBefore.y !== camAfter.y || camBefore.z !== camAfter.z) {
        this.editor.setCamera(camBefore, { animation: { duration: 0 } })
      }

      setTimeout(() => { this.isCreatingShape = false }, 200)
    } catch (error) {
      console.error('Error creating MeetingIntelligenceBrowser shape:', error)
      this.isCreatingShape = false
      throw error
    }
  }
}
