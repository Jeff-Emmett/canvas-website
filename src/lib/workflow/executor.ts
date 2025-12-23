/**
 * Workflow Executor
 *
 * Handles manual execution of workflow blocks and complete workflows.
 * Supports topological execution order, error handling, and state updates.
 */

import { Editor, TLShapeId } from 'tldraw'
import {
  ExecutionContext,
  BlockExecutionResult,
  ExecutionState,
} from './types'
import { getBlockDefinition, hasBlockDefinition } from './blockRegistry'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'
import {
  getExecutionOrder,
  getBlockInputBindings,
  getBlockOutputBindings,
} from './portBindings'

// =============================================================================
// Block Executors Registry
// =============================================================================

type BlockExecutor = (
  context: ExecutionContext,
  inputs: Record<string, unknown>,
  config: Record<string, unknown>
) => Promise<Record<string, unknown>>

const blockExecutors = new Map<string, BlockExecutor>()

/**
 * Register a custom executor for a block type
 */
export function registerBlockExecutor(
  blockType: string,
  executor: BlockExecutor
): void {
  blockExecutors.set(blockType, executor)
}

// =============================================================================
// Built-in Block Executors
// =============================================================================

// Trigger: Manual
registerBlockExecutor('trigger.manual', async () => {
  return { timestamp: Date.now() }
})

// Trigger: Schedule
registerBlockExecutor('trigger.schedule', async () => {
  return { timestamp: Date.now() }
})

// Trigger: Webhook
registerBlockExecutor('trigger.webhook', async (_ctx, inputs) => {
  return {
    body: inputs.body || {},
    headers: inputs.headers || {},
  }
})

// Action: HTTP Request
registerBlockExecutor('action.http', async (_ctx, inputs, config) => {
  const url = inputs.url as string
  const method = (config.method as string) || 'GET'
  const body = inputs.body

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json().catch(() => response.text())
    return {
      response: data,
      status: response.status,
    }
  } catch (error) {
    throw new Error(`HTTP request failed: ${error}`)
  }
})

// Action: Delay
registerBlockExecutor('action.delay', async (_ctx, inputs, config) => {
  const duration = (config.duration as number) || 1000
  await new Promise(resolve => setTimeout(resolve, duration))
  return { passthrough: inputs.input }
})

// Condition: If/Else
registerBlockExecutor('condition.if', async (_ctx, inputs) => {
  const condition = Boolean(inputs.condition)
  const value = inputs.value

  if (condition) {
    return { true: value, false: undefined }
  } else {
    return { true: undefined, false: value }
  }
})

// Condition: Compare
registerBlockExecutor('condition.compare', async (_ctx, inputs, config) => {
  const a = inputs.a
  const b = inputs.b
  const operator = (config.operator as string) || 'equals'

  let result = false
  switch (operator) {
    case 'equals':
      result = a === b
      break
    case 'not_equals':
      result = a !== b
      break
    case 'greater':
      result = (a as number) > (b as number)
      break
    case 'less':
      result = (a as number) < (b as number)
      break
    case 'greater_equal':
      result = (a as number) >= (b as number)
      break
    case 'less_equal':
      result = (a as number) <= (b as number)
      break
    case 'contains':
      result = String(a).includes(String(b))
      break
  }

  return { result }
})

// Transformer: JSON Parse
registerBlockExecutor('transformer.jsonParse', async (_ctx, inputs) => {
  const input = inputs.input as string
  try {
    return { output: JSON.parse(input) }
  } catch (error) {
    throw new Error(`JSON parse error: ${error}`)
  }
})

// Transformer: JSON Stringify
registerBlockExecutor('transformer.jsonStringify', async (_ctx, inputs, config) => {
  const pretty = config.pretty as boolean
  const output = pretty
    ? JSON.stringify(inputs.input, null, 2)
    : JSON.stringify(inputs.input)
  return { output }
})

// Transformer: JavaScript Code
registerBlockExecutor('transformer.code', async (_ctx, inputs, config) => {
  const code = config.code as string
  const input = inputs.input

  try {
    // Create a sandboxed function
    const fn = new Function('input', `return (${code})`)
    const output = fn(input)
    return { output }
  } catch (error) {
    throw new Error(`Code execution error: ${error}`)
  }
})

// Transformer: Template
registerBlockExecutor('transformer.template', async (_ctx, inputs, config) => {
  const template = config.template as string
  const variables = inputs.variables as Record<string, unknown>

  let output = template
  for (const [key, value] of Object.entries(variables || {})) {
    output = output.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
  }

  return { output }
})

