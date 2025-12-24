/**
 * Semantic Search Service
 * Uses @xenova/transformers for browser-based embeddings
 * Provides global understanding of canvas shapes for AI queries
 */

import { Editor, TLShape, TLShapeId } from 'tldraw'

// Lazy load transformers to avoid blocking initial page load
let pipeline: any = null
let embeddingModel: any = null

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2' // Fast, good quality embeddings (384 dimensions)
const DB_NAME = 'canvas-semantic-search'
const DB_VERSION = 1
const STORE_NAME = 'embeddings'

export interface ShapeEmbedding {
  shapeId: TLShapeId
  embedding: number[]
  text: string
  shapeType: string
  timestamp: number
}

export interface SemanticSearchResult {
  shapeId: TLShapeId
  shape: TLShape
  similarity: number
  matchedText: string
}

export interface CanvasContext {
  totalShapes: number
  shapeTypes: Record<string, number>
  textContent: string[]
  summary: string
}

/**
 * Initialize the embedding model (lazy loaded)
 */
async function initializeModel(): Promise<void> {
  if (embeddingModel) return

  try {
    // Dynamic import to avoid blocking
    const { pipeline: pipelineFn } = await import('@xenova/transformers')
    pipeline = pipelineFn

    embeddingModel = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // Use quantized model for faster inference
    })
  } catch (error) {
    console.error('❌ Failed to load embedding model:', error)
    throw error
  }
}

/**
 * Extract text content from a shape based on its type
 */
