import { useMemo, useEffect, useState, useCallback, useRef } from "react"
import { TLStoreSnapshot } from "@tldraw/tldraw"
import { CloudflareNetworkAdapter } from "./CloudflareAdapter"
import { useAutomergeStoreV2, useAutomergePresence } from "./useAutomergeStoreV2"
import { TLStoreWithStatus } from "@tldraw/tldraw"
import { Repo } from "@automerge/automerge-repo"

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

export function useAutomergeSync(config: AutomergeSyncConfig): TLStoreWithStatus {
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
  
  // Update ref when handle changes
  useEffect(() => {
    handleRef.current = handle
  }, [handle])
  
  // Callback to apply JSON sync data directly to handle (bypassing Automerge sync protocol)
  const applyJsonSyncData = useCallback((data: TLStoreSnapshot) => {
    const currentHandle = handleRef.current
    if (!currentHandle) {
      console.warn('⚠️ Cannot apply JSON sync data: handle not ready yet')
      return
    }
    
    try {
      console.log('🔌 Applying JSON sync data directly to handle:', {
        hasStore: !!data.store,
        storeKeys: data.store ? Object.keys(data.store).length : 0
      })
      
      // Apply the data directly to the handle
      currentHandle.change((doc: any) => {
        // Merge the store data into the document
        if (data.store) {
          if (!doc.store) {
            doc.store = {}
          }
          // Merge all records from the sync data
          Object.entries(data.store).forEach(([id, record]) => {
            doc.store[id] = record
          })
        }
        // Preserve schema if provided
        if (data.schema) {
          doc.schema = data.schema
        }
      })
      
      console.log('✅ Successfully applied JSON sync data to handle')
    } catch (error) {
      console.error('❌ Error applying JSON sync data to handle:', error)
    }
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
        console.log("🔌 Initializing Automerge Repo with NetworkAdapter")
        
        if (mounted) {
          // Create a new document - Automerge will generate the proper document ID
          // Force refresh to clear cache
          const handle = repo.create()
          
          console.log("Created Automerge handle via Repo:", {
            handleId: handle.documentId,
            isReady: handle.isReady()
          })
          
          // Wait for the handle to be ready
          await handle.whenReady()
          
          console.log("Automerge handle is ready:", {
            hasDoc: !!handle.doc(),
            docKeys: handle.doc() ? Object.keys(handle.doc()).length : 0
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
  useEffect(() => {
    if (!handle) return

    let saveTimeout: NodeJS.Timeout

    const scheduleSave = () => {
      // Clear existing timeout
      if (saveTimeout) clearTimeout(saveTimeout)
      
      // Schedule save with a short debounce (500ms) to batch rapid changes
      saveTimeout = setTimeout(async () => {
        try {
          // With Repo, we don't need manual saving - the NetworkAdapter handles sync
          console.log("🔍 Automerge changes detected - NetworkAdapter will handle sync")
        } catch (error) {
          console.error('Error in change-triggered save:', error)
        }
      }, 500)
    }

    // Listen for changes to the Automerge document
    const changeHandler = (payload: any) => {
      console.log('🔍 Automerge document changed:', {
        hasPatches: !!payload.patches,
        patchCount: payload.patches?.length || 0,
        patches: payload.patches?.map((p: any) => ({
          action: p.action,
          path: p.path,
          value: p.value ? (typeof p.value === 'object' ? 'object' : p.value) : 'undefined'
        }))
      })
      scheduleSave()
    }
    
    handle.on('change', changeHandler)

    return () => {
      handle.off('change', changeHandler)
      if (saveTimeout) clearTimeout(saveTimeout)
    }
  }, [handle])

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
  } as TLStoreWithStatus & { presence: typeof presence; handle: typeof handle }
}
