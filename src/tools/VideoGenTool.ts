import { StateNode } from 'tldraw'
import { findNonOverlappingPosition } from '@/utils/shapeCollisionUtils'

export class VideoGenTool extends StateNode {
  static override id = 'VideoGen'
  static override initial = 'idle'
  static override children = () => [VideoGenIdle]

  onSelect() {
    console.log('🎬 VideoGenTool: tool selected - waiting for user click')
  }
}

export class VideoGenIdle extends StateNode {
  static override id = 'idle'

  tooltipElement?: HTMLDivElement
  mouseMoveHandler?: (e: MouseEvent) => void

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 })

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
    this.tooltipElement.textContent = 'Click anywhere to place Video Generator'

    document.body.appendChild(this.tooltipElement)

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.tooltipElement) {
        const x = e.clientX + 15
        const y = e.clientY - 35

        const rect = this.tooltipElement.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        let finalX = x
        let finalY = y

        if (x + rect.width > viewportWidth) {
          finalX = e.clientX - rect.width - 15
        }

        if (y + rect.height > viewportHeight) {
          finalY = e.clientY - rect.height - 15
        }

        finalX = Math.max(10, finalX)
        finalY = Math.max(10, finalY)

        this.tooltipElement.style.left = `${finalX}px`
        this.tooltipElement.style.top = `${finalY}px`
      }
    }

    document.addEventListener('mousemove', this.mouseMoveHandler)
  }

  override onPointerDown = () => {
    const { currentPagePoint } = this.editor.inputs
    this.createVideoGenShape(currentPagePoint.x, currentPagePoint.y)
  }

  override onExit = () => {
    this.cleanupTooltip()
  }

  private cleanupTooltip = () => {
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = undefined
    }

    if (this.tooltipElement && this.tooltipElement.parentNode) {
      document.body.removeChild(this.tooltipElement)
      this.tooltipElement = undefined
    }
  }

  private createVideoGenShape(clickX: number, clickY: number) {
    try {
      const currentCamera = this.editor.getCamera()
      this.editor.stopCameraAnimation()

      const shapeWidth = 500
      const shapeHeight = 450

      const baseX = clickX - shapeWidth / 2
      const baseY = clickY - shapeHeight / 2

      const videoGenShape = this.editor.createShape({
        type: 'VideoGen',
        x: baseX,
        y: baseY,
        props: {
          w: shapeWidth,
          h: shapeHeight,
        }
      })

      console.log('🎬 Created VideoGen shape:', videoGenShape.id)

      const newCamera = this.editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }

      this.cleanupTooltip()
      this.editor.setCurrentTool('select')

    } catch (error) {
      console.error('❌ Error creating VideoGen shape:', error)
    }
  }
}
