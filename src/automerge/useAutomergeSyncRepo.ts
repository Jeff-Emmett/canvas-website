import { useMemo, useEffect, useState, useCallback, useRef } from "react"
import { TLStoreSnapshot, InstancePresenceRecordType, getIndexAbove, IndexKey } from "@tldraw/tldraw"
import { CloudflareNetworkAdapter, ConnectionState } from "./CloudflareAdapter"
import { useAutomergeStoreV2, useAutomergePresence } from "./useAutomergeStoreV2"
import { TLStoreWithStatus } from "@tldraw/tldraw"
import { Repo, parseAutomergeUrl, stringifyAutomergeUrl, AutomergeUrl, DocumentId } from "@automerge/automerge-repo"
import { DocHandle } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { getDocumentId, saveDocumentId } from "./documentIdMapping"

/**
 * Validate if an index is a valid tldraw fractional index
 * Valid indices: "a0", "a1", "a1V", "a24sT", "a1V4rr", "Zz", etc.
 * Invalid indices: "b1", "c2", or any simple letter+number that isn't a valid fractional index
 *
 * tldraw uses fractional indexing where indices are strings that can be compared lexicographically
 * The format allows inserting new items between any two existing items without renumbering.
 * Based on: https://observablehq.com/@dgreensp/implementing-fractional-indexing
 */
function isValidTldrawIndex(index: string): boolean {
  if (!index || typeof index !== 'string' || index.length === 0) return false

  // tldraw uses fractional indexing where:
  // - First character is a lowercase letter indicating integer part length (a=1, b=2, c=3, etc.)
  // - Followed by alphanumeric characters for the value and optional jitter
  // Examples: "a0", "a1", "b10", "b99", "c100", "a1V4rr", "b10Lz"
  //
  // Also uppercase letters for negative indices (Z=1, Y=2, etc.)

  // Valid fractional index: lowercase letter followed by alphanumeric characters
  if (/^[a-z][a-zA-Z0-9]+$/.test(index)) {
    return true
  }

  // Also allow uppercase prefix for negative/very high indices
  if (/^[A-Z][a-zA-Z0-9]+$/.test(index)) {
    return true
  }

  return false
}

/**
 * Migrate old data to fix invalid index values
 * tldraw requires indices to be in a specific format (fractional indexing)
 * Old data may have simple indices like "b1" which are invalid
 */
function migrateStoreData(store: Record<string, any>): Record<string, any> {
  if (!store) return store

  const migratedStore: Record<string, any> = {}
  let currentIndex: IndexKey = 'a1' as IndexKey // Start with a valid index

  // Sort shapes by their old index to maintain relative ordering
  const entries = Object.entries(store)
  const shapes = entries.filter(([_, record]) => record?.typeName === 'shape')
  const nonShapes = entries.filter(([_, record]) => record?.typeName !== 'shape')

  // Check if any shapes have invalid indices
  const hasInvalidIndices = shapes.some(([_, record]) => {
    const index = record?.index
    if (!index) return false
    return !isValidTldrawIndex(index)
  })

  if (!hasInvalidIndices) {
    // No migration needed
    return store
  }


  // Copy non-shape records as-is
  for (const [id, record] of nonShapes) {
    migratedStore[id] = record
  }

  // Sort shapes by their original index (alphabetically) to maintain order
  shapes.sort((a, b) => {
    const indexA = a[1]?.index || ''
    const indexB = b[1]?.index || ''
    return indexA.localeCompare(indexB)
  })

  // Regenerate valid indices for shapes
  for (const [id, record] of shapes) {
    const migratedRecord = { ...record }

    // Generate a new valid index
    try {
      currentIndex = getIndexAbove(currentIndex)
    } catch {
      // Fallback if getIndexAbove fails - generate simple sequential index
      const num = parseInt(currentIndex.slice(1) || '1') + 1
      currentIndex = `a${num}` as IndexKey
    }

    migratedRecord.index = currentIndex
    migratedStore[id] = migratedRecord
  }

  return migratedStore
}

