/**
 * WorkflowPropagator
 *
 * A propagator that handles real-time data flow between workflow blocks.
 * When a workflow block's output changes, it automatically propagates
 * the data to connected downstream blocks and triggers their execution.
 *
 * Uses the 'flow' prefix for arrows (e.g., flow{ ... } in arrow text)
 * to identify workflow connections.
 */

import {
  Editor,
  TLArrowBinding,
  TLArrowShape,
  TLShape,
  TLShapeId,
} from 'tldraw'
import { getEdge, getArrowsFromShape } from './tlgraph'
import { isShapeOfType } from './utils'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'
import {
  getPortBinding,
  getBlockOutputBindings,
  getDownstreamBlocks,
} from '@/lib/workflow/portBindings'
import { executeBlock } from '@/lib/workflow/executor'
import { canConnect } from '@/lib/workflow/validation'
import { getBlockDefinition, hasBlockDefinition } from '@/lib/workflow/blockRegistry'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Whether to auto-execute downstream blocks when outputs change
 */
let autoExecuteEnabled = true

/**
 * Debounce time for propagation (ms)
 */
const PROPAGATION_DEBOUNCE = 100

/**
 * Enable/disable auto-execution
 */
export function setAutoExecute(enabled: boolean): void {
  autoExecuteEnabled = enabled
}

/**
 * Get auto-execution status
 */
export function isAutoExecuteEnabled(): boolean {
  return autoExecuteEnabled
}

// =============================================================================
// Propagator State
// =============================================================================

interface PropagatorState {
  editor: Editor | null
  watchedBlocks: Set<TLShapeId>
  pendingPropagations: Map<TLShapeId, NodeJS.Timeout>
  executingBlocks: Set<TLShapeId>
}

const state: PropagatorState = {
  editor: null,
  watchedBlocks: new Set(),
  pendingPropagations: new Map(),
  executingBlocks: new Set(),
}

// =============================================================================
// Propagator Functions
// =============================================================================

/**
 * Check if a shape is a workflow block
 */
function isWorkflowBlock(shape: TLShape | undefined): shape is IWorkflowBlock {
  return shape?.type === 'WorkflowBlock'
}

/**
 * Check if an arrow is a workflow connection (connects two workflow blocks)
 */
function isWorkflowArrow(editor: Editor, arrowId: TLShapeId): boolean {
  const arrow = editor.getShape(arrowId) as TLArrowShape | undefined
  if (!arrow || arrow.type !== 'arrow') return false

  const bindings = editor.getBindingsInvolvingShape<TLArrowBinding>(arrowId)
  if (bindings.length !== 2) return false

  const startBinding = bindings.find(b => b.props.terminal === 'start')
  const endBinding = bindings.find(b => b.props.terminal === 'end')

  if (!startBinding || !endBinding) return false

  const startShape = editor.getShape(startBinding.toId)
  const endShape = editor.getShape(endBinding.toId)

  return isWorkflowBlock(startShape) && isWorkflowBlock(endShape)
}

/**
 * Propagate output data from a block to its downstream connections
 */
