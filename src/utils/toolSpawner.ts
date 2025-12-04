/**
 * Tool Spawner Utility
 * Handles spawning tool shapes on the canvas from the Mycelial Intelligence
 */

import { Editor, TLShapeId, createShapeId } from 'tldraw'
import { ToolSchema, TOOL_SCHEMAS } from '@/lib/toolSchema'
import { findNonOverlappingPosition } from './shapeCollisionUtils'

/**
 * Default dimensions for each tool type
 */
const TOOL_DIMENSIONS: Record<string, { w: number; h: number }> = {
  Prompt: { w: 300, h: 500 },
  ImageGen: { w: 400, h: 450 },
  VideoGen: { w: 400, h: 350 },
  ChatBox: { w: 400, h: 500 },
  Markdown: { w: 400, h: 400 },
  ObsNote: { w: 280, h: 200 },
  Transcription: { w: 320, h: 400 },
  Embed: { w: 600, h: 400 },
  Holon: { w: 600, h: 500 },
  Multmux: { w: 600, h: 400 },
  Slide: { w: 800, h: 600 },
}

/**
 * Arrangement patterns for spawning multiple tools
 */
export type ArrangementPattern = 'horizontal' | 'vertical' | 'grid' | 'radial' | 'cascade'

interface SpawnOptions {
  /** Where to center the spawned tools (defaults to viewport center) */
  centerPosition?: { x: number; y: number }
  /** How to arrange multiple tools */
  arrangement?: ArrangementPattern
  /** Spacing between tools */
  spacing?: number
  /** Whether to animate the spawn */
  animate?: boolean
  /** Whether to select the spawned shapes */
  selectAfterSpawn?: boolean
  /** Whether to zoom to show all spawned shapes */
  zoomToFit?: boolean
}

const DEFAULT_OPTIONS: SpawnOptions = {
  arrangement: 'horizontal',
  spacing: 30,
  animate: true,
  selectAfterSpawn: true,
  zoomToFit: false,
}

/**
 * Calculate positions for tools based on arrangement pattern
 */
function calculatePositions(
  tools: ToolSchema[],
  centerX: number,
  centerY: number,
  arrangement: ArrangementPattern,
  spacing: number
): Array<{ x: number; y: number; w: number; h: number }> {
  const positions: Array<{ x: number; y: number; w: number; h: number }> = []

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    const dims = TOOL_DIMENSIONS[tool.id] || { w: 300, h: 400 }
    let x: number, y: number

    switch (arrangement) {
      case 'horizontal': {
        // Arrange tools in a horizontal row
        const totalWidth = tools.reduce((sum, t, idx) => {
          const d = TOOL_DIMENSIONS[t.id] || { w: 300, h: 400 }
          return sum + d.w + (idx < tools.length - 1 ? spacing : 0)
        }, 0)

        let offsetX = centerX - totalWidth / 2
        for (let j = 0; j < i; j++) {
          const prevDims = TOOL_DIMENSIONS[tools[j].id] || { w: 300, h: 400 }
          offsetX += prevDims.w + spacing
        }

        x = offsetX
        y = centerY - dims.h / 2
        break
      }

      case 'vertical': {
        // Arrange tools in a vertical column
        const totalHeight = tools.reduce((sum, t, idx) => {
          const d = TOOL_DIMENSIONS[t.id] || { w: 300, h: 400 }
          return sum + d.h + (idx < tools.length - 1 ? spacing : 0)
        }, 0)

        let offsetY = centerY - totalHeight / 2
        for (let j = 0; j < i; j++) {
          const prevDims = TOOL_DIMENSIONS[tools[j].id] || { w: 300, h: 400 }
          offsetY += prevDims.h + spacing
        }

        x = centerX - dims.w / 2
        y = offsetY
        break
      }

      case 'grid': {
        // Arrange in a grid (max 3 columns)
        const cols = Math.min(3, tools.length)
        const row = Math.floor(i / cols)
        const col = i % cols

        const maxWidth = 400 + spacing
        const maxHeight = 500 + spacing

        x = centerX + (col - (cols - 1) / 2) * maxWidth - dims.w / 2
        y = centerY + (row - Math.floor(tools.length / cols) / 2) * maxHeight - dims.h / 2
        break
      }

      case 'radial': {
        // Arrange in a circle around center
        const radius = Math.max(300, tools.length * 80)
        const angle = (i / tools.length) * 2 * Math.PI - Math.PI / 2 // Start from top

        x = centerX + radius * Math.cos(angle) - dims.w / 2
        y = centerY + radius * Math.sin(angle) - dims.h / 2
        break
      }

      case 'cascade': {
        // Cascade diagonally down-right
        x = centerX + i * (dims.w / 2 + spacing) - dims.w / 2
        y = centerY + i * (80 + spacing) - dims.h / 2
        break
      }

      default:
        x = centerX - dims.w / 2
        y = centerY - dims.h / 2
    }

    positions.push({ x, y, w: dims.w, h: dims.h })
  }

  return positions
}

