/**
 * Automerge WASM initialization for Cloudflare Workers
 *
 * This module handles the proper initialization of Automerge's WASM module
 * in a Cloudflare Workers environment.
 *
 * @see https://automerge.org/docs/reference/library-initialization/
 * @see https://automerge.org/blog/2024/08/23/wasm-packaging/
 */

// Import from the slim variant for manual WASM initialization
import * as Automerge from '@automerge/automerge/slim'

// Import the WASM binary using Wrangler's module bundling
// The ?module suffix tells Wrangler to bundle this as a WebAssembly module
// CRITICAL: Use relative path from worker/ directory to node_modules to fix Wrangler resolution
import automergeWasm from '../node_modules/@automerge/automerge/dist/automerge.wasm?module'

let isInitialized = false
let initPromise: Promise<void> | null = null

/**
 * Initialize Automerge WASM module
 * This must be called before using any Automerge functions
 * Safe to call multiple times - will only initialize once
 */
export async function initializeAutomerge(): Promise<void> {
  if (isInitialized) {
    return
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      console.log('🔧 Initializing Automerge WASM...')

      // Initialize with the WASM module
      // In Cloudflare Workers, we pass the WebAssembly module directly
      await Automerge.initializeWasm(automergeWasm)

      isInitialized = true
      console.log('✅ Automerge WASM initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Automerge WASM:', error)
      initPromise = null
      throw error
    }
  })()

  return initPromise
}

/**
 * Check if Automerge is initialized
 */
export function isAutomergeInitialized(): boolean {
  return isInitialized
}

// Re-export Automerge for convenience
export { Automerge }

// Export commonly used types
export type { Doc, Patch, SyncState } from '@automerge/automerge/slim'
