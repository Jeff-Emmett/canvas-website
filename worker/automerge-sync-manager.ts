/**
 * Automerge CRDT Sync Manager
 *
 * This is the core component that implements proper CRDT sync semantics:
 * - Maintains the authoritative Automerge document on the server
 * - Tracks sync states per connected peer
 * - Processes incoming sync messages with proper CRDT merge
 * - Generates outgoing sync messages (only deltas, not full documents)
 * - Ensures deletions are preserved across offline/reconnect scenarios
 *
 * @see https://automerge.org/docs/cookbook/real-time/
 */

import { Automerge, initializeAutomerge } from './automerge-init'
import { AutomergeR2Storage, TLStoreSnapshot } from './automerge-r2-storage'

interface SyncPeerState {
  syncState: Automerge.SyncState
  lastActivity: number
}

/**
 * Manages Automerge CRDT sync for a single room
 */
export class AutomergeSyncManager {
  private doc: Automerge.Doc<TLStoreSnapshot> | null = null
  private peerSyncStates: Map<string, SyncPeerState> = new Map()
  private storage: AutomergeR2Storage
  private roomId: string
  private isInitialized: boolean = false
  private initPromise: Promise<void> | null = null
  private pendingSave: boolean = false
  private saveTimeout: ReturnType<typeof setTimeout> | null = null

  // Throttle saves to avoid excessive R2 writes
  private readonly SAVE_DEBOUNCE_MS = 2000

  constructor(r2: R2Bucket, roomId: string) {
    this.storage = new AutomergeR2Storage(r2)
    this.roomId = roomId
  }

  /**
   * Initialize the sync manager
   * Loads document from R2 or creates new one
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._initialize()
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    await initializeAutomerge()

    console.log(`🔧 Initializing AutomergeSyncManager for room ${this.roomId}`)

    // Try to load existing document from R2
    let doc = await this.storage.loadDocument(this.roomId)

    if (!doc) {
      // Check if there's a legacy JSON document to migrate
      const legacyDoc = await this.loadLegacyJsonDocument()
      if (legacyDoc) {
        console.log(`🔄 Found legacy JSON document, migrating to Automerge format`)
        doc = await this.storage.migrateFromJson(this.roomId, legacyDoc)
      }
    }

    if (!doc) {
      // Create new empty document
      console.log(`📝 Creating new Automerge document for room ${this.roomId}`)
      doc = Automerge.init<TLStoreSnapshot>()
      doc = Automerge.change(doc, 'Initialize empty store', (d) => {
        d.store = {}
      })
    }

    this.doc = doc
    this.isInitialized = true

    const shapeCount = this.getShapeCount()
    console.log(`✅ AutomergeSyncManager initialized: ${shapeCount} shapes`)
  }

  /**
   * Load legacy JSON document from R2
   * Used for migration from old format
   */
  private async loadLegacyJsonDocument(): Promise<TLStoreSnapshot | null> {
    try {
      const key = this.storage.getLegacyJsonKey(this.roomId)
      const object = await (this.storage as any).r2?.get(key)
      if (object) {
        const json = await object.json()
        if (json?.store) {
          return json as TLStoreSnapshot
        }
      }
      return null
    } catch (error) {
      console.log(`No legacy JSON document found for room ${this.roomId}`)
      return null
    }
  }

  /**
   * Handle incoming binary sync message from a peer
   * This is the core CRDT merge operation
   *
   * @returns Response message to send back to the peer (or null if no response needed)
   */
  async receiveSyncMessage(peerId: string, message: Uint8Array): Promise<Uint8Array | null> {
    await this.initialize()

    if (!this.doc) {
      throw new Error('Document not initialized')
    }

    // Get or create sync state for this peer
    let peerState = this.peerSyncStates.get(peerId)
    if (!peerState) {
      peerState = {
        syncState: Automerge.initSyncState(),
        lastActivity: Date.now()
      }
      this.peerSyncStates.set(peerId, peerState)
      console.log(`🤝 New peer connected: ${peerId}`)
    }
    peerState.lastActivity = Date.now()

    const shapeCountBefore = this.getShapeCount()

    try {
      // CRITICAL: This is where CRDT merge happens!
      // Automerge.receiveSyncMessage properly merges changes from the peer
      // including deletions (tracked as operations, not absence)
      const [newDoc, newSyncState, _patch] = Automerge.receiveSyncMessage(
        this.doc,
        peerState.syncState,
        message
      )

      this.doc = newDoc
      peerState.syncState = newSyncState
      this.peerSyncStates.set(peerId, peerState)

      const shapeCountAfter = this.getShapeCount()

      if (shapeCountBefore !== shapeCountAfter) {
        console.log(`📊 Document changed: ${shapeCountBefore} → ${shapeCountAfter} shapes (peer: ${peerId})`)
      }

      // Schedule save to R2 (debounced)
      this.scheduleSave()

      // Generate response message (if we have changes to send back)
      const [nextSyncState, responseMessage] = Automerge.generateSyncMessage(
        this.doc,
        peerState.syncState
      )

      if (responseMessage) {
        peerState.syncState = nextSyncState
        this.peerSyncStates.set(peerId, peerState)
        console.log(`📤 Sending sync response to ${peerId}: ${responseMessage.byteLength} bytes`)
        return responseMessage
      }

      return null
    } catch (error) {
      console.error(`❌ Error processing sync message from ${peerId}:`, error)
      // Reset sync state for this peer on error
      this.peerSyncStates.delete(peerId)
      throw error
    }
  }

