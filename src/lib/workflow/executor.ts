/**
 * Workflow Executor
 *
 * Executes workflow blocks either individually or as a complete workflow.
 * Manages execution state, handles data propagation between blocks,
 * and supports both manual and real-time execution modes.
 */

import { Editor, TLShapeId } from 'tldraw'
import {
  ExecutionContext,
  BlockExecutionResult,
  WorkflowBlockProps,
  ExecutionState,
} from './types'
import { getBlockDefinition, hasBlockDefinition } from './blockRegistry'
import {
  getBlockInputBindings,
  getBlockOutputBindings,
  getExecutionOrder,
  buildWorkflowGraph,
} from './portBindings'
import { validateRequiredInputs, validateWorkflow } from './validation'
import { IWorkflowBlock } from '@/shapes/WorkflowBlockShapeUtil'

// =============================================================================
// Block Executors
// =============================================================================

type BlockExecutor = (
  context: ExecutionContext,
  inputs: Record<string, unknown>,
  config: Record<string, unknown>
) => Promise<Record<string, unknown>>

const blockExecutors: Map<string, BlockExecutor> = new Map()

/**
 * Register a block executor
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
registerBlockExecutor('trigger.manual', async (context) => {
  return { timestamp: Date.now() }
})

// Trigger: Schedule
registerBlockExecutor('trigger.schedule', async (context, inputs, config) => {
  return {
    timestamp: Date.now(),
    scheduledTime: config.time || '00:00',
    interval: config.interval || 'daily',
  }
})

// Trigger: Webhook
registerBlockExecutor('trigger.webhook', async (context, inputs, config) => {
  return {
    timestamp: Date.now(),
    method: 'POST',
    body: {},
    headers: {},
  }
})

// Action: HTTP Request
registerBlockExecutor('action.http', async (context, inputs, config) => {
  const url = (inputs.url as string) || (config.url as string)
  const method = (config.method as string) || 'GET'
  const body = inputs.body as string | undefined

  if (!url) {
    throw new Error('URL is required for HTTP request')
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? body : undefined,
    })

    const responseData = await response.text()
    let parsedData: unknown = responseData

    try {
      parsedData = JSON.parse(responseData)
    } catch {
      // Keep as text if not valid JSON
    }

    return {
      response: parsedData,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    }
  } catch (error) {
    throw new Error(`HTTP request failed: ${(error as Error).message}`)
  }
})

// Action: Create Shape
registerBlockExecutor('action.createShape', async (context, inputs, config) => {
  const shapeType = (config.shapeType as string) || 'text'
  const position = (inputs.position as { x: number; y: number }) || { x: 100, y: 100 }
  const content = inputs.content as string || ''

  // Create shape through editor
  const newShape = context.editor.createShape({
    type: shapeType === 'text' ? 'text' : 'geo',
    x: position.x,
    y: position.y,
    props: shapeType === 'text'
      ? { text: content }
      : { text: content, w: 200, h: 100 },
  })

  return {
    shapeId: newShape?.id || null,
    created: true,
  }
})

// Action: Update Shape
registerBlockExecutor('action.updateShape', async (context, inputs, config) => {
  const shapeId = inputs.shapeId as TLShapeId
  const updates = inputs.updates as Record<string, unknown>

  if (!shapeId) {
    throw new Error('Shape ID is required')
  }

  context.editor.updateShape({
    id: shapeId,
    type: context.editor.getShape(shapeId)?.type || 'geo',
    props: updates,
  })

  return { updated: true, shapeId }
})

// Action: Delay
registerBlockExecutor('action.delay', async (context, inputs, config) => {
  const duration = (config.duration as number) || 1000
  await new Promise(resolve => setTimeout(resolve, duration))
  return { passthrough: inputs.input, delayed: duration }
})

// Condition: If/Else
registerBlockExecutor('condition.if', async (context, inputs) => {
  const condition = Boolean(inputs.condition)
  const value = inputs.value

  return condition
    ? { true: value }
    : { false: value }
})

// Condition: Switch
registerBlockExecutor('condition.switch', async (context, inputs, config) => {
  const value = inputs.value
  const cases = (config.cases as Record<string, unknown>) || {}

  for (const [caseValue, output] of Object.entries(cases)) {
    if (String(value) === caseValue) {
      return { match: output, matched: caseValue }
    }
  }

  return { default: value }
})

// Condition: Compare
registerBlockExecutor('condition.compare', async (context, inputs, config) => {
  const a = inputs.a
  const b = inputs.b
  const operator = (config.operator as string) || 'equals'

  let result: boolean

  switch (operator) {
    case 'equals':
      result = a === b
      break
    case 'notEquals':
      result = a !== b
      break
    case 'greaterThan':
      result = Number(a) > Number(b)
      break
    case 'lessThan':
      result = Number(a) < Number(b)
      break
    case 'contains':
      result = String(a).includes(String(b))
      break
    default:
      result = a === b
  }

  return { result }
})

// Transformer: JSON Parse
registerBlockExecutor('transformer.jsonParse', async (context, inputs) => {
  const input = inputs.input as string
  try {
    return { output: JSON.parse(input) }
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`)
  }
})

// Transformer: JSON Stringify
registerBlockExecutor('transformer.jsonStringify', async (context, inputs, config) => {
  const input = inputs.input
  const pretty = config.pretty as boolean

  return {
    output: pretty
      ? JSON.stringify(input, null, 2)
      : JSON.stringify(input),
  }
})

// Transformer: JavaScript Code
registerBlockExecutor('transformer.code', async (context, inputs, config) => {
  const code = config.code as string
  const input = inputs.input

  if (!code) {
    return { output: input }
  }

  try {
    // Create a sandboxed function
    const fn = new Function('input', 'context', `
      'use strict';
      ${code}
    `)
    const result = fn(input, { timestamp: Date.now() })
    return { output: result }
  } catch (error) {
    throw new Error(`Code execution failed: ${(error as Error).message}`)
  }
})

// Transformer: Template
registerBlockExecutor('transformer.template', async (context, inputs, config) => {
  const template = (config.template as string) || ''
  const variables = (inputs.variables as Record<string, unknown>) || {}

  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
  }

  return { output: result }
})

// Transformer: Get Property
registerBlockExecutor('transformer.getProperty', async (context, inputs, config) => {
  const object = inputs.object as Record<string, unknown>
  const path = (config.path as string) || ''

  if (!object || typeof object !== 'object') {
    return { value: undefined }
  }

  const parts = path.split('.')
  let value: unknown = object

  for (const part of parts) {
    if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[part]
    } else {
      return { value: undefined }
    }
  }

  return { value }
})

// Transformer: Set Property
registerBlockExecutor('transformer.setProperty', async (context, inputs, config) => {
  const object = { ...(inputs.object as Record<string, unknown>) } || {}
  const path = (config.path as string) || ''
  const value = inputs.value

  if (path) {
    const parts = path.split('.')
    let current = object as Record<string, unknown>

    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]] as Record<string, unknown>
    }

    current[parts[parts.length - 1]] = value
  }

  return { output: object }
})

// Transformer: Array Map
registerBlockExecutor('transformer.arrayMap', async (context, inputs, config) => {
  const array = inputs.array as unknown[]
  const expression = (config.expression as string) || 'item'

  if (!Array.isArray(array)) {
    throw new Error('Input must be an array')
  }

  const fn = new Function('item', 'index', `return ${expression}`)
  return { output: array.map((item, index) => fn(item, index)) }
})

// Transformer: Array Filter
registerBlockExecutor('transformer.arrayFilter', async (context, inputs, config) => {
  const array = inputs.array as unknown[]
  const condition = (config.condition as string) || 'true'

  if (!Array.isArray(array)) {
    throw new Error('Input must be an array')
  }

  const fn = new Function('item', 'index', `return ${condition}`)
  return { output: array.filter((item, index) => fn(item, index)) }
})

// AI: LLM Prompt (placeholder - integrates with existing AI utilities)
registerBlockExecutor('ai.llm', async (context, inputs, config) => {
  const prompt = inputs.prompt as string
  const systemPrompt = (config.systemPrompt as string) || ''

  // TODO: Integrate with existing LLM utilities
  // For now, return a placeholder
  console.log('LLM Prompt:', { prompt, systemPrompt })

  return {
    response: `[LLM response to: "${prompt?.substring(0, 50)}..."]`,
    tokens: 0,
  }
})

// AI: Image Generation (placeholder)
registerBlockExecutor('ai.imageGen', async (context, inputs, config) => {
  const prompt = inputs.prompt as string
  const size = (config.size as string) || '512x512'

  // TODO: Integrate with existing image generation
  console.log('Image Gen:', { prompt, size })

  return {
    image: '[Image URL placeholder]',
    prompt,
  }
})

// AI: Text to Speech (placeholder)
registerBlockExecutor('ai.tts', async (context, inputs, config) => {
  const text = inputs.text as string
  const voice = (config.voice as string) || 'default'

  console.log('TTS:', { text, voice })

  return {
    audio: '[Audio URL placeholder]',
    duration: 0,
  }
})

// AI: Speech to Text (placeholder)
registerBlockExecutor('ai.stt', async (context, inputs) => {
  const audio = inputs.audio as string

  console.log('STT:', { audio })

  return {
    text: '[Transcription placeholder]',
    confidence: 0,
  }
})

// Output: Display
registerBlockExecutor('output.display', async (context, inputs, config) => {
  const value = inputs.value
  const format = (config.format as string) || 'auto'

  let displayed: string
  if (format === 'json') {
    displayed = JSON.stringify(value, null, 2)
  } else if (format === 'text') {
    displayed = String(value)
  } else {
    displayed = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  }

  console.log('Display:', displayed)
  return { displayed }
})

// Output: Log
registerBlockExecutor('output.log', async (context, inputs, config) => {
  const message = inputs.message
  const level = (config.level as string) || 'info'

  const timestamp = new Date().toISOString()
  console.log(`[${level.toUpperCase()}] ${timestamp}:`, message)

  return { logged: true, timestamp, level }
})

// Output: Notify
registerBlockExecutor('output.notify', async (context, inputs, config) => {
  const message = inputs.message as string
  const title = (config.title as string) || 'Notification'

  // Dispatch notification event
  window.dispatchEvent(new CustomEvent('workflow:notify', {
    detail: { title, message },
  }))

  return { notified: true }
})

// Output: Create Markdown
registerBlockExecutor('output.markdown', async (context, inputs, config) => {
  const content = inputs.content as string
  const position = (inputs.position as { x: number; y: number }) || { x: 100, y: 100 }

  // Create a markdown shape
  const newShape = context.editor.createShape({
    type: 'Markdown',
    x: position.x,
    y: position.y,
    props: {
      w: 400,
      h: 300,
      text: content,
    },
  })

  return { shapeId: newShape?.id || null, created: true }
})

// =============================================================================
// Execution Functions
// =============================================================================

/**
 * Execute a single workflow block
 */
