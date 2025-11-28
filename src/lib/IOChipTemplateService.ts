import { TLShapeId } from "tldraw"
import { IOPin, IOPinType } from "@/shapes/IOChipShapeUtil"

// Wire connection between two pins
export interface IOWireConnection {
  id: string
  fromPinId: string
  toPinId: string
  fromShapeId: TLShapeId
  toShapeId: TLShapeId
  pinType: IOPinType
}

// Contained shape reference with relative position
export interface ContainedShapeRef {
  originalId: TLShapeId
  type: string
  relativeX: number  // Position relative to chip origin
  relativeY: number
  props: Record<string, any>  // Sanitized props (no sensitive data)
}

// Full chip template schema
export interface IOChipTemplate {
  id: string
  name: string
  description?: string
  category?: string
  icon?: string
  createdAt: number
  updatedAt: number

  // Chip dimensions
  width: number
  height: number

  // I/O schema
  inputPins: IOPin[]
  outputPins: IOPin[]

  // Internal structure
  containedShapes: ContainedShapeRef[]
  wires: IOWireConnection[]

  // Metadata
  tags: string[]
  author?: string
  version?: string
}

// Template category for organization
export interface IOChipCategory {
  id: string
  name: string
  icon: string
  description?: string
}

// Default categories
export const DEFAULT_CATEGORIES: IOChipCategory[] = [
  { id: 'ai', name: 'AI & ML', icon: '🤖', description: 'AI and machine learning pipelines' },
  { id: 'media', name: 'Media', icon: '🎬', description: 'Image, video, and audio processing' },
  { id: 'data', name: 'Data', icon: '📊', description: 'Data transformation and analysis' },
  { id: 'integration', name: 'Integration', icon: '🔗', description: 'API and service integrations' },
  { id: 'utility', name: 'Utility', icon: '🔧', description: 'General purpose utilities' },
  { id: 'custom', name: 'Custom', icon: '⭐', description: 'User-created templates' },
]

// Storage key
const TEMPLATES_STORAGE_KEY = 'io-chip-templates'
const CATEGORIES_STORAGE_KEY = 'io-chip-categories'

