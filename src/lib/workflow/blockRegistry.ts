/**
 * Block Registry
 *
 * Defines all available workflow blocks with their ports, configuration,
 * and metadata. Blocks are organized by category for the palette UI.
 */

import {
  BlockDefinition,
  BlockCategory,
  InputPort,
  OutputPort,
} from './types'

// =============================================================================
// Block Registry Storage
// =============================================================================

const BLOCK_REGISTRY: Map<string, BlockDefinition> = new Map()

// =============================================================================
// Helper Functions for Port Creation
// =============================================================================

function input(
  id: string,
  name: string,
  type: 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any' | 'file' | 'image',
  options: Partial<Omit<InputPort, 'id' | 'name' | 'type' | 'direction'>> = {}
): InputPort {
  return {
    id,
    name,
    type,
    direction: 'input',
    required: options.required ?? false,
    accepts: options.accepts ?? [type, 'any'],
    description: options.description,
    defaultValue: options.defaultValue,
  }
}

function output(
  id: string,
  name: string,
  type: 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any' | 'file' | 'image',
  options: Partial<Omit<OutputPort, 'id' | 'name' | 'type' | 'direction' | 'produces'>> = {}
): OutputPort {
  return {
    id,
    name,
    type,
    direction: 'output',
    produces: type,
    required: false,
    description: options.description,
    defaultValue: options.defaultValue,
  }
}

// =============================================================================
// TRIGGER BLOCKS
// =============================================================================

const ManualTrigger: BlockDefinition = {
  type: 'trigger.manual',
  category: 'trigger',
  name: 'Manual Trigger',
  description: 'Start workflow with a button click',
  icon: '▶️',
  color: '#f59e0b',
  inputs: [],
  outputs: [
    output('timestamp', 'Timestamp', 'number', {
      description: 'Unix timestamp when triggered',
    }),
    output('trigger', 'Trigger Data', 'object', {
      description: 'Metadata about the trigger event',
    }),
  ],
  executor: 'trigger.manual',
}

const ScheduleTrigger: BlockDefinition = {
  type: 'trigger.schedule',
  category: 'trigger',
  name: 'Schedule',
  description: 'Run on a schedule (cron expression)',
  icon: '⏰',
  color: '#f59e0b',
  inputs: [],
  outputs: [
    output('timestamp', 'Timestamp', 'number'),
    output('scheduledTime', 'Scheduled Time', 'number'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      cron: {
        type: 'string',
        description: 'Cron expression (e.g., "0 * * * *" for every hour)',
        default: '0 * * * *',
      },
      timezone: {
        type: 'string',
        description: 'Timezone for schedule',
        default: 'UTC',
      },
    },
  },
  defaultConfig: {
    cron: '0 * * * *',
    timezone: 'UTC',
  },
  executor: 'trigger.schedule',
}

const WebhookTrigger: BlockDefinition = {
  type: 'trigger.webhook',
  category: 'trigger',
  name: 'Webhook',
  description: 'Trigger from external HTTP request',
  icon: '🌐',
  color: '#f59e0b',
  inputs: [],
  outputs: [
    output('body', 'Request Body', 'object'),
    output('headers', 'Headers', 'object'),
    output('method', 'Method', 'text'),
    output('url', 'URL', 'text'),
  ],
  executor: 'trigger.webhook',
}

// =============================================================================
// ACTION BLOCKS
// =============================================================================

const HttpRequest: BlockDefinition = {
  type: 'action.http',
  category: 'action',
  name: 'HTTP Request',
  description: 'Make HTTP API calls',
  icon: '🌐',
  color: '#3b82f6',
  inputs: [
    input('url', 'URL', 'text', { required: true, description: 'Request URL' }),
    input('body', 'Body', 'object', { description: 'Request body (for POST/PUT)' }),
    input('headers', 'Headers', 'object', { description: 'Additional headers' }),
  ],
  outputs: [
    output('response', 'Response', 'object', { description: 'Parsed response body' }),
    output('status', 'Status', 'number', { description: 'HTTP status code' }),
    output('headers', 'Response Headers', 'object'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        default: 'GET',
      },
      contentType: {
        type: 'string',
        enum: ['application/json', 'application/x-www-form-urlencoded', 'text/plain'],
        default: 'application/json',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 30000,
      },
    },
  },
  defaultConfig: {
    method: 'GET',
    contentType: 'application/json',
    timeout: 30000,
  },
  executor: 'action.http',
}

