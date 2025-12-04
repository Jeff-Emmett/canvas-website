/**
 * Selection Transforms Utility
 * Provides batch operations on selected shapes for the Mycelial Intelligence
 *
 * Capabilities:
 * - Alignment (horizontal, vertical, distribute)
 * - Size normalization
 * - Grid/row arrangement
 * - Semantic clustering (AI-powered grouping)
 * - Content aggregation and transformation
 */

import { Editor, TLShape, TLShapeId, Box, createShapeId } from 'tldraw'
import { extractShapeText } from '@/lib/semanticSearch'

/**
 * Information about a selected shape for transformations
 */
export interface SelectionInfo {
  id: TLShapeId
  shape: TLShape
  bounds: Box
  text: string
  type: string
}

/**
 * Get detailed info about currently selected shapes
 */
export function getSelectionInfo(editor: Editor): SelectionInfo[] {
  const selectedShapes = editor.getSelectedShapes()

  return selectedShapes.map(shape => {
    const bounds = editor.getShapePageBounds(shape.id)
    return {
      id: shape.id,
      shape,
      bounds: bounds || new Box(shape.x, shape.y, 100, 100),
      text: extractShapeText(shape),
      type: shape.type,
    }
  }).filter(info => info.bounds !== null)
}

/**
 * Get a summary of the current selection for AI context
 */
export function getSelectionSummary(editor: Editor): {
  count: number
  types: Record<string, number>
  totalText: string
  textPreviews: string[]
  bounds: Box | null
  hasContent: boolean
} {
  const infos = getSelectionInfo(editor)

  if (infos.length === 0) {
    return {
      count: 0,
      types: {},
      totalText: '',
      textPreviews: [],
      bounds: null,
      hasContent: false,
    }
  }

  // Count shape types
  const types: Record<string, number> = {}
  for (const info of infos) {
    types[info.type] = (types[info.type] || 0) + 1
  }

  // Collect text content
  const texts = infos.map(i => i.text).filter(t => t.length > 0)
  const totalText = texts.join('\n\n')
  const textPreviews = texts.map(t => t.slice(0, 200) + (t.length > 200 ? '...' : ''))

  // Calculate combined bounds
  const bounds = editor.getSelectionPageBounds()

  return {
    count: infos.length,
    types,
    totalText,
    textPreviews,
    bounds,
    hasContent: totalText.length > 0,
  }
}

// =============================================================================
// ALIGNMENT OPERATIONS
// =============================================================================

export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/**
 * Align selected shapes
 */
export function alignSelection(editor: Editor, alignment: AlignmentType): void {
  const infos = getSelectionInfo(editor)
  if (infos.length < 2) return

  const bounds = editor.getSelectionPageBounds()
  if (!bounds) return

  const updates: { id: TLShapeId; x?: number; y?: number }[] = []

  for (const info of infos) {
    let newX = info.bounds.x
    let newY = info.bounds.y

    switch (alignment) {
      case 'left':
        newX = bounds.x
        break
      case 'center':
        newX = bounds.x + (bounds.w - info.bounds.w) / 2
        break
      case 'right':
        newX = bounds.x + bounds.w - info.bounds.w
        break
      case 'top':
        newY = bounds.y
        break
      case 'middle':
        newY = bounds.y + (bounds.h - info.bounds.h) / 2
        break
      case 'bottom':
        newY = bounds.y + bounds.h - info.bounds.h
        break
    }

    if (newX !== info.bounds.x || newY !== info.bounds.y) {
      updates.push({
        id: info.id,
        x: newX,
        y: newY,
      })
    }
  }

  // Batch update
  for (const update of updates) {
    editor.updateShape({
      id: update.id,
      type: editor.getShape(update.id)!.type,
      x: update.x,
      y: update.y,
    })
  }
}

/**
 * Distribute shapes evenly (horizontal or vertical)
 */