  /**
   * Generate initial sync message for a newly connected peer
   * This sends our current document state to bring them up to date
   */
  async generateSyncMessageForPeer(peerId: string): Promise<Uint8Array | null> {
    await this.initialize()

    if (!this.doc) {
      return null
    }

    // Get or create sync state for this peer
    let peerState = this.peerSyncStates.get(peerId)
    if (!peerState) {
      peerState = {
        syncState: Automerge.initSyncState(),
        lastActivity: Date.now()
      }
      this.peerSyncStates.set(peerId, peerState)
    }
    peerState.lastActivity = Date.now()

    // Generate sync message
    const [nextSyncState, message] = Automerge.generateSyncMessage(
      this.doc,
      peerState.syncState
    )

    if (message) {
      peerState.syncState = nextSyncState
      this.peerSyncStates.set(peerId, peerState)
      console.log(`📤 Generated initial sync message for ${peerId}: ${message.byteLength} bytes`)
      return message
    }

    return null
  }

  /**
   * Apply a local change to the document
   * Used when receiving JSON data from legacy clients
   */
  async applyLocalChange(
    description: string,
    changeFn: (doc: TLStoreSnapshot) => void
  ): Promise<void> {
    await this.initialize()

    if (!this.doc) {
      throw new Error('Document not initialized')
    }

    const shapeCountBefore = this.getShapeCount()

    this.doc = Automerge.change(this.doc, description, changeFn)

    const shapeCountAfter = this.getShapeCount()
    console.log(`📝 Applied local change: "${description}" (shapes: ${shapeCountBefore} → ${shapeCountAfter})`)

    this.scheduleSave()
  }

  /**
   * Get the current document as JSON
   * Used for legacy compatibility and debugging
   */
  async getDocumentJson(): Promise<TLStoreSnapshot | null> {
    await this.initialize()

    if (!this.doc) {
      return null
    }

    // Convert Automerge document to plain JSON
    return JSON.parse(JSON.stringify(this.doc)) as TLStoreSnapshot
  }

  /**
   * Handle peer disconnection
   * Clean up sync state and flush any pending saves
   */
  async handlePeerDisconnect(peerId: string): Promise<void> {
    if (this.peerSyncStates.has(peerId)) {
      this.peerSyncStates.delete(peerId)
      console.log(`👋 Peer disconnected: ${peerId}`)

      // If there's a pending save, flush it immediately to prevent data loss
      if (this.pendingSave) {
        console.log(`💾 Flushing pending save on peer disconnect`)
        await this.forceSave()
      }
    }
  }

  /**
   * Get the number of shapes in the document
   */
  getShapeCount(): number {
    if (!this.doc?.store) return 0
    return Object.values(this.doc.store).filter((r: any) => r?.typeName === 'shape').length
  }

  /**
   * Get the number of records in the document
   */
  getRecordCount(): number {
    if (!this.doc?.store) return 0
    return Object.keys(this.doc.store).length
  }

  /**
   * Schedule a save to R2 (debounced)
   */
  private scheduleSave(): void {
    this.pendingSave = true

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(async () => {
      if (this.pendingSave && this.doc) {
        this.pendingSave = false
        await this.storage.saveDocument(this.roomId, this.doc)
      }
    }, this.SAVE_DEBOUNCE_MS)
  }

