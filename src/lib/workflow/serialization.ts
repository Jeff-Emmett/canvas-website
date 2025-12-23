/**
 * Workflow Serialization
 *
 * Export and import workflows as JSON for sharing and backup.
 * Compatible with a simplified Flowy-like format.
 */

import { Editor, TLShapeId, createShapeId } from 'tldraw'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'
import { WorkflowBlockProps, PortBinding } from './types'
import { getAllBindings, setArrowBinding } from './portBindings'
import { hasBlockDefinition } from './blockRegistry'

// =============================================================================
// Serialization Types
// =============================================================================

export interface SerializedBlock {
  id: string
  type: string
  blockType: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
  inputValues: Record<string, unknown>
  tags: string[]
}

export interface SerializedConnection {
  id: string
  fromBlock: string
  fromPort: string
  toBlock: string
  toPort: string
}

export interface SerializedWorkflow {
  version: string
  name: string
  description?: string
  createdAt: string
  blocks: SerializedBlock[]
  connections: SerializedConnection[]
  metadata?: Record<string, unknown>
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Export workflow blocks and connections from the editor
 */
export function exportWorkflow(
  editor: Editor,
  options: {
    name?: string
    description?: string
    selectedOnly?: boolean
  } = {}
): SerializedWorkflow {
  const { name = 'Untitled Workflow', description, selectedOnly = false } = options

  // Get all workflow blocks
  let blocks = editor
    .getCurrentPageShapes()
    .filter((s): s is IWorkflowBlock => s.type === 'WorkflowBlock')

  if (selectedOnly) {
    const selectedIds = new Set(editor.getSelectedShapeIds())
    blocks = blocks.filter((b) => selectedIds.has(b.id))
  }

  const blockIds = new Set(blocks.map((b) => b.id))

  // Get all bindings between these blocks
  const allBindings = getAllBindings(editor)
  const relevantBindings = allBindings.filter(
    (b) => blockIds.has(b.fromShapeId) && blockIds.has(b.toShapeId)
  )

  // Serialize blocks
  const serializedBlocks: SerializedBlock[] = blocks.map((block) => ({
    id: block.id,
    type: 'WorkflowBlock',
    blockType: block.props.blockType,
    x: block.x,
    y: block.y,
    w: block.props.w,
    h: block.props.h,
    config: block.props.blockConfig,
    inputValues: block.props.inputValues,
    tags: block.props.tags,
  }))

  // Serialize connections
  const serializedConnections: SerializedConnection[] = relevantBindings.map(
    (binding) => ({
      id: binding.arrowId,
      fromBlock: binding.fromShapeId,
      fromPort: binding.fromPortId,
      toBlock: binding.toShapeId,
      toPort: binding.toPortId,
    })
  )

  return {
    version: '1.0.0',
    name,
    description,
    createdAt: new Date().toISOString(),
    blocks: serializedBlocks,
    connections: serializedConnections,
  }
}

/**
 * Export workflow as a JSON string
 */
export function exportWorkflowToJSON(
  editor: Editor,
  options: {
    name?: string
    description?: string
    selectedOnly?: boolean
    pretty?: boolean
  } = {}
): string {
  const { pretty = true, ...workflowOptions } = options
  const workflow = exportWorkflow(editor, workflowOptions)
  return pretty ? JSON.stringify(workflow, null, 2) : JSON.stringify(workflow)
}

/**
 * Download workflow as a JSON file
 */
export function downloadWorkflow(
  editor: Editor,
  options: {
    name?: string
    description?: string
    selectedOnly?: boolean
  } = {}
): void {
  const json = exportWorkflowToJSON(editor, { ...options, pretty: true })
  const filename = `${options.name || 'workflow'}-${Date.now()}.json`

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// =============================================================================
// Import Functions
// =============================================================================

/**
 * Import a workflow from serialized data
 */
export function importWorkflow(
  editor: Editor,
  workflow: SerializedWorkflow,
  options: {
    offset?: { x: number; y: number }
    generateNewIds?: boolean
  } = {}
): { blockIds: TLShapeId[]; arrowIds: TLShapeId[] } {
  const { offset = { x: 0, y: 0 }, generateNewIds = true } = options

  // Map old IDs to new IDs
  const idMap = new Map<string, TLShapeId>()

  // Validate blocks
  const validBlocks = workflow.blocks.filter((block) => {
    if (!hasBlockDefinition(block.blockType)) {
      console.warn(`Unknown block type: ${block.blockType}, skipping`)
      return false
    }
    return true
  })

  // Create new IDs if needed
  for (const block of validBlocks) {
    const newId = generateNewIds
      ? createShapeId()
      : (block.id as TLShapeId)
    idMap.set(block.id, newId)
  }

  // Calculate bounding box for centering
  let minX = Infinity
  let minY = Infinity
  for (const block of validBlocks) {
    minX = Math.min(minX, block.x)
    minY = Math.min(minY, block.y)
  }

  // Create blocks
  const blockIds: TLShapeId[] = []
  for (const block of validBlocks) {
    const newId = idMap.get(block.id)!
    blockIds.push(newId)

    editor.createShape<IWorkflowBlock>({
      id: newId,
      type: 'WorkflowBlock',
      x: block.x - minX + offset.x,
      y: block.y - minY + offset.y,
      props: {
        w: block.w,
        h: block.h,
        blockType: block.blockType,
        blockConfig: block.config,
        inputValues: block.inputValues,
        outputValues: {},
        executionState: 'idle',
        tags: block.tags || ['workflow'],
        pinnedToView: false,
      },
    })
  }

  // Create connections (arrows)
  const arrowIds: TLShapeId[] = []
  for (const conn of workflow.connections) {
    const fromId = idMap.get(conn.fromBlock)
    const toId = idMap.get(conn.toBlock)

    if (!fromId || !toId) {
      console.warn(`Skipping connection: missing block reference`)
      continue
    }

    const arrowId = generateNewIds
      ? createShapeId()
      : (conn.id as TLShapeId)
    arrowIds.push(arrowId)

    // Create arrow between blocks
    editor.createShape({
      id: arrowId,
      type: 'arrow',
      props: {
        start: {
          type: 'binding',
          boundShapeId: fromId,
          normalizedAnchor: { x: 1, y: 0.5 },
          isExact: false,
          isPrecise: false,
        },
        end: {
          type: 'binding',
          boundShapeId: toId,
          normalizedAnchor: { x: 0, y: 0.5 },
          isExact: false,
          isPrecise: false,
        },
        text: `flow{ ${conn.fromPort} -> ${conn.toPort} }`,
      },
    })

    // Set arrow binding metadata
    setArrowBinding(editor, arrowId, conn.fromPort, conn.toPort)
  }

  // Select imported shapes
  editor.setSelectedShapes([...blockIds, ...arrowIds])

  return { blockIds, arrowIds }
}

/**
 * Import workflow from JSON string
 */
export function importWorkflowFromJSON(
  editor: Editor,
  json: string,
  options: {
    offset?: { x: number; y: number }
    generateNewIds?: boolean
  } = {}
): { blockIds: TLShapeId[]; arrowIds: TLShapeId[] } | null {
  try {
    const workflow = JSON.parse(json) as SerializedWorkflow
    return importWorkflow(editor, workflow, options)
  } catch (error) {
    console.error('Failed to parse workflow JSON:', error)
    return null
  }
}

/**
 * Import workflow from File object
 */
export async function importWorkflowFromFile(
  editor: Editor,
  file: File,
  options: {
    offset?: { x: number; y: number }
    generateNewIds?: boolean
  } = {}
): Promise<{ blockIds: TLShapeId[]; arrowIds: TLShapeId[] } | null> {
  try {
    const text = await file.text()
    return importWorkflowFromJSON(editor, text, options)
  } catch (error) {
    console.error('Failed to read workflow file:', error)
    return null
  }
}

// =============================================================================
// Template Functions
// =============================================================================

/**
 * Create a basic API workflow template
 */
export function getApiWorkflowTemplate(): SerializedWorkflow {
  return {
    version: '1.0.0',
    name: 'API Request Template',
    description: 'Fetch data from an API and display the result',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: 'trigger-1',
        type: 'WorkflowBlock',
        blockType: 'trigger.manual',
        x: 100,
        y: 100,
        w: 220,
        h: 150,
        config: {},
        inputValues: {},
        tags: ['workflow', 'trigger'],
      },
      {
        id: 'http-1',
        type: 'WorkflowBlock',
        blockType: 'action.http',
        x: 400,
        y: 100,
        w: 220,
        h: 180,
        config: { method: 'GET' },
        inputValues: { url: 'https://api.example.com/data' },
        tags: ['workflow', 'action'],
      },
      {
        id: 'display-1',
        type: 'WorkflowBlock',
        blockType: 'output.display',
        x: 700,
        y: 100,
        w: 220,
        h: 150,
        config: { format: 'json' },
        inputValues: {},
        tags: ['workflow', 'output'],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        fromBlock: 'trigger-1',
        fromPort: 'timestamp',
        toBlock: 'http-1',
        toPort: 'trigger',
      },
      {
        id: 'conn-2',
        fromBlock: 'http-1',
        fromPort: 'response',
        toBlock: 'display-1',
        toPort: 'value',
      },
    ],
  }
}

