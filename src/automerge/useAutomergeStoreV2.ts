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

    // Initial load - populate TLDraw store from Automerge document
    const initializeStore = async () => {
      try {
        // Only log if debugging is needed
        // console.log("Starting TLDraw store initialization...")
        await handle.whenReady()
        // console.log("Automerge handle is ready")
        
        const doc = handle.doc()
        // Only log if debugging is needed
        // console.log("Got Automerge document (FIXED VERSION):", {
        //   hasStore: !!doc.store,
        //   storeKeys: doc.store ? Object.keys(doc.store).length : 0,
        // })
        
        // Skip pre-sanitization to avoid Automerge reference errors
        // We'll handle validation issues in the record processing loop instead
        // Force cache refresh - pre-sanitization code has been removed
        
        // Initialize store with existing records from Automerge
        // NOTE: JSON sync might have already loaded data into the store
        // Check if store is already populated before loading from Automerge
        const existingStoreRecords = store.allRecords()
        const existingStoreShapes = existingStoreRecords.filter((r: any) => r.typeName === 'shape')
        
        if (doc.store) {
          const storeKeys = Object.keys(doc.store)
          const docShapes = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
          console.log(`📊 Automerge store initialization: doc has ${storeKeys.length} records (${docShapes} shapes), store already has ${existingStoreRecords.length} records (${existingStoreShapes.length} shapes)`)
          
          // If store already has shapes (from JSON sync), skip Automerge initialization
          // JSON sync happened first and loaded the data
          if (existingStoreShapes.length > 0 && docShapes === 0) {
            console.log(`ℹ️ Store already populated from JSON sync (${existingStoreShapes.length} shapes). Skipping Automerge initialization to prevent overwriting.`)
            setStoreWithStatus({
              store,
              status: "synced-remote",
              connectionStatus: "online",
            })
            return // Skip Automerge initialization
          }
          
          console.log(`📊 Store keys count: ${storeKeys.length}`, storeKeys.slice(0, 10))
          
          // Get all store values - Automerge should handle this correctly
          const allStoreValues = Object.values(doc.store)
          
          // Debug: Log first few records in detail to see their structure
          console.log("📊 Sample store values (first 3):", allStoreValues.slice(0, 3).map((v: any) => {
            try {
              return {
                hasTypeName: !!v?.typeName,
                hasId: !!v?.id,
                typeName: v?.typeName,
                id: v?.id,
                type: v?.type,
                keys: v ? Object.keys(v).slice(0, 10) : [],
                // Try to stringify a sample to see structure
                sample: JSON.stringify(v).substring(0, 200)
              }
            } catch (e) {
              return { error: String(e), value: v }
            }
          }))
          
          // Debug: Count record types before filtering
          const typeCountBefore = allStoreValues.reduce((acc: any, v: any) => {
            const type = v?.typeName || 'unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})
          console.log(`📊 Store values before filtering:`, {
            total: allStoreValues.length,
            typeCounts: typeCountBefore
          })
          
          // Simple filtering - only keep valid TLDraw records
          // Skip custom record types like obsidian_vault - they're not TLDraw records
          // Components should read them directly from Automerge (like ObsidianVaultBrowser does)
          const records = allStoreValues.filter((record: any) => {
            if (!record || !record.typeName || !record.id) {
              console.log(`⚠️ Filtering out invalid record:`, { hasRecord: !!record, hasTypeName: !!record?.typeName, hasId: !!record?.id })
              return false
            }
            // Skip obsidian_vault records - they're not TLDraw records
            if (record.typeName === 'obsidian_vault' || 
                (typeof record.id === 'string' && record.id.startsWith('obsidian_vault:'))) {
              return false
            }
            return true
          })
          
          // Track shape types before processing to ensure all are loaded
          const shapeRecordsBefore = records.filter((r: any) => r.typeName === 'shape')
          const shapeTypeCountsBefore = shapeRecordsBefore.reduce((acc: any, r: any) => {
            const type = r.type || 'unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})
          
          console.log(`📊 After filtering: ${records.length} valid records from ${allStoreValues.length} total store values`)
          console.log(`📊 Shape type breakdown before processing (${shapeRecordsBefore.length} shapes):`, shapeTypeCountsBefore)
          
          // Only log if there are many records or if debugging is needed
          if (records.length > 50) {
            console.log(`Found ${records.length} valid records in Automerge document`)
          }
          
          // CRITICAL: Use the same sanitization as dev mode (patch-based loading)
          // This ensures production works exactly like dev mode
          const processedRecords = records.map((record: any) => {
            // Create a deep copy to avoid modifying immutable Automerge objects
            let processedRecord: any
            try {
              // First try JSON serialization (works for most cases)
              processedRecord = JSON.parse(JSON.stringify(record))
              // Verify the record has essential properties
              if (!processedRecord.typeName || !processedRecord.id) {
                // If serialization lost properties, try accessing them directly
                processedRecord = {
                  ...record,
                  typeName: record.typeName,
                  id: record.id,
                  type: record.type,
                  props: record.props ? { ...record.props } : {},
                }
                // Copy all enumerable properties
                for (const key in record) {
                  if (!(key in processedRecord)) {
                    try {
                      processedRecord[key] = record[key]
                    } catch (e) {
                      // Skip properties that can't be accessed
                    }
                  }
                }
              }
            } catch (e) {
              // Fallback: manual copy if JSON serialization fails
              console.warn(`⚠️ JSON serialization failed for record ${record?.id}, using manual copy:`, e)
              processedRecord = {
                typeName: record.typeName,
                id: record.id,
                type: record.type,
                props: record.props ? { ...record.props } : {},
              }
              // Copy all enumerable properties
              for (const key in record) {
                try {
                  processedRecord[key] = record[key]
                } catch (err) {
                  // Skip properties that can't be accessed
                }
              }
            }
            
            // CRITICAL: Use the same sanitizeRecord function that dev mode uses
            // This ensures production uses the exact same sanitization logic
            try {
              return sanitizeRecord(processedRecord)
            } catch (error) {
              console.error(`Failed to sanitize record ${processedRecord?.id}:`, error)
              // Return unsanitized record as fallback (will likely fail validation)
              return processedRecord
            }
          }).filter((r): r is TLRecord => r !== null && r !== undefined)
          
          // OLD COMPLEX SANITIZATION CODE REMOVED - now using sanitizeRecord from AutomergeToTLStore
          // This matches dev mode behavior exactly
          
          console.log(`Processed ${processedRecords.length} records for loading (using same sanitization as dev mode)`)
          
          // Debug: Log what record types we have
          const recordTypes = processedRecords.reduce((acc: any, r: any) => {
            const type = r.typeName || 'unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})
          console.log(`📊 Record types breakdown:`, recordTypes)
          console.log(`📊 All processed records:`, processedRecords.map((r: any) => ({
            id: r.id,
            typeName: r.typeName,
            type: r.type,
            hasProps: !!r.props
          })))
          
          // Debug: Log shape structures before loading - track ALL shape types
          const shapesToLoad = processedRecords.filter(r => r.typeName === 'shape')
          const shapeTypeCountsToLoad = shapesToLoad.reduce((acc: any, r: any) => {
            const type = r.type || 'unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})
          console.log(`📊 About to load ${shapesToLoad.length} shapes into store`)
          console.log(`📊 Shape type breakdown to load:`, shapeTypeCountsToLoad)
          
          if (shapesToLoad.length > 0) {
            console.log("📊 Sample processed shape structure:", {
              id: shapesToLoad[0].id,
              type: shapesToLoad[0].type,
              x: shapesToLoad[0].x,
              y: shapesToLoad[0].y,
              props: shapesToLoad[0].props,
              parentId: shapesToLoad[0].parentId,
              allKeys: Object.keys(shapesToLoad[0])
            })
            
            // Log all shapes with their positions (first 20)
            const shapesToLog = shapesToLoad.slice(0, 20)
            console.log("📊 Processed shapes (first 20):", shapesToLog.map(s => ({
              id: s.id,
              type: s.type,
              x: s.x,
              y: s.y,
              hasProps: !!s.props,
              propsW: (s.props as any)?.w,
              propsH: (s.props as any)?.h,
              parentId: s.parentId
            })))
            if (shapesToLoad.length > 20) {
              console.log(`📊 ... and ${shapesToLoad.length - 20} more shapes`)
            }
          }
          
          // Load records into store
          if (processedRecords.length > 0) {
            console.log("Attempting to load records into store...")
            
            try {
              // CRITICAL: Ensure page exists before adding shapes
              // Get all page records from processed records
              const pageRecords = processedRecords.filter(r => r.typeName === 'page')
              const shapeRecords = processedRecords.filter(r => r.typeName === 'shape')
              const otherRecords = processedRecords.filter(r => r.typeName !== 'page' && r.typeName !== 'shape')
              
              console.log(`📊 Loading order: ${pageRecords.length} pages, ${shapeRecords.length} shapes, ${otherRecords.length} other records`)
              
              // Ensure default page exists if no pages in data
              if (pageRecords.length === 0) {
                console.log(`📊 No page records found, ensuring default page exists`)
                const defaultPage = {
                  id: 'page:page' as any,
                  typeName: 'page' as const,
                  name: 'Page 1',
                  index: 'a0' as any,
                }
                pageRecords.push(defaultPage as any)
              }
              
              store.mergeRemoteChanges(() => {
                // CRITICAL: Add pages first, then other records, then shapes
                // This ensures pages exist before shapes reference them
                const recordsToAdd = [...pageRecords, ...otherRecords, ...shapeRecords]
                
                // Verify all shapes have valid parentId pointing to an existing page
                const pageIds = new Set(pageRecords.map(p => p.id))
                const shapesWithInvalidParent = recordsToAdd.filter(r => {
                  if (r.typeName === 'shape') {
                    const shape = r as any
                    if (shape.parentId) {
                      return !pageIds.has(shape.parentId as any)
                    }
                  }
                  return false
                })
                
                if (shapesWithInvalidParent.length > 0) {
                  console.warn(`⚠️ Found ${shapesWithInvalidParent.length} shapes with invalid parentId, fixing...`)
                  shapesWithInvalidParent.forEach(shape => {
                    const defaultPageId = pageRecords[0]?.id || 'page:page'
                    const shapeRecord = shape as any
                    console.log(`🔧 Fixing shape ${shapeRecord.id}: parentId ${shapeRecord.parentId} -> ${defaultPageId}`)
                    shapeRecord.parentId = defaultPageId
                  })
                }
                
                // Put TLDraw records into store in correct order
                if (recordsToAdd.length > 0) {
                  console.log(`📊 Adding ${recordsToAdd.length} records to store (${pageRecords.length} pages, ${recordsToAdd.filter(r => r.typeName === 'shape').length} shapes)`)
                  store.put(recordsToAdd)
                  
                  // Verify shapes were added
                  setTimeout(() => {
                    const allShapes = store.allRecords().filter(r => r.typeName === 'shape')
                    const shapesOnPages = allShapes.filter(s => {
                      const shape = s as any
                      return shape.parentId && pageIds.has(shape.parentId)
                    })
                    console.log(`📊 Verification: Store now has ${allShapes.length} total shapes, ${shapesOnPages.length} with valid parentId`)
                  }, 100)
                }
              })
              console.log("Successfully loaded all records into store")
            } catch (error) {
              console.error("Error loading records into store:", error)
              // Try loading records one by one to identify problematic ones
              console.log("Attempting to load records one by one...")
              let successCount = 0
              const failedRecords = []
              
              for (const record of processedRecords) {
                try {
                  store.mergeRemoteChanges(() => {
                    store.put([record])
                  })
                  successCount++
                  console.log(`✅ Successfully loaded record ${record.id} (${record.typeName})`)
                } catch (individualError) {
                  console.error(`❌ Failed to load record ${record.id} (${record.typeName}):`, individualError)
                  failedRecords.push(record)
                }
              }
              if (successCount < processedRecords.length || processedRecords.length > 50) {
                console.log(`Successfully loaded ${successCount} out of ${processedRecords.length} records`)
              }
            }
          }
        }
        
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
      } catch (error) {
          console.error("Error initializing store from Automerge:", error)
          setStoreWithStatus({
            store,
            status: "not-synced",
            error: error instanceof Error ? error : new Error("Unknown error") as any,
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
