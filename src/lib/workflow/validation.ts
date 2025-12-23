/**
 * Port Validation
 *
 * Handles type compatibility checking between ports and validates
 * workflow connections to prevent invalid data flow.
 */

import {
  PortDataType,
  InputPort,
  OutputPort,
  PortBinding,
  isTypeCompatible,
} from './types'
import { getBlockDefinition, hasBlockDefinition } from './blockRegistry'

// =============================================================================
// Validation Result Types
// =============================================================================

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  type: 'type_mismatch' | 'missing_required' | 'unknown_block' | 'unknown_port' | 'cycle_detected'
  message: string
  blockId?: string
  portId?: string
  details?: Record<string, unknown>
}

export interface ValidationWarning {
  type: 'implicit_conversion' | 'unused_output' | 'unconnected_input'
  message: string
  blockId?: string
  portId?: string
}

// =============================================================================
// Port Compatibility
// =============================================================================

export function canConnect(
  outputPort: OutputPort,
  inputPort: InputPort
): boolean {
  return isTypeCompatible(outputPort.produces, inputPort.accepts)
}

export function canConnectType(
  outputType: PortDataType,
  inputPort: InputPort
): boolean {
  return isTypeCompatible(outputType, inputPort.accepts)
}

export function getCompatibleInputPorts(
  sourceBlockType: string,
  sourcePortId: string,
  targetBlockType: string
): InputPort[] {
  if (!hasBlockDefinition(sourceBlockType) || !hasBlockDefinition(targetBlockType)) {
    return []
  }

  const sourceBlock = getBlockDefinition(sourceBlockType)
  const targetBlock = getBlockDefinition(targetBlockType)

  const sourcePort = sourceBlock.outputs.find(p => p.id === sourcePortId)
  if (!sourcePort) return []

  return targetBlock.inputs.filter(inputPort =>
    canConnect(sourcePort, inputPort)
  )
}

export function getCompatibleOutputPorts(
  sourceBlockType: string,
  targetBlockType: string,
  targetPortId: string
): OutputPort[] {
  if (!hasBlockDefinition(sourceBlockType) || !hasBlockDefinition(targetBlockType)) {
    return []
  }

  const sourceBlock = getBlockDefinition(sourceBlockType)
  const targetBlock = getBlockDefinition(targetBlockType)

  const targetPort = targetBlock.inputs.find(p => p.id === targetPortId)
  if (!targetPort) return []

  return sourceBlock.outputs.filter(outputPort =>
    canConnect(outputPort, targetPort)
  )
}

// =============================================================================
// Connection Validation
// =============================================================================

export function validateConnection(
  sourceBlockType: string,
  sourcePortId: string,
  targetBlockType: string,
  targetPortId: string
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!hasBlockDefinition(sourceBlockType)) {
    errors.push({
      type: 'unknown_block',
      message: `Unknown source block type: ${sourceBlockType}`,
      details: { blockType: sourceBlockType },
    })
    return { valid: false, errors, warnings }
  }

  if (!hasBlockDefinition(targetBlockType)) {
    errors.push({
      type: 'unknown_block',
      message: `Unknown target block type: ${targetBlockType}`,
      details: { blockType: targetBlockType },
    })
    return { valid: false, errors, warnings }
  }

  const sourceBlock = getBlockDefinition(sourceBlockType)
  const targetBlock = getBlockDefinition(targetBlockType)

  const sourcePort = sourceBlock.outputs.find(p => p.id === sourcePortId)
  if (!sourcePort) {
    errors.push({
      type: 'unknown_port',
      message: `Unknown output port "${sourcePortId}" on block "${sourceBlockType}"`,
      portId: sourcePortId,
      details: { blockType: sourceBlockType, availablePorts: sourceBlock.outputs.map(p => p.id) },
    })
    return { valid: false, errors, warnings }
  }

  const targetPort = targetBlock.inputs.find(p => p.id === targetPortId)
  if (!targetPort) {
    errors.push({
      type: 'unknown_port',
      message: `Unknown input port "${targetPortId}" on block "${targetBlockType}"`,
      portId: targetPortId,
      details: { blockType: targetBlockType, availablePorts: targetBlock.inputs.map(p => p.id) },
    })
    return { valid: false, errors, warnings }
  }

  if (!canConnect(sourcePort, targetPort)) {
    errors.push({
      type: 'type_mismatch',
      message: `Type mismatch: "${sourcePort.produces}" cannot connect to "${targetPort.accepts.join(' | ')}"`,
      details: {
        sourceType: sourcePort.produces,
        targetAccepts: targetPort.accepts,
        sourcePort: sourcePortId,
        targetPort: targetPortId,
      },
    })
    return { valid: false, errors, warnings }
  }

  if (sourcePort.produces !== targetPort.type && targetPort.accepts.includes('any')) {
    warnings.push({
      type: 'implicit_conversion',
      message: `Implicit conversion from "${sourcePort.produces}" to "${targetPort.type}"`,
    })
  }

  return { valid: true, errors, warnings }
}

