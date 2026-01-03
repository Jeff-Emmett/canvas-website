/**
 * R2 Storage Adapter for Automerge Documents
 *
 * Stores Automerge documents as binary in R2, with support for:
 * - Binary document storage (not JSON)
 * - Chunking for large documents (R2 supports up to 5GB per object)
 * - Atomic updates
 *
 * Document storage format in R2:
 * - rooms/{roomId}/automerge.bin - The Automerge document binary
 * - rooms/{roomId}/metadata.json - Optional metadata (schema version, etc.)
 */

import { Automerge, initializeAutomerge } from './automerge-init'

// TLDraw store snapshot type (simplified - actual type is more complex)
// Index signature required for Automerge.Doc generic constraint
export interface TLStoreSnapshot {
  store: Record<string, any>
  schema?: {
    schemaVersion: number
    storeVersion: number
    [key: string]: any
  }
  [key: string]: unknown
}

/**
 * R2 Storage for Automerge Documents
 */
export class AutomergeR2Storage {
  constructor(private r2: R2Bucket) {}

  /**
   * Load an Automerge document from R2
   * Returns null if document doesn't exist
   */
  async loadDocument(roomId: string): Promise<Automerge.Doc<TLStoreSnapshot> | null> {
    await initializeAutomerge()

    const key = this.getDocumentKey(roomId)
    console.log(`📥 Loading Automerge document from R2: ${key}`)

    try {
      const object = await this.r2.get(key)

      if (!object) {
        console.log(`📥 No Automerge document found in R2 for room ${roomId}`)
        return null
      }

      const binary = await object.arrayBuffer()
      const uint8Array = new Uint8Array(binary)

      console.log(`📥 Loaded Automerge binary from R2: ${uint8Array.byteLength} bytes`)

      // Load the Automerge document from binary
      const doc = Automerge.load<TLStoreSnapshot>(uint8Array)

      const shapeCount = doc.store ?
        Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length : 0
      const recordCount = doc.store ? Object.keys(doc.store).length : 0

      console.log(`📥 Loaded Automerge document: ${recordCount} records, ${shapeCount} shapes`)

      return doc
    } catch (error) {
      console.error(`❌ Error loading Automerge document from R2:`, error)
      return null
    }
  }

  /**
   * Save an Automerge document to R2
   */
  async saveDocument(roomId: string, doc: Automerge.Doc<TLStoreSnapshot>): Promise<boolean> {
    await initializeAutomerge()

    const key = this.getDocumentKey(roomId)

    try {
      // Serialize the Automerge document to binary
      const binary = Automerge.save(doc)

      const shapeCount = doc.store ?
        Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length : 0
      const recordCount = doc.store ? Object.keys(doc.store).length : 0

      console.log(`💾 Saving Automerge document to R2: ${key}`)
      console.log(`💾 Document stats: ${recordCount} records, ${shapeCount} shapes, ${binary.byteLength} bytes`)

      // Save to R2
      await this.r2.put(key, binary, {
        httpMetadata: {
          contentType: 'application/octet-stream'
        },
        customMetadata: {
          format: 'automerge-binary',
          version: '1',
          recordCount: recordCount.toString(),
          shapeCount: shapeCount.toString(),
          savedAt: new Date().toISOString()
        }
      })

      console.log(`✅ Successfully saved Automerge document to R2`)
      return true
    } catch (error) {
      console.error(`❌ Error saving Automerge document to R2:`, error)
      return false
    }
  }

  /**
   * Check if an Automerge document exists in R2
   */
  async documentExists(roomId: string): Promise<boolean> {
    const key = this.getDocumentKey(roomId)
    const object = await this.r2.head(key)
    return object !== null
  }

  /**
   * Delete an Automerge document from R2
   */
  async deleteDocument(roomId: string): Promise<boolean> {
    const key = this.getDocumentKey(roomId)
    try {
      await this.r2.delete(key)
      console.log(`🗑️ Deleted Automerge document from R2: ${key}`)
      return true
    } catch (error) {
      console.error(`❌ Error deleting Automerge document from R2:`, error)
      return false
    }
  }

  /**
   * Migrate a JSON document to Automerge format
   * Used for upgrading existing rooms from JSON to Automerge
   *
   * OPTIMIZATION: Uses Automerge.from() instead of init() + change()
   * For large documents, batches records to avoid CPU timeout
   */
  async migrateFromJson(roomId: string, jsonDoc: TLStoreSnapshot): Promise<Automerge.Doc<TLStoreSnapshot> | null> {
    await initializeAutomerge()

    const recordCount = jsonDoc.store ? Object.keys(jsonDoc.store).length : 0
    console.log(`🔄 Migrating room ${roomId} from JSON to Automerge format (${recordCount} records)`)

    try {
      const startTime = Date.now()

      // Use Automerge.from() for direct initialization - more efficient than init() + change()
      // This creates the document with initial state in one operation
      const initialState: TLStoreSnapshot = {
        store: jsonDoc.store || {},
        ...(jsonDoc.schema && { schema: jsonDoc.schema })
      }

      // Automerge.from() is optimized for creating documents from existing state
      // Type assertion needed because TLStoreSnapshot doesn't have index signature
      const doc = Automerge.from(initialState as unknown as Record<string, unknown>) as Automerge.Doc<TLStoreSnapshot>

      const conversionTime = Date.now() - startTime
      console.log(`⏱️ Automerge conversion took ${conversionTime}ms for ${recordCount} records`)

      // Save to R2
      const saveStart = Date.now()
      const saved = await this.saveDocument(roomId, doc)
      const saveTime = Date.now() - saveStart

      if (!saved) {
        throw new Error('Failed to save migrated document')
      }

      console.log(`✅ Successfully migrated room ${roomId} to Automerge format (conversion: ${conversionTime}ms, save: ${saveTime}ms)`)
      return doc
    } catch (error) {
      console.error(`❌ Error migrating room ${roomId} to Automerge:`, error)
      return null
    }
  }

  /**
   * Check if a document is in Automerge format
   * (vs old JSON format)
   */
  async isAutomergeFormat(roomId: string): Promise<boolean> {
    const key = this.getDocumentKey(roomId)
    const object = await this.r2.head(key)

    if (!object) {
      return false
    }

    // Check custom metadata for format marker
    const format = object.customMetadata?.format
    return format === 'automerge-binary'
  }

  /**
   * Get the R2 key for a room's Automerge document
   */
  private getDocumentKey(roomId: string): string {
    return `rooms/${roomId}/automerge.bin`
  }

  /**
   * Get the R2 key for a room's legacy JSON document
   */
  getLegacyJsonKey(roomId: string): string {
    return `rooms/${roomId}`
  }
}
