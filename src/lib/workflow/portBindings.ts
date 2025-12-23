/**
 * Port Binding Utilities
 *
 * Manages port-to-port connections between workflow blocks via tldraw arrows.
 * Stores binding info in arrow metadata and provides utilities for querying.
 */

import { Editor, TLShapeId, TLArrowShape, TLShape, TLArrowShapeArrowheadStyle, JsonObject } from 'tldraw'
import { PortBinding } from './types'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'

// =============================================================================
// Arrow Metadata Types
// =============================================================================

export interface WorkflowArrowMeta extends JsonObject {
  isWorkflowBinding?: boolean
  fromPortId?: string
  toPortId?: string
  validated?: boolean
  dataType?: string
}

// Type guard for arrow binding terminal
interface ArrowBindingTerminal {
  type: 'binding'
  boundShapeId: TLShapeId
  normalizedAnchor: { x: number; y: number }
  isExact: boolean
  isPrecise: boolean
}

function isArrowBinding(terminal: unknown): terminal is ArrowBindingTerminal {
  return (
    terminal !== null &&
    typeof terminal === 'object' &&
    'type' in terminal &&
    (terminal as { type: string }).type === 'binding' &&
    'boundShapeId' in terminal
  )
}

// =============================================================================
// Binding Extraction
// =============================================================================

/**
 * Extract port binding info from an arrow shape
 */
export function getPortBinding(
  editor: Editor,
  arrowId: TLShapeId
): PortBinding | null {
  const arrow = editor.getShape(arrowId) as TLArrowShape | undefined
  if (!arrow || arrow.type !== 'arrow') return null

  const meta = arrow.meta as WorkflowArrowMeta
  if (!meta?.isWorkflowBinding) return null

  const startBinding = arrow.props.start
  const endBinding = arrow.props.end

  if (!isArrowBinding(startBinding) || !isArrowBinding(endBinding)) {
    return null
  }

  return {
    fromShapeId: startBinding.boundShapeId,
    fromPortId: meta.fromPortId || 'output',
    toShapeId: endBinding.boundShapeId,
    toPortId: meta.toPortId || 'input',
    arrowId: arrowId,
  }
}

/**
 * Get all port bindings in the editor
 */
export function getAllBindings(editor: Editor): PortBinding[] {
  const arrows = editor.getCurrentPageShapes().filter(
    (s): s is TLArrowShape => s.type === 'arrow'
  )

  const bindings: PortBinding[] = []
  for (const arrow of arrows) {
    const binding = getPortBinding(editor, arrow.id)
    if (binding) {
      bindings.push(binding)
    }
  }

  return bindings
}

/**
 * Get all arrows connected to workflow blocks (even without metadata)
 */
export function getWorkflowArrows(editor: Editor): TLArrowShape[] {
  const arrows = editor.getCurrentPageShapes().filter(
    (s): s is TLArrowShape => s.type === 'arrow'
  )

  return arrows.filter(arrow => {
    const start = arrow.props.start
    const end = arrow.props.end

    if (!isArrowBinding(start) || !isArrowBinding(end)) {
      return false
    }

    const startShape = editor.getShape(start.boundShapeId)
    const endShape = editor.getShape(end.boundShapeId)

    return (
      startShape?.type === 'WorkflowBlock' ||
      endShape?.type === 'WorkflowBlock'
    )
  })
}

// =============================================================================
// Block-specific Queries
// =============================================================================

/**
 * Get all input bindings for a workflow block
 */
export function getBlockInputBindings(
  editor: Editor,
  blockId: TLShapeId
): PortBinding[] {
  return getAllBindings(editor).filter(b => b.toShapeId === blockId)
}

/**
 * Get all output bindings for a workflow block
 */
export function getBlockOutputBindings(
  editor: Editor,
  blockId: TLShapeId
): PortBinding[] {
  return getAllBindings(editor).filter(b => b.fromShapeId === blockId)
}

/**
 * Get all connected block IDs for a given block
 */
export function getConnectedBlocks(
  editor: Editor,
  blockId: TLShapeId
): { upstream: TLShapeId[]; downstream: TLShapeId[] } {
  const bindings = getAllBindings(editor)

  const upstream = bindings
    .filter(b => b.toShapeId === blockId)
    .map(b => b.fromShapeId)

  const downstream = bindings
    .filter(b => b.fromShapeId === blockId)
    .map(b => b.toShapeId)

  return { upstream, downstream }
}

/**
 * Get the binding for a specific input port
 */
export function getInputPortBinding(
  editor: Editor,
  blockId: TLShapeId,
  portId: string
): PortBinding | null {
  const bindings = getBlockInputBindings(editor, blockId)
  return bindings.find(b => b.toPortId === portId) || null
}

/**
 * Get all bindings for a specific output port
 */
export function getOutputPortBindings(
  editor: Editor,
  blockId: TLShapeId,
  portId: string
): PortBinding[] {
  return getBlockOutputBindings(editor, blockId).filter(
    b => b.fromPortId === portId
  )
}

// =============================================================================
// Binding Creation & Updates
// =============================================================================

/**
 * Mark an arrow as a workflow binding with port metadata
 */
export function setArrowBinding(
  editor: Editor,
  arrowId: TLShapeId,
  fromPortId: string,
  toPortId: string,
  dataType?: string
): void {
  editor.updateShape({
    id: arrowId,
    type: 'arrow',
    meta: {
      isWorkflowBinding: true,
      fromPortId,
      toPortId,
      validated: true,
      dataType,
    } as WorkflowArrowMeta,
  })
}

/**
 * Clear workflow binding metadata from an arrow
 */
