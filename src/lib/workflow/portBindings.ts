/**
 * Port Binding Utilities
 *
 * Handles the connection between workflow blocks via arrows.
 * Stores port metadata in arrow meta and provides utilities for
 * querying connections between blocks.
 */

import {
  Editor,
  TLArrowBinding,
  TLArrowShape,
  TLShape,
  TLShapeId,
  Vec,
} from 'tldraw'
import { PortBinding } from './types'
import { getBlockDefinition, hasBlockDefinition } from './blockRegistry'
import { validateConnection } from './validation'

// =============================================================================
// Port Position Constants
// =============================================================================

const PORT_SIZE = 12
const PORT_SPACING = 28
const HEADER_HEIGHT = 36

// =============================================================================
// Port Position Calculation
// =============================================================================

/**
 * Get the position of a port in world coordinates
 */
export function getPortWorldPosition(
  editor: Editor,
  shapeId: TLShapeId,
  portId: string,
  direction: 'input' | 'output'
): Vec | null {
  const shape = editor.getShape(shapeId)
  if (!shape || shape.type !== 'WorkflowBlock') return null

  const props = shape.props as { w: number; blockType: string }
  if (!hasBlockDefinition(props.blockType)) return null

  const definition = getBlockDefinition(props.blockType)
  const ports = direction === 'input' ? definition.inputs : definition.outputs
  const portIndex = ports.findIndex(p => p.id === portId)

  if (portIndex === -1) return null

  // Calculate local position
  const localX = direction === 'input' ? 0 : props.w
  const localY = HEADER_HEIGHT + 12 + portIndex * PORT_SPACING + PORT_SIZE / 2

  // Transform to world coordinates
  const point = editor.getShapePageTransform(shapeId)?.applyToPoint({ x: localX, y: localY })
  return point ? new Vec(point.x, point.y) : null
}

/**
 * Find the closest port to a given point on a workflow block
 */
export function findClosestPort(
  editor: Editor,
  shapeId: TLShapeId,
  point: Vec,
  direction: 'input' | 'output'
): { portId: string; distance: number } | null {
  const shape = editor.getShape(shapeId)
  if (!shape || shape.type !== 'WorkflowBlock') return null

  const props = shape.props as { blockType: string }
  if (!hasBlockDefinition(props.blockType)) return null

  const definition = getBlockDefinition(props.blockType)
  const ports = direction === 'input' ? definition.inputs : definition.outputs

  let closestPort: { portId: string; distance: number } | null = null

  for (const port of ports) {
    const portPos = getPortWorldPosition(editor, shapeId, port.id, direction)
    if (!portPos) continue

    const distance = Vec.Dist(point, portPos)
    if (!closestPort || distance < closestPort.distance) {
      closestPort = { portId: port.id, distance }
    }
  }

  return closestPort
}

// =============================================================================
// Arrow Port Metadata
// =============================================================================

/**
 * Arrow meta type for workflow connections
 */
interface WorkflowArrowMeta {
  fromPortId?: string
  toPortId?: string
  validated?: boolean
}

/**
 * Get port binding from an arrow shape
 */
export function getPortBinding(
  editor: Editor,
  arrowId: TLShapeId
): PortBinding | null {
  const arrow = editor.getShape(arrowId) as TLArrowShape | undefined
  if (!arrow || arrow.type !== 'arrow') return null

  const bindings = editor.getBindingsInvolvingShape<TLArrowBinding>(arrowId)
  if (!bindings || bindings.length !== 2) return null

  // Find start and end bindings
  const startBinding = bindings.find(b => b.props.terminal === 'start')
  const endBinding = bindings.find(b => b.props.terminal === 'end')

  if (!startBinding || !endBinding) return null

  // Get meta from arrow
  const meta = (arrow.meta || {}) as WorkflowArrowMeta

  return {
    fromShapeId: startBinding.toId,
    fromPortId: meta.fromPortId || 'output',
    toShapeId: endBinding.toId,
    toPortId: meta.toPortId || 'input',
    arrowId,
  }
}

/**
 * Set port binding metadata on an arrow
 */
