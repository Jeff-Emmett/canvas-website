/**
 * IndexedDB mock utilities for testing offline storage
 * Uses fake-indexeddb for realistic IndexedDB simulation
 */

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

/**
 * Reset IndexedDB to a clean state between tests
 * This creates a fresh IDBFactory instance
 */
export function resetIndexedDB(): void {
  // Create new factory to clear all databases
  const newFactory = new IDBFactory()

  // Replace global indexedDB
  Object.defineProperty(globalThis, 'indexedDB', {
    value: newFactory,
    writable: true,
    configurable: true,
  })
}

/**
 * Get all database names (for debugging)
 */
export async function getDatabaseNames(): Promise<string[]> {
  const databases = await indexedDB.databases()
  return databases.map(db => db.name || '').filter(Boolean)
}

/**
 * Delete a specific database
 */
export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Create a test database with sample data
 */
export async function createTestMappingsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('canvas-document-mappings', 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const store = db.createObjectStore('mappings', { keyPath: 'roomId' })
      store.createIndex('documentId', 'documentId', { unique: false })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Seed test data into the mappings database
 */
export async function seedTestMapping(
  db: IDBDatabase,
  roomId: string,
  documentId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mappings', 'readwrite')
    const store = tx.objectStore('mappings')

    const request = store.put({
      roomId,
      documentId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
