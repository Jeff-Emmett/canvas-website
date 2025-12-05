import { Editor, Vec, createShapeId, AssetRecordType, getHashForString } from "tldraw"
import { WORKER_URL } from "../constants/workerUrl"

// URL patterns to detect multiple URLs in pasted text
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi

// Image file extensions
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i

/**
 * Check if a URL points to an image
 */
function isImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return IMAGE_EXTENSIONS.test(urlObj.pathname)
  } catch {
    return false
  }
}

/**
 * Extract all URLs from a string of text
 */
function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []

  // Deduplicate URLs
  return [...new Set(matches)]
}

/**
 * Unfurl a bookmark URL to get metadata
 */
async function unfurlUrl(url: string): Promise<{
  title: string
  description: string
  image: string
  favicon: string
}> {
  try {
    const response = await fetch(
      `${WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`
    )
    if (!response.ok) throw new Error('Failed to unfurl')
    return await response.json()
  } catch {
    return { title: '', description: '', image: '', favicon: '' }
  }
}

/**
 * Create a bookmark shape for a URL
 */
async function createBookmarkForUrl(
  editor: Editor,
  url: string,
  position: Vec
): Promise<void> {
  const assetId = AssetRecordType.createId(getHashForString(url))

  // Check if asset already exists
  const existingAsset = editor.getAsset(assetId)

  if (!existingAsset) {
    const metadata = await unfurlUrl(url)

    editor.createAssets([{
      id: assetId,
      typeName: 'asset',
      type: 'bookmark',
      meta: {},
      props: {
        src: url,
        title: metadata.title || url,
        description: metadata.description || '',
        image: metadata.image || '',
        favicon: metadata.favicon || '',
      },
    }])
  }

  editor.createShape({
    id: createShapeId(),
    type: 'bookmark',
    x: position.x,
    y: position.y,
    props: {
      assetId,
      url,
    },
  })
}

/**
 * Create an image shape for an image URL
 */
async function createImageForUrl(
  editor: Editor,
  url: string,
  position: Vec
): Promise<void> {
  const assetId = AssetRecordType.createId(getHashForString(url))

  // Check if asset already exists
  const existingAsset = editor.getAsset(assetId)

  if (!existingAsset) {
    // Try to get image dimensions
    let w = 300
    let h = 200

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          w = img.naturalWidth
          h = img.naturalHeight
          resolve()
        }
        img.onerror = () => reject()
        img.src = url
      })
    } catch {
      // Use default dimensions
    }

    editor.createAssets([{
      id: assetId,
      typeName: 'asset',
      type: 'image',
      meta: {},
      props: {
        src: url,
        w,
        h,
        mimeType: 'image/jpeg',
        name: url.split('/').pop() || 'image',
        isAnimated: url.endsWith('.gif'),
      },
    }])
  }

  const asset = editor.getAsset(assetId)
  const props = asset?.props as { w?: number; h?: number } | undefined

  editor.createShape({
    id: createShapeId(),
    type: 'image',
    x: position.x,
    y: position.y,
    props: {
      assetId,
      w: props?.w || 300,
      h: props?.h || 200,
    },
  })
}

/**
 * Create an image shape from a File
 */
async function createImageFromFile(
  editor: Editor,
  file: File,
  position: Vec
): Promise<void> {
  // Read file as data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const assetId = AssetRecordType.createId(getHashForString(dataUrl.slice(0, 100) + file.name))

  // Get image dimensions
  let w = 300
  let h = 200

  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        w = img.naturalWidth
        h = img.naturalHeight
        resolve()
      }
      img.onerror = reject
      img.src = dataUrl
    })
  } catch {
    // Use default dimensions
  }

  editor.createAssets([{
    id: assetId,
    typeName: 'asset',
    type: 'image',
    meta: {},
    props: {
      src: dataUrl,
      w,
      h,
      mimeType: file.type || 'image/jpeg',
      name: file.name,
      isAnimated: file.type === 'image/gif',
    },
  }])

  editor.createShape({
    id: createShapeId(),
    type: 'image',
    x: position.x,
    y: position.y,
    props: {
      assetId,
      w,
      h,
    },
  })
}

/**
 * Configuration for grid layout of pasted items
 */
const GRID_CONFIG = {
  spacing: 20,      // Space between items
  itemWidth: 320,   // Default width per item
  itemHeight: 240,  // Default height per item
  maxColumns: 5,    // Maximum items per row
}

/**
 * Calculate grid positions for multiple items
 */
function calculateGridPositions(
  startPosition: Vec,
  count: number
): Vec[] {
  const positions: Vec[] = []
  const columns = Math.min(count, GRID_CONFIG.maxColumns)

  for (let i = 0; i < count; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)

    positions.push(new Vec(
      startPosition.x + col * (GRID_CONFIG.itemWidth + GRID_CONFIG.spacing),
      startPosition.y + row * (GRID_CONFIG.itemHeight + GRID_CONFIG.spacing)
    ))
  }

  return positions
}

/**
 * Main paste handler that supports multiple items
 */
export function setupMultiPasteHandler(editor: Editor): () => void {
  const handlePaste = async (e: ClipboardEvent) => {
    // Don't intercept if user is typing in an input
    const activeElement = document.activeElement
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable)
    ) {
      return
    }

    const clipboardData = e.clipboardData
    if (!clipboardData) return

    // Get paste position (center of viewport)
    const viewportBounds = editor.getViewportPageBounds()
    const center = viewportBounds.center

    // Collect all items to paste
    const imageFiles: File[] = []
    const urls: string[] = []

    // Check for files (images)
    if (clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i]
        if (file.type.startsWith('image/')) {
          imageFiles.push(file)
        }
      }
    }

    // Check for text content that might contain URLs
    const textData = clipboardData.getData('text/plain')
    if (textData) {
      const extractedUrls = extractUrls(textData)
      urls.push(...extractedUrls)
    }

    // Check for URL data type
    const urlData = clipboardData.getData('text/uri-list')
    if (urlData) {
      // URI list can contain multiple URLs separated by newlines
      const uriUrls = urlData.split('\n').filter(line => line.trim() && !line.startsWith('#'))
      for (const url of uriUrls) {
        if (!urls.includes(url.trim())) {
          urls.push(url.trim())
        }
      }
    }

    // If we have multiple items, handle them ourselves
    const totalItems = imageFiles.length + urls.length

    if (totalItems > 1) {
      // Prevent default tldraw handling
      e.preventDefault()
      e.stopPropagation()

      console.log(`📋 Multi-paste: ${imageFiles.length} images, ${urls.length} URLs`)

      // Calculate grid positions
      const positions = calculateGridPositions(center, totalItems)
      let positionIndex = 0

      // Batch all shape creation in a single history entry
      editor.mark('multi-paste')

      // Process image files first
      for (const file of imageFiles) {
        const position = positions[positionIndex++]
        try {
          await createImageFromFile(editor, file, position)
        } catch (err) {
          console.error('Failed to create image from file:', err)
        }
      }

      // Process URLs
      for (const url of urls) {
        const position = positions[positionIndex++]
        try {
          if (isImageUrl(url)) {
            await createImageForUrl(editor, url, position)
          } else {
            await createBookmarkForUrl(editor, url, position)
          }
        } catch (err) {
          console.error('Failed to create shape for URL:', err)
        }
      }

      return
    }

    // For single items, let tldraw handle it normally
    // (don't prevent default)
  }

  // Add event listener
  document.addEventListener('paste', handlePaste, { capture: true })

  // Return cleanup function
  return () => {
    document.removeEventListener('paste', handlePaste, { capture: true })
  }
}
