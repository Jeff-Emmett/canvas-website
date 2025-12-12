/**
 * Miro to tldraw Converter
 *
 * Converts Miro board objects to tldraw shapes
 */

import { createShapeId, TLShapeId, AssetRecordType } from 'tldraw'
import {
  MiroBoardObject,
  MiroStickyNote,
  MiroText,
  MiroShape,
  MiroImage,
  MiroFrame,
  MiroConnector,
  MiroCard,
  MIRO_TO_TLDRAW_COLORS,
  MIRO_TO_TLDRAW_GEO,
} from './types'

// Default dimensions for shapes without explicit size
const DEFAULT_NOTE_SIZE = 200
const DEFAULT_SHAPE_SIZE = 100
const DEFAULT_TEXT_WIDTH = 300
const DEFAULT_FRAME_SIZE = 800

/**
 * Strip HTML tags and decode entities from Miro content
 */
function stripHtml(html: string): string {
  if (!html) return ''

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))

  return text.trim()
}

/**
 * Convert Miro color to tldraw color
 */
function convertColor(miroColor: string | undefined): string {
  if (!miroColor) return 'yellow'

  // Check direct mapping
  const normalized = miroColor.toLowerCase().replace(/[_-]/g, '_')
  if (MIRO_TO_TLDRAW_COLORS[normalized]) {
    return MIRO_TO_TLDRAW_COLORS[normalized]
  }

  // Check hex mapping
  if (miroColor.startsWith('#')) {
    const hexLower = miroColor.toLowerCase()
    if (MIRO_TO_TLDRAW_COLORS[hexLower]) {
      return MIRO_TO_TLDRAW_COLORS[hexLower]
    }
  }

  // Default fallback
  return 'yellow'
}

/**
 * Convert Miro text alignment to tldraw alignment
 */
function convertAlign(miroAlign: string | undefined): 'start' | 'middle' | 'end' {
  switch (miroAlign) {
    case 'left':
      return 'start'
    case 'center':
      return 'middle'
    case 'right':
      return 'end'
    default:
      return 'middle'
  }
}

/**
 * Convert Miro vertical alignment to tldraw vertical alignment
 */
function convertVerticalAlign(miroAlign: string | undefined): 'start' | 'middle' | 'end' {
  switch (miroAlign) {
    case 'top':
      return 'start'
    case 'middle':
      return 'middle'
    case 'bottom':
      return 'end'
    default:
      return 'middle'
  }
}

/**
 * Generate a unique shape ID from Miro ID
 */
function generateShapeId(miroId: string): TLShapeId {
  return createShapeId(`miro-${miroId}`)
}

/**
 * Generate a unique asset ID from Miro ID
 */
function generateAssetId(miroId: string): string {
  return AssetRecordType.createId(`miro-${miroId}`)
}

/**
 * Convert Miro sticky note to tldraw note shape
 */
export function convertStickyNote(item: MiroStickyNote, offset = { x: 0, y: 0 }): any {
  const text = stripHtml(item.content)
  const color = convertColor(item.style?.fillColor)

  return {
    id: generateShapeId(item.id),
    type: 'note',
    x: item.x + offset.x - (item.width || DEFAULT_NOTE_SIZE) / 2,
    y: item.y + offset.y - (item.height || DEFAULT_NOTE_SIZE) / 2,
    rotation: (item.rotation || 0) * (Math.PI / 180),
    props: {
      color,
      size: 'm',
      font: 'sans',
      align: convertAlign(item.style?.textAlign),
      verticalAlign: convertVerticalAlign(item.style?.textAlignVertical),
      growY: 0,
      url: '',
      scale: 1,
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : [],
          },
        ],
      },
    },
  }
}

/**
 * Convert Miro text to tldraw text shape
 */
export function convertText(item: MiroText, offset = { x: 0, y: 0 }): any {
  const text = stripHtml(item.content)
  const color = convertColor(item.style?.fillColor)

  return {
    id: generateShapeId(item.id),
    type: 'text',
    x: item.x + offset.x - (item.width || DEFAULT_TEXT_WIDTH) / 2,
    y: item.y + offset.y - (item.height || 50) / 2,
    rotation: (item.rotation || 0) * (Math.PI / 180),
    props: {
      color,
      size: 'm',
      font: 'sans',
      textAlign: convertAlign(item.style?.textAlign),
      w: item.width || DEFAULT_TEXT_WIDTH,
      scale: 1,
      autoSize: true,
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : [],
          },
        ],
      },
    },
  }
}