const CreateShape: BlockDefinition = {
  type: 'action.create-shape',
  category: 'action',
  name: 'Create Shape',
  description: 'Create a new shape on the canvas',
  icon: '📐',
  color: '#3b82f6',
  inputs: [
    input('type', 'Shape Type', 'text', { required: true }),
    input('x', 'X Position', 'number'),
    input('y', 'Y Position', 'number'),
    input('props', 'Properties', 'object'),
  ],
  outputs: [
    output('shapeId', 'Shape ID', 'text'),
    output('shape', 'Shape', 'object'),
  ],
  executor: 'action.create-shape',
}

const UpdateShape: BlockDefinition = {
  type: 'action.update-shape',
  category: 'action',
  name: 'Update Shape',
  description: 'Update properties of an existing shape',
  icon: '✏️',
  color: '#3b82f6',
  inputs: [
    input('shapeId', 'Shape ID', 'text', { required: true }),
    input('props', 'Properties', 'object', { required: true }),
  ],
  outputs: [
    output('success', 'Success', 'boolean'),
    output('shape', 'Updated Shape', 'object'),
  ],
  executor: 'action.update-shape',
}

const Delay: BlockDefinition = {
  type: 'action.delay',
  category: 'action',
  name: 'Delay',
  description: 'Wait for a specified duration',
  icon: '⏳',
  color: '#3b82f6',
  inputs: [
    input('input', 'Pass Through', 'any', { description: 'Data to pass through after delay' }),
  ],
  outputs: [
    output('output', 'Output', 'any'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        description: 'Delay in milliseconds',
        default: 1000,
      },
    },
  },
  defaultConfig: {
    duration: 1000,
  },
  executor: 'action.delay',
}

// =============================================================================
// CONDITION BLOCKS
// =============================================================================

const IfCondition: BlockDefinition = {
  type: 'condition.if',
  category: 'condition',
  name: 'If/Else',
  description: 'Branch based on a boolean condition',
  icon: '❓',
  color: '#8b5cf6',
  inputs: [
    input('condition', 'Condition', 'boolean', { required: true }),
    input('value', 'Value', 'any', { required: true, description: 'Data to route' }),
  ],
  outputs: [
    output('true', 'If True', 'any', { description: 'Output when condition is true' }),
    output('false', 'If False', 'any', { description: 'Output when condition is false' }),
  ],
  executor: 'condition.if',
}

const SwitchCondition: BlockDefinition = {
  type: 'condition.switch',
  category: 'condition',
  name: 'Switch',
  description: 'Route based on value matching',
  icon: '🔀',
  color: '#8b5cf6',
  inputs: [
    input('value', 'Value', 'any', { required: true }),
    input('data', 'Data', 'any', { description: 'Data to route' }),
  ],
  outputs: [
    output('case1', 'Case 1', 'any'),
    output('case2', 'Case 2', 'any'),
    output('case3', 'Case 3', 'any'),
    output('default', 'Default', 'any'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      cases: {
        type: 'array',
        items: { type: 'string' },
        default: ['value1', 'value2', 'value3'],
      },
    },
  },
  defaultConfig: {
    cases: ['value1', 'value2', 'value3'],
  },
  executor: 'condition.switch',
}

const Compare: BlockDefinition = {
  type: 'condition.compare',
  category: 'condition',
  name: 'Compare',
  description: 'Compare two values',
  icon: '⚖️',
  color: '#8b5cf6',
  inputs: [
    input('left', 'Left Value', 'any', { required: true }),
    input('right', 'Right Value', 'any', { required: true }),
  ],
  outputs: [
    output('result', 'Result', 'boolean'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      operator: {
        type: 'string',
        enum: ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'],
        default: '==',
      },
    },
  },
  defaultConfig: {
    operator: '==',
  },
  executor: 'condition.compare',
}