export function setPortBinding(
  editor: Editor,
  arrowId: TLShapeId,
  fromPortId: string,
  toPortId: string
): void {
  const arrow = editor.getShape(arrowId) as TLArrowShape | undefined
  if (!arrow || arrow.type !== 'arrow') return

  editor.updateShape({
    id: arrowId,
    type: 'arrow',
    meta: {
      ...arrow.meta,
      fromPortId,
      toPortId,
      validated: true,
    },
  })
}

/**
 * Clear port binding metadata from an arrow
 */
export function clearPortBinding(
  editor: Editor,
  arrowId: TLShapeId
): void {
  const arrow = editor.getShape(arrowId) as TLArrowShape | undefined
  if (!arrow || arrow.type !== 'arrow') return

  const meta = { ...arrow.meta } as WorkflowArrowMeta
  delete meta.fromPortId
  delete meta.toPortId
  delete meta.validated

  editor.updateShape({
    id: arrowId,
    type: 'arrow',
    meta,
  })
}

// =============================================================================
// Connection Queries
// =============================================================================

/**
 * Get all input bindings for a workflow block
 */
export function getBlockInputBindings(
  editor: Editor,
  shapeId: TLShapeId
): PortBinding[] {
  const bindings: PortBinding[] = []

  // Get all arrows ending at this shape
  const arrowBindings = editor.getBindingsToShape<TLArrowBinding>(shapeId, 'arrow')
  const incomingArrows = arrowBindings
    .filter(b => b.props.terminal === 'end')
    .map(b => b.fromId)

  for (const arrowId of incomingArrows) {
    const portBinding = getPortBinding(editor, arrowId)
    if (portBinding) {
      bindings.push(portBinding)
    }
  }

  return bindings
}

/**
 * Get all output bindings from a workflow block
 */
export function getBlockOutputBindings(
  editor: Editor,
  shapeId: TLShapeId
): PortBinding[] {
  const bindings: PortBinding[] = []

  // Get all arrows starting from this shape
  const arrowBindings = editor.getBindingsToShape<TLArrowBinding>(shapeId, 'arrow')
  const outgoingArrows = arrowBindings
    .filter(b => b.props.terminal === 'start')
    .map(b => b.fromId)

  for (const arrowId of outgoingArrows) {
    const portBinding = getPortBinding(editor, arrowId)
    if (portBinding) {
      bindings.push(portBinding)
    }
  }

  return bindings
}

/**
 * Get bindings for a specific input port
 */
export function getInputPortBindings(
  editor: Editor,
  shapeId: TLShapeId,
  portId: string
): PortBinding[] {
  return getBlockInputBindings(editor, shapeId).filter(b => b.toPortId === portId)
}

/**
 * Get bindings for a specific output port
 */
export function getOutputPortBindings(
  editor: Editor,
  shapeId: TLShapeId,
  portId: string
): PortBinding[] {
  return getBlockOutputBindings(editor, shapeId).filter(b => b.fromPortId === portId)
}

/**
 * Check if a specific port is connected
 */
export function isPortConnected(
  editor: Editor,
  shapeId: TLShapeId,
  portId: string,
  direction: 'input' | 'output'
): boolean {
  const bindings = direction === 'input'
    ? getBlockInputBindings(editor, shapeId)
    : getBlockOutputBindings(editor, shapeId)

  const portKey = direction === 'input' ? 'toPortId' : 'fromPortId'
  return bindings.some(b => b[portKey] === portId)
}

/**
 * Get all connected ports for a shape
 */
export function getConnectedPorts(
  editor: Editor,
  shapeId: TLShapeId
): { inputs: string[]; outputs: string[] } {
  const inputBindings = getBlockInputBindings(editor, shapeId)
  const outputBindings = getBlockOutputBindings(editor, shapeId)

  return {
    inputs: [...new Set(inputBindings.map(b => b.toPortId))],
    outputs: [...new Set(outputBindings.map(b => b.fromPortId))],
  }
}

// =============================================================================
// Workflow Graph Utilities
// =============================================================================

/**
 * Get upstream blocks (blocks that feed into this one)
 */
export function getUpstreamBlocks(
  editor: Editor,
  shapeId: TLShapeId
): TLShapeId[] {
  const inputBindings = getBlockInputBindings(editor, shapeId)
  return [...new Set(inputBindings.map(b => b.fromShapeId))]
}