export async function executeBlock(
  editor: Editor,
  blockId: TLShapeId,
  additionalInputs: Record<string, unknown> = {}
): Promise<BlockExecutionResult> {
  const shape = editor.getShape(blockId) as IWorkflowBlock | undefined

  if (!shape || shape.type !== 'WorkflowBlock') {
    return {
      success: false,
      error: 'Invalid block shape',
      outputs: {},
      executionTime: 0,
    }
  }

  const { blockType, blockConfig, inputValues } = shape.props

  if (!hasBlockDefinition(blockType)) {
    return {
      success: false,
      error: `Unknown block type: ${blockType}`,
      outputs: {},
      executionTime: 0,
    }
  }

  // Get executor
  const executor = blockExecutors.get(blockType)
  if (!executor) {
    return {
      success: false,
      error: `No executor registered for block type: ${blockType}`,
      outputs: {},
      executionTime: 0,
    }
  }

  // Update execution state to running
  updateBlockState(editor, blockId, 'running')

  const startTime = Date.now()

  try {
    // Gather inputs from upstream blocks
    const inputs = await gatherBlockInputs(editor, blockId)

    // Merge with additional inputs and stored input values
    const mergedInputs = {
      ...inputValues,
      ...inputs,
      ...additionalInputs,
    }

    // Create execution context
    const context: ExecutionContext = {
      editor,
      blockId,
      timestamp: Date.now(),
    }

    // Execute
    const outputs = await executor(context, mergedInputs, blockConfig)

    // Update block with outputs
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
    const errorMessage = (error as Error).message

    // Update block with error
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
      error: errorMessage,
      outputs: {},
      executionTime: Date.now() - startTime,
    }
  }
}