// =============================================================================
// TRANSFORMER BLOCKS
// =============================================================================

const JsonParse: BlockDefinition = {
  type: 'transformer.json-parse',
  category: 'transformer',
  name: 'Parse JSON',
  description: 'Parse JSON string to object',
  icon: '📋',
  color: '#10b981',
  inputs: [
    input('input', 'JSON String', 'text', { required: true }),
  ],
  outputs: [
    output('output', 'Object', 'object'),
  ],
  executor: 'transformer.json-parse',
}

const JsonStringify: BlockDefinition = {
  type: 'transformer.json-stringify',
  category: 'transformer',
  name: 'Stringify JSON',
  description: 'Convert object to JSON string',
  icon: '📝',
  color: '#10b981',
  inputs: [
    input('input', 'Object', 'object', { required: true }),
  ],
  outputs: [
    output('output', 'JSON String', 'text'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      pretty: { type: 'boolean', default: false },
      indent: { type: 'number', default: 2 },
    },
  },
  defaultConfig: { pretty: false, indent: 2 },
  executor: 'transformer.json-stringify',
}

const CodeTransformer: BlockDefinition = {
  type: 'transformer.code',
  category: 'transformer',
  name: 'JavaScript',
  description: 'Run custom JavaScript code',
  icon: '💻',
  color: '#10b981',
  inputs: [
    input('input', 'Input', 'any', { required: true }),
    input('context', 'Context', 'object', { description: 'Additional context data' }),
  ],
  outputs: [
    output('output', 'Output', 'any'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code. Use `input` variable. Return value becomes output.',
        default: 'return input;',
      },
    },
  },
  defaultConfig: {
    code: 'return input;',
  },
  executor: 'transformer.code',
}

const Template: BlockDefinition = {
  type: 'transformer.template',
  category: 'transformer',
  name: 'Template',
  description: 'String interpolation with variables',
  icon: '📄',
  color: '#10b981',
  inputs: [
    input('data', 'Data', 'object', { required: true }),
  ],
  outputs: [
    output('output', 'Text', 'text'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        description: 'Template string. Use {{key}} for interpolation.',
        default: 'Hello, {{name}}!',
      },
    },
  },
  defaultConfig: {
    template: 'Hello, {{name}}!',
  },
  executor: 'transformer.template',
}

const GetProperty: BlockDefinition = {
  type: 'transformer.get-property',
  category: 'transformer',
  name: 'Get Property',
  description: 'Extract a property from an object',
  icon: '🔍',
  color: '#10b981',
  inputs: [
    input('object', 'Object', 'object', { required: true }),
  ],
  outputs: [
    output('value', 'Value', 'any'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Property path (e.g., "data.user.name")',
        default: '',
      },
    },
  },
  defaultConfig: { path: '' },
  executor: 'transformer.get-property',
}

const SetProperty: BlockDefinition = {
  type: 'transformer.set-property',
  category: 'transformer',
  name: 'Set Property',
  description: 'Set a property on an object',
  icon: '✏️',
  color: '#10b981',
  inputs: [
    input('object', 'Object', 'object', { required: true }),
    input('value', 'Value', 'any', { required: true }),
  ],
  outputs: [
    output('output', 'Object', 'object'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Property path to set',
        default: '',
      },
    },
  },
  defaultConfig: { path: '' },
  executor: 'transformer.set-property',
}

const ArrayMap: BlockDefinition = {
  type: 'transformer.array-map',
  category: 'transformer',
  name: 'Map Array',
  description: 'Transform each item in an array',
  icon: '🗂️',
  color: '#10b981',
  inputs: [
    input('array', 'Array', 'array', { required: true }),
  ],
  outputs: [
    output('output', 'Array', 'array'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'JavaScript expression. Use `item` and `index` variables.',
        default: 'item',
      },
    },
  },
  defaultConfig: { expression: 'item' },
  executor: 'transformer.array-map',
}

