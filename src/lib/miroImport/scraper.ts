/**
 * Miro Board Scraper
 *
 * Extracts board data from Miro using browser automation (Puppeteer)
 * This runs on a backend service, not in the browser.
 *
 * For frontend use, see the API endpoint that calls this.
 */

import type { MiroBoardObject, MiroBoardExport } from './types'

/**
 * Extract board ID from various Miro URL formats
 * Supports:
 * - https://miro.com/app/board/uXjVLxxxxxx=/
 * - https://miro.com/app/board/uXjVLxxxxxx=/?share_link_id=xxxxx
 * - Board ID directly: uXjVLxxxxxx=
 */
export function extractBoardId(urlOrId: string): string | null {
  // Direct board ID (base64-like)
  if (/^[a-zA-Z0-9+/=_-]+=$/.test(urlOrId)) {
    return urlOrId
  }

  // Full URL pattern
  const urlMatch = urlOrId.match(/miro\.com\/app\/board\/([a-zA-Z0-9+/=_-]+=)/)
  if (urlMatch) {
    return urlMatch[1]
  }

  return null
}

/**
 * Parse the Miro export JSON format
 * This handles both the jolle/miro-export format and Miro's internal format
 */
export function parseMiroExportJson(jsonData: any): MiroBoardObject[] {
  // If it's an array, assume it's the objects directly
  if (Array.isArray(jsonData)) {
    return jsonData as MiroBoardObject[]
  }

  // If it has an 'objects' property
  if (jsonData.objects && Array.isArray(jsonData.objects)) {
    return jsonData.objects as MiroBoardObject[]
  }

  // If it has a 'data' property (some API responses)
  if (jsonData.data && Array.isArray(jsonData.data)) {
    return jsonData.data as MiroBoardObject[]
  }

  console.warn('Unknown Miro JSON format, attempting to extract objects')
  return []
}

/**
 * Fetch Miro board data using a proxy service
 * Since Puppeteer can't run in the browser, we need a backend endpoint
 *
 * This function is meant to be called from the frontend and talks to our API
 */
export async function fetchMiroBoardData(
  boardUrl: string,
  options: {
    token?: string
    frameNames?: string[]
    apiEndpoint?: string
  } = {}
): Promise<MiroBoardExport> {
  const { token, frameNames, apiEndpoint = '/api/miro/scrape' } = options

  const boardId = extractBoardId(boardUrl)
  if (!boardId) {
    throw new Error(`Invalid Miro URL or board ID: ${boardUrl}`)
  }

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      boardId,
      token,
      frameNames,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch Miro board: ${error}`)
  }

  const data = await response.json() as { boardName?: string; objects?: any }
  return {
    boardId,
    boardName: data.boardName,
    objects: parseMiroExportJson(data.objects || data),
    exportedAt: new Date().toISOString(),
  }
}

/**
 * Alternative: Parse a pre-exported Miro JSON file
 * Use this if you've already exported the board using miro-export CLI
 */
export function parseMiroExportFile(jsonString: string): MiroBoardExport {
  try {
    const data = JSON.parse(jsonString)
    return {
      boardId: data.boardId || 'unknown',
      boardName: data.boardName,
      objects: parseMiroExportJson(data),
      exportedAt: data.exportedAt || new Date().toISOString(),
    }
  } catch (error) {
    throw new Error(`Failed to parse Miro JSON: ${error}`)
  }
}

/**
 * Puppeteer-based scraper (for backend use only)
 * This is the actual scraping logic that runs on the server
 */
export async function scrapeMiroBoardWithPuppeteer(
  _boardId: string,
  _options: {
    token?: string
    frameNames?: string[]
  } = {}
): Promise<MiroBoardObject[]> {
  // This is a placeholder - actual implementation requires puppeteer
  // which can't be bundled for browser use
  throw new Error(
    'Puppeteer scraping must be done server-side. Use fetchMiroBoardData() from the frontend.'
  )
}
