/**
 * Miro Import Types
 *
 * Type definitions for Miro board items and tldraw shape conversion
 */

// Miro Text Alignment Types
export type MiroTextAlignment = 'left' | 'center' | 'right'
export type MiroTextVerticalAlignment = 'top' | 'middle' | 'bottom'

// Miro Base Types
export interface MiroBoardItemBase {
  id: string
  type: string
  parentId?: string
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  createdAt?: string
  createdBy?: string
  modifiedAt?: string
  modifiedBy?: string
  connectorIds?: string[]
  tagIds?: string[]
}

// Miro Style Types
export interface MiroStickyNoteStyle {
  fillColor: string
  textAlign: MiroTextAlignment
  textAlignVertical: MiroTextVerticalAlignment
}

export interface MiroShapeStyle {
  fillColor?: string
  fillOpacity?: number
  borderColor?: string
  borderWidth?: number
  borderStyle?: string
  fontFamily?: string
  fontSize?: number
  textAlign?: MiroTextAlignment
  textAlignVertical?: MiroTextVerticalAlignment
}

export interface MiroTextStyle {
  fillColor?: string
  fontFamily?: string
  fontSize?: number
  textAlign?: MiroTextAlignment
}

// Miro Object Types
export interface MiroStickyNote extends MiroBoardItemBase {
  type: 'sticky_note'
  shape: 'square' | 'rectangle'
  content: string // HTML content
  style: MiroStickyNoteStyle
}

export interface MiroText extends MiroBoardItemBase {
  type: 'text'
  content: string
  style: MiroTextStyle
}

export interface MiroShape extends MiroBoardItemBase {
  type: 'shape'
  shape: string // rectangle, circle, triangle, etc.
  content?: string
  style: MiroShapeStyle
}

export interface MiroImage extends MiroBoardItemBase {
  type: 'image'
  url: string
  title?: string
}

export interface MiroFrame extends MiroBoardItemBase {
  type: 'frame'
  title?: string
  childrenIds: string[]
  style?: {
    fillColor?: string
  }
}

export interface MiroConnector extends MiroBoardItemBase {
  type: 'connector'
  startItem?: { id: string }
  endItem?: { id: string }
  shape?: string
  style?: {
    strokeColor?: string
    strokeWidth?: number
    startStrokeCap?: string
    endStrokeCap?: string
  }
  captions?: Array<{ content: string }>
}

export interface MiroCard extends MiroBoardItemBase {
  type: 'card'
  title?: string
  description?: string
  style?: {
    cardTheme?: string
    fillBackground?: boolean
  }
  assignee?: {
    userId: string
  }
  dueDate?: string
}

export interface MiroEmbed extends MiroBoardItemBase {
  type: 'embed'
  url: string
  mode?: string
  previewUrl?: string
}

// Union type for all Miro objects
export type MiroBoardObject =
  | MiroStickyNote
  | MiroText
  | MiroShape
  | MiroImage
  | MiroFrame
  | MiroConnector
  | MiroCard
  | MiroEmbed
  | (MiroBoardItemBase & { type: string }) // Catch-all for unknown types

// Miro board export format
export interface MiroBoardExport {
  boardId: string
  boardName?: string
  objects: MiroBoardObject[]
  exportedAt: string
}

// Import options
export interface MiroImportOptions {
  /** Miro board URL or ID */
  boardUrl: string
  /** Optional authentication token for private boards */
  token?: string
  /** Specific frame names to import (empty = whole board) */
  frameNames?: string[]
  /** Whether to download and re-upload images to local storage */
  migrateAssets?: boolean
  /** Target position offset for imported shapes */
  offset?: { x: number; y: number }
}

// Import result
export interface MiroImportResult {
  success: boolean
  shapesCreated: number
  assetsUploaded: number
  errors: string[]
  /** The tldraw shapes ready to be created */
  shapes: any[] // TLShape[]
  /** Asset records to be created */
  assets: any[] // TLAsset[]
}

// Color mapping from Miro to tldraw
export const MIRO_TO_TLDRAW_COLORS: Record<string, string> = {
  // Miro sticky note colors
  'gray': 'grey',
  'light_yellow': 'yellow',
  'yellow': 'yellow',
  'orange': 'orange',
  'light_green': 'light-green',
  'green': 'green',
  'dark_green': 'green',
  'cyan': 'light-blue',
  'light_blue': 'light-blue',
  'blue': 'blue',
  'dark_blue': 'blue',
  'light_pink': 'light-red',
  'pink': 'light-red',
  'violet': 'violet',
  'red': 'red',
  'black': 'black',
  'white': 'white',
  // Hex colors (approximate mapping)
  '#f5d128': 'yellow',
  '#f24726': 'red',
  '#ff9d48': 'orange',
  '#93d275': 'light-green',
  '#12cdd4': 'light-blue',
  '#652cb3': 'violet',
  '#808080': 'grey',
}

// Shape type mapping from Miro to tldraw geo types
export const MIRO_TO_TLDRAW_GEO: Record<string, string> = {
  'rectangle': 'rectangle',
  'square': 'rectangle',
  'round_rectangle': 'rectangle',
  'circle': 'ellipse',
  'oval': 'oval',
  'ellipse': 'ellipse',
  'triangle': 'triangle',
  'right_triangle': 'triangle',
  'diamond': 'diamond',
  'rhombus': 'rhombus',
  'parallelogram': 'trapezoid',
  'trapezoid': 'trapezoid',
  'pentagon': 'pentagon',
  'hexagon': 'hexagon',
  'octagon': 'octagon',
  'star': 'star',
  'arrow_left': 'arrow-left',
  'arrow_right': 'arrow-right',
  'arrow_up': 'arrow-up',
  'arrow_down': 'arrow-down',
  'cloud': 'cloud',
  'heart': 'heart',
  'cross': 'x-box',
  'can': 'rectangle', // No exact match
  'wedge_round_rectangle_callout': 'rectangle',
}