export function distributeSelection(
  editor: Editor,
  direction: 'horizontal' | 'vertical',
  gap?: number
): void {
  const infos = getSelectionInfo(editor)
  if (infos.length < 3) return

  // Sort by position
  const sorted = [...infos].sort((a, b) =>
    direction === 'horizontal'
      ? a.bounds.x - b.bounds.x
      : a.bounds.y - b.bounds.y
  )

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (direction === 'horizontal') {
    const totalWidth = sorted.reduce((sum, info) => sum + info.bounds.w, 0)
    const availableSpace = (last.bounds.x + last.bounds.w) - first.bounds.x - totalWidth
    const spacing = gap ?? availableSpace / (sorted.length - 1)

    let currentX = first.bounds.x
    for (const info of sorted) {
      editor.updateShape({
        id: info.id,
        type: info.shape.type,
        x: currentX,
      })
      currentX += info.bounds.w + spacing
    }
  } else {
    const totalHeight = sorted.reduce((sum, info) => sum + info.bounds.h, 0)
    const availableSpace = (last.bounds.y + last.bounds.h) - first.bounds.y - totalHeight
    const spacing = gap ?? availableSpace / (sorted.length - 1)

    let currentY = first.bounds.y
    for (const info of sorted) {
      editor.updateShape({
        id: info.id,
        type: info.shape.type,
        y: currentY,
      })
      currentY += info.bounds.h + spacing
    }
  }
}

// =============================================================================
// SIZE NORMALIZATION
// =============================================================================

export type SizeMode = 'width' | 'height' | 'both' | 'smallest' | 'largest' | 'average'

/**
 * Normalize sizes of selected shapes
 */
export function normalizeSelectionSize(
  editor: Editor,
  mode: SizeMode,
  targetSize?: { w?: number; h?: number }
): void {
  const infos = getSelectionInfo(editor)
  if (infos.length < 2) return

  let targetW: number
  let targetH: number

  if (targetSize) {
    targetW = targetSize.w ?? infos[0].bounds.w
    targetH = targetSize.h ?? infos[0].bounds.h
  } else {
    const widths = infos.map(i => i.bounds.w)
    const heights = infos.map(i => i.bounds.h)

    switch (mode) {
      case 'smallest':
        targetW = Math.min(...widths)
        targetH = Math.min(...heights)
        break
      case 'largest':
        targetW = Math.max(...widths)
        targetH = Math.max(...heights)
        break
      case 'average':
      default:
        targetW = widths.reduce((a, b) => a + b, 0) / widths.length
        targetH = heights.reduce((a, b) => a + b, 0) / heights.length
        break
    }
  }

  for (const info of infos) {
    const props: Record<string, number> = {}

    // Determine which dimensions to update based on mode
    const updateWidth = mode === 'width' || mode === 'both' || mode === 'smallest' || mode === 'largest' || mode === 'average'
    const updateHeight = mode === 'height' || mode === 'both' || mode === 'smallest' || mode === 'largest' || mode === 'average'

    if (updateWidth) props.w = targetW
    if (updateHeight) props.h = targetH

    if (Object.keys(props).length > 0) {
      editor.updateShape({
        id: info.id,
        type: info.shape.type,
        props,
      })
    }
  }
}

// =============================================================================
// ARRANGEMENT OPERATIONS
// =============================================================================

export type ArrangementType = 'row' | 'column' | 'grid' | 'circle' | 'stack'

/**
 * Arrange selected shapes in a pattern
 */
