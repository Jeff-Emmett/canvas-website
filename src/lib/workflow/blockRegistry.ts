/**
 * Block Registry
 *
 * Defines all available workflow blocks with their ports and configuration.
 */

import { BlockDefinition, BlockCategory } from './types'

// =============================================================================
// Block Registry
// =============================================================================

const blockRegistry = new Map<string, BlockDefinition>()

export function registerBlock(definition: BlockDefinition): void {
  blockRegistry.set(definition.type, definition)
}

export function getBlockDefinition(type: string): BlockDefinition {
  const def = blockRegistry.get(type)
  if (!def) {
    throw new Error(`Unknown block type: ${type}`)
  }
  return def
}

export function hasBlockDefinition(type: string): boolean {
  return blockRegistry.has(type)
}

export function getAllBlockDefinitions(): BlockDefinition[] {
  return Array.from(blockRegistry.values())
}

export function getBlocksByCategory(category: BlockCategory): BlockDefinition[] {
  return getAllBlockDefinitions().filter(b => b.category === category)
}

// =============================================================================
// Trigger Blocks
// =============================================================================

registerBlock({
  type: 'trigger.manual',
  name: 'Manual Trigger',
  description: 'Start workflow manually with a button click',
  icon: '▶️',
  category: 'trigger',
  inputs: [],
  outputs: [
    { id: 'timestamp', name: 'Timestamp', type: 'number', produces: 'number' },
  ],
})

registerBlock({
  type: 'trigger.schedule',
  name: 'Schedule Trigger',
  description: 'Start workflow on a schedule',
  icon: '⏰',
  category: 'trigger',
  inputs: [],
  outputs: [
    { id: 'timestamp', name: 'Timestamp', type: 'number', produces: 'number' },
  ],
  defaultConfig: { interval: 'daily', time: '09:00' },
})

registerBlock({
  type: 'trigger.webhook',
  name: 'Webhook Trigger',
  description: 'Start workflow from HTTP request',
  icon: '🌐',
  category: 'trigger',
  inputs: [],
  outputs: [
    { id: 'body', name: 'Body', type: 'object', produces: 'object' },
    { id: 'headers', name: 'Headers', type: 'object', produces: 'object' },
  ],
})

// =============================================================================
// Action Blocks
// =============================================================================

registerBlock({
  type: 'action.http',
  name: 'HTTP Request',
  description: 'Make an HTTP request to an API',
  icon: '🔗',
  category: 'action',
  inputs: [
    { id: 'url', name: 'URL', type: 'text', accepts: ['text'], required: true },
    { id: 'body', name: 'Body', type: 'any', accepts: ['text', 'object', 'any'] },
    { id: 'trigger', name: 'Trigger', type: 'any', accepts: ['any'] },
  ],
  outputs: [
    { id: 'response', name: 'Response', type: 'any', produces: 'any' },
    { id: 'status', name: 'Status', type: 'number', produces: 'number' },
  ],
  defaultConfig: { method: 'GET' },
})

registerBlock({
  type: 'action.createShape',
  name: 'Create Shape',
  description: 'Create a new shape on the canvas',
  icon: '📦',
  category: 'action',
  inputs: [
    { id: 'content', name: 'Content', type: 'text', accepts: ['text', 'any'] },
    { id: 'position', name: 'Position', type: 'object', accepts: ['object'] },
  ],
  outputs: [
    { id: 'shapeId', name: 'Shape ID', type: 'text', produces: 'text' },
  ],
  defaultConfig: { shapeType: 'text' },
})

registerBlock({
  type: 'action.delay',
  name: 'Delay',
  description: 'Wait for a specified duration',
  icon: '⏳',
  category: 'action',
  inputs: [
    { id: 'input', name: 'Input', type: 'any', accepts: ['any'] },
  ],
  outputs: [
    { id: 'passthrough', name: 'Output', type: 'any', produces: 'any' },
  ],
  defaultConfig: { duration: 1000 },
})

// =============================================================================
// Condition Blocks
// =============================================================================

