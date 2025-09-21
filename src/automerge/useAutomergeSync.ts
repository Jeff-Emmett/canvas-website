import { useMemo, useEffect, useState, useCallback } from "react"
import { TLStoreSnapshot } from "@tldraw/tldraw"
import { CloudflareAdapter } from "./CloudflareAdapter"
import { useAutomergeStoreV2, useAutomergePresence } from "./useAutomergeStoreV2"
import { TLStoreWithStatus } from "@tldraw/tldraw"

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

  const [adapter] = useState(() => new CloudflareAdapter(workerUrl, roomId))
  const [handle, setHandle] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize Automerge document handle
  useEffect(() => {
    let mounted = true

    const initializeHandle = async () => {
      // Add a small delay to ensure the server is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        // Try to load existing document from Cloudflare
        const existingDoc = await adapter.loadFromCloudflare(roomId)
        
        if (mounted) {
          const handle = await adapter.getHandle(roomId)
          
          // If we loaded an existing document, properly initialize it
          if (existingDoc) {
            console.log("Initializing Automerge document with existing data:", {
              hasStore: !!existingDoc.store,
              storeKeys: existingDoc.store ? Object.keys(existingDoc.store).length : 0,
              sampleKeys: existingDoc.store ? Object.keys(existingDoc.store).slice(0, 5) : []
            })
            
            handle.change((doc) => {
              // Always load R2 data if it exists and has content
              const r2StoreKeys = existingDoc.store ? Object.keys(existingDoc.store).length : 0
              
              console.log("Loading R2 data:", {
                r2StoreKeys,
                hasR2Data: r2StoreKeys > 0,
                sampleStoreKeys: existingDoc.store ? Object.keys(existingDoc.store).slice(0, 5) : []
              })
              
              if (r2StoreKeys > 0) {
                console.log("Loading R2 data into Automerge document")
                if (existingDoc.store) {
                  doc.store = existingDoc.store
                  console.log("Loaded store data into Automerge document:", {
                    loadedStoreKeys: Object.keys(doc.store).length,
                    sampleLoadedKeys: Object.keys(doc.store).slice(0, 5)
                  })
                }
                if (existingDoc.schema) {
                  doc.schema = existingDoc.schema
                }
              } else {
                console.log("No R2 data to load")
              }
            })
          } else {
            console.log("No existing document found, loading snapshot data")
            // Load snapshot data for new rooms
            try {
              const snapshotResponse = await fetch('/src/snapshot.json')
              if (snapshotResponse.ok) {
              const snapshotData = await snapshotResponse.json() as TLStoreSnapshot
              console.log("Loaded snapshot data:", {
                hasStore: !!snapshotData.store,
                storeKeys: snapshotData.store ? Object.keys(snapshotData.store).length : 0,
                shapeCount: snapshotData.store ? Object.values(snapshotData.store).filter((r: any) => r.typeName === 'shape').length : 0
              })
                
                handle.change((doc) => {
                  if (snapshotData.store) {
                    doc.store = snapshotData.store
                    console.log("Loaded snapshot store data into Automerge document:", {
                      storeKeys: Object.keys(doc.store).length,
                      shapeCount: Object.values(doc.store).filter((r: any) => r.typeName === 'shape').length,
                      sampleKeys: Object.keys(doc.store).slice(0, 5)
                    })
                  }
                  if (snapshotData.schema) {
                    doc.schema = snapshotData.schema
                  }
                })
              }
            } catch (error) {
              console.error('Error loading snapshot data:', error)
            }
          }
          
          // Wait a bit more to ensure the handle is fully ready with data
          await new Promise(resolve => setTimeout(resolve, 500))
          
          setHandle(handle)
          setIsLoading(false)
          console.log("Automerge handle initialized and loading completed")
        }
      } catch (error) {
        console.error('Error initializing Automerge handle:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializeHandle()

    return () => {
      mounted = false
    }
  }, [adapter, roomId])

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
          await adapter.saveToCloudflare(roomId)
        } catch (error) {
          console.error('Error in change-triggered save:', error)
        }
      }, 500)
    }

    // Listen for changes to the Automerge document
    const changeHandler = (_payload: any) => {
      scheduleSave()
    }
    
    handle.on('change', changeHandler)

    return () => {
      handle.off('change', changeHandler)
      if (saveTimeout) clearTimeout(saveTimeout)
    }
  }, [handle, adapter, roomId])

  // Use the Automerge store (only when handle is ready and not loading)
  const store = useAutomergeStoreV2({
    handle: !isLoading && handle ? handle : null,
    userId: user?.id || 'anonymous',
  })

  // Set up presence if user is provided (always call hooks, but handle null internally)
  useAutomergePresence({
    handle,
    store,
    userMetadata: {
      userId: user?.id || 'anonymous',
      name: user?.name || 'Anonymous',
      color: '#000000', // Default color
    },
  })

  // Return loading state while initializing
  if (isLoading || !handle) {
    return { status: "loading" }
  }

  return store
}