const ArrayFilter: BlockDefinition = {
  type: 'transformer.array-filter',
  category: 'transformer',
  name: 'Filter Array',
  description: 'Filter array items by condition',
  icon: '🔍',
  color: '#10b981',
  inputs: [
    input('array', 'Array', 'array', { required: true }),
  ],
  outputs: [
    output('output', 'Array', 'array'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      condition: {
        type: 'string',
        description: 'JavaScript condition. Use `item` and `index` variables.',
        default: 'true',
      },
    },
  },
  defaultConfig: { condition: 'true' },
  executor: 'transformer.array-filter',
}

// =============================================================================
// AI BLOCKS
// =============================================================================

const LLMPrompt: BlockDefinition = {
  type: 'ai.llm',
  category: 'ai',
  name: 'LLM Prompt',
  description: 'Send prompt to language model',
  icon: '🤖',
  color: '#ec4899',
  inputs: [
    input('prompt', 'Prompt', 'text', { required: true }),
    input('context', 'Context', 'text', { description: 'Additional context' }),
    input('systemPrompt', 'System Prompt', 'text', { description: 'System instructions' }),
  ],
  outputs: [
    output('response', 'Response', 'text'),
    output('usage', 'Usage', 'object', { description: 'Token usage stats' }),
  ],
  configSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        enum: ['llama3.1:8b', 'llama3.1:70b', 'claude-sonnet', 'gpt-4'],
        default: 'llama3.1:8b',
      },
      temperature: {
        type: 'number',
        minimum: 0,
        maximum: 2,
        default: 0.7,
      },
      maxTokens: {
        type: 'number',
        default: 1000,
      },
    },
  },
  defaultConfig: {
    model: 'llama3.1:8b',
    temperature: 0.7,
    maxTokens: 1000,
  },
  executor: 'ai.llm',
}

const ImageGen: BlockDefinition = {
  type: 'ai.image-gen',
  category: 'ai',
  name: 'Image Generation',
  description: 'Generate image from text prompt',
  icon: '🎨',
  color: '#ec4899',
  inputs: [
    input('prompt', 'Prompt', 'text', { required: true }),
    input('negativePrompt', 'Negative Prompt', 'text'),
  ],
  outputs: [
    output('image', 'Image', 'image'),
    output('url', 'Image URL', 'text'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        enum: ['SDXL', 'SD3', 'FLUX'],
        default: 'SDXL',
      },
      width: { type: 'number', default: 512 },
      height: { type: 'number', default: 512 },
      steps: { type: 'number', default: 20 },
    },
  },
  defaultConfig: {
    model: 'SDXL',
    width: 512,
    height: 512,
    steps: 20,
  },
  executor: 'ai.image-gen',
}

const TextToSpeech: BlockDefinition = {
  type: 'ai.tts',
  category: 'ai',
  name: 'Text to Speech',
  description: 'Convert text to audio',
  icon: '🔊',
  color: '#ec4899',
  inputs: [
    input('text', 'Text', 'text', { required: true }),
  ],
  outputs: [
    output('audio', 'Audio', 'file'),
    output('url', 'Audio URL', 'text'),
  ],
  configSchema: {
    type: 'object',
    properties: {
      voice: {
        type: 'string',
        default: 'alloy',
      },
      speed: {
        type: 'number',
        minimum: 0.5,
        maximum: 2,
        default: 1,
      },
    },
  },
  defaultConfig: { voice: 'alloy', speed: 1 },
  executor: 'ai.tts',
}

const SpeechToText: BlockDefinition = {
  type: 'ai.stt',
  category: 'ai',
  name: 'Speech to Text',
  description: 'Transcribe audio to text',
  icon: '🎤',
  color: '#ec4899',
  inputs: [
    input('audio', 'Audio', 'file', { required: true }),
  ],
  outputs: [
    output('text', 'Text', 'text'),
    output('segments', 'Segments', 'array'),
  ],
  executor: 'ai.stt',
}

// =============================================================================
// OUTPUT BLOCKS
// =============================================================================

const DisplayOutput: BlockDefinition = {
  type: 'output.display',
  category: 'output',
  name: 'Display',
  description: 'Show result on canvas',
  icon: '📺',
  color: '#ef4444',
  inputs: [
    input('value', 'Value', 'any', { required: true }),
  ],
  outputs: [],
  configSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['auto', 'json', 'text', 'markdown'],
        default: 'auto',
      },
    },
  },
  defaultConfig: { format: 'auto' },
  executor: 'output.display',
}