registerBlock({
  type: 'condition.if',
  name: 'If / Else',
  description: 'Branch based on a condition',
  icon: '🔀',
  category: 'condition',
  inputs: [
    { id: 'condition', name: 'Condition', type: 'boolean', accepts: ['boolean', 'any'], required: true },
    { id: 'value', name: 'Value', type: 'any', accepts: ['any'] },
  ],
  outputs: [
    { id: 'true', name: 'True', type: 'any', produces: 'any' },
    { id: 'false', name: 'False', type: 'any', produces: 'any' },
  ],
})

registerBlock({
  type: 'condition.switch',
  name: 'Switch',
  description: 'Route based on value matching',
  icon: '🔃',
  category: 'condition',
  inputs: [
    { id: 'value', name: 'Value', type: 'any', accepts: ['any'], required: true },
  ],
  outputs: [
    { id: 'match', name: 'Match', type: 'any', produces: 'any' },
    { id: 'default', name: 'Default', type: 'any', produces: 'any' },
  ],
  defaultConfig: { cases: {} },
})

registerBlock({
  type: 'condition.compare',
  name: 'Compare',
  description: 'Compare two values',
  icon: '⚖️',
  category: 'condition',
  inputs: [
    { id: 'a', name: 'A', type: 'any', accepts: ['any'], required: true },
    { id: 'b', name: 'B', type: 'any', accepts: ['any'], required: true },
  ],
  outputs: [
    { id: 'result', name: 'Result', type: 'boolean', produces: 'boolean' },
  ],
  defaultConfig: { operator: 'equals' },
})

// =============================================================================
// Transformer Blocks
// =============================================================================

registerBlock({
  type: 'transformer.jsonParse',
  name: 'JSON Parse',
  description: 'Parse JSON text into object',
  icon: '📋',
  category: 'transformer',
  inputs: [
    { id: 'input', name: 'Input', type: 'text', accepts: ['text'], required: true },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'object', produces: 'object' },
  ],
})

registerBlock({
  type: 'transformer.jsonStringify',
  name: 'JSON Stringify',
  description: 'Convert object to JSON text',
  icon: '📝',
  category: 'transformer',
  inputs: [
    { id: 'input', name: 'Input', type: 'any', accepts: ['any'], required: true },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'text', produces: 'text' },
  ],
  defaultConfig: { pretty: false },
})

registerBlock({
  type: 'transformer.code',
  name: 'JavaScript Code',
  description: 'Run custom JavaScript code',
  icon: '💻',
  category: 'transformer',
  inputs: [
    { id: 'input', name: 'Input', type: 'any', accepts: ['any'] },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'any', produces: 'any' },
  ],
  defaultConfig: { code: 'return input' },
})

registerBlock({
  type: 'transformer.template',
  name: 'Template',
  description: 'Fill template with variables',
  icon: '📄',
  category: 'transformer',
  inputs: [
    { id: 'variables', name: 'Variables', type: 'object', accepts: ['object'], required: true },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'text', produces: 'text' },
  ],
  defaultConfig: { template: 'Hello {{name}}!' },
})

registerBlock({
  type: 'transformer.getProperty',
  name: 'Get Property',
  description: 'Get a property from an object',
  icon: '🔍',
  category: 'transformer',
  inputs: [
    { id: 'object', name: 'Object', type: 'object', accepts: ['object'], required: true },
  ],
  outputs: [
    { id: 'value', name: 'Value', type: 'any', produces: 'any' },
  ],
  defaultConfig: { path: '' },
})

registerBlock({
  type: 'transformer.setProperty',
  name: 'Set Property',
  description: 'Set a property on an object',
  icon: '✏️',
  category: 'transformer',
  inputs: [
    { id: 'object', name: 'Object', type: 'object', accepts: ['object'], required: true },
    { id: 'value', name: 'Value', type: 'any', accepts: ['any'], required: true },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'object', produces: 'object' },
  ],
  defaultConfig: { path: '' },
})

registerBlock({
  type: 'transformer.arrayMap',
  name: 'Array Map',
  description: 'Transform each array element',
  icon: '🗺️',
  category: 'transformer',
  inputs: [
    { id: 'array', name: 'Array', type: 'array', accepts: ['array'], required: true },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'array', produces: 'array' },
  ],
  defaultConfig: { expression: 'item' },
})

