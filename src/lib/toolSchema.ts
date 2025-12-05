/**
 * Canvas Tool Schema
 * Defines the purpose, capabilities, and usage context for each custom tool
 * Used by the Mycelial Intelligence to understand and assist with workspace tools
 */

export interface ToolCapability {
  name: string
  description: string
}

export interface ToolSchema {
  /** Unique identifier matching the shape type */
  id: string
  /** Human-readable display name */
  displayName: string
  /** Primary theme color (hex) */
  primaryColor: string
  /** Icon or emoji representing this tool */
  icon: string
  /** High-level purpose of this tool */
  purpose: string
  /** Detailed description of what this tool does */
  description: string
  /** List of specific capabilities */
  capabilities: ToolCapability[]
  /** When to suggest using this tool */
  useCases: string[]
  /** Tags for categorization */
  tags: string[]
  /** Whether this tool connects to external services */
  requiresExternalServices: boolean
  /** External service dependencies if any */
  externalServices?: string[]
}

/**
 * Complete schema for all canvas tools
 */
export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  // === AI Generation Tools ===

  Prompt: {
    id: 'Prompt',
    displayName: 'AI Prompt',
    primaryColor: '#6366f1',
    icon: '✨',
    purpose: 'Generate text responses using AI language models',
    description: 'A versatile text generation tool that connects to AI language models (local Ollama or cloud-based) to generate responses, answer questions, write content, and assist with creative and analytical tasks. Supports multiple AI models and streaming responses.',
    capabilities: [
      { name: 'Text Generation', description: 'Generate any kind of text content from prompts' },
      { name: 'Question Answering', description: 'Answer questions using AI knowledge' },
      { name: 'Model Selection', description: 'Choose from available local and cloud AI models' },
      { name: 'Streaming Output', description: 'See responses appear in real-time as they generate' },
      { name: 'Context Awareness', description: 'Can reference other shapes on the canvas for context' },
    ],
    useCases: [
      'Writing assistance and content creation',
      'Brainstorming and ideation',
      'Summarizing or analyzing text',
      'Code explanation or generation',
      'Research and question answering',
    ],
    tags: ['ai', 'text', 'generation', 'llm', 'creative'],
    requiresExternalServices: true,
    externalServices: ['Ollama (local)', 'Cloud LLM APIs'],
  },

  ImageGen: {
    id: 'ImageGen',
    displayName: 'AI Image Generator',
    primaryColor: '#ec4899',
    icon: '🎨',
    purpose: 'Generate images from text descriptions using AI',
    description: 'Creates images from text prompts using Stable Diffusion models. Supports various image sizes, styles, and can generate multiple variations. Connects to local or RunPod GPU endpoints for image synthesis.',
    capabilities: [
      { name: 'Text-to-Image', description: 'Generate images from descriptive prompts' },
      { name: 'Style Control', description: 'Influence the artistic style of generated images' },
      { name: 'Size Options', description: 'Generate images in various aspect ratios and resolutions' },
      { name: 'Batch Generation', description: 'Create multiple image variations at once' },
      { name: 'Progress Tracking', description: 'See generation progress in real-time' },
    ],
    useCases: [
      'Creating visual content and artwork',
      'Concept visualization and mood boards',
      'UI/UX design mockups',
      'Creative brainstorming with visuals',
      'Illustration for presentations',
    ],
    tags: ['ai', 'image', 'generation', 'art', 'visual', 'creative'],
    requiresExternalServices: true,
    externalServices: ['Stable Diffusion (local)', 'RunPod GPU'],
  },

  VideoGen: {
    id: 'VideoGen',
    displayName: 'AI Video Generator',
    primaryColor: '#f97316',
    icon: '🎬',
    purpose: 'Generate video clips from images or text using AI',
    description: 'Creates short video clips using AI video generation models like Wan2.1. Can animate still images (Image-to-Video) or generate videos from text descriptions (Text-to-Video). Useful for bringing static content to life.',
    capabilities: [
      { name: 'Image-to-Video', description: 'Animate a still image into a video clip' },
      { name: 'Text-to-Video', description: 'Generate video from text descriptions' },
      { name: 'Motion Control', description: 'Guide the type and amount of motion' },
      { name: 'Duration Options', description: 'Control the length of generated videos' },
      { name: 'Progress Tracking', description: 'Monitor generation progress with time estimates' },
    ],
    useCases: [
      'Animating concept art or illustrations',
      'Creating dynamic presentations',
      'Social media content creation',
      'Prototyping motion graphics',
      'Visual storytelling',
    ],
    tags: ['ai', 'video', 'generation', 'animation', 'motion', 'creative'],
    requiresExternalServices: true,
    externalServices: ['RunPod GPU (Wan2.1)'],
  },

  // === Content & Notes Tools ===

  ChatBox: {
    id: 'ChatBox',
    displayName: 'Chat Box',
    primaryColor: '#3b82f6',
    icon: '💬',
    purpose: 'Interactive AI chat interface for conversations',
    description: 'A persistent chat interface for multi-turn conversations with AI. Maintains conversation history, supports different AI models, and allows for in-depth discussions and iterative refinement of ideas.',
    capabilities: [
      { name: 'Conversation History', description: 'Maintains full chat context across messages' },
      { name: 'Multi-turn Dialog', description: 'Have back-and-forth conversations with AI' },
      { name: 'Model Selection', description: 'Choose which AI model to chat with' },
      { name: 'Context Persistence', description: 'AI remembers what was discussed earlier' },
      { name: 'Streaming Responses', description: 'See AI responses as they generate' },
    ],
    useCases: [
      'In-depth discussions and exploration',
      'Iterative problem solving',
      'Learning and Q&A sessions',
      'Collaborative brainstorming',
      'Getting detailed explanations',
    ],
    tags: ['ai', 'chat', 'conversation', 'dialogue', 'interactive'],
    requiresExternalServices: true,
    externalServices: ['Ollama (local)', 'Cloud LLM APIs'],
  },

  Markdown: {
    id: 'Markdown',
    displayName: 'Markdown Note',
    primaryColor: '#14b8a6',
    icon: '📝',
    purpose: 'Rich text notes with WYSIWYG and Markdown editing',
    description: 'A modern WYSIWYG markdown editor powered by MDXEditor. Edit content naturally like in Notion or Google Docs, with full markdown support. Toggle between rich-text mode and raw source mode. Supports tables, code blocks with syntax highlighting, images, and more.',
    capabilities: [
      { name: 'WYSIWYG Editing', description: 'Edit naturally without seeing raw markdown syntax' },
      { name: 'Source Mode Toggle', description: 'Switch between rich-text and raw markdown views' },
      { name: 'Markdown Shortcuts', description: 'Type # for headings, * for lists, ``` for code blocks' },
      { name: 'Code Highlighting', description: 'Syntax highlighting for 15+ programming languages' },
      { name: 'Tables', description: 'Insert and edit tables with visual controls' },
      { name: 'Rich Formatting', description: 'Headers, bold, italic, lists, blockquotes, links, images' },
      { name: 'Toolbar', description: 'Formatting toolbar for quick access to all features' },
    ],
    useCases: [
      'Documentation and technical notes',
      'Meeting notes with structure',
      'Code documentation with syntax highlighting',
      'Formatted lists and outlines',
      'Knowledge base articles',
      'Quick note-taking with markdown shortcuts',
    ],
    tags: ['notes', 'markdown', 'documentation', 'writing', 'formatting', 'wysiwyg'],
    requiresExternalServices: false,
  },

  ObsNote: {
    id: 'ObsNote',
    displayName: 'Observation Note',
    primaryColor: '#f59e0b',
    icon: '📋',
    purpose: 'Quick notes for observations and thoughts',
    description: 'Lightweight sticky-note style shapes for capturing quick thoughts, observations, and ideas. Simple text editing with a clean interface, perfect for rapid note-taking during brainstorming or research.',
    capabilities: [
      { name: 'Quick Capture', description: 'Fast creation for rapid note-taking' },
      { name: 'Simple Editing', description: 'Clean, distraction-free text editing' },
      { name: 'Visual Distinction', description: 'Color-coded for easy identification' },
      { name: 'Flexible Sizing', description: 'Resize to fit content needs' },
      { name: 'Canvas Positioning', description: 'Arrange freely on the canvas' },
    ],
    useCases: [
      'Quick thought capture',
      'Brainstorming sessions',
      'Annotations and comments',
      'Research observations',
      'To-do items and reminders',
    ],
    tags: ['notes', 'quick', 'sticky', 'observation', 'capture'],
    requiresExternalServices: false,
  },

  // === Audio & Media Tools ===

  Transcription: {
    id: 'Transcription',
    displayName: 'Voice Transcription',
    primaryColor: '#ff9500',
    icon: '🎤',
    purpose: 'Convert speech to text in real-time',
    description: 'Records audio and transcribes speech to text using either the Web Speech API (browser-native, real-time) or Whisper AI (higher accuracy). Perfect for capturing verbal ideas, meetings, or dictation.',
    capabilities: [
      { name: 'Real-time Transcription', description: 'See text appear as you speak (Web Speech)' },
      { name: 'Whisper AI Mode', description: 'Higher accuracy transcription with local Whisper' },
      { name: 'Continuous Recording', description: 'Record extended sessions without interruption' },
      { name: 'Pause & Resume', description: 'Control recording flow as needed' },
      { name: 'Text Editing', description: 'Edit transcribed text after recording' },
    ],
    useCases: [
      'Meeting transcription',
      'Voice note capture',
      'Dictation and hands-free input',
      'Interview recording',
      'Accessibility support',
    ],
    tags: ['audio', 'transcription', 'speech', 'voice', 'recording'],
    requiresExternalServices: false,
    externalServices: ['Web Speech API (browser)', 'Whisper AI (optional)'],
  },

  // === External Content Tools ===

  Embed: {
    id: 'Embed',
    displayName: 'Web Embed',
    primaryColor: '#eab308',
    icon: '🌐',
    purpose: 'Embed external web content into the canvas',
    description: 'Embeds external websites, videos, and interactive content directly into the canvas. Supports YouTube, Google Maps, Twitter/X, and many other web services. Great for gathering reference material.',
    capabilities: [
      { name: 'YouTube Embedding', description: 'Embed and watch YouTube videos inline' },
      { name: 'Map Integration', description: 'Embed Google Maps for location reference' },
      { name: 'Social Media', description: 'Embed tweets and social content' },
      { name: 'General Websites', description: 'Embed any iframe-compatible website' },
      { name: 'Interactive Content', description: 'Embedded content remains interactive' },
    ],
    useCases: [
      'Reference video content',
      'Location-based research',
      'Social media curation',
      'External documentation',
      'Interactive demos and tools',
    ],
    tags: ['embed', 'web', 'external', 'media', 'reference'],
    requiresExternalServices: true,
    externalServices: ['External websites'],
  },

  // === Collaboration Tools ===

  Holon: {
    id: 'Holon',
    displayName: 'Holon (Holosphere)',
    primaryColor: '#22c55e',
    icon: '🌐',
    purpose: 'Connect to the decentralized Holosphere network',
    description: 'Connects to Holons - nodes in the decentralized Holosphere network. Holons can be geospatial (H3 cells representing locations) or organizational (workspaces and groups). View and contribute data across the global knowledge network.',
    capabilities: [
      { name: 'Holon Connection', description: 'Connect to any Holon by ID (H3 cell or numeric)' },
      { name: 'Data Lenses', description: 'View different categories of data (users, tasks, events, etc.)' },
      { name: 'Real-time Sync', description: 'Data syncs via GunDB decentralized database' },
      { name: 'Geospatial Indexing', description: 'Access location-based holons via H3 cells' },
      { name: 'Collaborative Data', description: 'Read and write shared data with other users' },
    ],
    useCases: [
      'Accessing location-based community data',
      'Connecting to organizational workspaces',
      'Viewing shared tasks and activities',
      'Participating in decentralized collaboration',
      'Geographic data exploration',
    ],
    tags: ['collaboration', 'decentralized', 'holosphere', 'geospatial', 'community'],
    requiresExternalServices: true,
    externalServices: ['GunDB (Holosphere)', 'H3 Geospatial Index'],
  },

  Multmux: {
    id: 'Multmux',
    displayName: 'mulTmux Terminal',
    primaryColor: '#8b5cf6',
    icon: '💻',
    purpose: 'Collaborative terminal sessions',
    description: 'Shared terminal sessions that multiple users can view and interact with simultaneously. Uses xterm.js for a full terminal experience. Perfect for pair programming, teaching, or collaborative system administration.',
    capabilities: [
      { name: 'Shared Sessions', description: 'Multiple users can join the same terminal' },
      { name: 'Real Terminal', description: 'Full terminal emulation with xterm.js' },
      { name: 'Session Management', description: 'Create, join, and list active sessions' },
      { name: 'Real-time Sync', description: 'See inputs and outputs from all participants' },
      { name: 'Presence Awareness', description: 'Know who else is in the session' },
    ],
    useCases: [
      'Pair programming sessions',
      'Teaching command-line tools',
      'Collaborative debugging',
      'Shared server administration',
      'Live coding demonstrations',
    ],
    tags: ['terminal', 'collaboration', 'shell', 'programming', 'devops'],
    requiresExternalServices: true,
    externalServices: ['mulTmux server (local)'],
  },

  // === Presentation Tools ===

  Slide: {
    id: 'Slide',
    displayName: 'Slide',
    primaryColor: '#6b7280',
    icon: '📊',
    purpose: 'Create presentation slides on the canvas',
    description: 'Defines presentation slide boundaries on the canvas. Double-click to zoom into slide view. Arrange content within slide boundaries to create presentations that can be navigated sequentially.',
    capabilities: [
      { name: 'Slide Definition', description: 'Define slide boundaries on the canvas' },
      { name: 'Navigation', description: 'Double-click to zoom to slide view' },
      { name: 'Sequential Ordering', description: 'Slides are numbered for presentation order' },
      { name: 'Content Freedom', description: 'Place any canvas content inside slides' },
      { name: 'Present Mode', description: 'Navigate slides in presentation mode' },
    ],
    useCases: [
      'Creating presentations from canvas content',
      'Organizing content into viewable sections',
      'Teaching and walkthroughs',
      'Sequential storytelling',
      'Guided tours of canvas workspaces',
    ],
    tags: ['presentation', 'slides', 'organization', 'navigation'],
    requiresExternalServices: false,
  },
}