// Transformer: Get Property
registerBlockExecutor('transformer.getProperty', async (_ctx, inputs, config) => {
  const obj = inputs.object as Record<string, unknown>
  const path = (config.path as string) || ''

  const parts = path.split('.')
  let value: unknown = obj

  for (const part of parts) {
    if (value == null || typeof value !== 'object') {
      value = undefined
      break
    }
    value = (value as Record<string, unknown>)[part]
  }

  return { value }
})

// Transformer: Set Property
registerBlockExecutor('transformer.setProperty', async (_ctx, inputs, config) => {
  const obj = { ...(inputs.object as Record<string, unknown>) }
  const path = (config.path as string) || ''
  const value = inputs.value

  const parts = path.split('.')
  let current: Record<string, unknown> = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return { output: obj }
})

// Transformer: Array Map
registerBlockExecutor('transformer.arrayMap', async (_ctx, inputs, config) => {
  const array = inputs.array as unknown[]
  const expression = config.expression as string

  const fn = new Function('item', 'index', `return ${expression}`)
  const output = array.map((item, index) => fn(item, index))

  return { output }
})

// Transformer: Array Filter
registerBlockExecutor('transformer.arrayFilter', async (_ctx, inputs, config) => {
  const array = inputs.array as unknown[]
  const condition = config.condition as string

  const fn = new Function('item', 'index', `return ${condition}`)
  const output = array.filter((item, index) => fn(item, index))

  return { output }
})

// AI: LLM Prompt (placeholder - integrate with actual LLM service)
registerBlockExecutor('ai.llm', async (_ctx, inputs, config) => {
  const prompt = inputs.prompt as string
  const context = inputs.context as string
  const systemPrompt = config.systemPrompt as string

  // Placeholder - would integrate with actual LLM API
  console.log('[AI LLM] Prompt:', prompt)
  console.log('[AI LLM] Context:', context)
  console.log('[AI LLM] System:', systemPrompt)

  return {
    response: `[LLM Response placeholder for: ${prompt}]`,
    tokens: 0,
  }
})

// AI: Image Generation (placeholder)
registerBlockExecutor('ai.imageGen', async (_ctx, inputs, config) => {
  const prompt = inputs.prompt as string
  const size = config.size as string

  console.log('[AI Image] Prompt:', prompt, 'Size:', size)

  return {
    image: `[Generated image placeholder for: ${prompt}]`,
  }
})

// Output: Display
registerBlockExecutor('output.display', async (_ctx, inputs, config) => {
  const value = inputs.value
  const format = config.format as string

  let displayValue: string
  if (format === 'json' || format === 'auto') {
    displayValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  } else {
    displayValue = String(value)
  }

  console.log('[Display]:', displayValue)
  return { displayed: displayValue }
})

// Output: Log
registerBlockExecutor('output.log', async (_ctx, inputs, config) => {
  const message = inputs.message
  const level = (config.level as string) || 'info'

  switch (level) {
    case 'error':
      console.error('[Workflow Log]:', message)
      break
    case 'warn':
      console.warn('[Workflow Log]:', message)
      break
    default:
      console.log('[Workflow Log]:', message)
  }

  return { logged: true }
})

// Output: Notify
registerBlockExecutor('output.notify', async (_ctx, inputs, config) => {
  const message = inputs.message as string
  const title = (config.title as string) || 'Notification'

  // Dispatch custom event for UI to handle
  window.dispatchEvent(
    new CustomEvent('workflow:notification', {
      detail: { title, message },
    })
  )

  return { notified: true }
})

// =============================================================================
// Block Execution
// =============================================================================

/**
 * Execute a single workflow block
 */
