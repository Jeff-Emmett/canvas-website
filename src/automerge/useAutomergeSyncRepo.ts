import { useMemo, useEffect, useState, useCallback, useRef } from "react"
import { TLStoreSnapshot } from "@tldraw/tldraw"
import { CloudflareNetworkAdapter } from "./CloudflareAdapter"
import { useAutomergeStoreV2, useAutomergePresence } from "./useAutomergeStoreV2"
import { TLStoreWithStatus } from "@tldraw/tldraw"
import { Repo, DocHandle, DocumentId } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { getDocumentId, saveDocumentId } from "./documentIdMapping"

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

// Track online/offline status
export type ConnectionStatus = 'online' | 'offline' | 'syncing'

// Return type for useAutomergeSync - extends TLStoreWithStatus with offline capabilities
export interface AutomergeSyncResult {
  store?: TLStoreWithStatus['store']
  status: TLStoreWithStatus['status']
  error?: TLStoreWithStatus['error']
  handle: DocHandle<any> | null
  presence: ReturnType<typeof useAutomergePresence>
  connectionStatus: ConnectionStatus
  isOfflineReady: boolean
}

export function useAutomergeSync(config: AutomergeSyncConfig): AutomergeSyncResult {
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  )
  const [isOfflineReady, setIsOfflineReady] = useState(false)
  const handleRef = useRef<any>(null)
  const storeRef = useRef<any>(null)

  // Update refs when handle/store changes
  useEffect(() => {
    handleRef.current = handle
  }, [handle])

  // JSON sync is deprecated - all data now flows through Automerge sync protocol
  // Old format content is converted server-side and saved to R2 in Automerge format
  // This callback is kept for backwards compatibility but should not be used
  const applyJsonSyncData = useCallback((_data: TLStoreSnapshot) => {
    console.warn('⚠️ JSON sync callback called but JSON sync is deprecated. All data should flow through Automerge sync protocol.')
    // Don't apply JSON sync - let Automerge sync handle everything
    return
  }, [])

  // Create Repo with both network AND storage adapters for offline support
  const [repo] = useState(() => {
    const networkAdapter = new CloudflareNetworkAdapter(workerUrl, roomId, applyJsonSyncData)
    const storageAdapter = new IndexedDBStorageAdapter()

    console.log('🗄️ Creating Automerge Repo with IndexedDB storage adapter for offline support')

    return new Repo({
      network: [networkAdapter],
      storage: storageAdapter
    })
  })

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Back online')
      setConnectionStatus('syncing')
      // The network adapter will automatically reconnect and sync
      // After a short delay, assume we're synced if no errors
      setTimeout(() => {
        setConnectionStatus('online')
      }, 2000)
    }

    const handleOffline = () => {
      console.log('📴 Network: Gone offline')
      setConnectionStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize Automerge document handle with offline-first approach
  useEffect(() => {
    let mounted = true

    const initializeHandle = async () => {
      try {
        console.log("🔌 Initializing Automerge Repo with offline support for room:", roomId)

        if (!mounted) return

        let handle: DocHandle<any>
        let existingDocId: string | null = null
        let loadedFromLocal = false

        // Step 1: Check if we have a stored document ID for this room
        try {
          existingDocId = await getDocumentId(roomId)
          if (existingDocId) {
            console.log(`📦 Found existing document ID in IndexedDB: ${existingDocId}`)
          }
        } catch (error) {
          console.warn('⚠️ Could not check IndexedDB for existing document:', error)
        }

        // Step 2: Try to load from local storage first (offline-first approach)
        if (existingDocId) {
          try {
            console.log(`🔍 Attempting to load document from IndexedDB: ${existingDocId}`)
            // Use repo.find() which will check IndexedDB storage adapter first
            // In automerge-repo v2.x, find() can return a Promise
            const foundHandle = await Promise.resolve(repo.find(existingDocId as DocumentId))
            handle = foundHandle as DocHandle<any>

            // Wait for the handle to be ready (will load from IndexedDB if available)
            await handle.whenReady()

            const localDoc = handle.doc() as any
            const localRecordCount = localDoc?.store ? Object.keys(localDoc.store).length : 0

            if (localRecordCount > 0) {
              console.log(`✅ Loaded ${localRecordCount} records from IndexedDB (offline-first)`)
              loadedFromLocal = true
              setIsOfflineReady(true)
            } else {
              console.log('📦 Document exists in IndexedDB but is empty')
            }
          } catch (error) {
            console.warn('⚠️ Could not load from IndexedDB, will create new document:', error)
            existingDocId = null
          }
        }

        // Step 3: If no local document, create a new one
        if (!existingDocId || !handle!) {
          console.log('📝 Creating new Automerge document')
          handle = repo.create()

          // Save the mapping for future offline access
          await saveDocumentId(roomId, handle.documentId)
          console.log(`📝 Saved new document mapping: ${roomId} → ${handle.documentId}`)

          await handle.whenReady()
        }

        // Step 4: Sync with server if online (background sync)
        if (navigator.onLine) {
          setConnectionStatus('syncing')
          console.log("📥 Syncing with server...")

          try {
            const response = await fetch(`${workerUrl}/room/${roomId}`)
            if (response.ok) {
              const serverDoc = await response.json() as TLStoreSnapshot
              const serverRecordCount = Object.keys(serverDoc.store || {}).length
              const serverShapeCount = serverDoc.store
                ? Object.values(serverDoc.store).filter((r: any) => r?.typeName === 'shape').length
                : 0

              console.log(`📥 Server has: ${serverRecordCount} records, ${serverShapeCount} shapes`)

              // Merge server data into local document
              if (serverDoc.store && serverRecordCount > 0) {
                const localDoc = handle.doc() as any
                const localRecordCount = localDoc?.store ? Object.keys(localDoc.store).length : 0

                // If server has more data or local is empty, merge server data
                if (serverRecordCount > 0) {
                  handle.change((doc: any) => {
                    if (!doc.store) {
                      doc.store = {}
                    }
                    // Merge server records (Automerge will handle conflicts)
                    Object.entries(serverDoc.store).forEach(([id, record]) => {
                      // Only add if not already present locally, or if this is first load
                      if (!doc.store[id] || !loadedFromLocal) {
                        doc.store[id] = record
                      }
                    })
                  })

                  const mergedDoc = handle.doc() as any
                  const mergedCount = mergedDoc?.store ? Object.keys(mergedDoc.store).length : 0
                  console.log(`✅ Merged server data. Total records: ${mergedCount}`)
                }
              } else if (response.status !== 404) {
                console.log("📥 Server document is empty")
              }

              setConnectionStatus('online')
            } else if (response.status === 404) {
              console.log("📥 No document on server yet - local document will be synced when saved")
              setConnectionStatus('online')
            } else {
              console.warn(`⚠️ Server sync failed: ${response.status}`)
              setConnectionStatus(loadedFromLocal ? 'offline' : 'online')
            }
          } catch (error) {
            console.error("❌ Error syncing with server:", error)
            // If we loaded from local, we're still functional in offline mode
            setConnectionStatus(loadedFromLocal ? 'offline' : 'online')
          }
        } else {
          console.log("📴 Offline - using local data only")
          setConnectionStatus('offline')
        }

        // Mark as offline-ready once we have any document loaded
        setIsOfflineReady(true)

        const finalDoc = handle.doc() as any
        const finalStoreKeys = finalDoc?.store ? Object.keys(finalDoc.store).length : 0
        const finalShapeCount = finalDoc?.store
          ? Object.values(finalDoc.store).filter((r: any) => r?.typeName === 'shape').length
          : 0

        console.log("✅ Automerge handle initialized:", {
          documentId: handle.documentId,
          hasDoc: !!finalDoc,
          storeKeys: finalStoreKeys,
          shapeCount: finalShapeCount,
          loadedFromLocal,
          isOnline: navigator.onLine
        })

        if (mounted) {
          setHandle(handle)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("❌ Error initializing Automerge handle:", error)
        if (mounted) {
          setIsLoading(false)
          setConnectionStatus('offline')
        }
      }
    }

    initializeHandle()

    return () => {
      mounted = false
    }
  }, [repo, roomId, workerUrl])

  // Auto-save to Cloudflare on every change (with debouncing to prevent excessive calls)
  // CRITICAL: This ensures new shapes are persisted to R2
  useEffect(() => {
    if (!handle) return

    let saveTimeout: NodeJS.Timeout

    const saveDocumentToWorker = async () => {
      try {
        const doc = handle.doc()
        if (!doc || !doc.store) {
          console.log("🔍 No document to save yet")
          return
        }

        const shapeCount = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
        const storeKeys = Object.keys(doc.store).length
        
        // Track shape types being persisted
        const shapeTypeCounts = Object.values(doc.store)
          .filter((r: any) => r?.typeName === 'shape')
          .reduce((acc: any, r: any) => {
            const type = r?.type || 'unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})
        
        console.log(`💾 Persisting document to worker for R2 storage: ${storeKeys} records, ${shapeCount} shapes`)
        console.log(`💾 Shape type breakdown being persisted:`, shapeTypeCounts)
        
        // Send document state to worker via POST /room/:roomId
        // This updates the worker's currentDoc so it can be persisted to R2
        const response = await fetch(`${workerUrl}/room/${roomId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(doc),
        })

        if (!response.ok) {
          throw new Error(`Failed to save to worker: ${response.statusText}`)
        }

        console.log(`✅ Successfully sent document state to worker for persistence (${shapeCount} shapes)`)
      } catch (error) {
        console.error('❌ Error saving document to worker:', error)
      }
    }

    const scheduleSave = () => {
      // Clear existing timeout
      if (saveTimeout) clearTimeout(saveTimeout)
      
      // Schedule save with a debounce (2 seconds) to batch rapid changes
      // This matches the worker's persistence throttle
      saveTimeout = setTimeout(saveDocumentToWorker, 2000)
    }

    // Listen for changes to the Automerge document
    const changeHandler = (payload: any) => {
      const patchCount = payload.patches?.length || 0
      
      // Check if patches contain shape changes
      const hasShapeChanges = payload.patches?.some((p: any) => {
        const id = p.path?.[1]
        return id && typeof id === 'string' && id.startsWith('shape:')
      })
      
      if (hasShapeChanges) {
        console.log('🔍 Automerge document changed with shape patches:', {
          patchCount: patchCount,
          shapePatches: payload.patches.filter((p: any) => {
            const id = p.path?.[1]
            return id && typeof id === 'string' && id.startsWith('shape:')
          }).length
        })
      }
      
      // Schedule save to worker for persistence
      scheduleSave()
    }
    
    handle.on('change', changeHandler)

    // Also save immediately on mount to ensure initial state is persisted
    setTimeout(saveDocumentToWorker, 3000)

    return () => {
      handle.off('change', changeHandler)
      if (saveTimeout) clearTimeout(saveTimeout)
    }
  }, [handle, roomId, workerUrl])

  // Get user metadata for presence
  const userMetadata: { userId: string; name: string; color: string } = (() => {
    if (user && 'userId' in user) {
      return {
        userId: (user as { userId: string; name: string; color?: string }).userId,
        name: (user as { userId: string; name: string; color?: string }).name,
        color: (user as { userId: string; name: string; color?: string }).color || '#000000'
      }
    }
    return {
      userId: user?.id || 'anonymous',
      name: user?.name || 'Anonymous',
      color: '#000000'
    }
  })()
  
  // Use useAutomergeStoreV2 to create a proper TLStore instance that syncs with Automerge
  const storeWithStatus = useAutomergeStoreV2({
    handle: handle || null as any,
    userId: userMetadata.userId
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
    userMetadata
  })

  return {
    ...storeWithStatus,
    handle,
    presence,
    connectionStatus,
    isOfflineReady
  }
}
