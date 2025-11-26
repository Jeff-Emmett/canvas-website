/**
 * Document ID Mapping Utility
 *
 * Manages the mapping between room IDs (human-readable slugs) and
 * Automerge document IDs (automerge:xxxx format).
 *
 * This is necessary because:
 * - Automerge requires specific document ID formats
 * - We want to persist documents in IndexedDB with consistent IDs
 * - Room IDs are user-friendly slugs that may not match Automerge's format
 */

const DB_NAME = 'canvas-document-mappings'
const STORE_NAME = 'mappings'
const DB_VERSION = 1

interface DocumentMapping {
  roomId: string
  documentId: string
  createdAt: number
  lastAccessedAt: number
}

let dbInstance: IDBDatabase | null = null

/**
 * Open the IndexedDB database for document ID mappings
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open document mapping database:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'roomId' })
        store.createIndex('documentId', 'documentId', { unique: true })
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false })
      }
    }
  })
}

/**
 * Get the Automerge document ID for a given room ID
 * Returns null if no mapping exists
 */
export async function getDocumentId(roomId: string): Promise<string | null> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(roomId)

      request.onerror = () => {
        console.error('Failed to get document mapping:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const mapping = request.result as DocumentMapping | undefined
        if (mapping) {
          // Update last accessed time in background
          updateLastAccessed(roomId).catch(console.error)
          resolve(mapping.documentId)
        } else {
          resolve(null)
        }
      }
    })
  } catch (error) {
    console.error('Error getting document ID:', error)
    return null
  }
}

/**
 * Save a mapping between room ID and Automerge document ID
 */
export async function saveDocumentId(roomId: string, documentId: string): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const mapping: DocumentMapping = {
        roomId,
        documentId,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      }

      const request = store.put(mapping)

      request.onerror = () => {
        console.error('Failed to save document mapping:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`📝 Saved document mapping: ${roomId} → ${documentId}`)
        resolve()
      }
    })
  } catch (error) {
    console.error('Error saving document ID:', error)
    throw error
  }
}

/**
 * Update the last accessed timestamp for a room
 */
async function updateLastAccessed(roomId: string): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const getRequest = store.get(roomId)

      getRequest.onerror = () => reject(getRequest.error)

      getRequest.onsuccess = () => {
        const mapping = getRequest.result as DocumentMapping | undefined
        if (mapping) {
          mapping.lastAccessedAt = Date.now()
          store.put(mapping)
        }
        resolve()
      }
    })
  } catch (error) {
    // Silent fail for background update
  }
}

/**
 * Delete a document mapping (useful for cleanup)
 */
export async function deleteDocumentMapping(roomId: string): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(roomId)

      request.onerror = () => {
        console.error('Failed to delete document mapping:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`🗑️ Deleted document mapping for: ${roomId}`)
        resolve()
      }
    })
  } catch (error) {
    console.error('Error deleting document mapping:', error)
    throw error
  }
}

/**
 * Get all document mappings (useful for debugging/management)
 */
export async function getAllMappings(): Promise<DocumentMapping[]> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => {
        console.error('Failed to get all document mappings:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result as DocumentMapping[])
      }
    })
  } catch (error) {
    console.error('Error getting all mappings:', error)
    return []
  }
}

/**
 * Clean up old document mappings (documents not accessed in X days)
 * This helps manage storage quota
 */
export async function cleanupOldMappings(maxAgeDays: number = 30): Promise<number> {
  try {
    const db = await openDatabase()
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('lastAccessedAt')
      const range = IDBKeyRange.upperBound(cutoffTime)
      const request = index.openCursor(range)

      let deletedCount = 0

      request.onerror = () => {
        console.error('Failed to cleanup old mappings:', request.error)
        reject(request.error)
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          console.log(`🧹 Cleaned up ${deletedCount} old document mappings`)
          resolve(deletedCount)
        }
      }
    })
  } catch (error) {
    console.error('Error cleaning up old mappings:', error)
    return 0
  }
}