export async function executeBlock(
  editor: Editor,
  blockId: TLShapeId,
  inputs: Record<string, unknown> = {}
): Promise<BlockExecutionResult> {
  const startTime = Date.now()

  const shape = editor.getShape(blockId) as IWorkflowBlock | undefined
  if (!shape || shape.type !== 'WorkflowBlock') {
    return {
      success: false,
      outputs: {},
      error: 'Block not found',
      executionTime: 0,
    }
  }

  const { blockType, blockConfig } = shape.props

  if (!hasBlockDefinition(blockType)) {
    return {
      success: false,
      outputs: {},
      error: `Unknown block type: ${blockType}`,
      executionTime: Date.now() - startTime,
    }
  }

  // Set running state
  updateBlockState(editor, blockId, 'running')

  try {
    const executor = blockExecutors.get(blockType)
    if (!executor) {
      throw new Error(`No executor registered for block type: ${blockType}`)
    }

    const context: ExecutionContext = {
      editor,
      blockId,
      timestamp: Date.now(),
    }

    const outputs = await executor(context, inputs, blockConfig)

    // Update block with outputs and success state
    editor.updateShape<IWorkflowBlock>({
      id: blockId,
      type: 'WorkflowBlock',
      props: {
        outputValues: outputs,
        executionState: 'success',
        executionError: undefined,
      },
    })

    return {
      success: true,
      outputs,
      executionTime: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Update block with error state
    editor.updateShape<IWorkflowBlock>({
      id: blockId,
      type: 'WorkflowBlock',
      props: {
        executionState: 'error',
        executionError: errorMessage,
      },
    })

    return {
      success: false,
      outputs: {},
      error: errorMessage,
      executionTime: Date.now() - startTime,
    }
  }
}

/**
 * Update a block's execution state
 */
function updateBlockState(
  editor: Editor,
  blockId: TLShapeId,
  state: ExecutionState,
  error?: string
): void {
  editor.updateShape<IWorkflowBlock>({
    id: blockId,
    type: 'WorkflowBlock',
    props: {
      executionState: state,
      executionError: error,
    },
  })
}

// =============================================================================
// Workflow Execution
// =============================================================================

/**
 * Execute a complete workflow starting from trigger blocks
 */
export async function executeWorkflow(
  editor: Editor,
  startBlockId?: TLShapeId
): Promise<Map<TLShapeId, BlockExecutionResult>> {
  const results = new Map<TLShapeId, BlockExecutionResult>()
  const outputValues = new Map<TLShapeId, Record<string, unknown>>()

  // Get execution order
  const executionOrder = getExecutionOrder(editor, startBlockId)

  if (executionOrder.length === 0) {
    console.warn('No blocks to execute in workflow')
    return results
  }

  console.log(`[Workflow] Executing ${executionOrder.length} blocks`)

  for (const blockId of executionOrder) {
    // Gather inputs from upstream blocks
    const inputs = gatherBlockInputs(editor, blockId, outputValues)

    // Execute the block
    const result = await executeBlock(editor, blockId, inputs)
    results.set(blockId, result)

    if (result.success) {
      outputValues.set(blockId, result.outputs)
    } else {
      console.error(`[Workflow] Block ${blockId} failed:`, result.error)
      // Optionally stop on first error
      // break
    }
  }

  console.log('[Workflow] Execution complete')
  return results
}

/**
 * Gather input values for a block from its upstream connections
 */
function gatherBlockInputs(
  editor: Editor,
  blockId: TLShapeId,
  outputValues: Map<TLShapeId, Record<string, unknown>>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {}
  const bindings = getBlockInputBindings(editor, blockId)

  for (const binding of bindings) {
    const sourceOutputs = outputValues.get(binding.fromShapeId)
    if (sourceOutputs && binding.fromPortId in sourceOutputs) {
      inputs[binding.toPortId] = sourceOutputs[binding.fromPortId]
    }
  }

  // Also include any static input values from the block itself
  const shape = editor.getShape(blockId) as IWorkflowBlock | undefined
  if (shape && shape.type === 'WorkflowBlock') {
    for (const [key, value] of Object.entries(shape.props.inputValues)) {
      if (!(key in inputs)) {
        inputs[key] = value
      }
    }
  }

  return inputs
}

// =============================================================================
// Execution Event Listener Setup
// =============================================================================

/**
 * Set up listener for block execution events
 */
export function setupBlockExecutionListener(editor: Editor): () => void {
  const handler = (event: CustomEvent<{ blockId: TLShapeId }>) => {
    const { blockId } = event.detail
    executeWorkflow(editor, blockId)
  }

  window.addEventListener('workflow:execute-block', handler as EventListener)

  return () => {
    window.removeEventListener('workflow:execute-block', handler as EventListener)
  }
}

/**
 * Reset all blocks to idle state
 */
export function resetWorkflowState(editor: Editor): void {
  const blocks = editor
    .getCurrentPageShapes()
    .filter((s): s is IWorkflowBlock => s.type === 'WorkflowBlock')

  for (const block of blocks) {
    editor.updateShape<IWorkflowBlock>({
      id: block.id,
      type: 'WorkflowBlock',
      props: {
        executionState: 'idle',
        executionError: undefined,
        outputValues: {},
      },
    })
  }
}
