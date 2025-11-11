import { useMemo, useEffect, useState, useCallback, useRef } from "react"
import { TLStoreSnapshot } from "@tldraw/tldraw"
import { CloudflareNetworkAdapter } from "./CloudflareAdapter"
import { useAutomergeStoreV2, useAutomergePresence } from "./useAutomergeStoreV2"
import { TLStoreWithStatus } from "@tldraw/tldraw"
import { Repo } from "@automerge/automerge-repo"
import { DocHandle } from "@automerge/automerge-repo"

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
  
  const [repo] = useState(() => {
    const adapter = new CloudflareNetworkAdapter(workerUrl, roomId, applyJsonSyncData)
    return new Repo({
      network: [adapter]
    })
  })

  // Initialize Automerge document handle
  useEffect(() => {
    let mounted = true

    const initializeHandle = async () => {
      try {
        console.log("🔌 Initializing Automerge Repo with NetworkAdapter for room:", roomId)
        
        if (mounted) {
          // CRITICAL: Create a new Automerge document (repo.create() generates a proper document ID)
          // We can't use repo.find() with a custom ID because Automerge requires specific document ID formats
          // Instead, we'll create a new document and load initial data from the server
          const handle = repo.create()
          
          console.log("Created Automerge handle via Repo:", {
            handleId: handle.documentId,
            isReady: handle.isReady()
          })
          
          // Wait for the handle to be ready
          await handle.whenReady()
          
          // CRITICAL: Always load initial data from the server
          // The server stores documents in R2 as JSON, so we need to load and initialize the Automerge document
          console.log("📥 Loading initial data from server...")
          try {
            const response = await fetch(`${workerUrl}/room/${roomId}`)
            if (response.ok) {
              const serverDoc = await response.json() as TLStoreSnapshot
              const serverShapeCount = serverDoc.store ? Object.values(serverDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
              const serverRecordCount = Object.keys(serverDoc.store || {}).length
              
              console.log(`📥 Loaded document from server: ${serverRecordCount} records, ${serverShapeCount} shapes`)
              
              // Initialize the Automerge document with server data
              if (serverDoc.store && serverRecordCount > 0) {
                handle.change((doc: any) => {
                  // Initialize store if it doesn't exist
                  if (!doc.store) {
                    doc.store = {}
                  }
                  // Copy all records from server document
                  Object.entries(serverDoc.store).forEach(([id, record]) => {
                    doc.store[id] = record
                  })
                })
                
                console.log(`✅ Initialized Automerge document with ${serverRecordCount} records from server`)
              } else {
                console.log("📥 Server document is empty - starting with empty Automerge document")
              }
            } else if (response.status === 404) {
              console.log("📥 No document found on server (404) - starting with empty document")
            } else {
              console.warn(`⚠️ Failed to load document from server: ${response.status} ${response.statusText}`)
            }
          } catch (error) {
            console.error("❌ Error loading initial document from server:", error)
            // Continue anyway - user can still create new content
          }
          
          const finalDoc = handle.doc() as any
          const finalStoreKeys = finalDoc?.store ? Object.keys(finalDoc.store).length : 0
          const finalShapeCount = finalDoc?.store ? Object.values(finalDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
          
          console.log("Automerge handle initialized:", {
            hasDoc: !!finalDoc,
            storeKeys: finalStoreKeys,
            shapeCount: finalShapeCount
          })
          
          setHandle(handle)
          setIsLoading(false)
        }
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
    }
  }, [repo, roomId])

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
    presence
  }
}