/**
 * Create an LLM chain workflow template
 */
export function getLLMChainTemplate(): SerializedWorkflow {
  return {
    version: '1.0.0',
    name: 'LLM Chain Template',
    description: 'Chain multiple LLM prompts together',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: 'trigger-1',
        type: 'WorkflowBlock',
        blockType: 'trigger.manual',
        x: 100,
        y: 100,
        w: 220,
        h: 150,
        config: {},
        inputValues: {},
        tags: ['workflow', 'trigger'],
      },
      {
        id: 'llm-1',
        type: 'WorkflowBlock',
        blockType: 'ai.llm',
        x: 400,
        y: 100,
        w: 220,
        h: 200,
        config: { systemPrompt: 'You are a helpful assistant.' },
        inputValues: { prompt: 'Summarize the following topic:' },
        tags: ['workflow', 'ai'],
      },
      {
        id: 'llm-2',
        type: 'WorkflowBlock',
        blockType: 'ai.llm',
        x: 700,
        y: 100,
        w: 220,
        h: 200,
        config: { systemPrompt: 'You expand on summaries with examples.' },
        inputValues: {},
        tags: ['workflow', 'ai'],
      },
      {
        id: 'display-1',
        type: 'WorkflowBlock',
        blockType: 'output.display',
        x: 1000,
        y: 100,
        w: 220,
        h: 150,
        config: { format: 'auto' },
        inputValues: {},
        tags: ['workflow', 'output'],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        fromBlock: 'trigger-1',
        fromPort: 'timestamp',
        toBlock: 'llm-1',
        toPort: 'trigger',
      },
      {
        id: 'conn-2',
        fromBlock: 'llm-1',
        fromPort: 'response',
        toBlock: 'llm-2',
        toPort: 'prompt',
      },
      {
        id: 'conn-3',
        fromBlock: 'llm-2',
        fromPort: 'response',
        toBlock: 'display-1',
        toPort: 'value',
      },
    ],
  }
}