/**
 * Get a formatted summary of all tools for AI context
 */
export function getToolSummaryForAI(): string {
  const summaries = Object.values(TOOL_SCHEMAS).map(tool => {
    const capabilities = tool.capabilities.map(c => `  - ${c.name}: ${c.description}`).join('\n')
    const useCases = tool.useCases.map(u => `  - ${u}`).join('\n')

    return `
### ${tool.icon} ${tool.displayName} (${tool.id})
**Purpose:** ${tool.purpose}

${tool.description}

**Capabilities:**
${capabilities}

**When to use:**
${useCases}

**Tags:** ${tool.tags.join(', ')}
${tool.requiresExternalServices ? `**External Services:** ${tool.externalServices?.join(', ')}` : '**Works offline**'}
`
  }).join('\n---\n')

  return `# Canvas Tools Reference

The following tools are available in this workspace. Each tool is a specialized shape that can be placed on the canvas.

${summaries}`
}

/**
 * Get tool schema by ID
 */
export function getToolSchema(toolId: string): ToolSchema | undefined {
  return TOOL_SCHEMAS[toolId]
}

/**
 * Get tools by tag
 */
export function getToolsByTag(tag: string): ToolSchema[] {
  return Object.values(TOOL_SCHEMAS).filter(tool => tool.tags.includes(tag))
}