/**
 * Gather input values from upstream connected blocks
 */
async function gatherBlockInputs(
  editor: Editor,
  blockId: TLShapeId
): Promise<Record<string, unknown>> {
  const inputs: Record<string, unknown> = {}
  const bindings = getBlockInputBindings(editor, blockId)

  for (const binding of bindings) {
    const sourceShape = editor.getShape(binding.fromShapeId) as IWorkflowBlock | undefined
    if (sourceShape && sourceShape.type === 'WorkflowBlock') {
      const outputValue = sourceShape.props.outputValues?.[binding.fromPortId]
      if (outputValue !== undefined) {
        inputs[binding.toPortId] = outputValue
      }
    }
  }

  return inputs
}

/**
 * Update block execution state
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

/**
 * Execute an entire workflow starting from trigger blocks
 */
export async function executeWorkflow(
  editor: Editor,
  options: {
    startBlockId?: TLShapeId
    signal?: AbortSignal
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<{
  success: boolean
  results: Map<TLShapeId, BlockExecutionResult>
  error?: string
}> {
  const { signal, onProgress } = options

  // Validate workflow first
  const { blocks, connections } = buildWorkflowGraph(editor)
  const validation = validateWorkflow(blocks, connections)

  if (!validation.valid) {
    return {
      success: false,
      results: new Map(),
      error: validation.errors.map(e => e.message).join('; '),
    }
  }

  // Get execution order
  const executionOrder = getExecutionOrder(editor)

  // If start block specified, only execute that subgraph
  let blocksToExecute = executionOrder
  if (options.startBlockId) {
    const startIndex = executionOrder.indexOf(options.startBlockId)
    if (startIndex >= 0) {
      blocksToExecute = executionOrder.slice(startIndex)
    }
  }

  const results = new Map<TLShapeId, BlockExecutionResult>()
  let completed = 0

  // Reset all blocks to idle
  for (const blockId of blocksToExecute) {
    updateBlockState(editor, blockId, 'idle')
  }

  // Execute blocks in order
  for (const blockId of blocksToExecute) {
    // Check for abort
    if (signal?.aborted) {
      return {
        success: false,
        results,
        error: 'Execution aborted',
      }
    }

    const result = await executeBlock(editor, blockId)
    results.set(blockId, result)

    if (!result.success) {
      // Stop on first error
      return {
        success: false,
        results,
        error: `Block execution failed: ${result.error}`,
      }
    }

    completed++
    onProgress?.(completed, blocksToExecute.length)
  }

  return {
    success: true,
    results,
  }
}

/**
 * Reset all workflow blocks to idle state
 */
export function resetWorkflow(editor: Editor): void {
  const blocks = editor.getCurrentPageShapes().filter(s => s.type === 'WorkflowBlock')

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

// =============================================================================
// Event Listener for Manual Block Execution
// =============================================================================

/**
 * Setup event listener for workflow:execute-block events
 */
export function setupBlockExecutionListener(editor: Editor): () => void {
  const handler = async (event: CustomEvent<{ blockId: TLShapeId }>) => {
    const { blockId } = event.detail
    await executeBlock(editor, blockId)
  }

  window.addEventListener('workflow:execute-block', handler as EventListener)

  return () => {
    window.removeEventListener('workflow:execute-block', handler as EventListener)
  }
}