/**
 * Convert Miro shape to tldraw geo shape
 */
export function convertShape(item: MiroShape, offset = { x: 0, y: 0 }): any {
  const text = stripHtml(item.content || '')
  const geo = MIRO_TO_TLDRAW_GEO[item.shape] || 'rectangle'
  const color = convertColor(item.style?.fillColor || item.style?.borderColor)

  // Determine fill style based on Miro's fill opacity
  let fill: 'none' | 'semi' | 'solid' | 'pattern' = 'none'
  if (item.style?.fillOpacity !== undefined) {
    if (item.style.fillOpacity > 0.7) fill = 'solid'
    else if (item.style.fillOpacity > 0.3) fill = 'semi'
    else if (item.style.fillOpacity > 0) fill = 'pattern'
  } else if (item.style?.fillColor) {
    fill = 'solid'
  }

  return {
    id: generateShapeId(item.id),
    type: 'geo',
    x: item.x + offset.x - (item.width || DEFAULT_SHAPE_SIZE) / 2,
    y: item.y + offset.y - (item.height || DEFAULT_SHAPE_SIZE) / 2,
    rotation: (item.rotation || 0) * (Math.PI / 180),
    props: {
      geo,
      w: item.width || DEFAULT_SHAPE_SIZE,
      h: item.height || DEFAULT_SHAPE_SIZE,
      color,
      labelColor: color,
      fill,
      dash: 'solid',
      size: 'm',
      font: 'sans',
      align: convertAlign(item.style?.textAlign),
      verticalAlign: convertVerticalAlign(item.style?.textAlignVertical),
      growY: 0,
      url: '',
      scale: 1,
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : [],
          },
        ],
      },
    },
  }
}

/**
 * Convert Miro image to tldraw image shape
 * Returns both shape and asset records
 */
export function convertImage(
  item: MiroImage,
  offset = { x: 0, y: 0 }
): { shape: any; asset: any } {
  const assetId = generateAssetId(item.id)

  const asset = {
    id: assetId,
    type: 'image',
    typeName: 'asset',
    props: {
      name: item.title || 'Miro Image',
      src: item.url, // Will be replaced after migration
      w: item.width || 300,
      h: item.height || 200,
      mimeType: 'image/png',
      isAnimated: false,
    },
    meta: {
      miroId: item.id,
      originalUrl: item.url,
    },
  }

  const shape = {
    id: generateShapeId(item.id),
    type: 'image',
    x: item.x + offset.x - (item.width || 300) / 2,
    y: item.y + offset.y - (item.height || 200) / 2,
    rotation: (item.rotation || 0) * (Math.PI / 180),
    props: {
      w: item.width || 300,
      h: item.height || 200,
      assetId,
      url: '', // Deprecated but required
      playing: true,
      crop: null,
      flipX: false,
      flipY: false,
      altText: item.title || '',
    },
  }

  return { shape, asset }
}

/**
 * Convert Miro frame to tldraw frame shape
 */
export function convertFrame(item: MiroFrame, offset = { x: 0, y: 0 }): any {
  return {
    id: generateShapeId(item.id),
    type: 'frame',
    x: item.x + offset.x - (item.width || DEFAULT_FRAME_SIZE) / 2,
    y: item.y + offset.y - (item.height || DEFAULT_FRAME_SIZE) / 2,
    rotation: (item.rotation || 0) * (Math.PI / 180),
    props: {
      w: item.width || DEFAULT_FRAME_SIZE,
      h: item.height || DEFAULT_FRAME_SIZE,
      name: item.title || 'Frame',
      color: convertColor(item.style?.fillColor),
    },
  }
}

/**
 * Convert Miro connector to tldraw arrow shape
 */
