/**
 * WorkflowPropagator
 *
 * Real-time data propagation for workflow blocks.
 * Automatically executes downstream blocks when source block outputs change.
 * Uses 'flow' prefix syntax: flow{ ... } in arrow text.
 */

import { Editor, TLArrowShape, TLShape, TLShapeId } from 'tldraw'
import { getEdge } from '@/propagators/tlgraph'
import { isShapeOfType } from '@/propagators/utils'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'
import { getBlockDefinition, hasBlockDefinition } from '@/lib/workflow/blockRegistry'
import { executeBlock } from '@/lib/workflow/executor'
import {
  setArrowBinding,
  getBlockInputBindings,
  getConnectedInputPorts,
} from '@/lib/workflow/portBindings'
import { validateRequiredInputs } from '@/lib/workflow/validation'

// =============================================================================
// Propagator Registration
// =============================================================================

/**
 * Register the workflow propagator with the editor
 */
export function registerWorkflowPropagator(editor: Editor): () => void {
  const propagator = new WorkflowPropagator(editor)
  const cleanup: (() => void)[] = []

  // Initial scan for existing workflow arrows
  for (const shape of editor.getCurrentPageShapes()) {
    if (isShapeOfType<TLArrowShape>(shape, 'arrow')) {
      propagator.onArrowChange(shape)
    }
  }

  // Register shape change handler
  const shapeHandler = editor.sideEffects.registerAfterChangeHandler<'shape'>(
    'shape',
    (prev, next) => {
      if (isShapeOfType<TLArrowShape>(next, 'arrow')) {
        propagator.onArrowChange(next)
      } else if (isWorkflowBlock(next)) {
        propagator.onBlockChange(prev as IWorkflowBlock, next as IWorkflowBlock)
      }
    }
  )
  cleanup.push(shapeHandler)

  // Register binding create/delete handlers
  const bindingCreateHandler = editor.sideEffects.registerAfterCreateHandler<'binding'>(
    'binding',
    (binding) => {
      if (binding.type !== 'arrow') return
      const arrow = editor.getShape(binding.fromId)
      if (arrow && isShapeOfType<TLArrowShape>(arrow, 'arrow')) {
        propagator.onArrowChange(arrow)
      }
    }
  )
  cleanup.push(bindingCreateHandler)

  const bindingDeleteHandler = editor.sideEffects.registerAfterDeleteHandler<'binding'>(
    'binding',
    (binding) => {
      if (binding.type !== 'arrow') return
      propagator.removeArrow(binding.fromId)
    }
  )
  cleanup.push(bindingDeleteHandler)

  return () => {
    cleanup.forEach((fn) => fn())
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function isWorkflowBlock(shape: TLShape): shape is IWorkflowBlock {
  return shape.type === 'WorkflowBlock'
}

function isWorkflowArrow(arrow: TLArrowShape): boolean {
  // Check if arrow text starts with 'flow{' or just connects two workflow blocks
  const text = arrow.props.text.trim()
  return text.startsWith('flow{') || text.startsWith('flow (')
}

function parseFlowSyntax(text: string): { fromPort?: string; toPort?: string } | null {
  // Parse flow{ fromPort -> toPort } syntax
  const match = text.match(/^flow\s*\{\s*(\w+)?\s*(?:->|→)?\s*(\w+)?\s*\}$/i)
  if (!match) {
    // Try simple format: flow{}
    if (/^flow\s*\{\s*\}$/.test(text)) {
      return { fromPort: undefined, toPort: undefined }
    }
    return null
  }

  return {
    fromPort: match[1] || undefined,
    toPort: match[2] || undefined,
  }
}

// =============================================================================
// WorkflowPropagator Class
// =============================================================================

class WorkflowPropagator {
  private editor: Editor
  private workflowArrows: Map<TLShapeId, { fromBlock: TLShapeId; toBlock: TLShapeId }> = new Map()
  private pendingExecutions: Set<TLShapeId> = new Set()
  private executionDebounce: Map<TLShapeId, NodeJS.Timeout> = new Map()

  constructor(editor: Editor) {
    this.editor = editor
  }

  /**
   * Called when an arrow changes - check if it's a workflow connection
   */
  onArrowChange(arrow: TLArrowShape): void {
    const edge = getEdge(arrow, this.editor)
    if (!edge) {
      this.removeArrow(arrow.id)
      return
    }

    const fromShape = this.editor.getShape(edge.from)
    const toShape = this.editor.getShape(edge.to)

    // Only track arrows between workflow blocks
    if (!fromShape || !toShape) {
      this.removeArrow(arrow.id)
      return
    }

    if (!isWorkflowBlock(fromShape) || !isWorkflowBlock(toShape)) {
      this.removeArrow(arrow.id)
      return
    }

    // Parse flow syntax if present, or use default ports
    const text = arrow.props.text.trim()
    const parsed = parseFlowSyntax(text)

    // Determine port IDs
    let fromPortId = 'output'
    let toPortId = 'input'

    if (parsed) {
      if (parsed.fromPort) fromPortId = parsed.fromPort
      if (parsed.toPort) toPortId = parsed.toPort
    } else if (!text || !text.startsWith('flow')) {
      // For arrows without explicit flow syntax between workflow blocks,
      // try to infer the first available ports
      const fromDef = hasBlockDefinition(fromShape.props.blockType)
        ? getBlockDefinition(fromShape.props.blockType)
        : null
      const toDef = hasBlockDefinition(toShape.props.blockType)
        ? getBlockDefinition(toShape.props.blockType)
        : null

      if (fromDef?.outputs.length) {
        fromPortId = fromDef.outputs[0].id
      }
      if (toDef?.inputs.length) {
        toPortId = toDef.inputs[0].id
      }
    }

    // Update arrow metadata
    setArrowBinding(this.editor, arrow.id, fromPortId, toPortId)

    // Track this arrow
    this.workflowArrows.set(arrow.id, {
      fromBlock: edge.from,
      toBlock: edge.to,
    })
  }

  /**
   * Called when a workflow block changes
   */
  onBlockChange(prev: IWorkflowBlock, next: IWorkflowBlock): void {
    // Check if outputs changed
    const prevOutputs = prev.props.outputValues
    const nextOutputs = next.props.outputValues

    const outputsChanged =
      JSON.stringify(prevOutputs) !== JSON.stringify(nextOutputs)

    // Check if execution state changed to success
    const justSucceeded =
      prev.props.executionState !== 'success' &&
      next.props.executionState === 'success'

    if (outputsChanged || justSucceeded) {
      this.propagateFromBlock(next.id)
    }
  }

  /**
   * Remove tracking for an arrow
   */
  removeArrow(arrowId: TLShapeId): void {
    this.workflowArrows.delete(arrowId)
  }

  /**
   * Propagate data from a block to all downstream connections
   */
  private propagateFromBlock(blockId: TLShapeId): void {
    const block = this.editor.getShape(blockId) as IWorkflowBlock | undefined
    if (!block || block.type !== 'WorkflowBlock') return

    // Find all arrows originating from this block
    const downstreamBlocks = new Set<TLShapeId>()

    for (const [, connection] of this.workflowArrows) {
      if (connection.fromBlock === blockId) {
        downstreamBlocks.add(connection.toBlock)
      }
    }

    // Schedule execution for each downstream block
    for (const targetBlockId of downstreamBlocks) {
      this.scheduleExecution(targetBlockId)
    }
  }

  /**
   * Schedule block execution with debouncing
   */
  private scheduleExecution(blockId: TLShapeId): void {
    // Cancel any pending execution for this block
    const existing = this.executionDebounce.get(blockId)
    if (existing) {
      clearTimeout(existing)
    }

    // Schedule new execution
    const timeout = setTimeout(() => {
      this.executeBlockIfReady(blockId)
      this.executionDebounce.delete(blockId)
    }, 50) // 50ms debounce

    this.executionDebounce.set(blockId, timeout)
  }

  /**
   * Execute a block if all required inputs are satisfied
   */
  private async executeBlockIfReady(blockId: TLShapeId): Promise<void> {
    if (this.pendingExecutions.has(blockId)) return
    this.pendingExecutions.add(blockId)

    try {
      const block = this.editor.getShape(blockId) as IWorkflowBlock | undefined
      if (!block || block.type !== 'WorkflowBlock') return

      const { blockType, inputValues } = block.props

      if (!hasBlockDefinition(blockType)) return

      // Check if all required inputs are satisfied
      const connectedInputs = getConnectedInputPorts(this.editor, blockId)
      const validation = validateRequiredInputs(
        blockType,
        inputValues,
        connectedInputs
      )

      // Gather input values from upstream blocks
      const inputs = this.gatherInputs(blockId)

      // If validation passes (or has only warnings), execute
      if (validation.valid || validation.errors.length === 0) {
        await executeBlock(this.editor, blockId, inputs)
      }
    } finally {
      this.pendingExecutions.delete(blockId)
    }
  }

  /**
   * Gather input values from upstream connected blocks
   */
  private gatherInputs(blockId: TLShapeId): Record<string, unknown> {
    const inputs: Record<string, unknown> = {}
    const bindings = getBlockInputBindings(this.editor, blockId)

    for (const binding of bindings) {
      const sourceBlock = this.editor.getShape(
        binding.fromShapeId
      ) as IWorkflowBlock | undefined

      if (sourceBlock && sourceBlock.type === 'WorkflowBlock') {
        const sourceOutputs = sourceBlock.props.outputValues
        if (binding.fromPortId in sourceOutputs) {
          inputs[binding.toPortId] = sourceOutputs[binding.fromPortId]
        }
      }
    }

    // Include any static input values
    const block = this.editor.getShape(blockId) as IWorkflowBlock | undefined
    if (block && block.type === 'WorkflowBlock') {
      for (const [key, value] of Object.entries(block.props.inputValues)) {
        if (!(key in inputs)) {
          inputs[key] = value
        }
      }
    }

    return inputs
  }
}

export default WorkflowPropagator
