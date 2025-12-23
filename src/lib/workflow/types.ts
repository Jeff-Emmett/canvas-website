/**
 * Workflow Builder Type Definitions
 *
 * Core types for the Flowy-like workflow system including:
 * - Port type system for typed connections
 * - Block definitions for workflow nodes
 * - Execution context and results
 * - Serialization format
 */

import { TLBaseShape, TLShapeId } from 'tldraw'

// =============================================================================
// Port Type System
// =============================================================================

/**
 * Data types that can flow through ports
 */
export type PortDataType =
  | 'text'      // String data
  | 'number'    // Numeric data
  | 'boolean'   // True/false
  | 'object'    // JSON objects
  | 'array'     // Arrays of any type
  | 'any'       // Accepts all types
  | 'file'      // Binary/file data
  | 'image'     // Image data (base64 or URL)

/**
 * Base port definition shared by inputs and outputs
 */
export interface PortDefinition {
  id: string
  name: string
  type: PortDataType
  required: boolean
  description?: string
  defaultValue?: unknown
}

/**
 * Input port - receives data from connected output ports
 */
export interface InputPort extends PortDefinition {
  direction: 'input'
  accepts: PortDataType[]  // Types this port can receive
}

/**
 * Output port - sends data to connected input ports
 */
export interface OutputPort extends PortDefinition {
  direction: 'output'
  produces: PortDataType   // Type this port outputs
}

export type Port = InputPort | OutputPort

// =============================================================================
// Block Categories and Definitions
// =============================================================================

/**
 * Categories for organizing blocks in the palette
 */
export type BlockCategory =
  | 'trigger'      // Manual, schedule, webhook, event
  | 'action'       // API calls, canvas operations
  | 'condition'    // If/else, switch
  | 'transformer'  // Data manipulation
  | 'output'       // Display, export, notify
  | 'ai'           // LLM, image gen, etc.

/**
 * Category display information
 */
export interface CategoryInfo {
  name: string
  icon: string
  color: string
  description: string
}

/**
 * Complete block definition for the registry
 */
export interface BlockDefinition {
  type: string              // Unique identifier (e.g., 'action.http')
  category: BlockCategory
  name: string              // Display name
  description: string
  icon: string              // Emoji or icon identifier
  color: string             // Primary color for the block
  inputs: InputPort[]
  outputs: OutputPort[]
  configSchema?: object     // JSON Schema for block configuration
  defaultConfig?: object    // Default configuration values
  executor?: string         // Name of executor function
}

// =============================================================================
// Shape Types
// =============================================================================

/**
 * Props stored on WorkflowBlock shapes
 */
export interface WorkflowBlockProps {
  w: number
  h: number
  blockType: string                          // Reference to BlockDefinition.type
  blockConfig: Record<string, unknown>       // User-configured values
  inputValues: Record<string, unknown>       // Current input port values
  outputValues: Record<string, unknown>      // Current output port values
  executionState: ExecutionState
  executionError?: string
  lastExecutedAt?: number
  tags: string[]
  pinnedToView: boolean
}

/**
 * Execution state for visual feedback
 */
export type ExecutionState = 'idle' | 'running' | 'success' | 'error'

/**
 * The WorkflowBlock shape type for tldraw
 */
export type WorkflowBlockShape = TLBaseShape<'WorkflowBlock', WorkflowBlockProps>

// =============================================================================
// Port Binding (Arrow Connections)
// =============================================================================

/**
 * Represents a connection between two ports via an arrow
 */
export interface PortBinding {
  fromShapeId: TLShapeId
  fromPortId: string
  toShapeId: TLShapeId
  toPortId: string
  arrowId: TLShapeId
}

/**
 * Arrow metadata for storing port binding info
 */
export interface ArrowPortMeta {
  fromPortId?: string
  toPortId?: string
  validated?: boolean
  validationError?: string
}

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Context passed to block executors
 */
export interface ExecutionContext {
  workflowId: string
  executionId: string
  mode: 'manual' | 'realtime'
  startTime: number
  variables: Record<string, unknown>
  abortSignal?: AbortSignal
}

/**
 * Result from executing a single block
 */
export interface BlockExecutionResult {
  blockId: TLShapeId
  blockType: string
  status: 'success' | 'error' | 'skipped'
  outputs: Record<string, unknown>
  error?: string
  duration: number
  startTime: number
  endTime: number
}

/**
 * Result from executing an entire workflow
 */
