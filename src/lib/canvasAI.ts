/**
 * Canvas AI Assistant
 * Provides AI-powered queries about canvas content using semantic search
 * and LLM integration for natural language understanding
 */

import { Editor, TLShape, TLShapeId } from 'tldraw'
import { semanticSearch, extractShapeText, SemanticSearchResult } from './semanticSearch'
import { llm } from '@/utils/llmUtils'

export interface CanvasQueryResult {
  answer: string
  relevantShapes: SemanticSearchResult[]
  context: string
}

export interface CanvasAIConfig {
  maxContextLength?: number
  semanticSearchThreshold?: number
  topKResults?: number
  includeVisibleContext?: boolean
  streamResponse?: boolean
}

const DEFAULT_CONFIG: CanvasAIConfig = {
  maxContextLength: 8000,
  semanticSearchThreshold: 0.25,
  topKResults: 10,
  includeVisibleContext: true,
  streamResponse: true,
}

/**
 * Canvas AI Service - provides intelligent canvas queries
 */
export class CanvasAI {
  private editor: Editor | null = null
  private config: CanvasAIConfig

  constructor(config: Partial<CanvasAIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  setEditor(editor: Editor): void {
    this.editor = editor
    semanticSearch.setEditor(editor)
  }

  /**
   * Index the canvas for semantic search
   */
  async indexCanvas(onProgress?: (progress: number) => void): Promise<void> {
    await semanticSearch.indexCanvas(onProgress)
  }

  /**
   * Query the canvas with natural language
   */
  async query(
    question: string,
    onToken?: (partial: string, done?: boolean) => void,
    config?: Partial<CanvasAIConfig>
  ): Promise<CanvasQueryResult> {
    const mergedConfig = { ...this.config, ...config }

    if (!this.editor) {
      throw new Error('Editor not connected. Call setEditor() first.')
    }

    // Build context from canvas
    const context = await this.buildQueryContext(question, mergedConfig)
    const relevantShapes = await semanticSearch.search(
      question,
      mergedConfig.topKResults,
      mergedConfig.semanticSearchThreshold
    )

    // Build the system prompt for canvas-aware AI
    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt(question, context)

    let answer = ''

    // Use LLM to generate response
    if (onToken && mergedConfig.streamResponse) {
      await llm(
        userPrompt,
        (partial, done) => {
          answer = partial
          onToken(partial, done)
        },
        systemPrompt
      )
    } else {
      // Non-streaming fallback
      await llm(
        userPrompt,
        (partial, done) => {
          if (done) answer = partial
        },
        systemPrompt
      )
    }

    return {
      answer,
      relevantShapes,
      context,
    }
  }

  /**
   * Get a summary of the current canvas state
   */
  async summarize(
    onToken?: (partial: string, done?: boolean) => void
  ): Promise<string> {
    if (!this.editor) {
      throw new Error('Editor not connected. Call setEditor() first.')
    }

    const canvasContext = await semanticSearch.getCanvasContext()
    const visibleContext = semanticSearch.getVisibleShapesContext()

    const systemPrompt = `You are an AI assistant analyzing a collaborative canvas workspace.
Your role is to provide clear, concise summaries of what's on the canvas.
Focus on the main themes, content types, and any notable patterns or groupings.
Be specific about what you observe but keep the summary digestible.`

    const userPrompt = `Please summarize what's on this canvas:

## Canvas Overview
${canvasContext.summary}

## Shape Types Present
${Object.entries(canvasContext.shapeTypes)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

## Currently Visible (${visibleContext.shapes.length} shapes)
${visibleContext.descriptions.slice(0, 20).join('\n')}

## Sample Content
${canvasContext.textContent.slice(0, 10).map((t, i) => `${i + 1}. ${t.slice(0, 300)}...`).join('\n\n')}

Provide a concise summary (2-3 paragraphs) of the main content and themes on this canvas.`

    let summary = ''

    await llm(
      userPrompt,
      (partial, done) => {
        summary = partial
        onToken?.(partial, done)
      },
      systemPrompt
    )

    return summary
  }

  /**
   * Find shapes related to a concept/topic
   */
  async findRelated(
    concept: string,
    topK: number = 5
  ): Promise<SemanticSearchResult[]> {
    return semanticSearch.search(concept, topK, this.config.semanticSearchThreshold)
  }

  /**
   * Navigate to shapes matching a query
   */
  async navigateToQuery(query: string): Promise<TLShape[]> {
    if (!this.editor) return []

    const results = await semanticSearch.search(query, 5, 0.3)

    if (results.length === 0) return []

    // Select the matching shapes
    const shapeIds = results.map(r => r.shapeId)
    this.editor.setSelectedShapes(shapeIds)

    // Zoom to show all matching shapes
    const bounds = this.editor.getSelectionPageBounds()
    if (bounds) {
      this.editor.zoomToBounds(bounds, {
        targetZoom: Math.min(
          (this.editor.getViewportPageBounds().width * 0.8) / bounds.width,
          (this.editor.getViewportPageBounds().height * 0.8) / bounds.height,
          1
        ),
        inset: 50,
        animation: { duration: 400, easing: (t) => t * (2 - t) },
      })
    }

    return results.map(r => r.shape)
  }

  /**
   * Get shapes that are contextually similar to the selected shapes
   */
  async getSimilarToSelected(topK: number = 5): Promise<SemanticSearchResult[]> {
    if (!this.editor) return []

    const selected = this.editor.getSelectedShapes()
    if (selected.length === 0) return []

    // Combine text from all selected shapes
    const combinedText = selected
      .map(s => extractShapeText(s))
      .filter(t => t.length > 0)
      .join(' ')

    if (combinedText.length === 0) return []

    // Search for similar shapes, excluding the selected ones
    const results = await semanticSearch.search(combinedText, topK + selected.length, 0.2)

    // Filter out the selected shapes
    const selectedIds = new Set(selected.map(s => s.id))
    return results.filter(r => !selectedIds.has(r.shapeId)).slice(0, topK)
  }

  /**
   * Explain what's in the current viewport
   */
  async explainViewport(
    onToken?: (partial: string, done?: boolean) => void
  ): Promise<string> {
    if (!this.editor) {
      throw new Error('Editor not connected. Call setEditor() first.')
    }

    const visibleContext = semanticSearch.getVisibleShapesContext()

    if (visibleContext.shapes.length === 0) {
      const msg = 'The current viewport is empty. Pan or zoom to see shapes.'
      onToken?.(msg, true)
      return msg
    }

    const systemPrompt = `You are an AI assistant describing what's visible in a collaborative canvas viewport.
Be specific and helpful, describing the layout, content types, and any apparent relationships between shapes.
If there are notes, prompts, or text content, summarize the key points.`

    const userPrompt = `Describe what's currently visible in this canvas viewport:

## Visible Shapes (${visibleContext.shapes.length})
${visibleContext.descriptions.join('\n')}

Provide a clear description of what the user is looking at, including:
1. The types of content visible
2. Any apparent groupings or relationships
3. Key text content or themes`

    let explanation = ''

    await llm(
      userPrompt,
      (partial, done) => {
        explanation = partial
        onToken?.(partial, done)
      },
      systemPrompt
    )

    return explanation
  }

  /**
   * Build context for a query
   */
  private async buildQueryContext(
    query: string,
    config: CanvasAIConfig
  ): Promise<string> {
    const context = await semanticSearch.buildAIContext(query)

    // Truncate if too long
    if (context.length > (config.maxContextLength || 8000)) {
      return context.slice(0, config.maxContextLength) + '\n...(context truncated)'
    }

    return context
  }

  /**
   * Build system prompt for canvas queries
   */
  private buildSystemPrompt(): string {
    return `You are an intelligent AI assistant with full awareness of a collaborative canvas workspace.
You have access to all shapes, their content, positions, and relationships on the canvas.

Your capabilities:
- Answer questions about what's on the canvas
- Summarize content and themes
- Find connections between different pieces of content
- Help users navigate and understand their workspace
- Identify patterns and groupings

Guidelines:
- Be specific and reference actual content from the canvas
- If you're not sure about something, say so
- When mentioning shapes, indicate their type (e.g., [Prompt], [ObsNote], [Markdown])
- Keep responses concise but informative
- Focus on being helpful and accurate`
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(question: string, context: string): string {
    return `Based on the following canvas context, please answer the user's question.

${context}

---

User Question: ${question}

Please provide a helpful, accurate response based on the canvas content above.`
  }

  /**
   * Get indexing status
   */
  getIndexingStatus(): { isIndexing: boolean; progress: number } {
    return semanticSearch.getIndexingStatus()
  }

  /**
   * Clear the semantic search index
   */
  async clearIndex(): Promise<void> {
    await semanticSearch.clearIndex()
  }

  /**
   * Clean up stale embeddings
   */
  async cleanup(): Promise<number> {
    return semanticSearch.cleanupStaleEmbeddings()
  }
}

// Singleton instance
export const canvasAI = new CanvasAI()

/**
 * React hook for canvas AI (convenience export)
 */
export function useCanvasAI(editor: Editor | null) {
  if (editor) {
    canvasAI.setEditor(editor)
  }
  return canvasAI
}
