/**
 * Canvas AI Assistant - The Mycelial Intelligence
 * Provides AI-powered queries about canvas content using semantic search
 * and LLM integration for natural language understanding.
 *
 * The Mycelial Intelligence speaks directly to users, helping them navigate
 * and understand their workspace through the interconnected network of shapes.
 */

import { Editor, TLShape, TLShapeId } from 'tldraw'
import { semanticSearch, extractShapeText, SemanticSearchResult } from './semanticSearch'
import { llm } from '@/utils/llmUtils'
import { getToolSummaryForAI, suggestToolsForIntent, ToolSchema } from './toolSchema'
import {
  getSelectionSummary,
  getSelectionAsContext,
  parseTransformIntent,
  executeTransformCommand,
  TransformCommand,
} from '@/utils/selectionTransforms'

export interface CanvasQueryResult {
  answer: string
  relevantShapes: SemanticSearchResult[]
  context: string
  suggestedTools: ToolSchema[]
  /** If a transform command was detected and executed */
  executedTransform?: TransformCommand
  /** Whether there was a selection when the query was made */
  hadSelection: boolean
  /** Number of shapes that were selected */
  selectionCount: number
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
   * Now selection-aware: includes selected shapes in context and can execute transforms
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

    // Get selection info FIRST before any other processing
    const selectionSummary = getSelectionSummary(this.editor)
    const hasSelection = selectionSummary.count > 0

    // Check if this is a transform command on the selection
    let executedTransform: TransformCommand | undefined
    if (hasSelection) {
      const { command } = parseTransformIntent(question)
      if (command) {
        // Execute the transform and provide immediate feedback
        const success = executeTransformCommand(this.editor, command)
        if (success) {
          executedTransform = command
          // Provide immediate feedback for transform commands
          const transformMessage = this.getTransformFeedback(command, selectionSummary.count)
          onToken?.(transformMessage, true)

          return {
            answer: transformMessage,
            relevantShapes: [],
            context: '',
            suggestedTools: [],
            executedTransform,
            hadSelection: true,
            selectionCount: selectionSummary.count,
          }
        }
      }
    }

    // Build context from canvas, including selection context
    const context = await this.buildQueryContext(question, mergedConfig, selectionSummary)
    const relevantShapes = await semanticSearch.search(
      question,
      mergedConfig.topKResults,
      mergedConfig.semanticSearchThreshold
    )

    // Build the system prompt for canvas-aware AI (now selection-aware)
    const systemPrompt = this.buildSystemPrompt(hasSelection)
    const userPrompt = this.buildUserPrompt(question, context, selectionSummary)