export interface WorkflowExecutionResult {
  workflowId: string
  executionId: string
  status: 'success' | 'partial' | 'error' | 'aborted'
  results: BlockExecutionResult[]
  totalDuration: number
  startTime: number
  endTime: number
  error?: string
}

// =============================================================================
// Callbacks (Flowy-compatible events)
// =============================================================================

/**
 * Event callbacks for workflow interactions
 */
export interface WorkflowCallbacks {
  onBlockAdd?: (block: WorkflowBlockShape) => void
  onBlockRemove?: (blockId: TLShapeId) => void
  onBlockUpdate?: (block: WorkflowBlockShape) => void
  onConnect?: (binding: PortBinding) => void
  onDisconnect?: (binding: PortBinding) => void
  onValidationError?: (binding: PortBinding, error: string) => void
  onExecutionStart?: (context: ExecutionContext) => void
  onBlockExecute?: (result: BlockExecutionResult) => void
  onExecutionComplete?: (result: WorkflowExecutionResult) => void
}

// =============================================================================
// Serialization Format
// =============================================================================

/**
 * Serialized block for export/import
 */
export interface SerializedBlock {
  id: string
  type: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  config: Record<string, unknown>
}

/**
 * Serialized connection for export/import
 */
export interface SerializedConnection {
  id: string
  fromBlock: string
  fromPort: string
  toBlock: string
  toPort: string
}

/**
 * Complete serialized workflow
 */
export interface SerializedWorkflow {
  version: string
  name: string
  description?: string
  blocks: SerializedBlock[]
  connections: SerializedConnection[]
  metadata?: {
    createdAt: number
    updatedAt: number
    author?: string
  }
}

// =============================================================================
// Block Executor Types
// =============================================================================

/**
 * Function signature for block executors
 */
export type BlockExecutor = (
  inputs: Record<string, unknown>,
  config: Record<string, unknown>,
  context: ExecutionContext
) => Promise<Record<string, unknown>>

/**
 * Registry of block executors
 */
export type BlockExecutorRegistry = Record<string, BlockExecutor>

// =============================================================================
// UI State Types
// =============================================================================

/**
 * State for the workflow palette UI
 */
export interface WorkflowPaletteState {
  isOpen: boolean
  expandedCategory: BlockCategory | null
  searchQuery: string
  selectedBlockType: string | null
}

/**
 * State for workflow execution UI
 */
export interface WorkflowExecutionState {
  isRunning: boolean
  currentBlockId: TLShapeId | null
  executionHistory: WorkflowExecutionResult[]
  realtimeEnabled: boolean
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Check if a type is compatible with another
 */
export function isTypeCompatible(
  outputType: PortDataType,
  inputAccepts: PortDataType[]
): boolean {
  // 'any' accepts everything
  if (inputAccepts.includes('any')) return true

  // Direct match
  if (inputAccepts.includes(outputType)) return true

  // 'any' output can go to anything
  if (outputType === 'any') return true

  return false
}

/**
 * Get color for a port data type
 */
export function getPortTypeColor(type: PortDataType): string {
  const colors: Record<PortDataType, string> = {
    text: '#10b981',     // Green
    number: '#3b82f6',   // Blue
    boolean: '#8b5cf6',  // Purple
    object: '#f59e0b',   // Amber
    array: '#ec4899',    // Pink
    any: '#6b7280',      // Gray
    file: '#ef4444',     // Red
    image: '#06b6d4',    // Cyan
  }
  return colors[type] || colors.any
}

/**
 * Category information for UI
 */
export const CATEGORY_INFO: Record<BlockCategory, CategoryInfo> = {
  trigger: {
    name: 'Triggers',
    icon: '⚡',
    color: '#f59e0b',
    description: 'Start workflows with triggers',
  },
  action: {
    name: 'Actions',
    icon: '🔧',
    color: '#3b82f6',
    description: 'Perform operations and API calls',
  },
  condition: {
    name: 'Conditions',
    icon: '❓',
    color: '#8b5cf6',
    description: 'Branch based on conditions',
  },
  transformer: {
    name: 'Transformers',
    icon: '🔄',
    color: '#10b981',
    description: 'Transform and manipulate data',
  },
  output: {
    name: 'Outputs',
    icon: '📤',
    color: '#ef4444',
    description: 'Display and export results',
  },
  ai: {
    name: 'AI',
    icon: '🤖',
    color: '#ec4899',
    description: 'AI and machine learning blocks',
  },
}
