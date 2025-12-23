/**
 * Workflow Serialization
 *
 * Export and import workflows as JSON for sharing, backup,
 * and loading templates. Compatible with Flowy JSON format.
 */

import { Editor, TLShapeId, createShapeId } from 'tldraw'
import { PortBinding, WorkflowBlockProps } from './types'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'
import {
  buildWorkflowGraph,
  getPortBinding,
  setPortBinding,
  getAllWorkflowBlocks,
} from './portBindings'
import { hasBlockDefinition, getBlockDefinition } from './blockRegistry'

// =============================================================================
// Serialized Types
// =============================================================================

/**
 * Serialized block format
 */
interface SerializedBlock {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  blockType: string
  blockConfig: Record<string, unknown>
  inputValues?: Record<string, unknown>
  tags?: string[]
}

/**
 * Serialized connection format
 */
interface SerializedConnection {
  id: string
  from: {
    blockId: string
    portId: string
  }
  to: {
    blockId: string
    portId: string
  }
}

/**
 * Full workflow export format
 */
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
 * Export a workflow to JSON format
 */
export function exportWorkflow(
  editor: Editor,
  options: {
    name?: string
    description?: string
    includeInputValues?: boolean
    blockIds?: TLShapeId[]
  } = {}
): SerializedWorkflow {
  const {
    name = 'Untitled Workflow',
    description,
    includeInputValues = false,
    blockIds,
  } = options

  // Get blocks to export
  let blocks = getAllWorkflowBlocks(editor) as IWorkflowBlock[]

  if (blockIds && blockIds.length > 0) {
    const blockIdSet = new Set(blockIds)
    blocks = blocks.filter(b => blockIdSet.has(b.id))
  }

  // Serialize blocks
  const serializedBlocks: SerializedBlock[] = blocks.map(block => ({
    id: block.id,
    type: block.type,
    x: block.x,
    y: block.y,
    w: block.props.w,
    h: block.props.h,
    blockType: block.props.blockType,
    blockConfig: block.props.blockConfig,
    inputValues: includeInputValues ? block.props.inputValues : undefined,
    tags: block.props.tags,
  }))

  // Get connections between exported blocks
  const blockIdSet = new Set(blocks.map(b => b.id))
  const connections: SerializedConnection[] = []

  // Find all arrows connecting our blocks
  const arrows = editor.getCurrentPageShapes().filter(s => s.type === 'arrow')
  for (const arrow of arrows) {
    const binding = getPortBinding(editor, arrow.id)
    if (
      binding &&
      blockIdSet.has(binding.fromShapeId) &&
      blockIdSet.has(binding.toShapeId)
    ) {
      connections.push({
        id: arrow.id,
        from: {
          blockId: binding.fromShapeId,
          portId: binding.fromPortId,
        },
        to: {
          blockId: binding.toShapeId,
          portId: binding.toPortId,
        },
      })
    }
  }

  return {
    version: '1.0.0',
    name,
    description,
    createdAt: new Date().toISOString(),
    blocks: serializedBlocks,
    connections,
  }
}

/**
 * Export workflow to JSON string
 */
export function exportWorkflowToJSON(
  editor: Editor,
  options?: Parameters<typeof exportWorkflow>[1]
): string {
  return JSON.stringify(exportWorkflow(editor, options), null, 2)
}

/**
 * Download workflow as JSON file
 */
