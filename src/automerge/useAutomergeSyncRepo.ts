import { useMemo, useEffect, useState, useCallback, useRef } from "react"
import { TLStoreSnapshot, InstancePresenceRecordType, getIndexAbove, IndexKey } from "@tldraw/tldraw"
import { CloudflareNetworkAdapter } from "./CloudflareAdapter"
import { useAutomergeStoreV2, useAutomergePresence } from "./useAutomergeStoreV2"
import { TLStoreWithStatus } from "@tldraw/tldraw"
import { Repo, parseAutomergeUrl, stringifyAutomergeUrl, AutomergeUrl } from "@automerge/automerge-repo"
import { DocHandle } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { getDocumentId, saveDocumentId } from "./documentIdMapping"

/**
 * Validate if an index is a valid tldraw fractional index
 * Valid indices: "a0", "a1", "a1V", "a2", "Zz", etc.
 * Invalid indices: "b1", "c2", or any simple letter+number that isn't "a" followed by proper format
 *
 * tldraw uses fractional indexing where indices are strings that can be compared lexicographically
 * The format allows inserting new items between any two existing items without renumbering.
 */
function isValidTldrawIndex(index: string): boolean {
  if (!index || typeof index !== 'string') return false

  // Valid tldraw indices start with 'a' and can have various formats:
  // "a0", "a1", "a1V", "a1Vz", "Zz", etc.
  // The key insight is that indices NOT starting with 'a' (like 'b1', 'c1') are invalid
  // unless they're the special "Zz" format used for very high indices

  // Simple indices like "b1", "c1", "d1" are definitely invalid
  if (/^[b-z]\d+$/i.test(index)) {
    return false
  }

  // An index starting with 'a' followed by digits and optional letters is valid
  // e.g., "a0", "a1", "a1V", "a10", "a1Vz"
  if (/^a\d/.test(index)) {
    return true
  }

  // Other formats like "Zz" are also valid for high indices
  if (/^[A-Z]/.test(index)) {
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

  console.log('🔄 Migrating store data: fixing invalid shape indices')

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

  console.log(`✅ Migrated ${shapes.length} shapes with new indices`)
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

export function useAutomergeSync(config: AutomergeSyncConfig): TLStoreWithStatus & { handle: DocHandle<any> | null; presence: ReturnType<typeof useAutomergePresence> } {
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
  const handleRef = useRef<any>(null)
  const storeRef = useRef<any>(null)
  const adapterRef = useRef<any>(null)
  const lastSentHashRef = useRef<string | null>(null)
  const isMouseActiveRef = useRef<boolean>(false)
  const pendingSaveRef = useRef<boolean>(false)
  const saveFunctionRef = useRef<(() => void) | null>(null)
  
  // Generate a fast hash of the document state for change detection
  // OPTIMIZED: Avoid expensive JSON.stringify, use lightweight checksums instead
  const generateDocHash = useCallback((doc: any): string => {
    if (!doc || !doc.store) return ''
    const storeData = doc.store || {}
    const storeKeys = Object.keys(storeData).sort()
    
    // Fast hash using record IDs and lightweight checksums
    // Instead of JSON.stringify, use a combination of ID, type, and key property values
    let hash = 0
    for (const key of storeKeys) {
      // Skip ephemeral records
      if (key.startsWith('instance:') || 
          key.startsWith('instance_page_state:') || 
          key.startsWith('instance_presence:') ||
          key.startsWith('camera:') ||
          key.startsWith('pointer:')) {
        continue
      }
      
      const record = storeData[key]
      if (!record) continue
      
      // Use lightweight hash: ID + typeName + type (if shape) + key properties
      let recordHash = key
      if (record.typeName) recordHash += record.typeName
      if (record.type) recordHash += record.type
      
      // For shapes, include x, y, w, h for position/size changes
      if (record.typeName === 'shape') {
        if (typeof record.x === 'number') recordHash += `x${record.x}`
        if (typeof record.y === 'number') recordHash += `y${record.y}`
        if (typeof record.props?.w === 'number') recordHash += `w${record.props.w}`
        if (typeof record.props?.h === 'number') recordHash += `h${record.props.h}`
      }
      
      // Simple hash of the record string
      for (let i = 0; i < recordHash.length; i++) {
        const char = recordHash.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
    }
    return hash.toString(36)
  }, [])
  
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

    // Log incoming sync data for debugging
    console.log(`📥 Received JSON sync: ${changedRecordCount} records (${shapeRecords.length} shapes), ${deletedRecordIds.length} deletions (${deletedShapes.length} shapes)`)
    if (shapeRecords.length > 0) {
      shapeRecords.forEach((shape: any) => {
        console.log(`📥 Shape update: ${shape.type} ${shape.id}`, {
          x: shape.x,
          y: shape.y,
          w: shape.props?.w,
          h: shape.props?.h
        })
      })
    }
    if (deletedShapes.length > 0) {
      console.log(`📥 Shape deletions:`, deletedShapes)
    }

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

    console.log(`✅ Applied ${changedRecordCount} records and ${deletedRecordIds.length} deletions to Automerge document`)
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

      // Apply the instance_presence record using mergeRemoteChanges for atomic updates
      currentStore.mergeRemoteChanges(() => {
        currentStore.put([instancePresence])
      })

      // Presence applied for remote user
    } catch (error) {
      console.error('❌ Error applying presence:', error)
    }
  }, [])
  
  const { repo, adapter, storageAdapter } = useMemo(() => {
    const adapter = new CloudflareNetworkAdapter(
      workerUrl,
      roomId,
      applyJsonSyncData,
      applyPresenceUpdate
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
  }, [workerUrl, roomId, applyJsonSyncData, applyPresenceUpdate])

  // Initialize Automerge document handle
  useEffect(() => {
    let mounted = true

    const initializeHandle = async () => {
      try {
        // CRITICAL: Wait for the network adapter to be ready before creating document
        // This ensures the WebSocket connection is established for sync
        await adapter.whenReady()

        if (!mounted) return

        let handle: DocHandle<TLStoreSnapshot>
        let loadedFromLocal = false

        // Check if we have a stored document ID mapping for this room
        // This allows us to load the same document from IndexedDB on subsequent visits
        const storedDocumentId = await getDocumentId(roomId)

        if (storedDocumentId) {
          console.log(`Found stored document ID for room ${roomId}: ${storedDocumentId}`)
          try {
            // Try to find the existing document in the repo (loads from IndexedDB)
            // repo.find() returns a Promise<DocHandle>
            const foundHandle = await repo.find<TLStoreSnapshot>(storedDocumentId as AutomergeUrl)
            await foundHandle.whenReady()
            handle = foundHandle

            // Check if document has data
            const localDoc = handle.doc()
            const localRecordCount = localDoc?.store ? Object.keys(localDoc.store).length : 0
            const localShapeCount = localDoc?.store ? Object.values(localDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0

            if (localRecordCount > 0) {
              console.log(`Loaded document from IndexedDB: ${localRecordCount} records, ${localShapeCount} shapes`)

              // CRITICAL: Migrate local IndexedDB data to fix any invalid indices
              // This ensures shapes with old-format indices like "b1" are fixed
              if (localDoc?.store) {
                const migratedStore = migrateStoreData(localDoc.store)
                if (migratedStore !== localDoc.store) {
                  console.log('🔄 Applying index migration to local IndexedDB data')
                  handle.change((doc: any) => {
                    doc.store = migratedStore
                  })
                }
              }

              loadedFromLocal = true
            } else {
              console.log(`Document found in IndexedDB but is empty, will load from server`)
            }
          } catch (error) {
            console.warn(`Failed to load document ${storedDocumentId} from IndexedDB:`, error)
            // Fall through to create a new document
          }
        }

        // If we didn't load from local storage, create a new document
        if (!loadedFromLocal || !handle!) {
          console.log(`Creating new Automerge document for room ${roomId}`)
          handle = repo.create<TLStoreSnapshot>()
          await handle.whenReady()

          // Save the mapping between roomId and the new document ID
          const documentId = handle.url
          if (documentId) {
            await saveDocumentId(roomId, documentId)
            console.log(`Saved new document mapping: ${roomId} -> ${documentId}`)
          }
        }

        if (!mounted) return

        // Sync with server to get latest data (or upload local changes if offline was edited)
        // This ensures we're in sync even if we loaded from IndexedDB
        try {
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
            // Automerge handles conflict resolution automatically via CRDT
            if (serverDoc.store && serverRecordCount > 0) {
              handle.change((doc: any) => {
                // Initialize store if it doesn't exist
                if (!doc.store) {
                  doc.store = {}
                }
                // Merge server records - Automerge will handle conflicts
                Object.entries(serverDoc.store).forEach(([id, record]) => {
                  // Only add if not already present locally (local changes take precedence)
                  // This is a simple merge strategy - Automerge's CRDT will handle deeper conflicts
                  if (!doc.store[id]) {
                    doc.store[id] = record
                  }
                })
              })

              const finalDoc = handle.doc()
              const finalRecordCount = finalDoc?.store ? Object.keys(finalDoc.store).length : 0
              console.log(`Merged server data: server had ${serverRecordCount}, local had ${localRecordCount}, final has ${finalRecordCount} records`)
            } else if (!loadedFromLocal) {
              // Server is empty and we didn't load from local - fresh start
              console.log(`Starting fresh - no data on server or locally`)
            }
          } else if (response.status === 404) {
            // No document found on server
            if (loadedFromLocal) {
              console.log(`No server document, but loaded ${handle.doc()?.store ? Object.keys(handle.doc()!.store).length : 0} records from local storage`)
            } else {
              console.log(`No document found on server - starting fresh`)
            }
          } else {
            console.warn(`Failed to load document from server: ${response.status} ${response.statusText}`)
          }
        } catch (error) {
          // Network error - continue with local data if available
          if (loadedFromLocal) {
            console.log(`Offline mode: using local data from IndexedDB`)
          } else {
            console.error("Error loading from server (offline?):", error)
          }
        }

        // Verify final document state
        const finalDoc = handle.doc() as any
        const finalStoreKeys = finalDoc?.store ? Object.keys(finalDoc.store).length : 0
        const finalShapeCount = finalDoc?.store ? Object.values(finalDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
        console.log(`Automerge handle ready: ${finalStoreKeys} records, ${finalShapeCount} shapes (loaded from ${loadedFromLocal ? 'IndexedDB' : 'server/new'})`)

        setHandle(handle)
        setIsLoading(false)
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
      // Disconnect adapter on unmount to clean up WebSocket connection
      if (adapter) {
        adapter.disconnect?.()
      }
    }
  }, [repo, adapter, roomId, workerUrl])

  // Track mouse state to prevent persistence during active mouse interactions
  useEffect(() => {
    const handleMouseDown = () => {
      isMouseActiveRef.current = true
    }
    
    const handleMouseUp = () => {
      isMouseActiveRef.current = false
      // If there was a pending save, schedule it now that mouse is released
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        // Trigger save after a short delay to ensure mouse interaction is fully complete
        setTimeout(() => {
          // The save will be triggered by the next scheduled save or change event
          // We just need to ensure the mouse state is cleared
        }, 50)
      }
    }
    
    // Also track touch events for mobile
    const handleTouchStart = () => {
      isMouseActiveRef.current = true
    }
    
    const handleTouchEnd = () => {
      isMouseActiveRef.current = false
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
      }
    }
    
    // Add event listeners to document to catch all mouse interactions
    document.addEventListener('mousedown', handleMouseDown, { capture: true })
    document.addEventListener('mouseup', handleMouseUp, { capture: true })
    document.addEventListener('touchstart', handleTouchStart, { capture: true })
    document.addEventListener('touchend', handleTouchEnd, { capture: true })
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, { capture: true })
      document.removeEventListener('mouseup', handleMouseUp, { capture: true })
      document.removeEventListener('touchstart', handleTouchStart, { capture: true })
      document.removeEventListener('touchend', handleTouchEnd, { capture: true })
    }
  }, [])

  // Auto-save to Cloudflare on every change (with debouncing to prevent excessive calls)
  // CRITICAL: This ensures new shapes are persisted to R2
  useEffect(() => {
    if (!handle) return

    let saveTimeout: NodeJS.Timeout

    const saveDocumentToWorker = async () => {
      // CRITICAL: Don't save while mouse is active - this prevents interference with mouse interactions
      if (isMouseActiveRef.current) {
        console.log('⏸️ Deferring persistence - mouse is active')
        pendingSaveRef.current = true
        return
      }
      
      try {
        const doc = handle.doc()
        if (!doc || !doc.store) {
          console.log("🔍 No document to save yet")
          return
        }

        // Generate hash of current document state
        const currentHash = generateDocHash(doc)
        const lastHash = lastSentHashRef.current

        // Skip save if document hasn't changed
        if (currentHash === lastHash) {
          console.log('⏭️ Skipping persistence - document unchanged (hash matches)')
          return
        }

        // OPTIMIZED: Defer JSON.stringify to avoid blocking main thread
        // Use requestIdleCallback to serialize when browser is idle
        const storeKeys = Object.keys(doc.store).length
        
        // Defer expensive serialization to avoid blocking
        const serializedDoc = await new Promise<string>((resolve, reject) => {
          const serialize = () => {
            try {
              // Direct JSON.stringify - browser optimizes this internally
              // The key is doing it in an idle callback to not block interactions
              const json = JSON.stringify(doc)
              resolve(json)
            } catch (error) {
              reject(error)
            }
          }
          
          // Use requestIdleCallback if available to serialize when browser is idle
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(serialize, { timeout: 200 })
          } else {
            // Fallback: use setTimeout to defer to next event loop tick
            setTimeout(serialize, 0)
          }
        })
        
        // CRITICAL: Always log saves to help debug persistence issues
        const shapeCount = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
        console.log(`💾 Persisting document to worker for R2 storage: ${storeKeys} records, ${shapeCount} shapes`)
        
        // Send document state to worker via POST /room/:roomId
        // This updates the worker's currentDoc so it can be persisted to R2
        const response = await fetch(`${workerUrl}/room/${roomId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: serializedDoc,
        })

        if (!response.ok) {
          throw new Error(`Failed to save to worker: ${response.statusText}`)
        }

        // Update last sent hash only after successful save
        lastSentHashRef.current = currentHash
        pendingSaveRef.current = false
        // CRITICAL: Always log successful saves
        const finalShapeCount = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
        console.log(`✅ Successfully sent document state to worker for persistence (${finalShapeCount} shapes)`)
      } catch (error) {
        console.error('❌ Error saving document to worker:', error)
        pendingSaveRef.current = false
      }
    }

    // Store save function reference for mouse release handler
    saveFunctionRef.current = saveDocumentToWorker
    
    const scheduleSave = () => {
      // Clear existing timeout
      if (saveTimeout) clearTimeout(saveTimeout)
      
      // CRITICAL: Check if mouse is active before scheduling save
      if (isMouseActiveRef.current) {
        console.log('⏸️ Deferring save scheduling - mouse is active')
        pendingSaveRef.current = true
        // Schedule a check for when mouse is released
        const checkMouseState = () => {
          if (!isMouseActiveRef.current && pendingSaveRef.current) {
            pendingSaveRef.current = false
            // Mouse is released, schedule the save now
            requestAnimationFrame(() => {
              saveTimeout = setTimeout(saveDocumentToWorker, 3000)
            })
          } else if (isMouseActiveRef.current) {
            // Mouse still active, check again in 100ms
            setTimeout(checkMouseState, 100)
          }
        }
        setTimeout(checkMouseState, 100)
        return
      }
      
      // CRITICAL: Use requestIdleCallback if available to defer saves until browser is idle
      // This prevents saves from interrupting active interactions
      const schedule = () => {
        // Schedule save with a debounce (3 seconds) to batch rapid changes
        saveTimeout = setTimeout(saveDocumentToWorker, 3000)
      }
      
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(schedule, { timeout: 2000 })
      } else {
        requestAnimationFrame(schedule)
      }
    }

    // Listen for changes to the Automerge document
    const changeHandler = (payload: any) => {
      const patchCount = payload.patches?.length || 0
      
      if (!patchCount) {
        // No patches, nothing to save
        return
      }
      
      // CRITICAL: If mouse is active, defer all processing to avoid blocking mouse interactions
      if (isMouseActiveRef.current) {
        // Just mark that we have pending changes, process them when mouse is released
        pendingSaveRef.current = true
        return
      }
      
      // Process patches asynchronously to avoid blocking
      requestAnimationFrame(() => {
        // Double-check mouse state after animation frame
        if (isMouseActiveRef.current) {
          pendingSaveRef.current = true
          return
        }
        
        // Filter out ephemeral record changes - these shouldn't trigger persistence
        const ephemeralIdPatterns = [
          'instance:',
          'instance_page_state:',
          'instance_presence:',
          'camera:',
          'pointer:'
        ]
        
        // Quick check for ephemeral changes (lightweight)
        const hasOnlyEphemeralChanges = payload.patches.every((p: any) => {
          const id = p.path?.[1]
          if (!id || typeof id !== 'string') return false
          return ephemeralIdPatterns.some(pattern => id.startsWith(pattern))
        })
        
        // If all patches are for ephemeral records, skip persistence
        if (hasOnlyEphemeralChanges) {
          console.log('🚫 Skipping persistence - only ephemeral changes detected:', {
            patchCount
          })
          return
        }
        
        // Check if patches contain shape changes (lightweight check)
        const hasShapeChanges = payload.patches?.some((p: any) => {
          const id = p.path?.[1]
          return id && typeof id === 'string' && id.startsWith('shape:')
        })
        
        if (hasShapeChanges) {
          // Check if ALL patches are only position updates (x/y) for pinned-to-view shapes
          // These shouldn't trigger persistence since they're just keeping the shape in the same screen position
          // NOTE: We defer doc access to avoid blocking, but do lightweight path checks
          const allPositionUpdates = payload.patches.every((p: any) => {
            const shapeId = p.path?.[1]
            
            // If this is not a shape patch, it's not a position update
            if (!shapeId || typeof shapeId !== 'string' || !shapeId.startsWith('shape:')) {
              return false
            }
            
            // Check if this is a position update (x or y coordinate)
            // Path format: ['store', 'shape:xxx', 'x'] or ['store', 'shape:xxx', 'y']
            const pathLength = p.path?.length || 0
            return pathLength === 3 && (p.path[2] === 'x' || p.path[2] === 'y')
          })
          
          // If all patches are position updates, check if they're for pinned shapes
          // This requires doc access, so we defer it slightly
          if (allPositionUpdates && payload.patches.length > 0) {
            // Defer expensive doc access check
            setTimeout(() => {
              if (isMouseActiveRef.current) {
                pendingSaveRef.current = true
                return
              }
              
              const doc = handle.doc()
              const allPinned = payload.patches.every((p: any) => {
                const shapeId = p.path?.[1]
                if (!shapeId || typeof shapeId !== 'string' || !shapeId.startsWith('shape:')) {
                  return false
                }
                if (doc?.store?.[shapeId]) {
                  const shape = doc.store[shapeId]
                  return shape?.props?.pinnedToView === true
                }
                return false
              })
              
              if (allPinned) {
                console.log('🚫 Skipping persistence - only pinned-to-view position updates detected:', {
                  patchCount: payload.patches.length
                })
                return
              }
              
              // Not all pinned, schedule save
              scheduleSave()
            }, 0)
            return
          }
          
          const shapePatches = payload.patches.filter((p: any) => {
            const id = p.path?.[1]
            return id && typeof id === 'string' && id.startsWith('shape:')
          })
          
          // CRITICAL: Always log shape changes to debug persistence
          if (shapePatches.length > 0) {
            console.log('🔍 Automerge document changed with shape patches:', {
              patchCount: patchCount,
              shapePatches: shapePatches.length
            })
          }
        }
        
        // Schedule save to worker for persistence (only for non-ephemeral changes)
        scheduleSave()
      })
    }
    
    handle.on('change', changeHandler)

    // Don't save immediately on mount - only save when actual changes occur
    // The initial document load from server is already persisted, so we don't need to re-persist it

    return () => {
      handle.off('change', changeHandler)
      if (saveTimeout) clearTimeout(saveTimeout)
    }
  }, [handle, roomId, workerUrl, generateDocHash])

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
  const userMetadata: { userId: string; name: string; color: string } = (() => {
    if (user && 'userId' in user) {
      const uid = (user as { userId: string; name: string; color?: string }).userId
      return {
        userId: uid,
        name: (user as { userId: string; name: string; color?: string }).name,
        color: (user as { userId: string; name: string; color?: string }).color || generateUserColor(uid)
      }
    }
    const uid = user?.id || 'anonymous'
    return {
      userId: uid,
      name: user?.name || 'Anonymous',
      color: generateUserColor(uid)
    }
  })()
  
  // Use useAutomergeStoreV2 to create a proper TLStore instance that syncs with Automerge
  const storeWithStatus = useAutomergeStoreV2({
    handle: handle || null as any,
    userId: userMetadata.userId,
    adapter: adapter // Pass adapter for JSON sync broadcasting
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
    presence
  }
}