  /**
   * Force immediate save to R2
   * Call this before shutting down
   */
  async forceSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    if (this.doc) {
      this.pendingSave = false
      await this.storage.saveDocument(this.roomId, this.doc)
    }
  }

  /**
   * Broadcast changes to all connected peers except the sender
   * Returns map of peerId -> sync message
   */
  async generateBroadcastMessages(excludePeerId?: string): Promise<Map<string, Uint8Array>> {
    const messages = new Map<string, Uint8Array>()

    for (const [peerId, peerState] of this.peerSyncStates) {
      if (peerId === excludePeerId) continue

      const [nextSyncState, message] = Automerge.generateSyncMessage(
        this.doc!,
        peerState.syncState
      )

      if (message) {
        peerState.syncState = nextSyncState
        this.peerSyncStates.set(peerId, peerState)
        messages.set(peerId, message)
      }
    }

    return messages
  }

  /**
   * Get list of connected peer IDs
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peerSyncStates.keys())
  }

  /**
   * Clean up stale peer connections (inactive for > 5 minutes)
   */
  cleanupStalePeers(): void {
    const STALE_THRESHOLD = 5 * 60 * 1000 // 5 minutes
    const now = Date.now()

    for (const [peerId, peerState] of this.peerSyncStates) {
      if (now - peerState.lastActivity > STALE_THRESHOLD) {
        console.log(`🧹 Cleaning up stale peer: ${peerId}`)
        this.peerSyncStates.delete(peerId)
      }
    }
  }

  // =============================================================================
  // Version History Methods
  // =============================================================================

  /**
   * Get the change history of the document
   * Returns a list of changes with timestamps and summaries
   */
  async getHistory(): Promise<HistoryEntry[]> {
    await this.initialize()

    if (!this.doc) {
      return []
    }

    try {
      // Get all changes from the document
      const changes = Automerge.getAllChanges(this.doc)
      const history: HistoryEntry[] = []

      for (const change of changes) {
        try {
          // Decode the change to get metadata
          const decoded = Automerge.decodeChange(change)

          history.push({
            hash: decoded.hash,
            timestamp: decoded.time ? new Date(decoded.time * 1000).toISOString() : null,
            message: decoded.message || null,
            actor: decoded.actor,
          })
        } catch (e) {
          console.warn('Failed to decode change:', e)
        }
      }

      // Sort by timestamp (newest first)
      history.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0
        if (!a.timestamp) return 1
        if (!b.timestamp) return -1
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      return history
    } catch (error) {
      console.error('Error getting history:', error)
      return []
    }
  }

  /**
   * Get a snapshot of the document at a specific point in history
   * @param hash - The change hash to view from
   */
  async getSnapshotAtHash(hash: string): Promise<TLStoreSnapshot | null> {
    await this.initialize()

    if (!this.doc) {
      return null
    }

    try {
      // Get all changes and find the index of the target hash
      const changes = Automerge.getAllChanges(this.doc)
      let targetIndex = -1

      for (let i = 0; i < changes.length; i++) {
        const decoded = Automerge.decodeChange(changes[i])
        if (decoded.hash === hash) {
          targetIndex = i
          break
        }
      }

      if (targetIndex === -1) {
        console.error('Change hash not found:', hash)
        return null
      }

      // Rebuild the document up to that point
      let historicalDoc = Automerge.init<TLStoreSnapshot>()
      for (let i = 0; i <= targetIndex; i++) {
        const [newDoc] = Automerge.applyChanges(historicalDoc, [changes[i]])
        historicalDoc = newDoc
      }

      return JSON.parse(JSON.stringify(historicalDoc)) as TLStoreSnapshot
    } catch (error) {
      console.error('Error getting snapshot at hash:', error)
      return null
    }
  }

  /**
   * Get the diff between two snapshots
   * Returns added, removed, and modified records
   */
  async getDiff(fromHash: string | null, toHash: string | null): Promise<SnapshotDiff | null> {
    await this.initialize()

    if (!this.doc) {
      return null
    }

    try {
      // Get the "from" snapshot (or empty if null)
      const fromSnapshot = fromHash
        ? await this.getSnapshotAtHash(fromHash)
        : { store: {} }

      // Get the "to" snapshot (or current if null)
      const toSnapshot = toHash
        ? await this.getSnapshotAtHash(toHash)
        : JSON.parse(JSON.stringify(this.doc)) as TLStoreSnapshot

      if (!fromSnapshot || !toSnapshot) {
        return null
      }

      const fromStore = fromSnapshot.store || {}
      const toStore = toSnapshot.store || {}

      const added: Record<string, any> = {}
      const removed: Record<string, any> = {}
      const modified: Record<string, { before: any; after: any }> = {}

      // Find added and modified records
      for (const [id, record] of Object.entries(toStore)) {
        if (!(id in fromStore)) {
          added[id] = record
        } else if (JSON.stringify(fromStore[id]) !== JSON.stringify(record)) {
          modified[id] = {
            before: fromStore[id],
            after: record,
          }
        }
      }

      // Find removed records
      for (const [id, record] of Object.entries(fromStore)) {
        if (!(id in toStore)) {
          removed[id] = record
        }
      }

      return { added, removed, modified }
    } catch (error) {
      console.error('Error getting diff:', error)
      return null
    }
  }

  /**
   * Revert the document to a specific point in history
   * This creates a new change that sets the document state to match the historical state
   * @param hash - The change hash to revert to
   */
  async revertToHash(hash: string): Promise<boolean> {
    await this.initialize()

    if (!this.doc) {
      return false
    }

    try {
      const historicalSnapshot = await this.getSnapshotAtHash(hash)
      if (!historicalSnapshot) {
        console.error('Could not get historical snapshot for hash:', hash)
        return false
      }

      // Apply the historical state as a new change
      this.doc = Automerge.change(this.doc, `Revert to ${hash.slice(0, 8)}`, (doc) => {
        doc.store = historicalSnapshot.store || {}
      })

      // Save to R2
      await this.forceSave()

      console.log(`✅ Reverted document to hash ${hash.slice(0, 8)}`)
      return true
    } catch (error) {
      console.error('Error reverting to hash:', error)
      return false
    }
  }
}

// =============================================================================
// History Types
// =============================================================================

export interface HistoryEntry {
  hash: string
  timestamp: string | null
  message: string | null
  actor: string
}

export interface SnapshotDiff {
  added: Record<string, any>
  removed: Record<string, any>
  modified: Record<string, { before: any; after: any }>
}