export function downloadWorkflow(
  editor: Editor,
  options?: Parameters<typeof exportWorkflow>[1]
): void {
  const workflow = exportWorkflow(editor, options)
  const json = JSON.stringify(workflow, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const filename = `${workflow.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// =============================================================================
// Import Functions
// =============================================================================

/**
 * Import a workflow from JSON format
 */
export function importWorkflow(
  editor: Editor,
  workflow: SerializedWorkflow,
  options: {
    offset?: { x: number; y: number }
    preserveIds?: boolean
  } = {}
): {
  success: boolean
  blockIds: TLShapeId[]
  errors: string[]
} {
  const { offset = { x: 0, y: 0 }, preserveIds = false } = options
  const errors: string[] = []
  const blockIdMap = new Map<string, TLShapeId>()
  const newBlockIds: TLShapeId[] = []

  // Calculate bounds for centering
  let minX = Infinity
  let minY = Infinity

  for (const block of workflow.blocks) {
    minX = Math.min(minX, block.x)
    minY = Math.min(minY, block.y)
  }

  // Create blocks
  for (const block of workflow.blocks) {
    // Validate block type
    if (!hasBlockDefinition(block.blockType)) {
      errors.push(`Unknown block type: ${block.blockType}`)
      continue
    }

    const definition = getBlockDefinition(block.blockType)

    // Generate or preserve ID
    const newId = preserveIds && block.id.startsWith('shape:')
      ? block.id as TLShapeId
      : createShapeId()

    blockIdMap.set(block.id, newId)

    // Calculate position with offset
    const x = block.x - minX + offset.x
    const y = block.y - minY + offset.y

    // Calculate height based on ports
    const maxPorts = Math.max(definition.inputs.length, definition.outputs.length)
    const height = Math.max(block.h, 36 + 24 + maxPorts * 28 + 60)

    // Create the block
    try {
      editor.createShape<IWorkflowBlock>({
        id: newId,
        type: 'WorkflowBlock',
        x,
        y,
        props: {
          w: block.w,
          h: height,
          blockType: block.blockType,
          blockConfig: block.blockConfig || {},
          inputValues: block.inputValues || {},
          outputValues: {},
          executionState: 'idle',
          tags: block.tags || ['workflow'],
          pinnedToView: false,
        },
      })

      newBlockIds.push(newId)
    } catch (error) {
      errors.push(`Failed to create block: ${(error as Error).message}`)
    }
  }

  // Create connections (arrows)
  for (const conn of workflow.connections) {
    const fromId = blockIdMap.get(conn.from.blockId)
    const toId = blockIdMap.get(conn.to.blockId)

    if (!fromId || !toId) {
      errors.push(`Connection references missing block`)
      continue
    }

    const fromBlock = editor.getShape(fromId) as IWorkflowBlock | undefined
    const toBlock = editor.getShape(toId) as IWorkflowBlock | undefined

    if (!fromBlock || !toBlock) continue

    try {
      // Create arrow between blocks
      const arrowId = createShapeId()

      // Get port positions for arrow endpoints
      const fromDef = getBlockDefinition(fromBlock.props.blockType)
      const toDef = getBlockDefinition(toBlock.props.blockType)

      const fromPortIndex = fromDef.outputs.findIndex(p => p.id === conn.from.portId)
      const toPortIndex = toDef.inputs.findIndex(p => p.id === conn.to.portId)

      if (fromPortIndex === -1 || toPortIndex === -1) {
        errors.push(`Invalid port in connection`)
        continue
      }

      // Calculate port positions
      const fromX = fromBlock.x + fromBlock.props.w
      const fromY = fromBlock.y + 36 + 12 + fromPortIndex * 28 + 6

      const toX = toBlock.x
      const toY = toBlock.y + 36 + 12 + toPortIndex * 28 + 6

      // Create arrow with bindings
      editor.createShape({
        id: arrowId,
        type: 'arrow',
        x: 0,
        y: 0,
        props: {
          start: { x: fromX, y: fromY },
          end: { x: toX, y: toY },
          color: 'black',
        },
        meta: {
          fromPortId: conn.from.portId,
          toPortId: conn.to.portId,
          validated: true,
        },
      })

      // Create bindings for the arrow
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: fromId,
        props: {
          terminal: 'start',
          normalizedAnchor: { x: 1, y: 0.5 },
          isPrecise: false,
          isExact: false,
        },
      })

      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: toId,
        props: {
          terminal: 'end',
          normalizedAnchor: { x: 0, y: 0.5 },
          isPrecise: false,
          isExact: false,
        },
      })
    } catch (error) {
      errors.push(`Failed to create connection: ${(error as Error).message}`)
    }
  }

  return {
    success: errors.length === 0,
    blockIds: newBlockIds,
    errors,
  }
}

/**
 * Import workflow from JSON string
 */
export function importWorkflowFromJSON(
  editor: Editor,
  json: string,
  options?: Parameters<typeof importWorkflow>[2]
): ReturnType<typeof importWorkflow> {
  try {
    const workflow = JSON.parse(json) as SerializedWorkflow
    return importWorkflow(editor, workflow, options)
  } catch (error) {
    return {
      success: false,
      blockIds: [],
      errors: [`Invalid JSON: ${(error as Error).message}`],
    }
  }
}

/**
 * Load workflow from file
 */
export async function loadWorkflowFromFile(
  editor: Editor,
  file: File,
  options?: Parameters<typeof importWorkflow>[2]
): Promise<ReturnType<typeof importWorkflow>> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const json = e.target?.result as string
      resolve(importWorkflowFromJSON(editor, json, options))
    }

    reader.onerror = () => {
      resolve({
        success: false,
        blockIds: [],
        errors: ['Failed to read file'],
      })
    }

    reader.readAsText(file)
  })
}

// =============================================================================
// Workflow Templates
// =============================================================================

/**
 * Pre-built workflow templates
 */
export const WORKFLOW_TEMPLATES: Record<string, SerializedWorkflow> = {
  'api-transform-display': {
    version: '1.0.0',
    name: 'API Transform Display',
    description: 'Fetch data from an API, transform it, and display the result',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: 'block-1',
        type: 'WorkflowBlock',
        x: 100,
        y: 100,
        w: 220,
        h: 180,
        blockType: 'trigger.manual',
        blockConfig: {},
        tags: ['workflow', 'trigger'],
      },
      {
        id: 'block-2',
        type: 'WorkflowBlock',
        x: 400,
        y: 100,
        w: 220,
        h: 200,
        blockType: 'action.http',
        blockConfig: { url: 'https://api.example.com/data', method: 'GET' },
        tags: ['workflow', 'action'],
      },
      {
        id: 'block-3',
        type: 'WorkflowBlock',
        x: 700,
        y: 100,
        w: 220,
        h: 180,
        blockType: 'transformer.jsonParse',
        blockConfig: {},
        tags: ['workflow', 'transformer'],
      },
      {
        id: 'block-4',
        type: 'WorkflowBlock',
        x: 1000,
        y: 100,
        w: 220,
        h: 180,
        blockType: 'output.display',
        blockConfig: { format: 'json' },
        tags: ['workflow', 'output'],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        from: { blockId: 'block-1', portId: 'timestamp' },
        to: { blockId: 'block-2', portId: 'trigger' },
      },
      {
        id: 'conn-2',
        from: { blockId: 'block-2', portId: 'response' },
        to: { blockId: 'block-3', portId: 'input' },
      },
      {
        id: 'conn-3',
        from: { blockId: 'block-3', portId: 'output' },
        to: { blockId: 'block-4', portId: 'value' },
      },
    ],
  },

  'llm-chain': {
    version: '1.0.0',
    name: 'LLM Chain',
    description: 'Chain multiple LLM prompts together',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: 'block-1',
        type: 'WorkflowBlock',
        x: 100,
        y: 100,
        w: 220,
        h: 180,
        blockType: 'trigger.manual',
        blockConfig: {},
        tags: ['workflow', 'trigger'],
      },
      {
        id: 'block-2',
        type: 'WorkflowBlock',
        x: 400,
        y: 100,
        w: 220,
        h: 200,
        blockType: 'ai.llm',
        blockConfig: { systemPrompt: 'You are a helpful assistant.' },
        inputValues: { prompt: 'Summarize the following topic:' },
        tags: ['workflow', 'ai'],
      },
      {
        id: 'block-3',
        type: 'WorkflowBlock',
        x: 700,
        y: 100,
        w: 220,
        h: 200,
        blockType: 'ai.llm',
        blockConfig: { systemPrompt: 'You are a creative writer.' },
        inputValues: { prompt: 'Expand on this summary:' },
        tags: ['workflow', 'ai'],
      },
      {
        id: 'block-4',
        type: 'WorkflowBlock',
        x: 1000,
        y: 100,
        w: 220,
        h: 180,
        blockType: 'output.display',
        blockConfig: { format: 'text' },
        tags: ['workflow', 'output'],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        from: { blockId: 'block-1', portId: 'timestamp' },
        to: { blockId: 'block-2', portId: 'trigger' },
      },
      {
        id: 'conn-2',
        from: { blockId: 'block-2', portId: 'response' },
        to: { blockId: 'block-3', portId: 'context' },
      },
      {
        id: 'conn-3',
        from: { blockId: 'block-3', portId: 'response' },
        to: { blockId: 'block-4', portId: 'value' },
      },
    ],
  },

  'conditional-branch': {
    version: '1.0.0',
    name: 'Conditional Branch',
    description: 'Branch workflow based on a condition',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: 'block-1',
        type: 'WorkflowBlock',
        x: 100,
        y: 200,
        w: 220,
        h: 180,
        blockType: 'trigger.manual',
        blockConfig: {},
        tags: ['workflow', 'trigger'],
      },
      {
        id: 'block-2',
        type: 'WorkflowBlock',
        x: 400,
        y: 200,
        w: 220,
        h: 200,
        blockType: 'condition.if',
        blockConfig: {},
        tags: ['workflow', 'condition'],
      },
      {
        id: 'block-3',
        type: 'WorkflowBlock',
        x: 700,
        y: 50,
        w: 220,
        h: 180,
        blockType: 'output.log',
        blockConfig: { level: 'info' },
        inputValues: { message: 'Condition was TRUE' },
        tags: ['workflow', 'output'],
      },
      {
        id: 'block-4',
        type: 'WorkflowBlock',
        x: 700,
        y: 300,
        w: 220,
        h: 180,
        blockType: 'output.log',
        blockConfig: { level: 'warn' },
        inputValues: { message: 'Condition was FALSE' },
        tags: ['workflow', 'output'],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        from: { blockId: 'block-1', portId: 'timestamp' },
        to: { blockId: 'block-2', portId: 'value' },
      },
      {
        id: 'conn-2',
        from: { blockId: 'block-2', portId: 'true' },
        to: { blockId: 'block-3', portId: 'message' },
      },
      {
        id: 'conn-3',
        from: { blockId: 'block-2', portId: 'false' },
        to: { blockId: 'block-4', portId: 'message' },
      },
    ],
  },
}

/**
 * Load a workflow template
 */
export function loadTemplate(
  editor: Editor,
  templateId: string,
  options?: Parameters<typeof importWorkflow>[2]
): ReturnType<typeof importWorkflow> {
  const template = WORKFLOW_TEMPLATES[templateId]

  if (!template) {
    return {
      success: false,
      blockIds: [],
      errors: [`Unknown template: ${templateId}`],
    }
  }

  return importWorkflow(editor, template, options)
}

/**
 * Get available template names
 */
export function getTemplateNames(): Array<{ id: string; name: string; description?: string }> {
  return Object.entries(WORKFLOW_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
  }))
}