/**
 * Spawn a single tool on the canvas
 */
export function spawnTool(
  editor: Editor,
  toolId: string,
  position: { x: number; y: number },
  options: Partial<SpawnOptions> = {}
): TLShapeId | null {
  const schema = TOOL_SCHEMAS[toolId]
  if (!schema) {
    console.warn(`Unknown tool: ${toolId}`)
    return null
  }

  const dims = TOOL_DIMENSIONS[toolId] || { w: 300, h: 400 }

  // Find non-overlapping position
  const finalPosition = findNonOverlappingPosition(
    editor,
    position.x,
    position.y,
    dims.w,
    dims.h
  )

  const shapeId = createShapeId()

  // Create the shape with tool-specific defaults
  editor.createShape({
    id: shapeId,
    type: toolId,
    x: finalPosition.x,
    y: finalPosition.y,
    props: {
      w: dims.w,
      h: dims.h,
    },
  })

  if (options.selectAfterSpawn) {
    editor.setSelectedShapes([shapeId])
  }

  return shapeId
}

/**
 * Spawn multiple tools on the canvas with smart positioning
 */
export function spawnTools(
  editor: Editor,
  tools: ToolSchema[],
  options: Partial<SpawnOptions> = {}
): TLShapeId[] {
  if (tools.length === 0) return []

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  // Get center position (default to viewport center)
  let centerX: number, centerY: number
  if (mergedOptions.centerPosition) {
    centerX = mergedOptions.centerPosition.x
    centerY = mergedOptions.centerPosition.y
  } else {
    const viewportBounds = editor.getViewportPageBounds()
    centerX = viewportBounds.x + viewportBounds.w / 2
    centerY = viewportBounds.y + viewportBounds.h / 2
  }

  // Calculate initial positions based on arrangement
  const positions = calculatePositions(
    tools,
    centerX,
    centerY,
    mergedOptions.arrangement!,
    mergedOptions.spacing!
  )

  // Create shapes, adjusting for overlaps
  const createdIds: TLShapeId[] = []

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    const pos = positions[i]

    // Find non-overlapping position considering already created shapes
    const finalPosition = findNonOverlappingPosition(
      editor,
      pos.x,
      pos.y,
      pos.w,
      pos.h,
      createdIds.map(id => id as string)
    )

    const shapeId = createShapeId()

    editor.createShape({
      id: shapeId,
      type: tool.id,
      x: finalPosition.x,
      y: finalPosition.y,
      props: {
        w: pos.w,
        h: pos.h,
      },
    })

    createdIds.push(shapeId)
  }

  // Select all spawned shapes
  if (mergedOptions.selectAfterSpawn && createdIds.length > 0) {
    editor.setSelectedShapes(createdIds)
  }

  // Zoom to fit all spawned shapes
  if (mergedOptions.zoomToFit && createdIds.length > 0) {
    const bounds = editor.getSelectionPageBounds()
    if (bounds) {
      editor.zoomToBounds(bounds, {
        targetZoom: Math.min(
          (editor.getViewportPageBounds().width * 0.8) / bounds.width,
          (editor.getViewportPageBounds().height * 0.8) / bounds.height,
          1
        ),
        inset: 50,
        animation: { duration: 400, easing: (t) => t * (2 - t) },
      })
    }
  }

  return createdIds
}

/**
 * Spawn tools below the Mycelial Intelligence bar
 */
export function spawnToolsBelowMI(
  editor: Editor,
  tools: ToolSchema[],
  options: Partial<SpawnOptions> = {}
): TLShapeId[] {
  // The MI bar is at the top center of the viewport
  // Spawn tools slightly below and centered
  const viewportBounds = editor.getViewportPageBounds()

  // Calculate position: center horizontally, offset down from top
  const centerX = viewportBounds.x + viewportBounds.w / 2
  const topY = viewportBounds.y + 100 // Below MI bar

  return spawnTools(editor, tools, {
    ...options,
    centerPosition: { x: centerX, y: topY + 200 },
    arrangement: options.arrangement || (tools.length <= 2 ? 'horizontal' : 'grid'),
  })
}

/**
 * Get a tool schema by ID (convenience export)
 */
export function getToolById(toolId: string): ToolSchema | undefined {
  return TOOL_SCHEMAS[toolId]
}