const LogOutput: BlockDefinition = {
  type: 'output.log',
  category: 'output',
  name: 'Log',
  description: 'Log value to console',
  icon: '📋',
  color: '#ef4444',
  inputs: [
    input('value', 'Value', 'any', { required: true }),
    input('label', 'Label', 'text'),
  ],
  outputs: [
    output('passthrough', 'Pass Through', 'any'),
  ],
  executor: 'output.log',
}

const NotifyOutput: BlockDefinition = {
  type: 'output.notify',
  category: 'output',
  name: 'Notification',
  description: 'Show browser notification',
  icon: '🔔',
  color: '#ef4444',
  inputs: [
    input('message', 'Message', 'text', { required: true }),
    input('title', 'Title', 'text'),
  ],
  outputs: [],
  configSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info',
      },
    },
  },
  defaultConfig: { type: 'info' },
  executor: 'output.notify',
}

const CreateMarkdown: BlockDefinition = {
  type: 'output.markdown',
  category: 'output',
  name: 'Create Markdown',
  description: 'Create a markdown shape on canvas',
  icon: '📝',
  color: '#ef4444',
  inputs: [
    input('content', 'Content', 'text', { required: true }),
    input('x', 'X Position', 'number'),
    input('y', 'Y Position', 'number'),
  ],
  outputs: [
    output('shapeId', 'Shape ID', 'text'),
  ],
  executor: 'output.markdown',
}

// =============================================================================
// Register All Blocks
// =============================================================================

const ALL_BLOCKS: BlockDefinition[] = [
  // Triggers
  ManualTrigger,
  ScheduleTrigger,
  WebhookTrigger,
  // Actions
  HttpRequest,
  CreateShape,
  UpdateShape,
  Delay,
  // Conditions
  IfCondition,
  SwitchCondition,
  Compare,
  // Transformers
  JsonParse,
  JsonStringify,
  CodeTransformer,
  Template,
  GetProperty,
  SetProperty,
  ArrayMap,
  ArrayFilter,
  // AI
  LLMPrompt,
  ImageGen,
  TextToSpeech,
  SpeechToText,
  // Outputs
  DisplayOutput,
  LogOutput,
  NotifyOutput,
  CreateMarkdown,
]

// Register all blocks
for (const block of ALL_BLOCKS) {
  BLOCK_REGISTRY.set(block.type, block)
}

// =============================================================================
// Registry Access Functions
// =============================================================================

/**
 * Get a block definition by type
 */
export function getBlockDefinition(type: string): BlockDefinition {
  const def = BLOCK_REGISTRY.get(type)
  if (!def) {
    throw new Error(`Unknown block type: ${type}`)
  }
  return def
}

/**
 * Check if a block type exists
 */
export function hasBlockDefinition(type: string): boolean {
  return BLOCK_REGISTRY.has(type)
}

/**
 * Get all registered block definitions
 */
export function getAllBlockDefinitions(): BlockDefinition[] {
  return Array.from(BLOCK_REGISTRY.values())
}

/**
 * Get blocks filtered by category
 */
export function getBlocksByCategory(category: BlockCategory): BlockDefinition[] {
  return getAllBlockDefinitions().filter(b => b.category === category)
}

/**
 * Register a new block definition
 */
export function registerBlock(definition: BlockDefinition): void {
  if (BLOCK_REGISTRY.has(definition.type)) {
    console.warn(`Block type "${definition.type}" is already registered. Overwriting.`)
  }
  BLOCK_REGISTRY.set(definition.type, definition)
}

/**
 * Get all block categories with their blocks
 */
export function getBlocksByCategories(): Record<BlockCategory, BlockDefinition[]> {
  const result: Record<BlockCategory, BlockDefinition[]> = {
    trigger: [],
    action: [],
    condition: [],
    transformer: [],
    output: [],
    ai: [],
  }

  for (const block of BLOCK_REGISTRY.values()) {
    result[block.category].push(block)
  }

  return result
}