export function arrangeSelection(
  editor: Editor,
  arrangement: ArrangementType,
  options: {
    gap?: number
    columns?: number
    centerAt?: { x: number; y: number }
  } = {}
): void {
  const infos = getSelectionInfo(editor)
  if (infos.length < 2) return

  const gap = options.gap ?? 20
  const bounds = editor.getSelectionPageBounds()
  if (!bounds) return

  const centerX = options.centerAt?.x ?? (bounds.x + bounds.w / 2)
  const centerY = options.centerAt?.y ?? (bounds.y + bounds.h / 2)

  switch (arrangement) {
    case 'row': {
      // Sort by current x position to maintain relative order
      const sorted = [...infos].sort((a, b) => a.bounds.x - b.bounds.x)
      const totalWidth = sorted.reduce((sum, info) => sum + info.bounds.w, 0) + gap * (sorted.length - 1)
      let currentX = centerX - totalWidth / 2

      // Find the average y position
      const avgY = sorted.reduce((sum, info) => sum + info.bounds.y + info.bounds.h / 2, 0) / sorted.length

      for (const info of sorted) {
        editor.updateShape({
          id: info.id,
          type: info.shape.type,
          x: currentX,
          y: avgY - info.bounds.h / 2,
        })
        currentX += info.bounds.w + gap
      }
      break
    }

    case 'column': {
      // Sort by current y position to maintain relative order
      const sorted = [...infos].sort((a, b) => a.bounds.y - b.bounds.y)
      const totalHeight = sorted.reduce((sum, info) => sum + info.bounds.h, 0) + gap * (sorted.length - 1)
      let currentY = centerY - totalHeight / 2

      // Find the average x position
      const avgX = sorted.reduce((sum, info) => sum + info.bounds.x + info.bounds.w / 2, 0) / sorted.length

      for (const info of sorted) {
        editor.updateShape({
          id: info.id,
          type: info.shape.type,
          x: avgX - info.bounds.w / 2,
          y: currentY,
        })
        currentY += info.bounds.h + gap
      }
      break
    }

    case 'grid': {
      const columns = options.columns ?? Math.ceil(Math.sqrt(infos.length))
      const rows = Math.ceil(infos.length / columns)

      // Calculate max dimensions for uniform spacing
      const maxW = Math.max(...infos.map(i => i.bounds.w))
      const maxH = Math.max(...infos.map(i => i.bounds.h))

      const gridW = columns * maxW + (columns - 1) * gap
      const gridH = rows * maxH + (rows - 1) * gap

      const startX = centerX - gridW / 2
      const startY = centerY - gridH / 2

      infos.forEach((info, i) => {
        const col = i % columns
        const row = Math.floor(i / columns)

        // Center each shape in its grid cell
        const cellX = startX + col * (maxW + gap)
        const cellY = startY + row * (maxH + gap)

        editor.updateShape({
          id: info.id,
          type: info.shape.type,
          x: cellX + (maxW - info.bounds.w) / 2,
          y: cellY + (maxH - info.bounds.h) / 2,
        })
      })
      break
    }

    case 'circle': {
      const radius = Math.max(200, infos.length * 50)

      infos.forEach((info, i) => {
        const angle = (i / infos.length) * 2 * Math.PI - Math.PI / 2 // Start from top
        const x = centerX + radius * Math.cos(angle) - info.bounds.w / 2
        const y = centerY + radius * Math.sin(angle) - info.bounds.h / 2

        editor.updateShape({
          id: info.id,
          type: info.shape.type,
          x,
          y,
        })
      })
      break
    }

    case 'stack': {
      // Stack shapes with slight offset (like a deck of cards)
      const offsetX = 20
      const offsetY = 20

      infos.forEach((info, i) => {
        editor.updateShape({
          id: info.id,
          type: info.shape.type,
          x: centerX - info.bounds.w / 2 + i * offsetX,
          y: centerY - info.bounds.h / 2 + i * offsetY,
        })
      })
      break
    }
  }
}

// =============================================================================
// CONTENT OPERATIONS
// =============================================================================

/**
 * Merge text content from selected shapes into a new markdown shape
 */
export function mergeSelectionContent(
  editor: Editor,
  options: {
    format?: 'list' | 'paragraphs' | 'numbered' | 'combined'
    createNew?: boolean
    position?: { x: number; y: number }
  } = {}
): string {
  const infos = getSelectionInfo(editor)
  const texts = infos.map(i => i.text).filter(t => t.length > 0)

  if (texts.length === 0) return ''

  let mergedContent: string

  switch (options.format) {
    case 'list':
      mergedContent = texts.map(t => `- ${t}`).join('\n')
      break
    case 'numbered':
      mergedContent = texts.map((t, i) => `${i + 1}. ${t}`).join('\n')
      break
    case 'paragraphs':
      mergedContent = texts.join('\n\n')
      break
    case 'combined':
    default:
      mergedContent = texts.join(' ')
      break
  }

  // Optionally create a new Markdown shape with the merged content
  if (options.createNew) {
    const bounds = editor.getSelectionPageBounds()
    const position = options.position ?? {
      x: bounds ? bounds.x + bounds.w + 50 : 0,
      y: bounds ? bounds.y : 0,
    }

    editor.createShape({
      id: createShapeId(),
      type: 'Markdown',
      x: position.x,
      y: position.y,
      props: {
        w: 400,
        h: 300,
        content: mergedContent,
      },
    })
  }

  return mergedContent
}

/**
 * Extract and combine text from selection for use as AI context
 */
export function getSelectionAsContext(editor: Editor): string {
  const summary = getSelectionSummary(editor)

  if (summary.count === 0) {
    return ''
  }

  const typeDesc = Object.entries(summary.types)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ')

  let context = `## Currently Selected (${summary.count} shapes: ${typeDesc})\n\n`

  if (summary.hasContent) {
    context += `### Content from selected shapes:\n`
    for (const preview of summary.textPreviews) {
      context += `- ${preview}\n`
    }
  }

  return context
}

