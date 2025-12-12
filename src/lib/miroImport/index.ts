/**
 * Miro Import Service
 *
 * Main entry point for importing Miro boards into tldraw
 *
 * Usage:
 *
 * ```ts
 * import { importMiroBoard, importMiroJson } from '@/lib/miroImport'
 *
 * // Import from Miro URL (requires backend API)
 * const result = await importMiroBoard({
 *   boardUrl: 'https://miro.com/app/board/xxxxx=/',
 *   migrateAssets: true,
 * })
 *
 * // Import from exported JSON file
 * const result = await importMiroJson(jsonString, { migrateAssets: true })
 *
 * // Then create shapes in tldraw
 * editor.createShapes(result.shapes)
 * for (const asset of result.assets) {
 *   editor.createAssets([asset])
 * }
 * ```
 */

export * from './types'
export * from './converter'
export * from './scraper'
export * from './assetMigration'

import type { MiroImportOptions, MiroImportResult, MiroBoardObject } from './types'
import { convertMiroBoardToTldraw } from './converter'
import { fetchMiroBoardData, parseMiroExportFile } from './scraper'
import {
  extractImageUrls,
  migrateAssets,
  updateAssetReferences,
} from './assetMigration'

/**
 * Import a Miro board from URL
 * Requires a backend API endpoint for scraping
 */
export async function importMiroBoard(
  options: MiroImportOptions,
  callbacks?: {
    onProgress?: (stage: string, progress: number) => void
  }
): Promise<MiroImportResult> {
  const { boardUrl, token, frameNames, migrateAssets: shouldMigrate = true, offset = { x: 0, y: 0 } } = options
  const { onProgress } = callbacks || {}

  const errors: string[] = []

  try {
    // Stage 1: Fetch board data
    onProgress?.('Fetching board data...', 0.1)
    const boardData = await fetchMiroBoardData(boardUrl, { token, frameNames })

    if (!boardData.objects || boardData.objects.length === 0) {
      return {
        success: false,
        shapesCreated: 0,
        assetsUploaded: 0,
        errors: ['No objects found in Miro board'],
        shapes: [],
        assets: [],
      }
    }

    // Stage 2: Convert to tldraw shapes
    onProgress?.('Converting shapes...', 0.3)
    const { shapes, assets, skipped } = convertMiroBoardToTldraw(boardData.objects, offset)

    if (skipped.length > 0) {
      errors.push(`Skipped ${skipped.length} unsupported items: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '...' : ''}`)
    }

    // Stage 3: Migrate assets (if enabled)
    let finalAssets = assets
    let assetsUploaded = 0

    if (shouldMigrate && assets.length > 0) {
      onProgress?.('Migrating images...', 0.5)

      const imageUrls = assets
        .map((a) => a.props?.src || a.meta?.originalUrl)
        .filter((url): url is string => !!url)

      const migrationResults = await migrateAssets(imageUrls, {
        onProgress: (completed, total) => {
          const progress = 0.5 + (completed / total) * 0.4
          onProgress?.(`Migrating images (${completed}/${total})...`, progress)
        },
      })

      finalAssets = updateAssetReferences(assets, migrationResults)
      assetsUploaded = [...migrationResults.values()].filter((r) => r.success).length

      const failedMigrations = [...migrationResults.values()].filter((r) => !r.success)
      if (failedMigrations.length > 0) {
        errors.push(`Failed to migrate ${failedMigrations.length} images`)
      }
    }

    onProgress?.('Complete!', 1)

    return {
      success: true,
      shapesCreated: shapes.length,
      assetsUploaded,
      errors,
      shapes,
      assets: finalAssets,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      shapesCreated: 0,
      assetsUploaded: 0,
      errors: [message],
      shapes: [],
      assets: [],
    }
  }
}

/**
 * Import from a Miro JSON export file
 * Use this when you have a pre-exported JSON from miro-export CLI
 */
export async function importMiroJson(
  jsonString: string,
  options: {
    migrateAssets?: boolean
    offset?: { x: number; y: number }
  } = {},
  callbacks?: {
    onProgress?: (stage: string, progress: number) => void
  }
): Promise<MiroImportResult> {
  const { migrateAssets: shouldMigrate = true, offset = { x: 0, y: 0 } } = options
  const { onProgress } = callbacks || {}

  const errors: string[] = []

  try {
    // Parse JSON
    onProgress?.('Parsing JSON...', 0.1)
    const boardData = parseMiroExportFile(jsonString)

    if (!boardData.objects || boardData.objects.length === 0) {
      return {
        success: false,
        shapesCreated: 0,
        assetsUploaded: 0,
        errors: ['No objects found in JSON file'],
        shapes: [],
        assets: [],
      }
    }

    // Convert to tldraw shapes
    onProgress?.('Converting shapes...', 0.3)
    const { shapes, assets, skipped } = convertMiroBoardToTldraw(boardData.objects, offset)

    if (skipped.length > 0) {
      errors.push(`Skipped ${skipped.length} unsupported items`)
    }

    // Migrate assets if enabled
    let finalAssets = assets
    let assetsUploaded = 0

    if (shouldMigrate && assets.length > 0) {
      onProgress?.('Migrating images...', 0.5)

      const imageUrls = assets
        .map((a) => a.props?.src || a.meta?.originalUrl)
        .filter((url): url is string => !!url)

      const migrationResults = await migrateAssets(imageUrls, {
        onProgress: (completed, total) => {
          const progress = 0.5 + (completed / total) * 0.4
          onProgress?.(`Migrating images (${completed}/${total})...`, progress)
        },
      })

      finalAssets = updateAssetReferences(assets, migrationResults)
      assetsUploaded = [...migrationResults.values()].filter((r) => r.success).length
    }

    onProgress?.('Complete!', 1)

    return {
      success: true,
      shapesCreated: shapes.length,
      assetsUploaded,
      errors,
      shapes,
      assets: finalAssets,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      shapesCreated: 0,
      assetsUploaded: 0,
      errors: [message],
      shapes: [],
      assets: [],
    }
  }
}

/**
 * Direct conversion without asset migration
 * For quick imports or when assets don't need to be migrated
 */
export function convertMiroObjects(
  objects: MiroBoardObject[],
  offset = { x: 0, y: 0 }
): { shapes: any[]; assets: any[]; skipped: string[] } {
  return convertMiroBoardToTldraw(objects, offset)
}

/**
 * Validate a Miro URL
 */
export function isValidMiroUrl(url: string): boolean {
  return /miro\.com\/app\/board\/[a-zA-Z0-9+/=_-]+=/i.test(url) ||
    /^[a-zA-Z0-9+/=_-]+=$/.test(url)
}
