/**
 * Workflow Type Definitions
 *
 * Core types for the Flowy-like workflow builder system.
 * Supports typed ports, block definitions, and execution context.
 */

import { TLShapeId } from 'tldraw'

// =============================================================================
// Port Data Types
// =============================================================================

export type PortDataType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'any'
  | 'file'
  | 'image'

/**
 * Check if a source type is compatible with target accepted types
 */
export function isTypeCompatible(
  sourceType: PortDataType,
  targetAccepts: PortDataType[]
): boolean {
  if (targetAccepts.includes('any')) return true
  if (sourceType === 'any') return true
  return targetAccepts.includes(sourceType)
}

/**
 * Get display color for port type
 */
export function getPortTypeColor(type: PortDataType): string {
  const colors: Record<PortDataType, string> = {
    text: '#3b82f6',     // blue
    number: '#10b981',   // green
    boolean: '#f59e0b',  // amber
    object: '#8b5cf6',   // purple
    array: '#06b6d4',    // cyan
    any: '#6b7280',      // gray
    file: '#ec4899',     // pink
    image: '#f97316',    // orange
  }
  return colors[type] || colors.any
}

// =============================================================================
// Port Definitions
// =============================================================================

export interface InputPort {
  id: string
  name: string
  type: PortDataType
  accepts: PortDataType[]
  required?: boolean
  defaultValue?: unknown
  description?: string
}

export interface OutputPort {
  id: string
  name: string
  type: PortDataType
  produces: PortDataType
  description?: string
}

// =============================================================================
// Block Categories
// =============================================================================

export type BlockCategory =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'transformer'
  | 'ai'
  | 'output'

export const CATEGORY_INFO: Record<BlockCategory, { label: string; color: string; icon: string }> = {
  trigger: { label: 'Triggers', color: '#ef4444', icon: '⚡' },
  action: { label: 'Actions', color: '#3b82f6', icon: '🔧' },
  condition: { label: 'Conditions', color: '#f59e0b', icon: '🔀' },
  transformer: { label: 'Transformers', color: '#10b981', icon: '🔄' },
  ai: { label: 'AI', color: '#8b5cf6', icon: '🤖' },
  output: { label: 'Outputs', color: '#06b6d4', icon: '📤' },
}

// =============================================================================
// Block Definition
// =============================================================================

export interface BlockDefinition {
  type: string
  name: string
  description: string
  icon: string
  category: BlockCategory
  inputs: InputPort[]
  outputs: OutputPort[]
  defaultConfig?: Record<string, unknown>
  configSchema?: Record<string, unknown>
}

// =============================================================================
// Workflow Block Props
// =============================================================================

export interface WorkflowBlockProps {
  w: number
  h: number
  blockType: string
  blockConfig: Record<string, unknown>
  inputValues: Record<string, unknown>
  outputValues: Record<string, unknown>
  executionState: ExecutionState
  executionError?: string
  tags: string[]
  pinnedToView: boolean
}

export type ExecutionState = 'idle' | 'running' | 'success' | 'error'

// =============================================================================
// Port Binding (Arrow Metadata)
// =============================================================================

export interface PortBinding {
  fromShapeId: TLShapeId
  fromPortId: string
  toShapeId: TLShapeId
  toPortId: string
  arrowId: TLShapeId
}

// =============================================================================
// Execution Context
// =============================================================================

export interface ExecutionContext {
  editor: unknown // Editor type
  blockId: TLShapeId
  timestamp: number
  abortSignal?: AbortSignal
}

export interface BlockExecutionResult {
  success: boolean
  outputs: Record<string, unknown>
  error?: string
  executionTime: number
}