/**
 * Create a conditional branch workflow template
 */
export function getConditionalTemplate(): SerializedWorkflow {
  return {
    version: '1.0.0',
    name: 'Conditional Branch Template',
    description: 'Route data based on conditions',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: 'trigger-1',
        type: 'WorkflowBlock',
        blockType: 'trigger.manual',
        x: 100,
        y: 200,
        w: 220,
        h: 150,
        config: {},
        inputValues: {},
        tags: ['workflow', 'trigger'],
      },
      {
        id: 'compare-1',
        type: 'WorkflowBlock',
        blockType: 'condition.compare',
        x: 400,
        y: 200,
        w: 220,
        h: 180,
        config: { operator: 'greater' },
        inputValues: { a: 10, b: 5 },
        tags: ['workflow', 'condition'],
      },
      {
        id: 'if-1',
        type: 'WorkflowBlock',
        blockType: 'condition.if',
        x: 700,
        y: 200,
        w: 220,
        h: 180,
        config: {},
        inputValues: { value: 'Result data' },
        tags: ['workflow', 'condition'],
      },
      {
        id: 'display-true',
        type: 'WorkflowBlock',
        blockType: 'output.display',
        x: 1000,
        y: 100,
        w: 220,
        h: 150,
        config: { format: 'auto' },
        inputValues: {},
        tags: ['workflow', 'output'],
      },
      {
        id: 'display-false',
        type: 'WorkflowBlock',
        blockType: 'output.display',
        x: 1000,
        y: 300,
        w: 220,
        h: 150,
        config: { format: 'auto' },
        inputValues: {},
        tags: ['workflow', 'output'],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        fromBlock: 'compare-1',
        fromPort: 'result',
        toBlock: 'if-1',
        toPort: 'condition',
      },
      {
        id: 'conn-2',
        fromBlock: 'if-1',
        fromPort: 'true',
        toBlock: 'display-true',
        toPort: 'value',
      },
      {
        id: 'conn-3',
        fromBlock: 'if-1',
        fromPort: 'false',
        toBlock: 'display-false',
        toPort: 'value',
      },
    ],
  }
}
