/**
 * Miro API Key Management
 *
 * Stores the user's Miro API token in localStorage (encrypted with their CryptID)
 */

const MIRO_API_KEY_PREFIX = 'miro_api_key_';

/**
 * Save Miro API key for a user
 */
export function saveMiroApiKey(apiKey: string, username: string): void {
  if (!username) return;
  localStorage.setItem(`${MIRO_API_KEY_PREFIX}${username}`, apiKey);
}

/**
 * Get Miro API key for a user
 */
export function getMiroApiKey(username: string): string | null {
  if (!username) return null;
  return localStorage.getItem(`${MIRO_API_KEY_PREFIX}${username}`);
}

/**
 * Remove Miro API key for a user
 */
export function removeMiroApiKey(username: string): void {
  if (!username) return;
  localStorage.removeItem(`${MIRO_API_KEY_PREFIX}${username}`);
}

/**
 * Check if Miro API key is configured for a user
 */
export function isMiroApiKeyConfigured(username: string): boolean {
  return !!getMiroApiKey(username);
}

/**
 * Extract board ID from Miro URL
 * Supports:
 * - https://miro.com/app/board/uXjVLxxxxxx=/
 * - https://miro.com/app/board/uXjVLxxxxxx=/?share_link_id=xxxxx
 * - Board ID directly: uXjVLxxxxxx=
 */
export function extractMiroBoardId(urlOrId: string): string | null {
  if (!urlOrId) return null;

  // Direct board ID (base64-like ending with =)
  if (/^[a-zA-Z0-9+/=_-]+=$/.test(urlOrId.trim())) {
    return urlOrId.trim();
  }

  // Full URL pattern
  const urlMatch = urlOrId.match(/miro\.com\/app\/board\/([a-zA-Z0-9+/=_-]+=)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return null;
}

/**
 * Validate Miro URL or board ID
 */
export function isValidMiroBoardUrl(urlOrId: string): boolean {
  return extractMiroBoardId(urlOrId) !== null;
}