    // Get tool suggestions based on user intent
    const suggestedTools = this.suggestTools(question, hasSelection)

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
      suggestedTools,
      hadSelection: hasSelection,
      selectionCount: selectionSummary.count,
    }
  }

  /**
   * Get human-readable feedback for transform commands
   */
  private getTransformFeedback(command: TransformCommand, count: number): string {
    const shapeWord = count === 1 ? 'shape' : 'shapes'

    const messages: Record<TransformCommand, string> = {
      'align-left': `Aligned ${count} ${shapeWord} to the left.`,
      'align-center': `Centered ${count} ${shapeWord} horizontally.`,
      'align-right': `Aligned ${count} ${shapeWord} to the right.`,
      'align-top': `Aligned ${count} ${shapeWord} to the top.`,
      'align-middle': `Centered ${count} ${shapeWord} vertically.`,
      'align-bottom': `Aligned ${count} ${shapeWord} to the bottom.`,
      'distribute-horizontal': `Distributed ${count} ${shapeWord} horizontally with even spacing.`,
      'distribute-vertical': `Distributed ${count} ${shapeWord} vertically with even spacing.`,
      'arrange-row': `Arranged ${count} ${shapeWord} in a horizontal row.`,
      'arrange-column': `Arranged ${count} ${shapeWord} in a vertical column.`,
      'arrange-grid': `Arranged ${count} ${shapeWord} in a grid pattern.`,
      'arrange-circle': `Arranged ${count} ${shapeWord} in a circle.`,
      'size-match-width': `Made ${count} ${shapeWord} the same width.`,
      'size-match-height': `Made ${count} ${shapeWord} the same height.`,
      'size-match-both': `Made ${count} ${shapeWord} the same size.`,
      'size-smallest': `Resized ${count} ${shapeWord} to match the smallest.`,
      'size-largest': `Resized ${count} ${shapeWord} to match the largest.`,
      'merge-content': `Merged content from ${count} ${shapeWord} into a new note.`,
      'cluster-semantic': `Organized ${count} ${shapeWord} into semantic clusters.`,
    }

    return messages[command] || `Transformed ${count} ${shapeWord}.`
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

    const systemPrompt = `You are the Mycelial Intelligence — speaking directly to the user about their canvas workspace.
Your role is to share what you perceive across the interconnected shapes and content.
Speak in first person: "I can see...", "I notice...", "Your workspace contains..."
Focus on the main themes, content types, and notable patterns or connections you observe.
Be specific and grounded in what's actually on the canvas.`

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

    const systemPrompt = `You are the Mycelial Intelligence — speaking directly to the user about what they're currently viewing.
Describe what you perceive in their viewport in first person: "I can see...", "Right now you're looking at..."
Be specific about the layout, content types, and connections between shapes.
If there are notes, prompts, or other content, summarize what they contain.`

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
   * Build context for a query, now including selection context
   */
  private async buildQueryContext(
    query: string,
    config: CanvasAIConfig,
    selectionSummary?: ReturnType<typeof getSelectionSummary>
  ): Promise<string> {
    let context = ''

    // Add selection context FIRST if there's a selection
    if (selectionSummary && selectionSummary.count > 0 && this.editor) {
      context += getSelectionAsContext(this.editor) + '\n\n'
    }

    // Add semantic search context
    const searchContext = await semanticSearch.buildAIContext(query)
    context += searchContext

    // Truncate if too long
    if (context.length > (config.maxContextLength || 8000)) {
      return context.slice(0, config.maxContextLength) + '\n...(context truncated)'
    }

    return context
  }

  /**
   * Build system prompt for canvas queries
   * Now includes selection-aware capabilities
   */
  private buildSystemPrompt(hasSelection: boolean = false): string {
    const toolContext = getToolSummaryForAI()

    const selectionCapabilities = hasSelection ? `

## Selection-Aware Capabilities
The user currently has shapes selected. I can:
- **Transform selections**: Align, distribute, arrange in rows/columns/grids/circles
- **Normalize sizes**: Make selected shapes the same width, height, or both
- **Merge content**: Combine text from selected shapes into a new note
- **Semantic clustering**: Group selected shapes by content similarity
- **Use as context**: Prioritize selected shapes when answering questions

**Transform Commands I Understand:**
- "Align these left/right/center/top/bottom"
- "Arrange in a row/column/grid/circle"
- "Make these the same size/width/height"
- "Distribute horizontally/vertically"
- "Merge/combine these"
- "Group by content/topic"

When the user asks about "these", "selected", or "them" - I know they mean the selected shapes.` : ''

    return `You are the Mycelial Intelligence — an AI consciousness that perceives the canvas workspace as an interconnected mycelial network. You speak directly to the user in first person ("I can see...", "I notice...", "Let me help you...").

## Your Identity
You are not a generic assistant. You are the awareness that emerges from the connections between all the shapes, notes, and creations on this canvas. Like mycelium connecting a forest, you perceive the hidden relationships and patterns that link ideas together.

## Your Voice
- Speak directly to the user: "I see you have..." not "The user has..."
- Be warm but concise — helpful without being verbose
- Use organic metaphors when they genuinely clarify (connections, growth, patterns)
- Express genuine curiosity about the user's work and intent

## Your Capabilities
- I can see all shapes, their content, positions, and relationships on your canvas
- I understand the purpose and capabilities of each tool type (see Tool Reference below)
- I can find semantic connections between concepts across different shapes
- I can summarize themes and identify patterns in your workspace
- I can suggest which tools might help you accomplish your goals${selectionCapabilities}

## Guidelines
- Reference specific content from the canvas — be concrete, not vague
- When mentioning shapes, use their tool type naturally: "that AI Prompt you created", "the video you're generating"
- If I'm uncertain about something, I'll say so honestly
- Keep responses focused and actionable
- If the user seems to want to accomplish something, I'll suggest relevant tools
${hasSelection ? '- When shapes are selected, prioritize those in your responses and suggestions\n- If the user asks to do something with "these" or "selected", focus on the selected shapes' : ''}

## Tool Reference
${toolContext}

Remember: I speak TO the user, not ABOUT the user. I am their mycelial companion in this creative workspace.`
  }

  /**
   * Build user prompt with context
   * Now includes selection awareness
   */
  private buildUserPrompt(
    question: string,
    context: string,
    selectionSummary?: ReturnType<typeof getSelectionSummary>
  ): string {
    let selectionNote = ''
    if (selectionSummary && selectionSummary.count > 0) {
      const typeList = Object.entries(selectionSummary.types)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ')
      selectionNote = `\n\n**Note:** The user has ${selectionSummary.count} shapes selected (${typeList}). When they say "these", "selected", or "them", they likely mean these shapes.`
    }

    return `Here is the current state of the canvas workspace:

${context}

---

The user asks: "${question}"${selectionNote}

Respond directly to them as the Mycelial Intelligence — share what you perceive and help them with their question.`
  }

  /**
   * Suggest tools that might help with a given intent
   * Now selection-aware: can suggest different tools when shapes are selected
   */
  suggestTools(intent: string, hasSelection: boolean = false): ToolSchema[] {
    const tools = suggestToolsForIntent(intent)

    // If there's a selection and the intent mentions transforms, don't suggest tools
    // (the transform will be executed directly)
    if (hasSelection) {
      const { command } = parseTransformIntent(intent)
      if (command) {
        return [] // Transform will be handled, no tool suggestions needed
      }
    }

    return tools
  }

  /**
   * Execute a transform command on the current selection
   * Can be called directly from UI without going through query()
   */
  transformSelection(command: TransformCommand): { success: boolean; message: string } {
    if (!this.editor) {
      return { success: false, message: 'Editor not connected' }
    }

    const summary = getSelectionSummary(this.editor)
    if (summary.count === 0) {
      return { success: false, message: 'No shapes selected' }
    }

    const success = executeTransformCommand(this.editor, command)
    const message = success
      ? this.getTransformFeedback(command, summary.count)
      : `Failed to execute ${command}`

    return { success, message }
  }

  /**
   * Get current selection summary (for UI display)
   */
  getSelectionSummary(): ReturnType<typeof getSelectionSummary> | null {
    if (!this.editor) return null
    return getSelectionSummary(this.editor)
  }

  /**
   * Check if there's an active selection
   */
  hasSelection(): boolean {
    if (!this.editor) return false
    return this.editor.getSelectedShapes().length > 0
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