export function validatePortBinding(
  binding: PortBinding,
  getBlockType: (shapeId: string) => string | undefined
): ValidationResult {
  const sourceType = getBlockType(binding.fromShapeId as string)
  const targetType = getBlockType(binding.toShapeId as string)

  if (!sourceType || !targetType) {
    return {
      valid: false,
      errors: [{
        type: 'unknown_block',
        message: 'Could not determine block types for binding',
        blockId: !sourceType ? binding.fromShapeId as string : binding.toShapeId as string,
      }],
      warnings: [],
    }
  }

  return validateConnection(
    sourceType,
    binding.fromPortId,
    targetType,
    binding.toPortId
  )
}

// =============================================================================
// Block Validation
// =============================================================================

export function validateBlockConfig(
  blockType: string,
  config: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!hasBlockDefinition(blockType)) {
    errors.push({
      type: 'unknown_block',
      message: `Unknown block type: ${blockType}`,
    })
    return { valid: false, errors, warnings }
  }

  const definition = getBlockDefinition(blockType)

  if (!definition.configSchema) {
    return { valid: true, errors, warnings }
  }

  const schema = definition.configSchema as { properties?: Record<string, unknown> }
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as { type?: string; required?: boolean; enum?: unknown[] }

      if (prop.required && !(key in config)) {
        errors.push({
          type: 'missing_required',
          message: `Missing required configuration: ${key}`,
          details: { key },
        })
      }

      if (prop.enum && key in config && !prop.enum.includes(config[key])) {
        errors.push({
          type: 'type_mismatch',
          message: `Invalid value for "${key}": must be one of ${prop.enum.join(', ')}`,
          details: { key, value: config[key], allowed: prop.enum },
        })
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function validateRequiredInputs(
  blockType: string,
  inputValues: Record<string, unknown>,
  connectedInputs: string[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!hasBlockDefinition(blockType)) {
    errors.push({
      type: 'unknown_block',
      message: `Unknown block type: ${blockType}`,
    })
    return { valid: false, errors, warnings }
  }

  const definition = getBlockDefinition(blockType)

  for (const input of definition.inputs) {
    if (input.required) {
      const hasValue = input.id in inputValues && inputValues[input.id] !== undefined
      const hasConnection = connectedInputs.includes(input.id)

      if (!hasValue && !hasConnection) {
        errors.push({
          type: 'missing_required',
          message: `Required input "${input.name}" is not connected or provided`,
          portId: input.id,
        })
      }
    }
  }

  for (const input of definition.inputs) {
    if (!input.required) {
      const hasValue = input.id in inputValues && inputValues[input.id] !== undefined
      const hasConnection = connectedInputs.includes(input.id)

      if (!hasValue && !hasConnection && input.defaultValue === undefined) {
        warnings.push({
          type: 'unconnected_input',
          message: `Optional input "${input.name}" has no value or connection`,
          portId: input.id,
        })
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// =============================================================================
// Workflow Validation
// =============================================================================

export function detectCycles(
  connections: PortBinding[]
): { hasCycle: boolean; cycleNodes?: string[] } {
  const graph = new Map<string, Set<string>>()

  for (const conn of connections) {
    const from = conn.fromShapeId as string
    const to = conn.toShapeId as string

    if (!graph.has(from)) graph.set(from, new Set())
    graph.get(from)!.add(to)
  }

  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cyclePath: string[] = []

  function dfs(node: string): boolean {
    visited.add(node)
    recursionStack.add(node)
    cyclePath.push(node)

    const neighbors = graph.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (recursionStack.has(neighbor)) {
        cyclePath.push(neighbor)
        return true
      }
    }

    cyclePath.pop()
    recursionStack.delete(node)
    return false
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        const cycleStart = cyclePath.indexOf(cyclePath[cyclePath.length - 1])
        return {
          hasCycle: true,
          cycleNodes: cyclePath.slice(cycleStart),
        }
      }
    }
  }

  return { hasCycle: false }
}

export function validateWorkflow(
  blocks: Array<{ id: string; blockType: string; config: Record<string, unknown> }>,
  connections: PortBinding[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  for (const conn of connections) {
    const sourceBlock = blocks.find(b => b.id === conn.fromShapeId)
    const targetBlock = blocks.find(b => b.id === conn.toShapeId)

    if (sourceBlock && targetBlock) {
      const result = validateConnection(
        sourceBlock.blockType,
        conn.fromPortId,
        targetBlock.blockType,
        conn.toPortId
      )
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    }
  }

  const cycleResult = detectCycles(connections)
  if (cycleResult.hasCycle) {
    errors.push({
      type: 'cycle_detected',
      message: `Cycle detected in workflow: ${cycleResult.cycleNodes?.join(' -> ')}`,
      details: { cycleNodes: cycleResult.cycleNodes },
    })
  }

  const connectedOutputs = new Set(connections.map(c => `${c.fromShapeId}:${c.fromPortId}`))
  for (const block of blocks) {
    if (!hasBlockDefinition(block.blockType)) continue
    const def = getBlockDefinition(block.blockType)

    for (const output of def.outputs) {
      if (!connectedOutputs.has(`${block.id}:${output.id}`)) {
        if (def.category !== 'output') {
          warnings.push({
            type: 'unused_output',
            message: `Output "${output.name}" on block "${def.name}" is not connected`,
            blockId: block.id,
            portId: output.id,
          })
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