/**
 * Get downstream blocks (blocks that this one feeds into)
 */
export function getDownstreamBlocks(
  editor: Editor,
  shapeId: TLShapeId
): TLShapeId[] {
  const outputBindings = getBlockOutputBindings(editor, shapeId)
  return [...new Set(outputBindings.map(b => b.toShapeId))]
}

/**
 * Get all workflow blocks in the editor
 */
export function getAllWorkflowBlocks(editor: Editor): TLShape[] {
  return editor.getCurrentPageShapes().filter(s => s.type === 'WorkflowBlock')
}

/**
 * Get all arrows connecting workflow blocks
 */
export function getWorkflowArrows(editor: Editor): TLArrowShape[] {
  const workflowBlockIds = new Set(
    getAllWorkflowBlocks(editor).map(s => s.id)
  )

  return (editor.getCurrentPageShapes().filter(s => s.type === 'arrow') as TLArrowShape[])
    .filter(arrow => {
      const binding = getPortBinding(editor, arrow.id)
      return binding &&
        workflowBlockIds.has(binding.fromShapeId) &&
        workflowBlockIds.has(binding.toShapeId)
    })
}

/**
 * Build a workflow graph from the current canvas
 */
export function buildWorkflowGraph(editor: Editor): {
  blocks: Array<{ id: TLShapeId; blockType: string; config: Record<string, unknown> }>
  connections: PortBinding[]
} {
  const blocks = getAllWorkflowBlocks(editor).map(shape => {
    const props = shape.props as { blockType: string; blockConfig: Record<string, unknown> }
    return {
      id: shape.id,
      blockType: props.blockType,
      config: props.blockConfig || {},
    }
  })

  const connections: PortBinding[] = []
  for (const arrow of getWorkflowArrows(editor)) {
    const binding = getPortBinding(editor, arrow.id)
    if (binding) {
      connections.push(binding)
    }
  }

  return { blocks, connections }
}

/**
 * Get topologically sorted execution order
 */
export function getExecutionOrder(editor: Editor): TLShapeId[] {
  const { blocks, connections } = buildWorkflowGraph(editor)

  // Build adjacency list
  const inDegree = new Map<TLShapeId, number>()
  const outEdges = new Map<TLShapeId, TLShapeId[]>()

  for (const block of blocks) {
    inDegree.set(block.id, 0)
    outEdges.set(block.id, [])
  }

  for (const conn of connections) {
    inDegree.set(conn.toShapeId, (inDegree.get(conn.toShapeId) || 0) + 1)
    outEdges.get(conn.fromShapeId)?.push(conn.toShapeId)
  }

  // Kahn's algorithm
  const queue: TLShapeId[] = []
  const result: TLShapeId[] = []

  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    for (const neighbor of outEdges.get(node) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return result
}

// =============================================================================
// Connection Validation Helpers
// =============================================================================

/**
 * Validate if a potential connection is valid
 */
export function canCreateConnection(
  editor: Editor,
  fromShapeId: TLShapeId,
  fromPortId: string,
  toShapeId: TLShapeId,
  toPortId: string
): { valid: boolean; error?: string } {
  const fromShape = editor.getShape(fromShapeId)
  const toShape = editor.getShape(toShapeId)

  if (!fromShape || fromShape.type !== 'WorkflowBlock') {
    return { valid: false, error: 'Source is not a workflow block' }
  }

  if (!toShape || toShape.type !== 'WorkflowBlock') {
    return { valid: false, error: 'Target is not a workflow block' }
  }

  const fromProps = fromShape.props as { blockType: string }
  const toProps = toShape.props as { blockType: string }

  const result = validateConnection(
    fromProps.blockType,
    fromPortId,
    toProps.blockType,
    toPortId
  )

  if (!result.valid) {
    return { valid: false, error: result.errors[0]?.message }
  }

  return { valid: true }
}

/**
 * Get block type from a shape ID
 */
export function getBlockType(
  editor: Editor,
  shapeId: TLShapeId
): string | undefined {
  const shape = editor.getShape(shapeId)
  if (!shape || shape.type !== 'WorkflowBlock') return undefined

  const props = shape.props as { blockType: string }
  return props.blockType
}