/**
 * Selection-aware action suggestions
 * When shapes are selected, these actions can be performed
 */
export interface SelectionAction {
  id: string
  label: string
  description: string
  icon: string
  /** Intent patterns that trigger this action */
  patterns: RegExp[]
}

export const SELECTION_ACTIONS: SelectionAction[] = [
  {
    id: 'generate-image-from-text',
    label: 'Generate Image',
    description: 'Create an image from the selected text content',
    icon: '🎨',
    patterns: [/generate.*image|create.*image|visualize|illustrate/i],
  },
  {
    id: 'generate-video-from-image',
    label: 'Animate Image',
    description: 'Create a video from the selected image',
    icon: '🎬',
    patterns: [/animate|video|bring.*life|make.*move/i],
  },
  {
    id: 'summarize-selection',
    label: 'Summarize',
    description: 'Create a summary of the selected content',
    icon: '📝',
    patterns: [/summarize|summary|condense|brief/i],
  },
  {
    id: 'expand-selection',
    label: 'Expand',
    description: 'Elaborate on the selected content',
    icon: '✨',
    patterns: [/expand|elaborate|more.*detail|flesh.*out/i],
  },
  {
    id: 'connect-selection',
    label: 'Find Connections',
    description: 'Find relationships between selected items',
    icon: '🔗',
    patterns: [/connect|relate|relationship|link|between/i],
  },
]

