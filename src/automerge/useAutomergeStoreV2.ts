import {
  TLRecord,
  TLStoreWithStatus,
  createTLStore,
  TLStoreSnapshot,
} from "@tldraw/tldraw"
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from "@tldraw/tlschema"
import { useEffect, useState } from "react"
import { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo"
import {
  useLocalAwareness,
  useRemoteAwareness,
} from "@automerge/automerge-repo-react-hooks"

import { applyAutomergePatchesToTLStore, sanitizeRecord } from "./AutomergeToTLStore.js"
import { applyTLStoreChangesToAutomerge } from "./TLStoreToAutomerge.js"

// Import custom shape utilities
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { SlideShape } from "@/shapes/SlideShapeUtil"
import { PromptShape } from "@/shapes/PromptShapeUtil"
import { SharedPianoShape } from "@/shapes/SharedPianoShapeUtil"
import { TranscriptionShape } from "@/shapes/TranscriptionShapeUtil"
import { ObsNoteShape } from "@/shapes/ObsNoteShapeUtil"
import { FathomTranscriptShape } from "@/shapes/FathomTranscriptShapeUtil"
import { HolonShape } from "@/shapes/HolonShapeUtil"
import { ObsidianBrowserShape } from "@/shapes/ObsidianBrowserShapeUtil"
import { FathomMeetingsBrowserShape } from "@/shapes/FathomMeetingsBrowserShapeUtil"
import { LocationShareShape } from "@/shapes/LocationShareShapeUtil"

export function useAutomergeStoreV2({
  handle,
  userId: _userId,
}: {
  handle: DocHandle<any>
  userId: string
}): TLStoreWithStatus {
  console.log("useAutomergeStoreV2 called with handle:", !!handle)
  
  // Create a custom schema that includes all the custom shapes
  const customSchema = createTLSchema({
    shapes: {
      ...defaultShapeSchemas,
      ChatBox: {} as any,
      VideoChat: {} as any,
      Embed: {} as any,
      Markdown: {} as any,
      MycrozineTemplate: {} as any,
      Slide: {} as any,
      Prompt: {} as any,
      SharedPiano: {} as any,
      Transcription: {} as any,
      ObsNote: {} as any,
      FathomTranscript: {} as any,
      Holon: {} as any,
      ObsidianBrowser: {} as any,
      FathomMeetingsBrowser: {} as any,
      LocationShare: {} as any,
    },
    bindings: defaultBindingSchemas,
  })

  const [store] = useState(() => {
    const store = createTLStore({
      schema: customSchema,
      shapeUtils: [
        ChatBoxShape,
        VideoChatShape,
        EmbedShape,
        MarkdownShape,
        MycrozineTemplateShape,
        SlideShape,
        PromptShape,
        SharedPianoShape,
        TranscriptionShape,
        ObsNoteShape,
        FathomTranscriptShape,
        HolonShape,
        ObsidianBrowserShape,
        FathomMeetingsBrowserShape,
        LocationShareShape,
      ],
    })
    return store
  })

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  })

  // Debug: Log store status when it changes
  useEffect(() => {
    if (storeWithStatus.status === "synced-remote" && storeWithStatus.store) {
      const allRecords = storeWithStatus.store.allRecords()
      const shapes = allRecords.filter(r => r.typeName === 'shape')
      const pages = allRecords.filter(r => r.typeName === 'page')
      console.log(`📊 useAutomergeStoreV2: Store synced with ${allRecords.length} total records, ${shapes.length} shapes, ${pages.length} pages`)
    }
  }, [storeWithStatus.status, storeWithStatus.store])

  /* -------------------- TLDraw <--> Automerge -------------------- */
  useEffect(() => {
    // Early return if handle is not available
    if (!handle) {
      setStoreWithStatus({ status: "loading" })
      return
    }

    const unsubs: (() => void)[] = []

    // A hacky workaround to prevent local changes from being applied twice
    // once into the automerge doc and then back again.
    let isLocalChange = false

    // Listen for changes from Automerge and apply them to TLDraw
    const automergeChangeHandler = (payload: DocHandleChangePayload<any>) => {
      if (isLocalChange) {
        isLocalChange = false
        return
      }

      try {
        // Apply patches from Automerge to TLDraw store
        if (payload.patches && payload.patches.length > 0) {
          // Debug: Check if patches contain shapes
          const shapePatches = payload.patches.filter((p: any) => {
            const id = p.path?.[1]
            return id && typeof id === 'string' && id.startsWith('shape:')
          })
          if (shapePatches.length > 0) {
            console.log(`🔌 Automerge patches contain ${shapePatches.length} shape patches out of ${payload.patches.length} total patches`)
          }
          
          try {
            const recordsBefore = store.allRecords()
            const shapesBefore = recordsBefore.filter((r: any) => r.typeName === 'shape')
            
            applyAutomergePatchesToTLStore(payload.patches, store)
            
            const recordsAfter = store.allRecords()
            const shapesAfter = recordsAfter.filter((r: any) => r.typeName === 'shape')
            
            if (shapesAfter.length !== shapesBefore.length) {
              console.log(`✅ Applied ${payload.patches.length} patches: shapes changed from ${shapesBefore.length} to ${shapesAfter.length}`)
            }
            
            // Only log if there are many patches or if debugging is needed
            if (payload.patches.length > 5) {
              console.log(`✅ Successfully applied ${payload.patches.length} patches`)
            }
          } catch (patchError) {
            console.error("Error applying patches batch, attempting individual patch application:", patchError)
            // Try applying patches one by one to identify problematic ones
            // This is a fallback - ideally we should fix the data at the source
            let successCount = 0
            let failedPatches: any[] = []
            for (const patch of payload.patches) {
              try {
                applyAutomergePatchesToTLStore([patch], store)
                successCount++
              } catch (individualPatchError) {
                failedPatches.push({ patch, error: individualPatchError })
                console.error(`Failed to apply individual patch:`, individualPatchError)
                
                // Log the problematic patch for debugging
                const recordId = patch.path[1] as string
                console.error("Problematic patch details:", {
                  action: patch.action,
                  path: patch.path,
                  recordId: recordId,
                  value: 'value' in patch ? patch.value : undefined,
                  errorMessage: individualPatchError instanceof Error ? individualPatchError.message : String(individualPatchError)
                })
                
                // Try to get more context about the failing record
                try {
                  const existingRecord = store.get(recordId as any)
                  console.error("Existing record that failed:", existingRecord)
                  
                  // If it's a geo shape missing props.geo, try to fix it
                  if (existingRecord && (existingRecord as any).typeName === 'shape' && (existingRecord as any).type === 'geo') {
                    const geoRecord = existingRecord as any
                    if (!geoRecord.props || !geoRecord.props.geo) {
                      console.log(`🔧 Attempting to fix geo shape ${recordId} missing props.geo`)
                      // This won't help with the current patch, but might help future patches
                      // The real fix should happen in AutomergeToTLStore sanitization
                    }
                  }
                } catch (e) {
                  console.error("Could not retrieve existing record:", e)
                }
              }
            }
            
            // Log summary
            if (failedPatches.length > 0) {
              console.error(`❌ Failed to apply ${failedPatches.length} out of ${payload.patches.length} patches`)
              // Most common issue: geo shapes missing props.geo - this should be fixed in sanitization
              const geoShapeErrors = failedPatches.filter(p => 
                p.error instanceof Error && p.error.message.includes('props.geo')
              )
              if (geoShapeErrors.length > 0) {
                console.error(`⚠️ ${geoShapeErrors.length} failures due to missing props.geo - this should be fixed in AutomergeToTLStore sanitization`)
              }
            }
            
            if (successCount < payload.patches.length || payload.patches.length > 5) {
              console.log(`✅ Successfully applied ${successCount} out of ${payload.patches.length} patches`)
            }
          }
        }
        
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
      } catch (error) {
        console.error("Error applying Automerge patches to TLDraw:", error)
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "offline",
          error: error instanceof Error ? error : new Error("Unknown error") as any,
        })
      }
    }
    
    handle.on("change", automergeChangeHandler)

    // Listen for changes from TLDraw and apply them to Automerge
    // CRITICAL: Listen to ALL sources, not just "user", to catch richText/text changes
    const unsubscribeTLDraw = store.listen(({ changes, source }) => {
      // DEBUG: Log all changes to see what's being detected
      const totalChanges = Object.keys(changes.added || {}).length + Object.keys(changes.updated || {}).length + Object.keys(changes.removed || {}).length
      
      if (totalChanges > 0) {
        console.log(`🔍 TLDraw store changes detected (source: ${source}):`, {
          added: Object.keys(changes.added || {}).length,
          updated: Object.keys(changes.updated || {}).length,
          removed: Object.keys(changes.removed || {}).length,
          source: source
        })
        
        // DEBUG: Check for richText/text changes in updated records
        if (changes.updated) {
          Object.values(changes.updated).forEach(([_, record]) => {
            if (record.typeName === 'shape') {
              if (record.type === 'geo' && (record.props as any)?.richText) {
                console.log(`🔍 Geo shape ${record.id} richText change detected:`, {
                  hasRichText: !!(record.props as any).richText,
                  richTextType: typeof (record.props as any).richText,
                  source: source
                })
              }
              if (record.type === 'note' && (record.props as any)?.richText) {
                console.log(`🔍 Note shape ${record.id} richText change detected:`, {
                  hasRichText: !!(record.props as any).richText,
                  richTextType: typeof (record.props as any).richText,
                  richTextContentLength: Array.isArray((record.props as any).richText?.content) 
                    ? (record.props as any).richText.content.length 
                    : 'not array',
                  source: source
                })
              }
              if (record.type === 'arrow' && (record.props as any)?.text !== undefined) {
                console.log(`🔍 Arrow shape ${record.id} text change detected:`, {
                  hasText: !!(record.props as any).text,
                  textValue: (record.props as any).text,
                  source: source
                })
              }
              if (record.type === 'text' && (record.props as any)?.richText) {
                console.log(`🔍 Text shape ${record.id} richText change detected:`, {
                  hasRichText: !!(record.props as any).richText,
                  richTextType: typeof (record.props as any).richText,
                  source: source
                })
              }
            }
          })
        }
        
        // DEBUG: Log added shapes to track what's being created
        if (changes.added) {
          Object.values(changes.added).forEach((record) => {
            if (record.typeName === 'shape') {
              console.log(`🔍 Shape added: ${record.type} (${record.id})`, {
                type: record.type,
                id: record.id,
                hasRichText: !!(record.props as any)?.richText,
                hasText: !!(record.props as any)?.text,
                source: source
              })
            }
          })
        }
      }
      
      // CRITICAL: Don't skip changes - always save them to ensure consistency
      // The isLocalChange flag is only used to prevent feedback loops from Automerge changes
      // We should always save TLDraw changes, even if they came from Automerge sync
      // This ensures that all shapes (notes, rectangles, etc.) are consistently persisted
      
      try {
        // Set flag to prevent feedback loop when this change comes back from Automerge
        isLocalChange = true
        
        handle.change((doc) => {
          applyTLStoreChangesToAutomerge(doc, changes)
        })
        
        // Reset flag after a short delay to allow Automerge change handler to process
        // This prevents feedback loops while ensuring all changes are saved
        setTimeout(() => {
          isLocalChange = false
        }, 100)
        
        // Only log if there are many changes or if debugging is needed
        if (totalChanges > 3) {
          console.log(`✅ Applied ${totalChanges} TLDraw changes to Automerge document`)
        } else if (totalChanges > 0) {
          console.log(`✅ Applied ${totalChanges} TLDraw change(s) to Automerge document`)
        }
        
        // Check if the document actually changed
        const docAfter = handle.doc()
      } catch (error) {
        console.error("Error applying TLDraw changes to Automerge:", error)
        // Reset flag on error to prevent getting stuck
        isLocalChange = false
      }
    }, {
      // CRITICAL: Don't filter by source - listen to ALL changes
      // This ensures we catch richText/text changes regardless of their source
      // (TLDraw might emit these changes with a different source than "user")
      scope: "document",
    })

    unsubs.push(
      () => handle.off("change", automergeChangeHandler),
      unsubscribeTLDraw
    )

    // CRITICAL: Use patch-based loading exclusively (same as dev)
    // No bulk loading - all data flows through patches via automergeChangeHandler
    // This ensures production works exactly like dev
    const initializeStore = async () => {
      try {
        await handle.whenReady()
        const doc = handle.doc()
        
        // Check if store is already populated from patches
        const existingStoreRecords = store.allRecords()
        const existingStoreShapes = existingStoreRecords.filter((r: any) => r.typeName === 'shape')
        
        if (doc.store) {
          const storeKeys = Object.keys(doc.store)
          const docShapes = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
          console.log(`📊 Patch-based initialization: doc has ${storeKeys.length} records (${docShapes} shapes), store has ${existingStoreRecords.length} records (${existingStoreShapes.length} shapes)`)
          
          // If store already has shapes, patches have been applied (dev mode behavior)
          if (existingStoreShapes.length > 0) {
            console.log(`✅ Store already populated from patches (${existingStoreShapes.length} shapes) - using patch-based loading like dev`)
            setStoreWithStatus({
              store,
              status: "synced-remote",
              connectionStatus: "online",
            })
            return
          }
          
          // If doc has data but store doesn't, trigger patches by making a minimal change
          // This ensures patches are generated and processed by automergeChangeHandler
          if (docShapes > 0 && existingStoreShapes.length === 0) {
            console.log(`📊 Doc has ${docShapes} shapes but store is empty. Triggering patches to populate store (patch-based loading)...`)
            
            // Trigger patches by touching the document - this will cause automergeChangeHandler to fire
            // The handler will process all existing records via patches (same as dev)
            handle.change((doc: any) => {
              if (doc.store && Object.keys(doc.store).length > 0) {
                // Touch the first record to trigger change detection and patch generation
                const firstKey = Object.keys(doc.store)[0]
                if (firstKey) {
                  // This minimal change triggers Automerge to generate patches for all records
                  doc.store[firstKey] = { ...doc.store[firstKey] }
                }
              }
            })
            
            // Wait for patches to be processed by automergeChangeHandler
            // Give it time for the handler to apply patches to the store
            let attempts = 0
            const maxAttempts = 20 // Wait up to 4 seconds (20 * 200ms)
            
            await new Promise<void>(resolve => {
              const checkForPatches = () => {
                attempts++
                const currentShapes = store.allRecords().filter((r: any) => r.typeName === 'shape')
                
                if (currentShapes.length > 0) {
                  console.log(`✅ Patches applied successfully: ${currentShapes.length} shapes loaded via patches (same as dev)`)
                  setStoreWithStatus({
                    store,
                    status: "synced-remote",
                    connectionStatus: "online",
                  })
                  resolve()
                } else if (attempts < maxAttempts) {
                  setTimeout(checkForPatches, 200)
                } else {
                  console.warn(`⚠️ Patches didn't populate store after ${maxAttempts * 200}ms. This shouldn't happen - patches should always work.`)
                  // Still set status to synced - patches might come through later
                  setStoreWithStatus({
                    store,
                    status: "synced-remote",
                    connectionStatus: "online",
                  })
                  resolve()
                }
              }
              
              setTimeout(checkForPatches, 200)
            })
            
            return // Always return - patches handle everything, no bulk loading
          }
          
          // If doc is empty, just set status
          if (docShapes === 0) {
            console.log(`📊 Empty document - starting fresh (patch-based loading)`)
            setStoreWithStatus({
              store,
              status: "synced-remote",
              connectionStatus: "online",
            })
            return
          }
        } else {
          // No store in doc - empty document
          console.log(`📊 No store in Automerge doc - starting fresh (patch-based loading)`)
          setStoreWithStatus({
            store,
            status: "synced-remote",
            connectionStatus: "online",
          })
          return
        }
      } catch (error) {
        console.error("Error in patch-based initialization:", error)
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
      }
    }
    
    initializeStore()
      
      return () => {
        unsubs.forEach((unsub) => unsub())
      }
    }, [handle, store])
    
    /* -------------------- Presence -------------------- */
    // Create a safe handle that won't cause null errors
    const safeHandle = handle || {
      on: () => {},
      off: () => {},
      removeListener: () => {},
      whenReady: () => Promise.resolve(),
      doc: () => null,
      change: () => {},
      broadcast: () => {},
    } as any
    
    const [, updateLocalState] = useLocalAwareness({
      handle: safeHandle,
      userId: _userId,
      initialState: {},
    })
    
    const [peerStates] = useRemoteAwareness({
      handle: safeHandle,
      localUserId: _userId,
    })
    
    return {
      ...storeWithStatus,
      store,
    } as TLStoreWithStatus
  }
  
// Presence hook (simplified version)
export function useAutomergePresence(params: {
  handle: DocHandle<any> | null
  store: any
  userMetadata: {
    userId: string
    name: string
    color: string
  }
}) {
  const { handle, store, userMetadata } = params
  
  // Simple presence implementation
  useEffect(() => {
    if (!handle || !store) return

    const updatePresence = () => {
      // Basic presence update logic
      console.log("Updating presence for user:", userMetadata.userId)
    }

    updatePresence()
  }, [handle, store, userMetadata])

  return {
    updatePresence: () => {},
    presence: {},
  }
}