// =============================================================================
// SEMANTIC CLUSTERING (requires AI integration)
// =============================================================================

export interface ClusterGroup {
  label: string
  shapes: SelectionInfo[]
  suggestedPosition?: { x: number; y: number }
}

/**
 * Group shapes by semantic similarity
 * Returns groups with suggested labels and positions
 *
 * This is a placeholder - actual implementation would use embeddings
 * from semanticSearch to cluster shapes by content similarity
 */
export function clusterByContent(
  editor: Editor,
  _numClusters?: number
): ClusterGroup[] {
  const infos = getSelectionInfo(editor)

  if (infos.length < 3) {
    return [{ label: 'All', shapes: infos }]
  }

  // Simple heuristic clustering by shape type for now
  // Real implementation would use semantic embeddings
  const byType = new Map<string, SelectionInfo[]>()

  for (const info of infos) {
    const list = byType.get(info.type) || []
    list.push(info)
    byType.set(info.type, list)
  }

  const clusters: ClusterGroup[] = []
  let clusterIndex = 0

  for (const [type, shapes] of byType) {
    clusters.push({
      label: `${type} group`,
      shapes,
      suggestedPosition: {
        x: clusterIndex * 500,
        y: 0,
      },
    })
    clusterIndex++
  }

  return clusters
}

/**
 * Arrange shapes into semantic clusters
 */
export function arrangeIntoClusters(
  editor: Editor,
  clusters: ClusterGroup[],
  options: {
    gap?: number
    clusterGap?: number
    arrangement?: 'row' | 'column' | 'grid'
  } = {}
): void {
  const gap = options.gap ?? 20
  const clusterGap = options.clusterGap ?? 100

  let offsetX = 0
  let offsetY = 0

  for (const cluster of clusters) {
    if (cluster.shapes.length === 0) continue

    // Arrange shapes within cluster
    const clusterWidth = cluster.shapes.reduce((max, s) => Math.max(max, s.bounds.w), 0)
    const clusterHeight = cluster.shapes.reduce((sum, s) => sum + s.bounds.h + gap, -gap)

    let currentY = offsetY
    for (const info of cluster.shapes) {
      editor.updateShape({
        id: info.id,
        type: info.shape.type,
        x: offsetX + (clusterWidth - info.bounds.w) / 2,
        y: currentY,
      })
      currentY += info.bounds.h + gap
    }

    // Move to next cluster position
    if (options.arrangement === 'column') {
      offsetY += clusterHeight + clusterGap
    } else {
      offsetX += clusterWidth + clusterGap
    }
  }
}

// =============================================================================
// HIGH-LEVEL TRANSFORMATION COMMANDS
// =============================================================================

export type TransformCommand =
  | 'align-left' | 'align-center' | 'align-right'
  | 'align-top' | 'align-middle' | 'align-bottom'
  | 'distribute-horizontal' | 'distribute-vertical'
  | 'arrange-row' | 'arrange-column' | 'arrange-grid' | 'arrange-circle'
  | 'size-match-width' | 'size-match-height' | 'size-match-both'
  | 'size-smallest' | 'size-largest'
  | 'merge-content' | 'cluster-semantic'

/**
 * Execute a transformation command on the current selection
 */