class IOChipTemplateService {
  private templates: Map<string, IOChipTemplate> = new Map()
  private categories: IOChipCategory[] = [...DEFAULT_CATEGORIES]
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  // Load templates from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as IOChipTemplate[]
        this.templates = new Map(parsed.map(t => [t.id, t]))
      }

      const storedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY)
      if (storedCategories) {
        this.categories = JSON.parse(storedCategories)
      }
    } catch (error) {
      console.error('❌ Failed to load IO chip templates:', error)
    }
  }

  // Save templates to localStorage
  private saveToStorage(): void {
    try {
      const templates = Array.from(this.templates.values())
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories))
      this.notifyListeners()
    } catch (error) {
      console.error('❌ Failed to save IO chip templates:', error)
    }
  }

  // Subscribe to changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }

  // Generate unique ID
  private generateId(): string {
    return `chip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Save a new template
  saveTemplate(template: Omit<IOChipTemplate, 'id' | 'createdAt' | 'updatedAt'>): IOChipTemplate {
    const now = Date.now()
    const newTemplate: IOChipTemplate = {
      ...template,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    }

    this.templates.set(newTemplate.id, newTemplate)
    this.saveToStorage()

    console.log('💾 Saved IO chip template:', newTemplate.name)
    return newTemplate
  }

  // Update existing template
  updateTemplate(id: string, updates: Partial<IOChipTemplate>): IOChipTemplate | null {
    const existing = this.templates.get(id)
    if (!existing) {
      console.error('❌ Template not found:', id)
      return null
    }

    const updated: IOChipTemplate = {
      ...existing,
      ...updates,
      id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: Date.now(),
    }

    this.templates.set(id, updated)
    this.saveToStorage()

    console.log('📝 Updated IO chip template:', updated.name)
    return updated
  }

  // Delete template
  deleteTemplate(id: string): boolean {
    const deleted = this.templates.delete(id)
    if (deleted) {
      this.saveToStorage()
      console.log('🗑️ Deleted IO chip template:', id)
    }
    return deleted
  }

  // Get single template
  getTemplate(id: string): IOChipTemplate | undefined {
    return this.templates.get(id)
  }

  // Get all templates
  getAllTemplates(): IOChipTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  // Get templates by category
  getTemplatesByCategory(categoryId: string): IOChipTemplate[] {
    return this.getAllTemplates().filter(t => t.category === categoryId)
  }

  // Search templates
  searchTemplates(query: string): IOChipTemplate[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllTemplates().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  // Get all categories
  getCategories(): IOChipCategory[] {
    return this.categories
  }

  // Add custom category
  addCategory(category: Omit<IOChipCategory, 'id'>): IOChipCategory {
    const newCategory: IOChipCategory = {
      ...category,
      id: `cat-${Date.now()}`,
    }
    this.categories.push(newCategory)
    this.saveToStorage()
    return newCategory
  }

  // Export template as JSON
  exportTemplate(id: string): string | null {
    const template = this.templates.get(id)
    if (!template) return null
    return JSON.stringify(template, null, 2)
  }

  // Import template from JSON
  importTemplate(json: string): IOChipTemplate | null {
    try {
      const template = JSON.parse(json) as IOChipTemplate
      // Generate new ID to avoid conflicts
      template.id = this.generateId()
      template.createdAt = Date.now()
      template.updatedAt = Date.now()

      this.templates.set(template.id, template)
      this.saveToStorage()

      console.log('📥 Imported IO chip template:', template.name)
      return template
    } catch (error) {
      console.error('❌ Failed to import template:', error)
      return null
    }
  }

  // Export all templates
  exportAllTemplates(): string {
    return JSON.stringify(this.getAllTemplates(), null, 2)
  }

  // Import multiple templates
  importTemplates(json: string): number {
    try {
      const templates = JSON.parse(json) as IOChipTemplate[]
      let count = 0

      for (const template of templates) {
        template.id = this.generateId()
        template.createdAt = Date.now()
        template.updatedAt = Date.now()
        this.templates.set(template.id, template)
        count++
      }

      this.saveToStorage()
      console.log(`📥 Imported ${count} IO chip templates`)
      return count
    } catch (error) {
      console.error('❌ Failed to import templates:', error)
      return 0
    }
  }

  // Create some built-in example templates
  createBuiltInTemplates(): void {
    if (this.templates.size > 0) return // Don't overwrite existing

    // Image Generation Pipeline
    this.saveTemplate({
      name: 'Text to Image',
      description: 'Generate images from text prompts using AI',
      category: 'ai',
      icon: '🎨',
      width: 500,
      height: 300,
      inputPins: [
        { id: 'prompt-in', name: 'Prompt', type: 'prompt', direction: 'input', required: true },
        { id: 'style-in', name: 'Style', type: 'text', direction: 'input', required: false },
      ],
      outputPins: [
        { id: 'image-out', name: 'Generated Image', type: 'image', direction: 'output' },
      ],
      containedShapes: [],
      wires: [],
      tags: ['ai', 'image', 'generation', 'stable-diffusion'],
    })

    // Video Generation Pipeline
    this.saveTemplate({
      name: 'Image to Video',
      description: 'Animate images into videos using AI',
      category: 'ai',
      icon: '🎬',
      width: 600,
      height: 350,
      inputPins: [
        { id: 'image-in', name: 'Source Image', type: 'image', direction: 'input', required: true },
        { id: 'prompt-in', name: 'Motion Prompt', type: 'prompt', direction: 'input', required: false },
      ],
      outputPins: [
        { id: 'video-out', name: 'Generated Video', type: 'video', direction: 'output' },
      ],
      containedShapes: [],
      wires: [],
      tags: ['ai', 'video', 'animation', 'wan'],
    })

    // Chat Pipeline
    this.saveTemplate({
      name: 'AI Chat',
      description: 'Conversational AI with context',
      category: 'ai',
      icon: '💬',
      width: 450,
      height: 400,
      inputPins: [
        { id: 'message-in', name: 'User Message', type: 'text', direction: 'input', required: true },
        { id: 'context-in', name: 'Context', type: 'data', direction: 'input', required: false },
      ],
      outputPins: [
        { id: 'response-out', name: 'AI Response', type: 'text', direction: 'output' },
      ],
      containedShapes: [],
      wires: [],
      tags: ['ai', 'chat', 'llm', 'conversation'],
    })

    // Transcription Pipeline
    this.saveTemplate({
      name: 'Audio Transcription',
      description: 'Convert speech to text',
      category: 'media',
      icon: '🎤',
      width: 400,
      height: 250,
      inputPins: [
        { id: 'audio-in', name: 'Audio File', type: 'file', direction: 'input', required: true },
      ],
      outputPins: [
        { id: 'transcript-out', name: 'Transcript', type: 'text', direction: 'output' },
      ],
      containedShapes: [],
      wires: [],
      tags: ['audio', 'transcription', 'speech-to-text', 'whisper'],
    })

    console.log('📦 Created built-in IO chip templates')
  }
}

// Singleton instance
export const ioChipTemplateService = new IOChipTemplateService()

// Initialize built-in templates
ioChipTemplateService.createBuiltInTemplates()