async function propagateOutputs(
  editor: Editor,
  sourceBlockId: TLShapeId
): Promise<void> {
  if (!autoExecuteEnabled) return
  if (state.executingBlocks.has(sourceBlockId)) return

  const sourceShape = editor.getShape(sourceBlockId) as IWorkflowBlock | undefined
  if (!sourceShape || !isWorkflowBlock(sourceShape)) return

  const outputBindings = getBlockOutputBindings(editor, sourceBlockId)
  const downstreamBlocks = new Set<TLShapeId>()

  // Collect downstream blocks and update their input values
  for (const binding of outputBindings) {
    const outputValue = sourceShape.props.outputValues?.[binding.fromPortId]

    if (outputValue !== undefined) {
      // Update the target block's input value
      const targetShape = editor.getShape(binding.toShapeId) as IWorkflowBlock | undefined
      if (targetShape && isWorkflowBlock(targetShape)) {
        editor.updateShape<IWorkflowBlock>({
          id: binding.toShapeId,
          type: 'WorkflowBlock',
          props: {
            inputValues: {
              ...targetShape.props.inputValues,
              [binding.toPortId]: outputValue,
            },
          },
        })
        downstreamBlocks.add(binding.toShapeId)
      }
    }
  }

  // Execute downstream blocks if auto-execute is enabled
  for (const blockId of downstreamBlocks) {
    // Skip blocks that are already executing
    if (state.executingBlocks.has(blockId)) continue

    const blockShape = editor.getShape(blockId) as IWorkflowBlock | undefined
    if (!blockShape) continue

    // Check if block has all required inputs satisfied
    if (hasBlockDefinition(blockShape.props.blockType)) {
      const definition = getBlockDefinition(blockShape.props.blockType)
      const requiredInputs = definition.inputs.filter(i => i.required)
      const hasAllRequired = requiredInputs.every(input => {
        const inputValue = blockShape.props.inputValues?.[input.id]
        return inputValue !== undefined
      })

      if (hasAllRequired) {
        // Debounce execution to avoid rapid-fire updates
        const existingTimeout = state.pendingPropagations.get(blockId)
        if (existingTimeout) clearTimeout(existingTimeout)

        const timeout = setTimeout(async () => {
          state.pendingPropagations.delete(blockId)
          state.executingBlocks.add(blockId)

          try {
            await executeBlock(editor, blockId)
          } finally {
            state.executingBlocks.delete(blockId)
          }
        }, PROPAGATION_DEBOUNCE)

        state.pendingPropagations.set(blockId, timeout)
      }
    }
  }
}

/**
 * Handle workflow block changes
 */
function onBlockChange(editor: Editor, shape: TLShape): void {
  if (!isWorkflowBlock(shape)) return

  // Check if output values changed
  const oldShape = editor.store.query.record('shape', () => shape.id)
  if (oldShape && isWorkflowBlock(oldShape as TLShape)) {
    const oldOutputs = (oldShape as IWorkflowBlock).props.outputValues
    const newOutputs = shape.props.outputValues

    // Only propagate if outputs actually changed
    if (JSON.stringify(oldOutputs) !== JSON.stringify(newOutputs)) {
      propagateOutputs(editor, shape.id)
    }
  }
}

/**
 * Handle arrow changes to update port bindings
 */