export function clearArrowBinding(editor: Editor, arrowId: TLShapeId): void {
  editor.updateShape({
    id: arrowId,
    type: 'arrow',
    meta: {
      isWorkflowBinding: false,
      fromPortId: undefined,
      toPortId: undefined,
      validated: false,
      dataType: undefined,
    } as WorkflowArrowMeta,
  })
}

/**
 * Remove a binding (delete the arrow)
 */
export function removeBinding(editor: Editor, binding: PortBinding): void {
  editor.deleteShape(binding.arrowId)
}

// =============================================================================
// Port Position Helpers
// =============================================================================

/**
 * Calculate the world position of a port on a workflow block
 */
export function getPortWorldPosition(
  editor: Editor,
  blockId: TLShapeId,
  portId: string,
  direction: 'input' | 'output'
): { x: number; y: number } | null {
  const shape = editor.getShape(blockId) as IWorkflowBlock | undefined
  if (!shape || shape.type !== 'WorkflowBlock') return null

  // Get the shape's transform
  const point = editor.getShapePageTransform(blockId)?.point()
  if (!point) return null

  // Import dynamically to avoid circular deps
  const { getBlockDefinition, hasBlockDefinition } = require('./blockRegistry')

  if (!hasBlockDefinition(shape.props.blockType)) {
    return null
  }

  const definition = getBlockDefinition(shape.props.blockType)
  const ports = direction === 'input' ? definition.inputs : definition.outputs
  const portIndex = ports.findIndex((p: { id: string }) => p.id === portId)

  if (portIndex === -1) return null

  const PORT_SIZE = 12
  const PORT_SPACING = 28
  const HEADER_HEIGHT = 36

  const x = direction === 'input' ? 0 : shape.props.w
  const y = HEADER_HEIGHT + 12 + portIndex * PORT_SPACING + PORT_SIZE / 2

  return {
    x: point.x + x,
    y: point.y + y,
  }
}

// =============================================================================
// Connection Validation Helpers
// =============================================================================

/**
 * Check if a connection already exists between two ports
 */
export function connectionExists(
  editor: Editor,
  fromBlockId: TLShapeId,
  fromPortId: string,
  toBlockId: TLShapeId,
  toPortId: string
): boolean {
  const bindings = getAllBindings(editor)
  return bindings.some(
    b =>
      b.fromShapeId === fromBlockId &&
      b.fromPortId === fromPortId &&
      b.toShapeId === toBlockId &&
      b.toPortId === toPortId
  )
}

/**
 * Check if an input port already has a connection
 */
export function inputPortHasConnection(
  editor: Editor,
  blockId: TLShapeId,
  portId: string
): boolean {
  return getInputPortBinding(editor, blockId, portId) !== null
}

/**
 * Get the list of connected input port IDs for a block
 */
export function getConnectedInputPorts(
  editor: Editor,
  blockId: TLShapeId
): string[] {
  return getBlockInputBindings(editor, blockId).map(b => b.toPortId)
}

/**
 * Get the list of connected output port IDs for a block
 */
export function getConnectedOutputPorts(
  editor: Editor,
  blockId: TLShapeId
): string[] {
  const bindings = getBlockOutputBindings(editor, blockId)
  return [...new Set(bindings.map(b => b.fromPortId))]
}

// =============================================================================
// Graph Traversal
// =============================================================================

/**
 * Get all workflow blocks in topological order (for execution)
 */
export function getExecutionOrder(
  editor: Editor,
  startBlockId?: TLShapeId
): TLShapeId[] {
  const bindings = getAllBindings(editor)
  const blocks = editor
    .getCurrentPageShapes()
    .filter((s): s is IWorkflowBlock => s.type === 'WorkflowBlock')
    .map(s => s.id)

  // Build adjacency list
  const graph = new Map<TLShapeId, Set<TLShapeId>>()
  const inDegree = new Map<TLShapeId, number>()

  for (const blockId of blocks) {
    graph.set(blockId, new Set())
    inDegree.set(blockId, 0)
  }

  for (const binding of bindings) {
    if (blocks.includes(binding.fromShapeId) && blocks.includes(binding.toShapeId)) {
      graph.get(binding.fromShapeId)?.add(binding.toShapeId)
      inDegree.set(
        binding.toShapeId,
        (inDegree.get(binding.toShapeId) || 0) + 1
      )
    }
  }

  // Kahn's algorithm for topological sort
  const queue: TLShapeId[] = []
  const result: TLShapeId[] = []

  // Start from specified block or all roots
  if (startBlockId && blocks.includes(startBlockId)) {
    queue.push(startBlockId)
  } else {
    for (const [blockId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(blockId)
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    for (const neighbor of graph.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  return result
}

/**
 * Get all blocks downstream from a given block
 */
export function getDownstreamBlocks(
  editor: Editor,
  blockId: TLShapeId
): TLShapeId[] {
  const visited = new Set<TLShapeId>()
  const result: TLShapeId[] = []

  function dfs(current: TLShapeId) {
    if (visited.has(current)) return
    visited.add(current)

    const downstream = getBlockOutputBindings(editor, current).map(
      b => b.toShapeId
    )

    for (const next of downstream) {
      result.push(next)
      dfs(next)
    }
  }

  dfs(blockId)
  return result
}

/**
 * Get all blocks upstream from a given block
 */
export function getUpstreamBlocks(
  editor: Editor,
  blockId: TLShapeId
): TLShapeId[] {
  const visited = new Set<TLShapeId>()
  const result: TLShapeId[] = []

  function dfs(current: TLShapeId) {
    if (visited.has(current)) return
    visited.add(current)

    const upstream = getBlockInputBindings(editor, current).map(
      b => b.fromShapeId
    )

    for (const prev of upstream) {
      result.push(prev)
      dfs(prev)
    }
  }

  dfs(blockId)
  return result
}
