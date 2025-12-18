/**
 * Unit tests for IndexedDB document mapping
 *
 * Tests the persistence layer that maps room IDs to Automerge document IDs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resetIndexedDB, createTestMappingsDB, seedTestMapping } from '../../mocks/indexeddb'

const DB_NAME = 'canvas-document-mappings'
const STORE_NAME = 'mappings'

describe('IndexedDB Document Mapping', () => {
  beforeEach(() => {
    // Reset IndexedDB for clean state
    resetIndexedDB()
  })

  describe('Database Setup', () => {
    it('can create mappings database', async () => {
      const db = await createTestMappingsDB()

      expect(db).toBeDefined()
      expect(db.name).toBe(DB_NAME)

      db.close()
    })

    it('database has correct object store', async () => {
      const db = await createTestMappingsDB()

      expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true)

      db.close()
    })

    it('object store has correct key path', async () => {
      const db = await createTestMappingsDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      expect(store.keyPath).toBe('roomId')

      db.close()
    })
  })

  describe('Save Document ID', () => {
    it('can save a room to document mapping', async () => {
      const db = await createTestMappingsDB()

      await seedTestMapping(db, 'room-123', 'automerge:abc123')

      // Verify it was saved
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('room-123')

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          expect(request.result).toBeDefined()
          expect(request.result.documentId).toBe('automerge:abc123')
          resolve()
        }
        request.onerror = () => reject(request.error)
      })

      db.close()
    })

    it('saves timestamp on creation', async () => {
      const db = await createTestMappingsDB()
      const beforeTime = Date.now()

      await seedTestMapping(db, 'room-456', 'automerge:def456')

      const afterTime = Date.now()

      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('room-456')

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          expect(request.result.createdAt).toBeGreaterThanOrEqual(beforeTime)
          expect(request.result.createdAt).toBeLessThanOrEqual(afterTime)
          resolve()
        }
        request.onerror = () => reject(request.error)
      })

      db.close()
    })

    it('can update existing mapping', async () => {
      const db = await createTestMappingsDB()

      // Save initial mapping
      await seedTestMapping(db, 'room-789', 'automerge:old-id')

      // Update with new document ID
      await seedTestMapping(db, 'room-789', 'automerge:new-id')

      // Verify update
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('room-789')

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          expect(request.result.documentId).toBe('automerge:new-id')
          resolve()
        }
        request.onerror = () => reject(request.error)
      })

      db.close()
    })
  })

  describe('Get Document ID', () => {
    it('retrieves existing mapping', async () => {
      const db = await createTestMappingsDB()
      await seedTestMapping(db, 'room-abc', 'automerge:xyz')

      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('room-abc')

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          expect(request.result).toBeDefined()
          expect(request.result.documentId).toBe('automerge:xyz')
          resolve()
        }
        request.onerror = () => reject(request.error)
      })

      db.close()
    })

    it('returns undefined for non-existent room', async () => {
      const db = await createTestMappingsDB()

      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('non-existent-room')

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          expect(request.result).toBeUndefined()
          resolve()
        }
        request.onerror = () => reject(request.error)
      })

      db.close()
    })
  })

  describe('Update Last Accessed', () => {
    it('updates lastAccessedAt timestamp', async () => {
      const db = await createTestMappingsDB()
      await seedTestMapping(db, 'room-update-test', 'automerge:test')

      // Get initial lastAccessedAt
      const tx1 = db.transaction(STORE_NAME, 'readonly')
      const store1 = tx1.objectStore(STORE_NAME)
      const initialRequest = store1.get('room-update-test')

      const initialTime = await new Promise<number>((resolve, reject) => {
        initialRequest.onsuccess = () => resolve(initialRequest.result.lastAccessedAt)
        initialRequest.onerror = () => reject(initialRequest.error)
      })

      // Wait a bit and update
      await new Promise(resolve => setTimeout(resolve, 10))

      const tx2 = db.transaction(STORE_NAME, 'readwrite')
      const store2 = tx2.objectStore(STORE_NAME)
      const getRequest = store2.get('room-update-test')

      await new Promise<void>((resolve, reject) => {
        getRequest.onsuccess = () => {
          const record = getRequest.result
          record.lastAccessedAt = Date.now()
          store2.put(record)
          resolve()
        }
        getRequest.onerror = () => reject(getRequest.error)
      })

      // Verify update
      const tx3 = db.transaction(STORE_NAME, 'readonly')
      const store3 = tx3.objectStore(STORE_NAME)
      const finalRequest = store3.get('room-update-test')

      await new Promise<void>((resolve, reject) => {
        finalRequest.onsuccess = () => {
          expect(finalRequest.result.lastAccessedAt).toBeGreaterThan(initialTime)
          resolve()
        }
        finalRequest.onerror = () => reject(finalRequest.error)
      })

      db.close()
    })
  })

  describe('Cleanup Old Mappings', () => {
    it('can delete old mappings', async () => {
      const db = await createTestMappingsDB()

      // Create an old mapping (manually set old timestamp)
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          roomId: 'old-room',
          documentId: 'automerge:old',
          createdAt: oldTimestamp,
          lastAccessedAt: oldTimestamp,
        })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Delete the old mapping
      const tx2 = db.transaction(STORE_NAME, 'readwrite')
      const store2 = tx2.objectStore(STORE_NAME)
      const deleteRequest = store2.delete('old-room')

      await new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      })

      // Verify deletion
      const tx3 = db.transaction(STORE_NAME, 'readonly')
      const store3 = tx3.objectStore(STORE_NAME)
      const getRequest = store3.get('old-room')

      await new Promise<void>((resolve, reject) => {
        getRequest.onsuccess = () => {
          expect(getRequest.result).toBeUndefined()
          resolve()
        }
        getRequest.onerror = () => reject(getRequest.error)
      })

      db.close()
    })

    it('preserves recent mappings during cleanup', async () => {
      const db = await createTestMappingsDB()

      // Create a recent mapping
      await seedTestMapping(db, 'recent-room', 'automerge:recent')

      // Create an old mapping
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000)

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          roomId: 'old-room',
          documentId: 'automerge:old',
          createdAt: oldTimestamp,
          lastAccessedAt: oldTimestamp,
        })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Simulate cleanup: delete only old entries
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days
      const cutoffTime = Date.now() - maxAge

      const tx2 = db.transaction(STORE_NAME, 'readwrite')
      const store2 = tx2.objectStore(STORE_NAME)
      const cursorRequest = store2.openCursor()

      await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (cursor) {
            if (cursor.value.lastAccessedAt < cutoffTime) {
              cursor.delete()
            }
            cursor.continue()
          } else {
            resolve()
          }
        }
        cursorRequest.onerror = () => reject(cursorRequest.error)
      })

      // Verify: recent still exists, old is deleted
      const tx3 = db.transaction(STORE_NAME, 'readonly')
      const store3 = tx3.objectStore(STORE_NAME)

      const recentRequest = store3.get('recent-room')
      const oldRequest = store3.get('old-room')

      await new Promise<void>((resolve, reject) => {
        let checkedRecent = false
        let checkedOld = false

        recentRequest.onsuccess = () => {
          expect(recentRequest.result).toBeDefined()
          checkedRecent = true
          if (checkedOld) resolve()
        }

        oldRequest.onsuccess = () => {
          expect(oldRequest.result).toBeUndefined()
          checkedOld = true
          if (checkedRecent) resolve()
        }

        recentRequest.onerror = () => reject(recentRequest.error)
        oldRequest.onerror = () => reject(oldRequest.error)
      })

      db.close()
    })
  })

  describe('Multiple Rooms', () => {
    it('can store multiple room mappings', async () => {
      const db = await createTestMappingsDB()

      await seedTestMapping(db, 'room-1', 'automerge:doc1')
      await seedTestMapping(db, 'room-2', 'automerge:doc2')
      await seedTestMapping(db, 'room-3', 'automerge:doc3')

      // Count all entries
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const countRequest = store.count()

      await new Promise<void>((resolve, reject) => {
        countRequest.onsuccess = () => {
          expect(countRequest.result).toBe(3)
          resolve()
        }
        countRequest.onerror = () => reject(countRequest.error)
      })

      db.close()
    })

    it('each room maps to correct document ID', async () => {
      const db = await createTestMappingsDB()

      const mappings = [
        { room: 'room-a', doc: 'automerge:aaa' },
        { room: 'room-b', doc: 'automerge:bbb' },
        { room: 'room-c', doc: 'automerge:ccc' },
      ]

      for (const m of mappings) {
        await seedTestMapping(db, m.room, m.doc)
      }

      // Verify each mapping
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      for (const m of mappings) {
        const request = store.get(m.room)
        await new Promise<void>((resolve, reject) => {
          request.onsuccess = () => {
            expect(request.result.documentId).toBe(m.doc)
            resolve()
          }
          request.onerror = () => reject(request.error)
        })
      }

      db.close()
    })
  })
})