function onArrowChange(editor: Editor, arrow: TLArrowShape): void {
  if (!isWorkflowArrow(editor, arrow.id)) return

  const edge = getEdge(arrow, editor)
  if (!edge) return

  const fromShape = editor.getShape(edge.from) as IWorkflowBlock | undefined
  const toShape = editor.getShape(edge.to) as IWorkflowBlock | undefined

  if (!fromShape || !toShape) return
  if (!isWorkflowBlock(fromShape) || !isWorkflowBlock(toShape)) return

  // Determine port IDs based on arrow position or existing meta
  const meta = (arrow.meta || {}) as { fromPortId?: string; toPortId?: string }

  // If meta already has port IDs, validate the connection
  if (meta.fromPortId && meta.toPortId) {
    if (!hasBlockDefinition(fromShape.props.blockType) ||
        !hasBlockDefinition(toShape.props.blockType)) {
      return
    }

    const fromDef = getBlockDefinition(fromShape.props.blockType)
    const toDef = getBlockDefinition(toShape.props.blockType)

    const fromPort = fromDef.outputs.find(p => p.id === meta.fromPortId)
    const toPort = toDef.inputs.find(p => p.id === meta.toPortId)

    if (fromPort && toPort && canConnect(fromPort, toPort)) {
      // Valid connection - update arrow color to indicate valid
      editor.updateShape({
        id: arrow.id,
        type: 'arrow',
        props: { color: 'black' },
      })
    } else {
      // Invalid connection
      editor.updateShape({
        id: arrow.id,
        type: 'arrow',
        props: { color: 'orange' },
      })
    }
  } else {
    // Auto-detect ports based on first available compatible pair
    if (!hasBlockDefinition(fromShape.props.blockType) ||
        !hasBlockDefinition(toShape.props.blockType)) {
      return
    }

    const fromDef = getBlockDefinition(fromShape.props.blockType)
    const toDef = getBlockDefinition(toShape.props.blockType)

    // Find first compatible port pair
    for (const outputPort of fromDef.outputs) {
      for (const inputPort of toDef.inputs) {
        if (canConnect(outputPort, inputPort)) {
          // Set port binding on arrow meta
          editor.updateShape({
            id: arrow.id,
            type: 'arrow',
            meta: {
              ...arrow.meta,
              fromPortId: outputPort.id,
              toPortId: inputPort.id,
              validated: true,
            },
            props: { color: 'black' },
          })
          return
        }
      }
    }

    // No compatible ports found
    editor.updateShape({
      id: arrow.id,
      type: 'arrow',
      props: { color: 'orange' },
    })
  }
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register the workflow propagator with the editor
 */
export function registerWorkflowPropagator(editor: Editor): () => void {
  state.editor = editor
  state.watchedBlocks.clear()
  state.pendingPropagations.clear()
  state.executingBlocks.clear()

  // Initialize: find all existing workflow blocks
  for (const shape of editor.getCurrentPageShapes()) {
    if (isWorkflowBlock(shape)) {
      state.watchedBlocks.add(shape.id)
    }
  }

  // Register change handler
  const unsubscribeChange = editor.sideEffects.registerAfterChangeHandler<'shape'>(
    'shape',
    (_, next) => {
      // Handle workflow block changes
      if (isWorkflowBlock(next)) {
        state.watchedBlocks.add(next.id)
        onBlockChange(editor, next)
      }

      // Handle arrow changes
      if (isShapeOfType<TLArrowShape>(next, 'arrow')) {
        onArrowChange(editor, next)
      }
    }
  )

  // Register create handler
  const unsubscribeCreate = editor.sideEffects.registerAfterCreateHandler<'shape'>(
    'shape',
    (shape) => {
      if (isWorkflowBlock(shape)) {
        state.watchedBlocks.add(shape.id)
      }
    }
  )

  // Register delete handler
  const unsubscribeDelete = editor.sideEffects.registerAfterDeleteHandler<'shape'>(
    'shape',
    (shape) => {
      if (shape.type === 'WorkflowBlock') {
        state.watchedBlocks.delete(shape.id)
        state.pendingPropagations.delete(shape.id)
        state.executingBlocks.delete(shape.id)
      }
    }
  )

  // Register binding change handler for arrows
  const unsubscribeBinding = editor.sideEffects.registerAfterChangeHandler<'binding'>(
    'binding',
    (_, binding) => {
      if (binding.type !== 'arrow') return
      const arrow = editor.getShape(binding.fromId)
      if (arrow && isShapeOfType<TLArrowShape>(arrow, 'arrow')) {
        onArrowChange(editor, arrow)
      }
    }
  )

  // Return cleanup function
  return () => {
    unsubscribeChange()
    unsubscribeCreate()
    unsubscribeDelete()
    unsubscribeBinding()

    // Clear pending propagations
    for (const timeout of state.pendingPropagations.values()) {
      clearTimeout(timeout)
    }

    state.editor = null
    state.watchedBlocks.clear()
    state.pendingPropagations.clear()
    state.executingBlocks.clear()
  }
}

/**
 * Manually trigger propagation from a block
 */
export function triggerPropagation(
  editor: Editor,
  blockId: TLShapeId
): Promise<void> {
  return propagateOutputs(editor, blockId)
}

/**
 * Get all blocks currently being watched
 */
export function getWatchedBlocks(): TLShapeId[] {
  return Array.from(state.watchedBlocks)
}

/**
 * Check if a block is currently executing
 */
export function isBlockExecuting(blockId: TLShapeId): boolean {
  return state.executingBlocks.has(blockId)
}