export function executeTransformCommand(
  editor: Editor,
  command: TransformCommand,
  options?: Record<string, unknown>
): boolean {
  const infos = getSelectionInfo(editor)

  if (infos.length === 0) {
    console.warn('No shapes selected for transformation')
    return false
  }

  switch (command) {
    // Alignment
    case 'align-left':
      alignSelection(editor, 'left')
      break
    case 'align-center':
      alignSelection(editor, 'center')
      break
    case 'align-right':
      alignSelection(editor, 'right')
      break
    case 'align-top':
      alignSelection(editor, 'top')
      break
    case 'align-middle':
      alignSelection(editor, 'middle')
      break
    case 'align-bottom':
      alignSelection(editor, 'bottom')
      break

    // Distribution
    case 'distribute-horizontal':
      distributeSelection(editor, 'horizontal', options?.gap as number)
      break
    case 'distribute-vertical':
      distributeSelection(editor, 'vertical', options?.gap as number)
      break

    // Arrangement
    case 'arrange-row':
      arrangeSelection(editor, 'row', options as { gap?: number })
      break
    case 'arrange-column':
      arrangeSelection(editor, 'column', options as { gap?: number })
      break
    case 'arrange-grid':
      arrangeSelection(editor, 'grid', options as { gap?: number; columns?: number })
      break
    case 'arrange-circle':
      arrangeSelection(editor, 'circle', options as { centerAt?: { x: number; y: number } })
      break

    // Size normalization
    case 'size-match-width':
      normalizeSelectionSize(editor, 'width')
      break
    case 'size-match-height':
      normalizeSelectionSize(editor, 'height')
      break
    case 'size-match-both':
      normalizeSelectionSize(editor, 'both')
      break
    case 'size-smallest':
      normalizeSelectionSize(editor, 'smallest')
      break
    case 'size-largest':
      normalizeSelectionSize(editor, 'largest')
      break

    // Content operations
    case 'merge-content':
      mergeSelectionContent(editor, { createNew: true, format: 'paragraphs' })
      break
    case 'cluster-semantic':
      const clusters = clusterByContent(editor)
      arrangeIntoClusters(editor, clusters)
      break

    default:
      console.warn(`Unknown transform command: ${command}`)
      return false
  }

  return true
}

/**
 * Parse natural language into transform commands
 * Returns the command and any extracted options
 */
export function parseTransformIntent(intent: string): {
  command: TransformCommand | null
  options: Record<string, unknown>
} {
  const intentLower = intent.toLowerCase()
  const options: Record<string, unknown> = {}

  // Alignment patterns
  if (intentLower.match(/align.*(left|start)/)) {
    return { command: 'align-left', options }
  }
  if (intentLower.match(/align.*(right|end)/)) {
    return { command: 'align-right', options }
  }
  if (intentLower.match(/align.*(center|middle).*horizontal|center.*align|horizontally.*center/)) {
    return { command: 'align-center', options }
  }
  if (intentLower.match(/align.*top/)) {
    return { command: 'align-top', options }
  }
  if (intentLower.match(/align.*bottom/)) {
    return { command: 'align-bottom', options }
  }
  if (intentLower.match(/align.*(center|middle).*vertical|vertically.*center|middle.*align/)) {
    return { command: 'align-middle', options }
  }

  // Distribution patterns
  if (intentLower.match(/distribute.*horizontal|spread.*out.*horizontal|space.*horizontal/)) {
    return { command: 'distribute-horizontal', options }
  }
  if (intentLower.match(/distribute.*vertical|spread.*out.*vertical|space.*vertical/)) {
    return { command: 'distribute-vertical', options }
  }

  // Arrangement patterns
  if (intentLower.match(/arrange.*row|put.*row|line.*up.*horizontal|horizontal.*row/)) {
    return { command: 'arrange-row', options }
  }
  if (intentLower.match(/arrange.*column|put.*column|line.*up.*vertical|vertical.*column|stack/)) {
    return { command: 'arrange-column', options }
  }
  if (intentLower.match(/arrange.*grid|put.*grid|tile|organize.*grid/)) {
    // Extract column count if specified
    const colMatch = intentLower.match(/(\d+)\s*col/)
    if (colMatch) {
      options.columns = parseInt(colMatch[1])
    }
    return { command: 'arrange-grid', options }
  }
  if (intentLower.match(/arrange.*circle|circular|radial|around/)) {
    return { command: 'arrange-circle', options }
  }

  // Size patterns
  if (intentLower.match(/same.*width|match.*width|equal.*width/)) {
    return { command: 'size-match-width', options }
  }
  if (intentLower.match(/same.*height|match.*height|equal.*height/)) {
    return { command: 'size-match-height', options }
  }
  if (intentLower.match(/same.*size|match.*size|equal.*size|uniform|consistent.*size/)) {
    return { command: 'size-match-both', options }
  }
  if (intentLower.match(/smallest|shrink.*to.*smallest|make.*small/)) {
    return { command: 'size-smallest', options }
  }
  if (intentLower.match(/largest|expand.*to.*largest|make.*large|make.*big/)) {
    return { command: 'size-largest', options }
  }

  // Content patterns
  if (intentLower.match(/merge|combine|consolidate|aggregate/)) {
    return { command: 'merge-content', options }
  }
  if (intentLower.match(/cluster|group.*by.*content|semantic.*group|organize.*by.*topic/)) {
    return { command: 'cluster-semantic', options }
  }

  return { command: null, options }
}
