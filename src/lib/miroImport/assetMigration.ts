/**
 * Asset Migration Service
 *
 * Downloads images from Miro and re-uploads them to the local asset store
 * This ensures images persist even if Miro access is lost
 */

import { WORKER_URL } from '../../constants/workerUrl'
import { uniqueId } from 'tldraw'

export interface AssetMigrationResult {
  originalUrl: string
  newUrl: string
  success: boolean
  error?: string
}

/**
 * Download an image from a URL and return as Blob
 */
async function downloadImage(url: string): Promise<Blob> {
  // Use a CORS proxy if needed for Miro URLs
  let fetchUrl = url

  // Miro images might need proxy
  if (url.includes('miro.medium.com') || url.includes('miro.com')) {
    // Try direct fetch first, then proxy if it fails
    try {
      const response = await fetch(url, { mode: 'cors' })
      if (response.ok) {
        return await response.blob()
      }
    } catch (e) {
      // Fall through to proxy
    }

    // Use our worker as a proxy
    fetchUrl = `${WORKER_URL}/proxy?url=${encodeURIComponent(url)}`
  }

  const response = await fetch(fetchUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }

  return await response.blob()
}

/**
 * Upload a blob to the asset store
 */
async function uploadToAssetStore(blob: Blob, filename: string): Promise<string> {
  const id = uniqueId()
  const safeName = `${id}-${filename}`.replace(/[^a-zA-Z0-9.]/g, '-')
  const url = `${WORKER_URL}/uploads/${safeName}`

  const response = await fetch(url, {
    method: 'POST',
    body: blob,
  })

  if (!response.ok) {
    throw new Error(`Failed to upload asset: ${response.statusText}`)
  }

  return url
}

/**
 * Extract filename from URL
 */
function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const parts = pathname.split('/')
    const filename = parts[parts.length - 1] || 'image.png'
    return filename.split('?')[0] // Remove query params
  } catch {
    return 'image.png'
  }
}

/**
 * Migrate a single asset from Miro to local storage
 */
export async function migrateAsset(originalUrl: string): Promise<AssetMigrationResult> {
  try {
    // Download the image
    const blob = await downloadImage(originalUrl)

    // Get a reasonable filename
    const filename = extractFilename(originalUrl)

    // Upload to our asset store
    const newUrl = await uploadToAssetStore(blob, filename)

    return {
      originalUrl,
      newUrl,
      success: true,
    }
  } catch (error) {
    console.error(`Failed to migrate asset ${originalUrl}:`, error)
    return {
      originalUrl,
      newUrl: originalUrl, // Fall back to original
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Migrate multiple assets in parallel with rate limiting
 */
export async function migrateAssets(
  urls: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Map<string, AssetMigrationResult>> {
  const { concurrency = 3, onProgress } = options
  const results = new Map<string, AssetMigrationResult>()

  // Deduplicate URLs
  const uniqueUrls = [...new Set(urls)]
  let completed = 0

  // Process in batches
  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const batch = uniqueUrls.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await migrateAsset(url)
        completed++
        onProgress?.(completed, uniqueUrls.length)
        return { url, result }
      })
    )

    for (const { url, result } of batchResults) {
      results.set(url, result)
    }
  }

  return results
}

/**
 * Update asset references in shapes with migrated URLs
 */
export function updateAssetReferences(
  assets: any[],
  migrationResults: Map<string, AssetMigrationResult>
): any[] {
  return assets.map((asset) => {
    const originalUrl = asset.props?.src || asset.meta?.originalUrl
    if (!originalUrl) return asset

    const migration = migrationResults.get(originalUrl)
    if (!migration || !migration.success) return asset

    return {
      ...asset,
      props: {
        ...asset.props,
        src: migration.newUrl,
      },
      meta: {
        ...asset.meta,
        originalUrl,
        migratedAt: new Date().toISOString(),
      },
    }
  })
}

/**
 * Extract all image URLs from Miro objects
 */
export function extractImageUrls(objects: any[]): string[] {
  const urls: string[] = []

  for (const obj of objects) {
    if (obj.type === 'image' && obj.url) {
      urls.push(obj.url)
    }
    // Also check for embedded images in other object types
    if (obj.style?.backgroundImageUrl) {
      urls.push(obj.style.backgroundImageUrl)
    }
  }

  return urls
}
