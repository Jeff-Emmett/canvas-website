// Key storage utilities for Web Crypto API key pairs
// In production, use Web Crypto API's persistent key storage with IndexedDB

import { isBrowser } from '../utils/browser';

// In-memory key pair storage (session-based)
// In production, use Web Crypto API's key storage API
const keyPairStore = new Map<string, CryptoKeyPair>();

/**
 * Store a key pair in memory for the current session
 * Note: This is a simplified implementation for development
 * In production, use Web Crypto API's persistent key storage
 */
export function storeKeyPairInMemory(username: string, keyPair: CryptoKeyPair): void {
  if (!isBrowser()) return;
  keyPairStore.set(username, keyPair);
}

/**
 * Get a key pair from memory
 * Note: This only works for the current session
 * In production, use Web Crypto API's key storage
 */
export function getKeyPairFromMemory(username: string): CryptoKeyPair | null {
  if (!isBrowser()) return null;
  return keyPairStore.get(username) || null;
}

/**
 * Clear a key pair from memory
 */
export function clearKeyPairFromMemory(username: string): void {
  if (!isBrowser()) return;
  keyPairStore.delete(username);
}

/**
 * Check if a key pair exists in memory
 */
export function hasKeyPairInMemory(username: string): boolean {
  if (!isBrowser()) return false;
  return keyPairStore.has(username);
}

/**
 * TODO: Implement persistent key storage using Web Crypto API's key storage
 * This would use IndexedDB and the Web Crypto API's key storage capabilities
 * to securely store non-extractable private keys
 */
export async function storeKeyPairPersistent(
  username: string,
  keyPair: CryptoKeyPair
): Promise<boolean> {
  // TODO: Implement using Web Crypto API's key storage
  // This would involve:
  // 1. Creating a key storage database in IndexedDB
  // 2. Storing the key pair using crypto.subtle's key storage API
  // 3. Retrieving it later using the same API
  console.warn('Persistent key storage not yet implemented. Using in-memory storage.');
  storeKeyPairInMemory(username, keyPair);
  return true;
}

/**
 * TODO: Retrieve key pair from persistent storage
 */
export async function getKeyPairPersistent(username: string): Promise<CryptoKeyPair | null> {
  // TODO: Implement retrieval from persistent storage
  return getKeyPairFromMemory(username);
}

