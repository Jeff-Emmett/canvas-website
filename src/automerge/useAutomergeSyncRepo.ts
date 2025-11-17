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
    const repo = new Repo({
      network: [adapter],
      // Enable sharing of all documents with all peers
      sharePolicy: async () => true
    })

    // Log when sync messages are sent/received
    adapter.on('message', (msg: any) => {
      console.log('🔄 CloudflareAdapter received message from network:', msg.type)
    })

    return repo
  })

  // Initialize Automerge document handle
  useEffect(() => {
    let mounted = true

    const initializeHandle = async () => {
      try {
        console.log("🔌 Initializing Automerge Repo with NetworkAdapter for room:", roomId)

        if (mounted) {
          // CRITICAL FIX: Get or create a consistent document ID for this room
          // All clients in the same room MUST use the same document ID for sync to work
          let documentId: string | null = null

          try {
            // First, try to get the document ID from the server
            const response = await fetch(`${workerUrl}/room/${roomId}/documentId`)
            if (response.ok) {
              const data = await response.json() as { documentId: string }
              documentId = data.documentId
              console.log(`📥 Got existing document ID from server: ${documentId}`)
            } else if (response.status === 404) {
              console.log(`📝 No document ID found on server for room ${roomId}, will create new one`)
            }
          } catch (error) {
            console.warn(`⚠️ Could not fetch document ID from server:`, error)
          }

          let handle: DocHandle<TLStoreSnapshot>

          if (documentId) {
            // Try to find the existing document
            console.log(`🔍 Attempting to find document ${documentId}`)
            try {
              handle = await repo.find<TLStoreSnapshot>(documentId as any)
              console.log(`✅ Found document handle: ${documentId}`)
            } catch (error) {
              // Document not available yet - this can happen when it exists on server but not locally
              console.log(`📝 Document ${documentId} not immediately available, creating new handle`)
              // Create a new handle - the sync will handle merging with server state
              handle = repo.create<TLStoreSnapshot>()
              console.log(`📝 Created new handle ${handle.documentId}, will sync with server`)
            }
          } else {
            // Create a new document and register its ID with the server
            handle = repo.create<TLStoreSnapshot>()
            documentId = handle.documentId
            console.log(`📝 Created new document with ID: ${documentId}`)

            // Register this document ID with the server so other clients use the same one
            try {
              await fetch(`${workerUrl}/room/${roomId}/documentId`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId })
              })
              console.log(`✅ Registered document ID with server: ${documentId}`)
            } catch (error) {
              console.error(`❌ Failed to register document ID with server:`, error)
            }
          }

          console.log("Found/Created Automerge handle via Repo:", {
            handleId: handle.documentId,
            isReady: handle.isReady(),
            roomId: roomId
          })

          // Wait for the handle to be ready
          await handle.whenReady()

          // Initialize document with default store if it's new/empty
          const currentDoc = handle.doc() as any
          if (!currentDoc || !currentDoc.store || Object.keys(currentDoc.store).length === 0) {
            console.log("📝 Document is new/empty - initializing with default store")

            // Try to load initial data from server for new documents
            try {
              const response = await fetch(`${workerUrl}/room/${roomId}`)
              if (response.ok) {
                const serverDoc = await response.json() as TLStoreSnapshot
                const serverRecordCount = Object.keys(serverDoc.store || {}).length

                if (serverDoc.store && serverRecordCount > 0) {
                  console.log(`📥 Loading ${serverRecordCount} records from server into new document`)
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
                  console.log("📥 Server document is empty - document will start empty")
                }
              } else if (response.status === 404) {
                console.log("📥 No document found on server (404) - starting with empty document")
              } else {
                console.warn(`⚠️ Failed to load document from server: ${response.status} ${response.statusText}`)
              }
            } catch (error) {
              console.error("❌ Error loading initial document from server:", error)
              // Continue anyway - document will start empty and sync via WebSocket
            }
          } else {
            const existingRecordCount = Object.keys(currentDoc.store || {}).length
            console.log(`✅ Document already has ${existingRecordCount} records - ready to sync`)
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