export function extractShapeText(shape: TLShape): string {
  const props = shape.props as any
  const meta = shape.meta as any

  const textParts: string[] = []

  // Add shape type for context
  textParts.push(`[${shape.type}]`)

  // Extract text from various properties
  if (props.text) textParts.push(props.text)
  if (props.content) textParts.push(props.content)
  if (props.prompt) textParts.push(props.prompt)
  if (props.value && typeof props.value === 'string') textParts.push(props.value)
  if (props.name) textParts.push(props.name)
  if (props.description) textParts.push(props.description)
  if (props.url) textParts.push(`URL: ${props.url}`)
  if (props.editingContent) textParts.push(props.editingContent)
  if (props.originalContent) textParts.push(props.originalContent)

  // Check meta for text (geo shapes)
  if (meta?.text) textParts.push(meta.text)

  // For tldraw built-in shapes
  if (shape.type === 'text' && props.text) {
    textParts.push(props.text)
  }
  if (shape.type === 'note' && props.text) {
    textParts.push(props.text)
  }

  return textParts.filter(Boolean).join(' ').trim()
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  await initializeModel()

  if (!text || text.trim().length === 0) {
    return []
  }

  try {
    const output = await embeddingModel(text, {
      pooling: 'mean',
      normalize: true,
    })

    // Convert to regular array
    return Array.from(output.data)
  } catch (error) {
    console.error('❌ Failed to generate embedding:', error)
    return []
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * IndexedDB operations for embedding storage
 */
class EmbeddingStore {
  private db: IDBDatabase | null = null

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'shapeId' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('shapeType', 'shapeType', { unique: false })
        }
      }
    })
  }

  async save(embedding: ShapeEmbedding): Promise<void> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(embedding)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async get(shapeId: TLShapeId): Promise<ShapeEmbedding | undefined> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(shapeId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAll(): Promise<ShapeEmbedding[]> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async delete(shapeId: TLShapeId): Promise<void> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(shapeId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clear(): Promise<void> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

const embeddingStore = new EmbeddingStore()

/**
 * Main Semantic Search Service
 */
export class SemanticSearchService {
  private editor: Editor | null = null
  private isIndexing = false
  private indexingProgress = 0

  setEditor(editor: Editor): void {
    this.editor = editor
  }

  /**
   * Index all shapes on the current canvas page
   */
  async indexCanvas(onProgress?: (progress: number) => void): Promise<void> {
    if (!this.editor || this.isIndexing) return

    this.isIndexing = true
    this.indexingProgress = 0

    try {
      const shapes = this.editor.getCurrentPageShapes()
      const shapesWithText = shapes.filter(s => extractShapeText(s).length > 10) // Only shapes with meaningful text


      for (let i = 0; i < shapesWithText.length; i++) {
        const shape = shapesWithText[i]
        const text = extractShapeText(shape)

        // Check if already indexed and text hasn't changed
        const existing = await embeddingStore.get(shape.id)
        if (existing && existing.text === text) {
          continue // Skip re-indexing
        }

        const embedding = await generateEmbedding(text)

        if (embedding.length > 0) {
          await embeddingStore.save({
            shapeId: shape.id,
            embedding,
            text,
            shapeType: shape.type,
            timestamp: Date.now(),
          })
        }

        this.indexingProgress = ((i + 1) / shapesWithText.length) * 100
        onProgress?.(this.indexingProgress)
      }

    } finally {
      this.isIndexing = false
    }
  }

  /**
   * Semantic search for shapes matching a query
   */
  async search(query: string, topK: number = 10, threshold: number = 0.3): Promise<SemanticSearchResult[]> {
    if (!this.editor) return []

    const queryEmbedding = await generateEmbedding(query)
    if (queryEmbedding.length === 0) return []

    const allEmbeddings = await embeddingStore.getAll()
    const currentShapes = new Map(
      this.editor.getCurrentPageShapes().map(s => [s.id, s])
    )

    // Calculate similarities
    const results: SemanticSearchResult[] = []

    for (const stored of allEmbeddings) {
      const shape = currentShapes.get(stored.shapeId)
      if (!shape) continue // Shape no longer exists

      const similarity = cosineSimilarity(queryEmbedding, stored.embedding)

      if (similarity >= threshold) {
        results.push({
          shapeId: stored.shapeId,
          shape,
          similarity,
          matchedText: stored.text,
        })
      }
    }

    // Sort by similarity (descending) and return top K
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  /**
   * Get aggregated context of all canvas content for AI queries
   */
  async getCanvasContext(): Promise<CanvasContext> {
    if (!this.editor) {
      return {
        totalShapes: 0,
        shapeTypes: {},
        textContent: [],
        summary: 'No editor connected',
      }
    }

    const shapes = this.editor.getCurrentPageShapes()
    const shapeTypes: Record<string, number> = {}
    const textContent: string[] = []

    for (const shape of shapes) {
      // Count shape types
      shapeTypes[shape.type] = (shapeTypes[shape.type] || 0) + 1

      // Extract text content
      const text = extractShapeText(shape)
      if (text.length > 10) {
        textContent.push(text)
      }
    }

    // Build summary
    const typesSummary = Object.entries(shapeTypes)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ')

    const summary = `Canvas contains ${shapes.length} shapes: ${typesSummary}. ${textContent.length} shapes have text content.`

    return {
      totalShapes: shapes.length,
      shapeTypes,
      textContent,
      summary,
    }
  }

  /**
   * Get shapes visible in the current viewport
   */
  getVisibleShapesContext(): { shapes: TLShape[]; descriptions: string[] } {
    if (!this.editor) return { shapes: [], descriptions: [] }

    const viewportBounds = this.editor.getViewportPageBounds()
    const allShapes = this.editor.getCurrentPageShapes()

    const visibleShapes = allShapes.filter(shape => {
      const bounds = this.editor!.getShapePageBounds(shape.id)
      if (!bounds) return false

      // Check if shape intersects viewport
      return !(
        bounds.maxX < viewportBounds.minX ||
        bounds.minX > viewportBounds.maxX ||
        bounds.maxY < viewportBounds.minY ||
        bounds.minY > viewportBounds.maxY
      )
    })

    const descriptions = visibleShapes.map(shape => {
      const text = extractShapeText(shape)
      const bounds = this.editor!.getShapePageBounds(shape.id)
      const position = bounds ? `at (${Math.round(bounds.x)}, ${Math.round(bounds.y)})` : ''
      return `[${shape.type}] ${position}: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`
    })

    return { shapes: visibleShapes, descriptions }
  }

  /**
   * Build a comprehensive context string for AI queries about the canvas
   */
  async buildAIContext(query?: string): Promise<string> {
    const canvasContext = await this.getCanvasContext()
    const visibleContext = this.getVisibleShapesContext()

    let context = `# Canvas Overview\n${canvasContext.summary}\n\n`

    context += `## Currently Visible (${visibleContext.shapes.length} shapes):\n`
    visibleContext.descriptions.forEach((desc, i) => {
      context += `${i + 1}. ${desc}\n`
    })

    // If there's a query, add semantic search results
    if (query) {
      const searchResults = await this.search(query, 5, 0.2)
      if (searchResults.length > 0) {
        context += `\n## Most Relevant to Query "${query}":\n`
        searchResults.forEach((result, i) => {
          context += `${i + 1}. [${result.shape.type}] (${Math.round(result.similarity * 100)}% match): ${result.matchedText.slice(0, 300)}\n`
        })
      }
    }

    // Add all text content (truncated)
    const allText = canvasContext.textContent.join('\n---\n')
    if (allText.length > 0) {
      context += `\n## All Text Content:\n${allText.slice(0, 5000)}${allText.length > 5000 ? '\n...(truncated)' : ''}`
    }

    return context
  }

  /**
   * Clean up embeddings for shapes that no longer exist
   */
  async cleanupStaleEmbeddings(): Promise<number> {
    if (!this.editor) return 0

    const currentShapeIds = new Set(
      this.editor.getCurrentPageShapes().map(s => s.id)
    )

    const allEmbeddings = await embeddingStore.getAll()
    let removed = 0

    for (const embedding of allEmbeddings) {
      if (!currentShapeIds.has(embedding.shapeId)) {
        await embeddingStore.delete(embedding.shapeId)
        removed++
      }
    }

    if (removed > 0) {
    }

    return removed
  }

  /**
   * Clear all stored embeddings
   */
  async clearIndex(): Promise<void> {
    await embeddingStore.clear()
  }

  /**
   * Get indexing status
   */
  getIndexingStatus(): { isIndexing: boolean; progress: number } {
    return {
      isIndexing: this.isIndexing,
      progress: this.indexingProgress,
    }
  }
}

// Singleton instance
export const semanticSearch = new SemanticSearchService()