export function convertConnector(
  item: MiroConnector,
  objectsById: Map<string, MiroBoardObject>,
  offset = { x: 0, y: 0 }
): any | null {
  // Get start and end positions
  let startX = item.x + offset.x
  let startY = item.y + offset.y
  let endX = startX + 100
  let endY = startY

  // If connected to items, calculate positions
  if (item.startItem?.id) {
    const startObj = objectsById.get(item.startItem.id)
    if (startObj) {
      startX = startObj.x + offset.x
      startY = startObj.y + offset.y
    }
  }

  if (item.endItem?.id) {
    const endObj = objectsById.get(item.endItem.id)
    if (endObj) {
      endX = endObj.x + offset.x
      endY = endObj.y + offset.y
    }
  }

  // Get label text if any
  const text = item.captions?.[0]?.content ? stripHtml(item.captions[0].content) : ''

  return {
    id: generateShapeId(item.id),
    type: 'arrow',
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    rotation: 0,
    props: {
      color: convertColor(item.style?.strokeColor),
      labelColor: 'black',
      fill: 'none',
      dash: 'solid',
      size: 'm',
      arrowheadStart: item.style?.startStrokeCap === 'none' ? 'none' : 'none',
      arrowheadEnd: item.style?.endStrokeCap === 'none' ? 'none' : 'arrow',
      font: 'sans',
      start: { x: startX - Math.min(startX, endX), y: startY - Math.min(startY, endY) },
      end: { x: endX - Math.min(startX, endX), y: endY - Math.min(startY, endY) },
      bend: 0,
      text,
      labelPosition: 0.5,
      scale: 1,
      kind: 'arc',
      elbowMidPoint: 0.5,
    },
  }
}

/**
 * Convert Miro card to tldraw geo shape (rectangle with text)
 */
export function convertCard(item: MiroCard, offset = { x: 0, y: 0 }): any {
  const title = item.title || ''
  const description = item.description ? `\n${item.description}` : ''
  const text = stripHtml(title + description)

  return {
    id: generateShapeId(item.id),
    type: 'geo',
    x: item.x + offset.x - (item.width || 200) / 2,
    y: item.y + offset.y - (item.height || 150) / 2,
    rotation: (item.rotation || 0) * (Math.PI / 180),
    props: {
      geo: 'rectangle',
      w: item.width || 200,
      h: item.height || 150,
      color: 'light-blue',
      labelColor: 'black',
      fill: 'solid',
      dash: 'solid',
      size: 'm',
      font: 'sans',
      align: 'start',
      verticalAlign: 'start',
      growY: 0,
      url: '',
      scale: 1,
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : [],
          },
        ],
      },
    },
  }
}

/**
 * Main converter function - converts all Miro objects to tldraw shapes
 */
export function convertMiroBoardToTldraw(
  objects: MiroBoardObject[],
  offset = { x: 0, y: 0 }
): { shapes: any[]; assets: any[]; skipped: string[] } {
  const shapes: any[] = []
  const assets: any[] = []
  const skipped: string[] = []

  // Create a map for quick lookup (needed for connectors)
  const objectsById = new Map<string, MiroBoardObject>()
  objects.forEach((obj) => objectsById.set(obj.id, obj))

  for (const obj of objects) {
    try {
      switch (obj.type) {
        case 'sticky_note':
          shapes.push(convertStickyNote(obj as MiroStickyNote, offset))
          break

        case 'text':
          shapes.push(convertText(obj as MiroText, offset))
          break

        case 'shape':
          shapes.push(convertShape(obj as MiroShape, offset))
          break

        case 'image': {
          const { shape, asset } = convertImage(obj as MiroImage, offset)
          shapes.push(shape)
          assets.push(asset)
          break
        }

        case 'frame':
          shapes.push(convertFrame(obj as MiroFrame, offset))
          break

        case 'connector': {
          const arrow = convertConnector(obj as MiroConnector, objectsById, offset)
          if (arrow) shapes.push(arrow)
          break
        }

        case 'card':
          shapes.push(convertCard(obj as MiroCard, offset))
          break

        // Unsupported types - log and skip
        case 'app_card':
        case 'embed':
        case 'document':
        case 'kanban':
        case 'mindmap':
        case 'table':
          skipped.push(`${obj.type} (id: ${obj.id})`)
          break

        default:
          skipped.push(`unknown type '${obj.type}' (id: ${obj.id})`)
      }
    } catch (error) {
      console.error(`Error converting Miro object ${obj.id}:`, error)
      skipped.push(`${obj.type} (id: ${obj.id}) - conversion error`)
    }
  }

  return { shapes, assets, skipped }
}