/**
 * Get selection actions that match an intent
 */
export function suggestSelectionActions(intent: string): SelectionAction[] {
  const intentLower = intent.toLowerCase()
  return SELECTION_ACTIONS.filter(action =>
    action.patterns.some(pattern => pattern.test(intentLower))
  )
}

/**
 * Suggest tools based on user intent
 * Enhanced pattern matching for natural language queries
 */
export function suggestToolsForIntent(intent: string): ToolSchema[] {
  const intentLower = intent.toLowerCase()
  const suggestions: ToolSchema[] = []

  // Don't suggest tools for pure transform commands
  if (intentLower.match(/^(align|arrange|distribute|make.*same|resize|grid|row|column|circle)\b/)) {
    return [] // Transform commands don't need tool suggestions
  }

  // AI Text Generation / Prompt intents
  if (intentLower.match(/\b(write|generate|create|compose|draft|text|answer|explain|summarize|analyze|research|brainstorm|help me|assist|outline|describe|elaborate|rewrite|edit|improve|ai|gpt|llm|prompt)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Prompt)
  }

  // Image Generation intents
  if (intentLower.match(/\b(image|picture|art|draw|visual|illustration|design|artwork|painting|sketch|render|graphic|photo|portrait|scene|generate.*image|create.*image|make.*image|visualize)\b/)) {
    suggestions.push(TOOL_SCHEMAS.ImageGen)
  }

  // Video Generation intents
  if (intentLower.match(/\b(video|animate|animation|motion|clip|movie|film|footage|moving|dynamic|animate.*image|bring.*life|make.*move)\b/)) {
    suggestions.push(TOOL_SCHEMAS.VideoGen)
  }

  // Chat/Conversation intents
  if (intentLower.match(/\b(chat|conversation|discuss|dialogue|talk|multi-turn|back.?and.?forth|iterative|deep.?dive|explore.?topic|q.?&.?a)\b/)) {
    suggestions.push(TOOL_SCHEMAS.ChatBox)
  }

  // Rich text notes / Markdown intents
  if (intentLower.match(/\b(note|document|markdown|format|documentation|wiki|article|blog|readme|writing|structured|rich.?text|code.?block|table|heading|list)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Markdown)
  }

  // Quick notes / Observation intents
  if (intentLower.match(/\b(quick|sticky|capture|thought|idea|jot|reminder|todo|observation|memo|post-?it|scribble|brief)\b/)) {
    suggestions.push(TOOL_SCHEMAS.ObsNote)
  }

  // Both note types for general note-taking
  if (intentLower.match(/\b(take.?note|make.?note|write.?down|record.?thought)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Markdown, TOOL_SCHEMAS.ObsNote)
  }

  // Transcription / Voice intents
  if (intentLower.match(/\b(transcrib|record|voice|speak|audio|dictate|speech|microphone|meeting|interview|lecture|podcast|listen)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Transcription)
  }

  // Embed / External content intents
  if (intentLower.match(/\b(embed|youtube|website|link|map|google.?map|iframe|external|reference|twitter|tweet|social|import|bring.?in)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Embed)
  }

  // Terminal / Code intents
  if (intentLower.match(/\b(terminal|shell|command|code|program|script|bash|run|execute|deploy|devops|server|ssh|pip|npm|git|docker)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Multmux)
  }

  // Holon / Community intents
  if (intentLower.match(/\b(holon|holosphere|location|community|decentralized|geo|place|coordinate|h3|cell|collaborative.?data|shared)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Holon)
  }

  // Presentation / Slide intents
  if (intentLower.match(/\b(present|slide|presentation|organize|sequence|walkthrough|demo|tour|pitch|deck|keynote|powerpoint)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Slide)
  }

  // Task-oriented compound intents
  // Planning / Project management
  if (intentLower.match(/\b(plan|planning|project|roadmap|timeline|milestone|schedule|organize.?work)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Markdown, TOOL_SCHEMAS.ObsNote, TOOL_SCHEMAS.Prompt)
  }

  // Research
  if (intentLower.match(/\b(research|investigate|learn|study|explore|understand|find.?out|look.?up)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Prompt, TOOL_SCHEMAS.Markdown, TOOL_SCHEMAS.Embed)
  }

  // Creative work
  if (intentLower.match(/\b(creative|artistic|design|mood.?board|inspiration|concept|prototype|mockup)\b/)) {
    suggestions.push(TOOL_SCHEMAS.ImageGen, TOOL_SCHEMAS.Prompt, TOOL_SCHEMAS.Markdown)
  }

  // Meeting / Collaboration
  if (intentLower.match(/\b(meeting|collaborate|team|group|pair|together|session|workshop)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Transcription, TOOL_SCHEMAS.Markdown, TOOL_SCHEMAS.ChatBox)
  }

  // Development / Coding
  if (intentLower.match(/\b(develop|coding|programming|debug|build|compile|test|api|function|class|module)\b/)) {
    suggestions.push(TOOL_SCHEMAS.Multmux, TOOL_SCHEMAS.Prompt, TOOL_SCHEMAS.Markdown)
  }

  // Content creation
  if (intentLower.match(/\b(content|social.?media|post|publish|share|marketing|campaign|brand)\b/)) {
    suggestions.push(TOOL_SCHEMAS.ImageGen, TOOL_SCHEMAS.VideoGen, TOOL_SCHEMAS.Prompt)
  }

  // Remove duplicates while preserving order
  const seen = new Set<string>()
  return suggestions.filter(tool => {
    if (seen.has(tool.id)) return false
    seen.add(tool.id)
    return true
  })
}