interface AutomergeSyncConfig {
  uri: string
  assets?: any
  shapeUtils?: any[]
  bindingUtils?: any[]
  user?: {
    id: string
    name: string
  }
}

export function useAutomergeSync(config: AutomergeSyncConfig): TLStoreWithStatus & {
  handle: DocHandle<any> | null;
  presence: ReturnType<typeof useAutomergePresence>;
  connectionState: ConnectionState;
  isNetworkOnline: boolean;
} {
  const { uri, user } = config

  // Extract roomId from URI (e.g., "https://worker.com/connect/room123" -> "room123")
  const roomId = useMemo(() => {
    const match = uri.match(/\/connect\/([^\/]+)$/)
    return match ? match[1] : "default-room"
  }, [uri])

  // Extract worker URL from URI (remove /connect/roomId part)
  const workerUrl = useMemo(() => {
    return uri.replace(/\/connect\/.*$/, '')
  }, [uri])

  const [handle, setHandle] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [isNetworkOnline, setIsNetworkOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  // Sync version counter - increments when server data is merged, forces re-render
  const [syncVersion, setSyncVersion] = useState(0)
  const handleRef = useRef<any>(null)
  const storeRef = useRef<any>(null)
  const adapterRef = useRef<any>(null)
  
  // Update refs when handle/store changes
  useEffect(() => {
    handleRef.current = handle
  }, [handle])
  
  // JSON sync callback - receives changed records from other clients
  // Apply to Automerge document which will emit patches to update the store
  const applyJsonSyncData = useCallback((data: TLStoreSnapshot & { deleted?: string[] }) => {
    const currentHandle = handleRef.current
    if (!currentHandle || (!data?.store && !data?.deleted)) {
      console.warn('⚠️ Cannot apply JSON sync - no handle or data')
      return
    }

    const changedRecordCount = data.store ? Object.keys(data.store).length : 0
    const shapeRecords = data.store ? Object.values(data.store).filter((r: any) => r?.typeName === 'shape') : []
    const deletedRecordIds = data.deleted || []
    const deletedShapes = deletedRecordIds.filter(id => id.startsWith('shape:'))

    // Apply changes to the Automerge document
    // This will trigger patches which will update the TLDraw store
    // NOTE: We do NOT increment pendingLocalChanges here because these are REMOTE changes
    // that we WANT to be processed by automergeChangeHandler and applied to the store
    currentHandle.change((doc: any) => {
      if (!doc.store) {
        doc.store = {}
      }
      // Merge the changed records into the Automerge document
      if (data.store) {
        Object.entries(data.store).forEach(([id, record]) => {
          doc.store[id] = record
        })
      }
      // Delete records that were removed on the other client
      if (deletedRecordIds.length > 0) {
        deletedRecordIds.forEach(id => {
          if (doc.store[id]) {
            delete doc.store[id]
          }
        })
      }
    })

  }, [])

  // Presence update batching to prevent "Maximum update depth exceeded" errors
  // We batch presence updates and apply them in a single mergeRemoteChanges call
  const pendingPresenceUpdates = useRef<Map<string, any>>(new Map())
  const presenceUpdateTimer = useRef<NodeJS.Timeout | null>(null)
  const PRESENCE_BATCH_INTERVAL_MS = 16 // ~60fps, batch updates every frame

  // Flush pending presence updates to the store
  const flushPresenceUpdates = useCallback(() => {
    const currentStore = storeRef.current
    if (!currentStore || pendingPresenceUpdates.current.size === 0) {
      return
    }

    const updates = Array.from(pendingPresenceUpdates.current.values())
    pendingPresenceUpdates.current.clear()

    try {
      currentStore.mergeRemoteChanges(() => {
        currentStore.put(updates)
      })
    } catch (error) {
      console.error('❌ Error flushing presence updates:', error)
    }
  }, [])

  // Presence update callback - applies presence from other clients
  // Presence is ephemeral (cursors, selections) and goes directly to the store
  // Note: This callback is passed to the adapter but accesses storeRef which updates later
  const applyPresenceUpdate = useCallback((userId: string, presenceData: any, senderId?: string, userName?: string, userColor?: string) => {
    // CRITICAL: Don't apply our own presence back to ourselves (avoid echo)
    // Use senderId (sessionId) instead of userId since multiple users can have the same userId
    const currentAdapter = adapterRef.current
    const ourSessionId = currentAdapter?.sessionId

    if (senderId && ourSessionId && senderId === ourSessionId) {
      return
    }

    // Access the CURRENT store ref (not captured in closure)
    const currentStore = storeRef.current

    if (!currentStore) {
      return
    }

    try {
      // CRITICAL: Transform remote user's instance/pointer/page_state into a proper instance_presence record
      // TLDraw expects instance_presence records for remote users, not their local instance records

      // Extract data from the presence message
      const pointerRecord = presenceData['pointer:pointer']
      const pageStateRecord = presenceData['instance_page_state:page:page']
      const instanceRecord = presenceData['instance:instance']

      if (!pointerRecord) {
        return
      }

      // Create a proper instance_presence record for this remote user
      // Use senderId to create a unique presence ID for each session
      const presenceId = InstancePresenceRecordType.createId(senderId || userId)

      const instancePresence = InstancePresenceRecordType.create({
        id: presenceId,
        currentPageId: pageStateRecord?.pageId || 'page:page', // Default to main page
        userId: userId,
        userName: userName || userId, // Use provided userName or fall back to userId
        color: userColor || '#000000', // Use provided color or default to black
        cursor: {
          x: pointerRecord.x || 0,
          y: pointerRecord.y || 0,
          type: pointerRecord.type || 'default',
          rotation: pointerRecord.rotation || 0
        },
        chatMessage: '', // Empty by default
        lastActivityTimestamp: Date.now()
      })

      // Queue the presence update for batched application
      pendingPresenceUpdates.current.set(presenceId, instancePresence)

      // Schedule a flush if not already scheduled
      if (!presenceUpdateTimer.current) {
        presenceUpdateTimer.current = setTimeout(() => {
          presenceUpdateTimer.current = null
          flushPresenceUpdates()
        }, PRESENCE_BATCH_INTERVAL_MS)
      }

    } catch (error) {
      console.error('❌ Error applying presence:', error)
    }
  }, [flushPresenceUpdates])

  // Handle presence leave - remove the user's presence record from the store
  const handlePresenceLeave = useCallback((sessionId: string) => {
    const currentStore = storeRef.current
    if (!currentStore) return

    try {
      // Find and remove the presence record for this session
      // Presence IDs are formatted as "instance_presence:{sessionId}"
      const presenceId = `instance_presence:${sessionId}`

      // Check if this record exists before trying to remove it
      const allRecords = currentStore.allRecords()
      const presenceRecord = allRecords.find((r: any) =>
        r.id === presenceId ||
        r.id?.includes(sessionId)
      )

      if (presenceRecord) {
        currentStore.remove([presenceRecord.id])
      }
    } catch (error) {
      console.error('Error removing presence on leave:', error)
    }
  }, [])

  const { repo, adapter, storageAdapter } = useMemo(() => {
    const adapter = new CloudflareNetworkAdapter(
      workerUrl,
      roomId,
      applyJsonSyncData,
      applyPresenceUpdate,
      handlePresenceLeave
    )

    // Store adapter ref for use in callbacks
    adapterRef.current = adapter

    // Create IndexedDB storage adapter for offline persistence
    // This stores Automerge documents locally in the browser
    const storageAdapter = new IndexedDBStorageAdapter()

    const repo = new Repo({
      network: [adapter],
      storage: storageAdapter, // Add IndexedDB storage for offline support
      // Enable sharing of all documents with all peers
      sharePolicy: async () => true
    })

    // Log when sync messages are sent/received
    adapter.on('message', (_msg: any) => {
      // Message received from network
    })

    return { repo, adapter, storageAdapter }
  }, [workerUrl, roomId, applyJsonSyncData, applyPresenceUpdate, handlePresenceLeave])

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = adapter.onConnectionStateChange((state) => {
      setConnectionState(state)
      setIsNetworkOnline(adapter.isNetworkOnline)
    })
    return unsubscribe
  }, [adapter])

  // Initialize Automerge document handle
  useEffect(() => {
    let mounted = true

    const initializeHandle = async () => {
      try {
        // OFFLINE-FIRST: Load from IndexedDB immediately, don't wait for network
        // Network sync happens in the background after local data is loaded

        let handle: DocHandle<TLStoreSnapshot>
        let loadedFromLocal = false

        // Check if we have a stored document ID mapping for this room
        // This allows us to load the same document from IndexedDB on subsequent visits
        const storedDocumentId = await getDocumentId(roomId)

        if (storedDocumentId) {
          try {
            // Parse the URL to get the DocumentId
            const parsed = parseAutomergeUrl(storedDocumentId as AutomergeUrl)
            const docId = parsed.documentId

            // Check if the document is already loaded in the repo's handles cache
            // This prevents "Cannot create a reference to an existing document object" error
            const existingHandle = repo.handles[docId] as DocHandle<TLStoreSnapshot> | undefined

            let foundHandle: DocHandle<TLStoreSnapshot>
            if (existingHandle) {
              foundHandle = existingHandle
            } else {
              // Try to find the existing document in the repo (loads from IndexedDB)
              // repo.find() returns a Promise<DocHandle>
              foundHandle = await repo.find<TLStoreSnapshot>(storedDocumentId as AutomergeUrl)
            }
            await foundHandle.whenReady()
            handle = foundHandle

            // Check if document has data
            const localDoc = handle.doc()
            const localRecordCount = localDoc?.store ? Object.keys(localDoc.store).length : 0
            const localShapeCount = localDoc?.store ? Object.values(localDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0

            if (localRecordCount > 0) {

              // CRITICAL: Migrate local IndexedDB data to fix any invalid indices
              // This ensures shapes with old-format indices like "b1" are fixed
              if (localDoc?.store) {
                const migratedStore = migrateStoreData(localDoc.store)
                if (migratedStore !== localDoc.store) {
                  handle.change((doc: any) => {
                    doc.store = migratedStore
                  })
                }
              }

              loadedFromLocal = true
            } else {
            }
          } catch (error) {
            console.warn(`Failed to load document ${storedDocumentId} from IndexedDB:`, error)
            // Fall through to create a new document
          }
        }

        // If we didn't load from local storage, create a new document
        if (!loadedFromLocal || !handle!) {
          handle = repo.create<TLStoreSnapshot>()
          await handle.whenReady()

          // Save the mapping between roomId and the new document ID
          const documentId = handle.url
          if (documentId) {
            await saveDocumentId(roomId, documentId)
          }
        }

        if (!mounted) return

        // OFFLINE-FIRST: Set the handle and mark as ready BEFORE network sync
        // This allows the UI to render immediately with local data
        if (handle.url) {
          adapter.setDocumentId(handle.url)
        }

        // If we loaded from local, set handle immediately so UI can render
        if (loadedFromLocal) {
          const localDoc = handle.doc() as any
          const localShapeCount = localDoc?.store ? Object.values(localDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
          setHandle(handle)
          setIsLoading(false)
        }

        // Sync with server in the background (non-blocking for offline-first)
        // This runs in parallel - if it fails, we still have local data
        const syncWithServer = async () => {
          try {
            // Wait for network adapter with a timeout
            const networkReadyPromise = adapter.whenReady()
            const timeoutPromise = new Promise<'timeout'>((resolve) =>
              setTimeout(() => resolve('timeout'), 5000)
            )

            const result = await Promise.race([networkReadyPromise, timeoutPromise])

            if (result === 'timeout') {
              // If we haven't set the handle yet (no local data), set it now
              if (!loadedFromLocal && mounted) {
                setHandle(handle)
                setIsLoading(false)
              }
              return
            }

            if (!mounted) return

            const response = await fetch(`${workerUrl}/room/${roomId}`)
            if (response.ok) {
              let serverDoc = await response.json() as TLStoreSnapshot

              // Migrate server data to fix any invalid indices
              if (serverDoc.store) {
                serverDoc = {
                  ...serverDoc,
                  store: migrateStoreData(serverDoc.store)
                }
              }

              const serverShapeCount = serverDoc.store ? Object.values(serverDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
              const serverRecordCount = Object.keys(serverDoc.store || {}).length

              // Get current local state
              const localDoc = handle.doc()
              const localRecordCount = localDoc?.store ? Object.keys(localDoc.store).length : 0

              // Merge server data with local data
              // Strategy:
              // 1. If local has NO SHAPES (only ephemeral records), use server data
              // 2. If server has SIGNIFICANTLY MORE shapes (10x), prefer server (stale local cache)
              // 3. Otherwise, only add server records that don't exist locally
              //    (preserve offline changes, let Automerge CRDT sync handle conflicts)
              if (serverDoc.store && serverRecordCount > 0) {
                handle.change((doc: any) => {
                  // Initialize store if it doesn't exist
                  if (!doc.store) {
                    doc.store = {}
                  }

                  // Count LOCAL SHAPES (not just records - ignore ephemeral camera/instance records)
                  const localShapeCount = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
                  const localIsEmpty = Object.keys(doc.store).length === 0

                  // Server has significantly more shapes - local is likely stale cache
                  // Use 10x threshold or server has shapes but local has none
                  const serverHasSignificantlyMore = (
                    localShapeCount === 0 && serverShapeCount > 0
                  ) || (
                    serverShapeCount > 0 && localShapeCount > 0 && serverShapeCount >= localShapeCount * 10
                  )

                  // If local has no shapes but server does, or server has 10x more,
                  // replace local with server data (but keep local ephemeral records)
                  const shouldPreferServer = localIsEmpty || localShapeCount === 0 || serverHasSignificantlyMore

                  let addedFromServer = 0
                  let skippedExisting = 0
                  let replacedFromServer = 0

                  Object.entries(serverDoc.store).forEach(([id, record]) => {
                    if (shouldPreferServer) {
                      // Prefer server data - bootstrap or replace stale local
                      if (doc.store[id]) {
                        replacedFromServer++
                      } else {
                        addedFromServer++
                      }
                      doc.store[id] = record
                    } else if (!doc.store[id]) {
                      // Local has data but missing this record - add from server
                      // This handles: shapes created on another device and synced to R2
                      doc.store[id] = record
                      addedFromServer++
                    } else {
                      // Record exists locally - preserve local version
                      // The Automerge binary sync will handle merging conflicts via CRDT
                      // This preserves offline edits to existing shapes
                      skippedExisting++
                    }
                  })

                  console.log(`🔄 Server sync: added=${addedFromServer}, replaced=${replacedFromServer}, skipped=${skippedExisting}, shouldPreferServer=${shouldPreferServer}`)
                })

                const finalDoc = handle.doc()
                const finalRecordCount = finalDoc?.store ? Object.keys(finalDoc.store).length : 0

                // CRITICAL: Force React to re-render after merging server data
                // The handle object reference doesn't change, so we increment syncVersion
                if ((addedFromServer > 0 || replacedFromServer > 0) && mounted) {
                  console.log(`🔄 Forcing UI update after server sync (${addedFromServer + replacedFromServer} records merged)`)
                  // Increment sync version to trigger React re-render
                  setSyncVersion(v => v + 1)
                }
              } else if (!loadedFromLocal) {
                // Server is empty and we didn't load from local - fresh start
              }
            } else if (response.status === 404) {
              // No document found on server
              if (loadedFromLocal) {
              } else {
              }
            } else {
              console.warn(`Failed to load document from server: ${response.status} ${response.statusText}`)
            }
          } catch (error) {
            // Network error - continue with local data if available
            if (loadedFromLocal) {
            } else {
              console.error("Error loading from server (offline?):", error)
            }
          }

          // Verify final document state
          const finalDoc = handle.doc() as any
          const finalStoreKeys = finalDoc?.store ? Object.keys(finalDoc.store).length : 0
          const finalShapeCount = finalDoc?.store ? Object.values(finalDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0

          // If we haven't set the handle yet (no local data), set it now after server sync
          if (!loadedFromLocal && mounted) {
            setHandle(handle)
            setIsLoading(false)
          }
        }

        // Start server sync in background (don't await - non-blocking)
        syncWithServer()

      } catch (error) {
        console.error("Error initializing Automerge handle:", error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializeHandle()

    return () => {
      mounted = false
      // Clear any pending presence update timer
      if (presenceUpdateTimer.current) {
        clearTimeout(presenceUpdateTimer.current)
        presenceUpdateTimer.current = null
      }
      // Disconnect adapter on unmount to clean up WebSocket connection
      if (adapter) {
        adapter.disconnect?.()
      }
    }
  }, [repo, adapter, roomId, workerUrl])

  // BINARY CRDT SYNC: The Automerge Repo now handles sync automatically via the NetworkAdapter
  // The NetworkAdapter sends binary sync messages when documents change
  // Local persistence is handled by IndexedDB via the storage adapter
  // Server persistence is handled by the worker receiving binary sync messages
  //
  // We keep a lightweight change logger for debugging, but no HTTP POST sync
  useEffect(() => {
    if (!handle) return

    // Listen for changes to log sync activity (debugging only)
    const changeHandler = (payload: any) => {
      const patchCount = payload.patches?.length || 0

      if (!patchCount) return

      // Filter out ephemeral record changes for logging
      const ephemeralIdPatterns = [
        'instance:',
        'instance_page_state:',
        'instance_presence:',
        'camera:',
        'pointer:'
      ]

      const hasOnlyEphemeralChanges = payload.patches.every((p: any) => {
        const id = p.path?.[1]
        if (!id || typeof id !== 'string') return false
        return ephemeralIdPatterns.some(pattern => id.startsWith(pattern))
      })

      if (hasOnlyEphemeralChanges) {
        // Don't log ephemeral changes
        return
      }

    }

    handle.on('change', changeHandler)

    return () => {
      handle.off('change', changeHandler)
    }
  }, [handle])

  // Generate a unique color for each user based on their userId
  const generateUserColor = (userId: string): string => {
    // Use a simple hash of the userId to generate a consistent color
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    // Generate a vibrant color using HSL (hue varies, saturation and lightness fixed for visibility)
    const hue = hash % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  // Get user metadata for presence
  // Color is generated from the username (name) for consistency across sessions,
  // not from the unique session ID (userId) which changes per tab/session
  const userMetadata: { userId: string; name: string; color: string } = (() => {
    if (user && 'userId' in user) {
      const uid = (user as { userId: string; name: string; color?: string }).userId
      const name = (user as { userId: string; name: string; color?: string }).name
      return {
        userId: uid,
        name: name,
        // Use name for color (consistent across sessions), fall back to uid if no name
        color: (user as { userId: string; name: string; color?: string }).color || generateUserColor(name || uid)
      }
    }
    const uid = user?.id || 'anonymous'
    const name = user?.name || 'Anonymous'
    return {
      userId: uid,
      name: name,
      // Use name for color (consistent across sessions), fall back to uid if no name
      color: generateUserColor(name !== 'Anonymous' ? name : uid)
    }
  })()
  
  // Use useAutomergeStoreV2 to create a proper TLStore instance that syncs with Automerge
  const storeWithStatus = useAutomergeStoreV2({
    handle: handle || null as any,
    userId: userMetadata.userId,
    adapter: adapter, // Pass adapter for JSON sync broadcasting
    isNetworkOnline // Pass network state for offline support
  })
  
  // Update store ref when store is available
  useEffect(() => {
    if (storeWithStatus.store) {
      storeRef.current = storeWithStatus.store
    }
  }, [storeWithStatus.store])
  
  // Get presence data (only when handle is ready)
  const presence = useAutomergePresence({
    handle: handle || null,
    store: storeWithStatus.store || null,
    userMetadata,
    adapter: adapter // Pass adapter for presence broadcasting
  })

  return {
    ...storeWithStatus,
    handle,
    presence,
    connectionState,
    isNetworkOnline,
    syncVersion // Increments when server data is merged, forces re-render
  }
}
