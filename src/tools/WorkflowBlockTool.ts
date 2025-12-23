/**
 * WorkflowBlockTool
 *
 * A StateNode-based tool for placing workflow blocks on the canvas.
 * Shows a tooltip with the block type and creates the block on click.
 */

import { StateNode, TLEventHandlers, createShapeId } from 'tldraw'
import { getBlockDefinition, hasBlockDefinition } from '@/lib/workflow/blockRegistry'
import { CATEGORY_INFO } from '@/lib/workflow/types'

// Store the selected block type for creation
let selectedBlockType = 'trigger.manual'

/**
 * Set the block type that will be created when clicking
 */
export function setWorkflowBlockType(blockType: string): void {
  selectedBlockType = blockType
}

/**
 * Get the currently selected block type
 */
export function getWorkflowBlockType(): string {
  return selectedBlockType
}

/**
 * Main WorkflowBlock tool
 */
export class WorkflowBlockTool extends StateNode {
  static override id = 'WorkflowBlock'
  static override initial = 'idle'
  static override children = () => [WorkflowBlockIdle]
}

/**
 * Idle state - shows tooltip and handles click to create block
 */
export class WorkflowBlockIdle extends StateNode {
  static override id = 'idle'

  tooltipElement?: HTMLDivElement
  mouseMoveHandler?: (e: MouseEvent) => void

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 })

    const blockType = getWorkflowBlockType()
    const definition = hasBlockDefinition(blockType)
      ? getBlockDefinition(blockType)
      : null

    const blockName = definition?.name || 'Workflow Block'
    const categoryInfo = definition ? CATEGORY_INFO[definition.category] : null
    const icon = definition?.icon || '?'

    this.tooltipElement = document.createElement('div')
    this.tooltipElement.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 14px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      white-space: nowrap;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 8px;
    `

    if (categoryInfo) {
      const indicator = document.createElement('span')
      indicator.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${categoryInfo.color};
      `
      this.tooltipElement.appendChild(indicator)
    }

    const textSpan = document.createElement('span')
    textSpan.textContent = `${icon} Click to place ${blockName}`
    this.tooltipElement.appendChild(textSpan)

    document.body.appendChild(this.tooltipElement)

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.tooltipElement) {
        const x = e.clientX + 15
        const y = e.clientY - 40

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

  override onPointerDown: TLEventHandlers['onPointerDown'] = () => {
    const { currentPagePoint } = this.editor.inputs
    this.createWorkflowBlock(currentPagePoint.x, currentPagePoint.y)
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
      this.tooltipElement.parentNode.removeChild(this.tooltipElement)
      this.tooltipElement = undefined
    }
  }

  private createWorkflowBlock(clickX: number, clickY: number) {
    try {
      const blockType = getWorkflowBlockType()
      const definition = hasBlockDefinition(blockType)
        ? getBlockDefinition(blockType)
        : null

      const shapeWidth = 220
      const maxPorts = definition
        ? Math.max(definition.inputs.length, definition.outputs.length)
        : 2
      const shapeHeight = Math.max(150, 36 + 24 + maxPorts * 28 + 60)

      const finalX = clickX - shapeWidth / 2
      const finalY = clickY - shapeHeight / 2

      // Create a unique ID for the shape
      const shapeId = createShapeId()

      this.editor.createShape({
        id: shapeId,
        type: 'WorkflowBlock',
        x: finalX,
        y: finalY,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          blockType: blockType,
          blockConfig: definition?.defaultConfig || {},
          inputValues: {},
          outputValues: {},
          executionState: 'idle',
          tags: ['workflow', definition?.category || 'block'],
          pinnedToView: false,
        },
      })

      this.editor.setSelectedShapes([shapeId])
      this.editor.setCurrentTool('select')

    } catch (error) {
      console.error('Error creating WorkflowBlock shape:', error)
    }
  }
}

export default WorkflowBlockTool