registerBlock({
  type: 'transformer.arrayFilter',
  name: 'Array Filter',
  description: 'Filter array elements',
  icon: '🔎',
  category: 'transformer',
  inputs: [
    { id: 'array', name: 'Array', type: 'array', accepts: ['array'], required: true },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'array', produces: 'array' },
  ],
  defaultConfig: { condition: 'true' },
})

// =============================================================================
// AI Blocks
// =============================================================================

registerBlock({
  type: 'ai.llm',
  name: 'LLM Prompt',
  description: 'Send prompt to language model',
  icon: '🤖',
  category: 'ai',
  inputs: [
    { id: 'prompt', name: 'Prompt', type: 'text', accepts: ['text'], required: true },
    { id: 'context', name: 'Context', type: 'text', accepts: ['text', 'any'] },
    { id: 'trigger', name: 'Trigger', type: 'any', accepts: ['any'] },
  ],
  outputs: [
    { id: 'response', name: 'Response', type: 'text', produces: 'text' },
    { id: 'tokens', name: 'Tokens', type: 'number', produces: 'number' },
  ],
  defaultConfig: { systemPrompt: '', model: 'default' },
})

registerBlock({
  type: 'ai.imageGen',
  name: 'Image Generation',
  description: 'Generate image from prompt',
  icon: '🎨',
  category: 'ai',
  inputs: [
    { id: 'prompt', name: 'Prompt', type: 'text', accepts: ['text'], required: true },
  ],
  outputs: [
    { id: 'image', name: 'Image', type: 'image', produces: 'image' },
  ],
  defaultConfig: { size: '512x512' },
})

registerBlock({
  type: 'ai.tts',
  name: 'Text to Speech',
  description: 'Convert text to audio',
  icon: '🔊',
  category: 'ai',
  inputs: [
    { id: 'text', name: 'Text', type: 'text', accepts: ['text'], required: true },
  ],
  outputs: [
    { id: 'audio', name: 'Audio', type: 'file', produces: 'file' },
  ],
  defaultConfig: { voice: 'default' },
})

registerBlock({
  type: 'ai.stt',
  name: 'Speech to Text',
  description: 'Convert audio to text',
  icon: '🎤',
  category: 'ai',
  inputs: [
    { id: 'audio', name: 'Audio', type: 'file', accepts: ['file'], required: true },
  ],
  outputs: [
    { id: 'text', name: 'Text', type: 'text', produces: 'text' },
  ],
})

// =============================================================================
// Output Blocks
// =============================================================================

registerBlock({
  type: 'output.display',
  name: 'Display',
  description: 'Display value on canvas',
  icon: '📺',
  category: 'output',
  inputs: [
    { id: 'value', name: 'Value', type: 'any', accepts: ['any'], required: true },
  ],
  outputs: [
    { id: 'displayed', name: 'Displayed', type: 'text', produces: 'text' },
  ],
  defaultConfig: { format: 'auto' },
})

registerBlock({
  type: 'output.log',
  name: 'Log',
  description: 'Log message to console',
  icon: '📋',
  category: 'output',
  inputs: [
    { id: 'message', name: 'Message', type: 'any', accepts: ['any'], required: true },
  ],
  outputs: [
    { id: 'logged', name: 'Logged', type: 'boolean', produces: 'boolean' },
  ],
  defaultConfig: { level: 'info' },
})

registerBlock({
  type: 'output.notify',
  name: 'Notify',
  description: 'Show notification',
  icon: '🔔',
  category: 'output',
  inputs: [
    { id: 'message', name: 'Message', type: 'text', accepts: ['text'], required: true },
  ],
  outputs: [
    { id: 'notified', name: 'Notified', type: 'boolean', produces: 'boolean' },
  ],
  defaultConfig: { title: 'Notification' },
})

registerBlock({
  type: 'output.markdown',
  name: 'Create Markdown',
  description: 'Create markdown shape on canvas',
  icon: '📝',
  category: 'output',
  inputs: [
    { id: 'content', name: 'Content', type: 'text', accepts: ['text'], required: true },
    { id: 'position', name: 'Position', type: 'object', accepts: ['object'] },
  ],
  outputs: [
    { id: 'shapeId', name: 'Shape ID', type: 'text', produces: 'text' },
  ],
})
