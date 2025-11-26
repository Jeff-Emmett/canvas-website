import {
  TLRecord,
  TLStoreWithStatus,
  createTLStore,
  TLStoreSnapshot,
  RecordsDiff,
} from "@tldraw/tldraw"
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from "@tldraw/tlschema"
import { useEffect, useState, useRef } from "react"
import { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo"
import {
  useLocalAwareness,
  useRemoteAwareness,
} from "@automerge/automerge-repo-react-hooks"
import throttle from "lodash.throttle"

import { applyAutomergePatchesToTLStore, sanitizeRecord } from "./AutomergeToTLStore.js"
import { applyTLStoreChangesToAutomerge } from "./TLStoreToAutomerge.js"

// Helper function to safely extract plain objects from Automerge proxies
// This handles cases where JSON.stringify fails due to functions or getters
function safeExtractPlainObject(obj: any, visited = new WeakSet()): any {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return obj
  }
  
  // Handle primitives
  if (typeof obj !== 'object') {
    return obj
  }
  
  // Handle circular references
  if (visited.has(obj)) {
    return null
  }
  visited.add(obj)
  
  // Handle arrays
  if (Array.isArray(obj)) {
    try {
      return obj.map(item => safeExtractPlainObject(item, visited))
    } catch (e) {
      return []
    }
  }
  
  // Handle objects
  try {
    const result: any = {}
    // Use Object.keys to get enumerable properties, which is safer than for...in
    // for Automerge proxies
    const keys = Object.keys(obj)
    for (const key of keys) {
      try {
        // Safely get the property value
        // Use Object.getOwnPropertyDescriptor to check if it's a getter
        const descriptor = Object.getOwnPropertyDescriptor(obj, key)
        if (descriptor) {
          // If it's a getter, try to get the value, but catch any errors
          if (descriptor.get) {
            try {
              const value = descriptor.get.call(obj)
              // Skip functions
              if (typeof value === 'function') {
                continue
              }
              result[key] = safeExtractPlainObject(value, visited)
            } catch (e) {
              // Skip properties that can't be accessed via getter
              continue
            }
          } else if (descriptor.value !== undefined) {
            // Regular property
            const value = descriptor.value
            // Skip functions
            if (typeof value === 'function') {
              continue
            }
            result[key] = safeExtractPlainObject(value, visited)
          }
        } else {
          // Fallback: try direct access
          try {
            const value = obj[key]
            // Skip functions
            if (typeof value === 'function') {
              continue
            }
            result[key] = safeExtractPlainObject(value, visited)
          } catch (e) {
            // Skip properties that can't be accessed
            continue
          }
        }
      } catch (e) {
        // Skip properties that can't be accessed
        continue
      }
    }
    return result
  } catch (e) {
    // If extraction fails, try JSON.stringify as fallback
    try {
      return JSON.parse(JSON.stringify(obj))
    } catch (jsonError) {
      // If that also fails, return empty object
      return {}
    }
  }
}

// Import custom shape utilities
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { SlideShape } from "@/shapes/SlideShapeUtil"
import { PromptShape } from "@/shapes/PromptShapeUtil"
import { TranscriptionShape } from "@/shapes/TranscriptionShapeUtil"
import { ObsNoteShape } from "@/shapes/ObsNoteShapeUtil"
import { FathomNoteShape } from "@/shapes/FathomNoteShapeUtil"
import { HolonShape } from "@/shapes/HolonShapeUtil"
import { ObsidianBrowserShape } from "@/shapes/ObsidianBrowserShapeUtil"
import { FathomMeetingsBrowserShape } from "@/shapes/FathomMeetingsBrowserShapeUtil"
import { ImageGenShape } from "@/shapes/ImageGenShapeUtil"
import { VideoGenShape } from "@/shapes/VideoGenShapeUtil"
import { MultmuxShape } from "@/shapes/MultmuxShapeUtil"
// Location shape removed - no longer needed

export function useAutomergeStoreV2({
  handle,
  userId: _userId,
  adapter,
}: {
  handle: DocHandle<any>
  userId: string
  adapter?: any
}): TLStoreWithStatus {
  console.log("useAutomergeStoreV2 called with handle:", !!handle, "adapter:", !!adapter)
  
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
      Transcription: {} as any,
      ObsNote: {} as any,
      FathomNote: {} as any,
      Holon: {} as any,
      ObsidianBrowser: {} as any,
      FathomMeetingsBrowser: {} as any,
      ImageGen: {} as any,
      VideoGen: {} as any,
      Multmux: {} as any,
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
        TranscriptionShape,
        ObsNoteShape,
        FathomNoteShape,
        HolonShape,
        ObsidianBrowserShape,
        FathomMeetingsBrowserShape,
        ImageGenShape,
        VideoGenShape,
        MultmuxShape,
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

    // Track local changes to prevent echoing them back
    // Simple boolean flag: set to true when making local changes,
    // then reset on the NEXT Automerge change event (which is the echo)
    let isLocalChange = false

    // Helper function to broadcast changes via JSON sync
    // DISABLED: This causes last-write-wins conflicts
    // Automerge should handle sync automatically via binary protocol
    // We're keeping this function but disabling all actual broadcasting
    const broadcastJsonSync = (changedRecords: any[]) => {
      // TEMPORARY FIX: Manually broadcast changes via WebSocket since Automerge Repo sync isn't working
      // This sends the full changed records as JSON to other clients
      // TODO: Fix Automerge Repo's binary sync protocol to work properly

      if (!changedRecords || changedRecords.length === 0) {
        return
      }

      console.log(`📤 Broadcasting ${changedRecords.length} changed records via manual JSON sync`)

      if (adapter && typeof (adapter as any).send === 'function') {
        // Send changes to other clients via the network adapter
        (adapter as any).send({
          type: 'sync',
          data: {
            store: Object.fromEntries(changedRecords.map(r => [r.id, r]))
          },
          documentId: handle?.documentId,
          timestamp: Date.now()
        })
      } else {
        console.warn('⚠️ Cannot broadcast - adapter not available')
      }
    }

    // Listen for changes from Automerge and apply them to TLDraw
    const automergeChangeHandler = (payload: DocHandleChangePayload<any>) => {
      // Skip the immediate echo of our own local changes
      // This flag is set when we update Automerge from TLDraw changes
      // and gets reset after skipping one change event (the echo)
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
            
            // CRITICAL: Pass Automerge document to patch handler so it can read full records
            // This prevents coordinates from defaulting to 0,0 when patches create new records
            const automergeDoc = handle.doc()
            applyAutomergePatchesToTLStore(payload.patches, store, automergeDoc)
            
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
            // CRITICAL: Pass Automerge document to patch handler so it can read full records
            const automergeDoc = handle.doc()
            for (const patch of payload.patches) {
              try {
                applyAutomergePatchesToTLStore([patch], store, automergeDoc)
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
    
    // Set up handler BEFORE initializeStore to catch patches from initial data load
    handle.on("change", automergeChangeHandler)
    
    // CRITICAL: If data was written to Automerge before this handler was set up,
    // manually trigger patch processing by reading the current doc state
    // This handles the case where useAutomergeSyncRepo writes data before useAutomergeStoreV2 sets up the handler
    // We do this synchronously when the handler is set up to catch any missed patches
    const currentDoc = handle.doc()
    if (currentDoc && currentDoc.store && Object.keys(currentDoc.store).length > 0) {
      const docShapeCount = Object.values(currentDoc.store).filter((r: any) => r?.typeName === 'shape').length
      const storeShapeCount = store.allRecords().filter((r: any) => r.typeName === 'shape').length
      
      if (docShapeCount > 0 && storeShapeCount === 0) {
        console.log(`🔧 Handler set up after data was written. Manually processing ${docShapeCount} shapes that were loaded before handler was ready...`)
        // Since patches were already emitted when handle.change() was called in useAutomergeSyncRepo,
        // we need to manually process the data that's already in the doc
        try {
          const allRecords: TLRecord[] = []
          Object.entries(currentDoc.store).forEach(([id, record]: [string, any]) => {
            if (!record || !record.typeName || !record.id) return
            if (record.typeName === 'obsidian_vault' || (typeof record.id === 'string' && record.id.startsWith('obsidian_vault:'))) return
            
            try {
              let cleanRecord: any
              try {
                cleanRecord = JSON.parse(JSON.stringify(record))
              } catch {
                cleanRecord = safeExtractPlainObject(record)
              }
              
              if (cleanRecord && typeof cleanRecord === 'object') {
                const sanitized = sanitizeRecord(cleanRecord)
                const plainSanitized = JSON.parse(JSON.stringify(sanitized))
                allRecords.push(plainSanitized)
              }
            } catch (e) {
              console.warn(`⚠️ Could not process record ${id}:`, e)
            }
          })
          
          // Filter out SharedPiano shapes since they're no longer supported
          const filteredRecords = allRecords.filter((record: any) => {
            if (record.typeName === 'shape' && record.type === 'SharedPiano') {
              console.log(`⚠️ Filtering out deprecated SharedPiano shape: ${record.id}`)
              return false
            }
            return true
          })
          
          if (filteredRecords.length > 0) {
            console.log(`🔧 Manually applying ${filteredRecords.length} records to store (patches were missed during initial load, filtered out ${allRecords.length - filteredRecords.length} SharedPiano shapes)`)
            store.mergeRemoteChanges(() => {
              const pageRecords = filteredRecords.filter(r => r.typeName === 'page')
              const shapeRecords = filteredRecords.filter(r => r.typeName === 'shape')
              const otherRecords = filteredRecords.filter(r => r.typeName !== 'page' && r.typeName !== 'shape')
              const recordsToAdd = [...pageRecords, ...otherRecords, ...shapeRecords]
              store.put(recordsToAdd)
            })
            console.log(`✅ Manually applied ${filteredRecords.length} records to store`)
          }
        } catch (error) {
          console.error(`❌ Error manually processing initial data:`, error)
        }
      }
    }

    // Throttle position-only updates (x/y changes) to reduce automerge saves during movement
    let positionUpdateQueue: RecordsDiff<TLRecord> | null = null
    let positionUpdateTimeout: NodeJS.Timeout | null = null
    const POSITION_UPDATE_THROTTLE_MS = 100 // Save position updates every 100ms for real-time feel
    
    const flushPositionUpdates = () => {
      if (positionUpdateQueue && handle) {
        const queuedChanges = positionUpdateQueue
        positionUpdateQueue = null
        
        // CRITICAL: Defer position update saves to prevent interrupting active interactions
        requestAnimationFrame(() => {
          try {
            isLocalChange = true
            handle.change((doc) => {
              applyTLStoreChangesToAutomerge(doc, queuedChanges)
            })
            // Trigger sync to broadcast position updates
            const changedRecords = [
              ...Object.values(queuedChanges.added || {}),
              ...Object.values(queuedChanges.updated || {}),
              ...Object.values(queuedChanges.removed || {})
            ]
            broadcastJsonSync(changedRecords)
          } catch (error) {
            console.error("Error applying throttled position updates to Automerge:", error)
          }
        })
      }
    }
    
    // Helper to check if a change is only a position update (x/y changed, nothing else)
    const isPositionOnlyUpdate = (changes: RecordsDiff<TLRecord>): boolean => {
      // If there are added or removed records, it's not just a position update
      if (changes.added && Object.keys(changes.added).length > 0) return false
      if (changes.removed && Object.keys(changes.removed).length > 0) return false
      
      // Check if all updated records are only position changes
      if (changes.updated) {
        const doc = handle?.doc()
        if (!doc?.store) return false
        
        for (const [id, recordTuple] of Object.entries(changes.updated)) {
          const isTuple = Array.isArray(recordTuple) && recordTuple.length === 2
          const oldRecord = isTuple ? recordTuple[0] : null
          const newRecord = isTuple ? recordTuple[1] : recordTuple
          
          if (!oldRecord || !newRecord) return false
          // Check if it's a shape record (not a tuple)
          const record = newRecord as any
          if (!record || typeof record !== 'object' || !('typeName' in record)) return false
          if (record.typeName !== 'shape') return false
          
          // Check if only x/y changed
          const oldX = (oldRecord as any).x
          const oldY = (oldRecord as any).y
          const newX = record.x
          const newY = record.y
          
          // If x/y didn't change, it's not a position update
          if (oldX === newX && oldY === newY) return false
          
          // Check if any other properties changed
          for (const key of Object.keys(record)) {
            if (key === 'x' || key === 'y') continue
            if (key === 'props') {
              // Deep compare props - only if both records have props
              const oldProps = (oldRecord as any)?.props || {}
              const newProps = record?.props || {}
              if (JSON.stringify(oldProps) !== JSON.stringify(newProps)) {
                return false // Props changed, not just position
              }
            } else {
              if ((oldRecord as any)[key] !== record[key]) {
                return false // Other property changed
              }
            }
          }
        }
        return true // All updates are position-only
      }
      
      return false
    }
    
    // Track recent eraser activity to detect active eraser drags
    let lastEraserActivity = 0
    let eraserToolSelected = false
    const ERASER_ACTIVITY_THRESHOLD = 2000 // Increased to 2 seconds to handle longer eraser drags
    let eraserChangeQueue: RecordsDiff<TLRecord> | null = null
    let eraserCheckInterval: NodeJS.Timeout | null = null
    
    // Helper to check if eraser tool is actively erasing (to prevent saves during eraser drag)
    const isEraserActive = (): boolean => {
      try {
        const allRecords = store.allRecords()
        
        // Check instance_page_state for erasingShapeIds (most reliable indicator)
        const instancePageState = allRecords.find((r: any) => 
          r.typeName === 'instance_page_state' && 
          (r as any).erasingShapeIds && 
          Array.isArray((r as any).erasingShapeIds) && 
          (r as any).erasingShapeIds.length > 0
        )
        
        if (instancePageState) {
          lastEraserActivity = Date.now()
          eraserToolSelected = true
          return true // Eraser is actively erasing shapes
        }
        
        // Check if eraser tool is selected
        const instance = allRecords.find((r: any) => r.typeName === 'instance')
        const currentToolId = instance ? (instance as any).currentToolId : null
        
        if (currentToolId === 'eraser') {
          eraserToolSelected = true
          const now = Date.now()
          // If eraser tool is selected, keep it active for longer to handle drags
          // Also check if there was recent activity
          if (now - lastEraserActivity < ERASER_ACTIVITY_THRESHOLD) {
            return true
          }
          // If tool is selected but no recent activity, still consider it active
          // (user might be mid-drag)
          return true
        } else {
          // Tool switched away - only consider active if very recent activity
          eraserToolSelected = false
          const now = Date.now()
          if (now - lastEraserActivity < 300) {
            return true // Very recent activity, might still be processing
          }
        }
        
        return false
      } catch (e) {
        // If we can't check, use last known state with timeout
        const now = Date.now()
        if (eraserToolSelected && now - lastEraserActivity < ERASER_ACTIVITY_THRESHOLD) {
          return true
        }
        return false
      }
    }
    
    // Track eraser activity from shape deletions
    const checkForEraserActivity = (changes: RecordsDiff<TLRecord>) => {
      // If shapes are being removed and eraser tool might be active, mark activity
      if (changes.removed) {
        const removedShapes = Object.values(changes.removed).filter((r: any) => 
          r && r.typeName === 'shape'
        )
        if (removedShapes.length > 0) {
          // Check if eraser tool is currently selected
          const allRecords = store.allRecords()
          const instance = allRecords.find((r: any) => r.typeName === 'instance')
          if (instance && (instance as any).currentToolId === 'eraser') {
            lastEraserActivity = Date.now()
            eraserToolSelected = true
          }
        }
      }
    }
    
    // Listen for changes from TLDraw and apply them to Automerge
    // CRITICAL: Listen to ALL sources, not just "user", to catch richText/text changes
    const unsubscribeTLDraw = store.listen(({ changes, source }) => {
      // Check for eraser activity from shape deletions
      checkForEraserActivity(changes)
      
      // Filter out ephemeral records that shouldn't be persisted
      // These include:
      // - instance: UI state (cursor, screen bounds, etc.)
      // - instance_page_state: selection state, editing state, etc.
      // - instance_presence: presence/awareness data
      // - camera: viewport position (x, y, z) - changes when panning/zooming
      // - pointer: pointer position - changes on mouse movement
      const ephemeralTypes = ['instance', 'instance_page_state', 'instance_presence', 'camera', 'pointer']
      
      const filterEphemeral = (records: any) => {
        if (!records) return {}
        const filtered: any = {}
        Object.entries(records).forEach(([id, record]: [string, any]) => {
          const recordObj = Array.isArray(record) ? record[1] : record
          // Check typeName from the record object
          const typeName = recordObj?.typeName
          // Also check if ID pattern matches ephemeral types (e.g., "camera:page:page")
          const idMatchesEphemeral = typeof id === 'string' && (
            id.startsWith('instance:') ||
            id.startsWith('instance_page_state:') ||
            id.startsWith('instance_presence:') ||
            id.startsWith('camera:') ||
            id.startsWith('pointer:')
          )
          
          // DEBUG: Log why records are being filtered or not
          const shouldFilter = (typeName && ephemeralTypes.includes(typeName)) || idMatchesEphemeral
          if (shouldFilter) {
            console.log(`🚫 Filtering out ephemeral record:`, {
              id,
              typeName,
              idMatchesEphemeral,
              typeNameMatches: typeName && ephemeralTypes.includes(typeName)
            })
          }
          
          // Filter out if typeName matches OR if ID pattern matches ephemeral types
          if (typeName && ephemeralTypes.includes(typeName)) {
            // Skip - this is an ephemeral record
            return
          }
          if (idMatchesEphemeral) {
            // Skip - ID pattern indicates ephemeral record (even if typeName is missing)
            return
          }
          
          // Keep this record - it's not ephemeral
          filtered[id] = record
        })
        return filtered
      }
      
      const filteredChanges = {
        added: filterEphemeral(changes.added),
        updated: filterEphemeral(changes.updated),
        removed: filterEphemeral(changes.removed),
      }
      
      // DEBUG: Log all changes to see what's being detected
      const totalChanges = Object.keys(changes.added || {}).length + Object.keys(changes.updated || {}).length + Object.keys(changes.removed || {}).length
      const filteredTotalChanges = Object.keys(filteredChanges.added || {}).length + Object.keys(filteredChanges.updated || {}).length + Object.keys(filteredChanges.removed || {}).length
      
      // DEBUG: Log ALL changes (before filtering) to see what's actually being updated
      if (totalChanges > 0) {
        const allChangedRecords: Array<{id: string, typeName: string, changeType: string}> = []
        if (changes.added) {
          Object.entries(changes.added).forEach(([id, record]: [string, any]) => {
            const recordObj = Array.isArray(record) ? record[1] : record
            allChangedRecords.push({ id, typeName: recordObj?.typeName || 'unknown', changeType: 'added' })
          })
        }
        if (changes.updated) {
          Object.entries(changes.updated).forEach(([id, [_, record]]: [string, [any, any]]) => {
            allChangedRecords.push({ id, typeName: record?.typeName || 'unknown', changeType: 'updated' })
          })
        }
        if (changes.removed) {
          Object.entries(changes.removed).forEach(([id, record]: [string, any]) => {
            const recordObj = Array.isArray(record) ? record[1] : record
            allChangedRecords.push({ id, typeName: recordObj?.typeName || 'unknown', changeType: 'removed' })
          })
        }
        console.log(`🔍 ALL changes detected (before filtering):`, {
          total: totalChanges,
          records: allChangedRecords,
          // Also log the actual record objects to see their structure
          recordDetails: allChangedRecords.map(r => {
            let record: any = null
            if (r.changeType === 'added' && changes.added) {
              const rec = (changes.added as any)[r.id]
              record = Array.isArray(rec) ? rec[1] : rec
            } else if (r.changeType === 'updated' && changes.updated) {
              const rec = (changes.updated as any)[r.id]
              record = Array.isArray(rec) ? rec[1] : rec
            } else if (r.changeType === 'removed' && changes.removed) {
              const rec = (changes.removed as any)[r.id]
              record = Array.isArray(rec) ? rec[1] : rec
            }
            return {
              id: r.id,
              typeName: r.typeName,
              changeType: r.changeType,
              hasTypeName: !!record?.typeName,
              actualTypeName: record?.typeName,
              recordKeys: record ? Object.keys(record).slice(0, 10) : []
            }
          })
        })
      }
      
      // Log if we filtered out any ephemeral changes
      if (totalChanges > 0 && filteredTotalChanges < totalChanges) {
        const filteredCount = totalChanges - filteredTotalChanges
        const filteredTypes = new Set<string>()
        const filteredIds: string[] = []
        if (changes.added) {
          Object.entries(changes.added).forEach(([id, record]: [string, any]) => {
            const recordObj = Array.isArray(record) ? record[1] : record
            if (recordObj && ephemeralTypes.includes(recordObj.typeName)) {
              filteredTypes.add(recordObj.typeName)
              filteredIds.push(id)
            }
          })
        }
        if (changes.updated) {
          Object.entries(changes.updated).forEach(([id, [_, record]]: [string, [any, any]]) => {
            if (ephemeralTypes.includes(record.typeName)) {
              filteredTypes.add(record.typeName)
              filteredIds.push(id)
            }
          })
        }
        if (changes.removed) {
          Object.entries(changes.removed).forEach(([id, record]: [string, any]) => {
            const recordObj = Array.isArray(record) ? record[1] : record
            if (recordObj && ephemeralTypes.includes(recordObj.typeName)) {
              filteredTypes.add(recordObj.typeName)
              filteredIds.push(id)
            }
          })
        }
        console.log(`🚫 Filtered out ${filteredCount} ephemeral change(s) (${Array.from(filteredTypes).join(', ')}) - not persisting`, {
          filteredIds: filteredIds.slice(0, 5), // Show first 5 IDs
          totalFiltered: filteredIds.length
        })
      }
      
      if (filteredTotalChanges > 0) {
        // Log what records are passing through the filter (shouldn't happen for ephemeral records)
        const passingRecords: Array<{id: string, typeName: string, changeType: string}> = []
        if (filteredChanges.added) {
          Object.entries(filteredChanges.added).forEach(([id, record]: [string, any]) => {
            const recordObj = Array.isArray(record) ? record[1] : record
            passingRecords.push({ id, typeName: recordObj?.typeName || 'unknown', changeType: 'added' })
          })
        }
        if (filteredChanges.updated) {
          Object.entries(filteredChanges.updated).forEach(([id, recordTuple]: [string, any]) => {
            const record = Array.isArray(recordTuple) && recordTuple.length === 2 ? recordTuple[1] : recordTuple
            passingRecords.push({ id, typeName: (record as any)?.typeName || 'unknown', changeType: 'updated' })
          })
        }
        if (filteredChanges.removed) {
          Object.entries(filteredChanges.removed).forEach(([id, record]: [string, any]) => {
            const recordObj = Array.isArray(record) ? record[1] : record
            passingRecords.push({ id, typeName: recordObj?.typeName || 'unknown', changeType: 'removed' })
          })
        }
        
        console.log(`🔍 TLDraw store changes detected (source: ${source}):`, {
          added: Object.keys(filteredChanges.added || {}).length,
          updated: Object.keys(filteredChanges.updated || {}).length,
          removed: Object.keys(filteredChanges.removed || {}).length,
          source: source,
          passingRecords: passingRecords // Show what's actually passing through
        })
        
        // DEBUG: Check for richText/text changes in updated records
        if (filteredChanges.updated) {
          Object.values(filteredChanges.updated).forEach((recordTuple: any) => {
            const record = Array.isArray(recordTuple) && recordTuple.length === 2 ? recordTuple[1] : recordTuple
            if ((record as any)?.typeName === 'shape') {
              const rec = record as any
              if (rec.type === 'geo' && rec.props?.richText) {
                console.log(`🔍 Geo shape ${rec.id} richText change detected:`, {
                  hasRichText: !!rec.props.richText,
                  richTextType: typeof rec.props.richText,
                  source: source
                })
              }
              if (rec.type === 'note' && rec.props?.richText) {
                console.log(`🔍 Note shape ${rec.id} richText change detected:`, {
                  hasRichText: !!rec.props.richText,
                  richTextType: typeof rec.props.richText,
                  richTextContentLength: Array.isArray(rec.props.richText?.content) 
                    ? rec.props.richText.content.length 
                    : 'not array',
                  source: source
                })
              }
              if (rec.type === 'arrow' && rec.props?.text !== undefined) {
                console.log(`🔍 Arrow shape ${rec.id} text change detected:`, {
                  hasText: !!rec.props.text,
                  textValue: rec.props.text,
                  source: source
                })
              }
              if (rec.type === 'text' && rec.props?.richText) {
                console.log(`🔍 Text shape ${rec.id} richText change detected:`, {
                  hasRichText: !!rec.props.richText,
                  richTextType: typeof rec.props.richText,
                  source: source
                })
              }
            }
          })
        }
        
        // DEBUG: Log added shapes to track what's being created
        if (filteredChanges.added) {
          Object.values(filteredChanges.added).forEach((record: any) => {
            const rec = Array.isArray(record) ? record[1] : record
            if (rec?.typeName === 'shape') {
              console.log(`🔍 Shape added: ${rec.type} (${rec.id})`, {
                type: rec.type,
                id: rec.id,
                hasRichText: !!rec.props?.richText,
                hasText: !!rec.props?.text,
                source: source
              })
            }
          })
        }
      }
      
      // Skip if no meaningful changes after filtering ephemeral records
      if (filteredTotalChanges === 0) {
        return
      }

      // CRITICAL: Skip broadcasting changes that came from remote sources to prevent feedback loops
      // Only broadcast changes that originated from user interactions (source === 'user')
      if (source === 'remote') {
        console.log('🔄 Skipping broadcast for remote change to prevent feedback loop')
        return
      }

      // CRITICAL: Filter out x/y coordinate changes for pinned-to-view shapes
      // When a shape is pinned, its x/y coordinates change to stay in the same screen position,
      // but we want to keep the original coordinates static in Automerge
      const filterPinnedPositionChanges = (changes: any) => {
        if (!changes || !handle) return changes
        
        const doc = handle.doc()
        if (!doc?.store) return changes
        
        // First, check if there are ANY pinned shapes in the document
        // Only filter if there are actually pinned shapes
        // Use strict equality check to ensure we only match true (not truthy values)
        const hasPinnedShapes = Object.values(doc.store).some((record: any) => {
          const isShape = record?.typeName === 'shape'
          const isPinned = record?.props?.pinnedToView === true
          return isShape && isPinned
        })
        
        // Also check the changes being processed to see if any shapes are pinned
        let hasPinnedShapesInChanges = false
        if (changes.updated) {
          hasPinnedShapesInChanges = Object.entries(changes.updated).some(([id, recordTuple]: [string, any]) => {
            const isTuple = Array.isArray(recordTuple) && recordTuple.length === 2
            const newRecord = isTuple ? recordTuple[1] : recordTuple
            const isShape = newRecord?.typeName === 'shape'
            const isPinned = (newRecord.props as any)?.pinnedToView === true
            // Also verify in the doc that it's actually pinned
            const docShape = doc.store[id]
            const isPinnedInDoc = docShape?.props?.pinnedToView === true
            return isShape && isPinned && isPinnedInDoc
        })
        }
        
        // If there are no pinned shapes in either the doc or the changes, skip filtering entirely
        if (!hasPinnedShapes && !hasPinnedShapesInChanges) {
          return changes
        }
        
        const filtered: any = { ...changes }
        
        // Check updated shapes for pinned position changes
        if (filtered.updated) {
          const updatedEntries = Object.entries(filtered.updated)
          const filteredUpdated: any = {}
          
          updatedEntries.forEach(([id, recordTuple]: [string, any]) => {
            // TLDraw store changes use tuple format [oldRecord, newRecord] for updates
            const isTuple = Array.isArray(recordTuple) && recordTuple.length === 2
            const oldRecord = isTuple ? recordTuple[0] : null
            const newRecord = isTuple ? recordTuple[1] : recordTuple
            const record = newRecord
            
            // Get the original shape from Automerge doc to verify it's actually pinned
              const originalShape = doc.store[id]
            
            // STRICT CHECK: Must be a shape, must have pinnedToView === true in BOTH the record AND the doc
            const isShape = record?.typeName === 'shape'
            const isPinnedInRecord = (record.props as any)?.pinnedToView === true
            const isPinnedInDoc = originalShape?.props?.pinnedToView === true
            
            // Only filter if the shape is actually pinned in BOTH places
            if (isShape && isPinnedInRecord && isPinnedInDoc) {
              if (originalShape) {
                const originalX = originalShape.x
                const originalY = originalShape.y
                const newX = (record as any).x
                const newY = (record as any).y
                
                // If only x/y coordinates changed, restore original coordinates
                // Compare all other properties to see if anything else changed
                const otherPropsChanged = Object.keys(record).some(key => {
                  if (key === 'x' || key === 'y') return false
                  if (key === 'props') {
                    // Check if props changed (excluding pinnedToView changes)
                    const oldProps = oldRecord?.props || originalShape?.props || {}
                    const newProps = record.props || {}
                    // Deep compare props (excluding pinnedToView which might change)
                    const oldPropsCopy = { ...oldProps }
                    const newPropsCopy = { ...newProps }
                    delete oldPropsCopy.pinnedToView
                    delete newPropsCopy.pinnedToView
                    return JSON.stringify(oldPropsCopy) !== JSON.stringify(newPropsCopy)
                  }
                  const oldValue = oldRecord?.[key] ?? originalShape?.[key]
                  return oldValue !== record[key]
                })
                
                // If only position changed (x/y), restore original coordinates
                if (!otherPropsChanged && (newX !== originalX || newY !== originalY)) {
                  console.log(`🚫 Filtering out x/y coordinate change for pinned shape ${id}: (${newX}, ${newY}) -> keeping original (${originalX}, ${originalY})`)
                  // Restore original coordinates
                  const recordWithOriginalCoords = {
                    ...record,
                    x: originalX,
                    y: originalY
                  }
                  filteredUpdated[id] = isTuple 
                    ? [oldRecord, recordWithOriginalCoords]
                    : recordWithOriginalCoords
                } else if (otherPropsChanged) {
                  // Other properties changed, keep the update but restore coordinates
                  const recordWithOriginalCoords = {
                    ...record,
                    x: originalX,
                    y: originalY
                  }
                  filteredUpdated[id] = isTuple
                    ? [oldRecord, recordWithOriginalCoords]
                    : recordWithOriginalCoords
                } else {
                  // No changes or only non-position changes, keep as is
                  filteredUpdated[id] = recordTuple
                }
              } else {
                // Shape not in doc yet, keep as is
                filteredUpdated[id] = recordTuple
              }
            } else {
              // Not a pinned shape (or not pinned in both places), keep as is
              filteredUpdated[id] = recordTuple
            }
          })
          
          filtered.updated = filteredUpdated
        }
        
        return filtered
      }
      
      const finalFilteredChanges = filterPinnedPositionChanges(filteredChanges)
      
      // Check if this is a position-only update that should be throttled
      const isPositionOnly = isPositionOnlyUpdate(finalFilteredChanges)

      // Log what type of change this is for debugging
      const changeType = Object.keys(finalFilteredChanges.added || {}).length > 0 ? 'added' :
                         Object.keys(finalFilteredChanges.removed || {}).length > 0 ? 'removed' :
                         isPositionOnly ? 'position-only' : 'property-change'

      // DEBUG: Log dimension changes for shapes
      if (finalFilteredChanges.updated) {
        Object.entries(finalFilteredChanges.updated).forEach(([id, recordTuple]: [string, any]) => {
          const isTuple = Array.isArray(recordTuple) && recordTuple.length === 2
          const oldRecord = isTuple ? recordTuple[0] : null
          const newRecord = isTuple ? recordTuple[1] : recordTuple
          if (newRecord?.typeName === 'shape') {
            const oldProps = oldRecord?.props || {}
            const newProps = newRecord?.props || {}
            if (oldProps.w !== newProps.w || oldProps.h !== newProps.h) {
              console.log(`🔍 Shape dimension change detected for ${newRecord.type} ${id}:`, {
                oldDims: { w: oldProps.w, h: oldProps.h },
                newDims: { w: newProps.w, h: newProps.h },
                source
              })
            }
          }
        })
      }

      console.log(`🔍 Change detected: ${changeType}, will ${isPositionOnly ? 'throttle' : 'broadcast immediately'}`, {
        added: Object.keys(finalFilteredChanges.added || {}).length,
        updated: Object.keys(finalFilteredChanges.updated || {}).length,
        removed: Object.keys(finalFilteredChanges.removed || {}).length,
        source
      })

      if (isPositionOnly && positionUpdateQueue === null) {
        // Start a new queue for position updates
        positionUpdateQueue = finalFilteredChanges
        
        // Clear any existing timeout
        if (positionUpdateTimeout) {
          clearTimeout(positionUpdateTimeout)
        }
        
        // Schedule flush after throttle period
        positionUpdateTimeout = setTimeout(() => {
          flushPositionUpdates()
          positionUpdateTimeout = null
        }, POSITION_UPDATE_THROTTLE_MS)
        
        return // Don't save immediately, wait for throttle
      } else if (isPositionOnly && positionUpdateQueue !== null) {
        // Merge with existing position update queue
        // Merge added records
        if (finalFilteredChanges.added) {
          positionUpdateQueue.added = {
            ...(positionUpdateQueue.added || {}),
            ...finalFilteredChanges.added
          }
        }
        // Merge updated records (keep latest)
        if (finalFilteredChanges.updated) {
          positionUpdateQueue.updated = {
            ...(positionUpdateQueue.updated || {}),
            ...finalFilteredChanges.updated
          }
        }
        // Merge removed records
        if (finalFilteredChanges.removed) {
          positionUpdateQueue.removed = {
            ...(positionUpdateQueue.removed || {}),
            ...finalFilteredChanges.removed
          }
        }
        
        // Reset the timeout
        if (positionUpdateTimeout) {
          clearTimeout(positionUpdateTimeout)
        }
        positionUpdateTimeout = setTimeout(() => {
          flushPositionUpdates()
          positionUpdateTimeout = null
        }, POSITION_UPDATE_THROTTLE_MS)
        
        return // Don't save immediately, wait for throttle
      } else {
        // Not a position-only update, or we have non-position changes
        // Flush any queued position updates first
        if (positionUpdateQueue) {
          flushPositionUpdates()
        }

        // CRITICAL: Don't skip changes - always save them to ensure consistency
        // The local change timestamp is only used to prevent immediate feedback loops
        // We should always save TLDraw changes, even if they came from Automerge sync
        // This ensures that all shapes (notes, rectangles, etc.) are consistently persisted
        
        try {
          // CRITICAL: Check if eraser is actively erasing - if so, defer the save
          const eraserActive = isEraserActive()
          
          if (eraserActive) {
            // Eraser is active - queue the changes and apply when eraser becomes inactive
            // Merge with existing queued changes
            if (eraserChangeQueue) {
              // Merge added records
              if (finalFilteredChanges.added) {
                eraserChangeQueue.added = {
                  ...(eraserChangeQueue.added || {}),
                  ...finalFilteredChanges.added
                }
              }
              // Merge updated records (keep latest)
              if (finalFilteredChanges.updated) {
                eraserChangeQueue.updated = {
                  ...(eraserChangeQueue.updated || {}),
                  ...finalFilteredChanges.updated
                }
              }
              // Merge removed records
              if (finalFilteredChanges.removed) {
                eraserChangeQueue.removed = {
                  ...(eraserChangeQueue.removed || {}),
                  ...finalFilteredChanges.removed
                }
              }
            } else {
              eraserChangeQueue = finalFilteredChanges
            }
            
            // Start checking for when eraser becomes inactive
            if (!eraserCheckInterval) {
              eraserCheckInterval = setInterval(() => {
                const stillActive = isEraserActive()
                if (!stillActive && eraserChangeQueue) {
                  // Eraser is no longer active - flush queued changes
                  const queuedChanges = eraserChangeQueue
                  eraserChangeQueue = null
                  
                  if (eraserCheckInterval) {
                    clearInterval(eraserCheckInterval)
                    eraserCheckInterval = null
                  }
                  
                  // Apply queued changes immediately
                  try {
                    isLocalChange = true
                    handle.change((doc) => {
                      applyTLStoreChangesToAutomerge(doc, queuedChanges)
                    })
                    // Trigger sync to broadcast eraser changes
                    const changedRecords = [
                      ...Object.values(queuedChanges.added || {}),
                      ...Object.values(queuedChanges.updated || {}),
                      ...Object.values(queuedChanges.removed || {})
                    ]
                    broadcastJsonSync(changedRecords)
                  } catch (error) {
                    console.error('❌ Error applying queued eraser changes:', error)
                  }
                }
              }, 50) // Check every 50ms for faster response
            }
            
            return // Don't save immediately while eraser is active
          } else {
            // If eraser was active but now isn't, flush any queued changes first
            if (eraserChangeQueue) {
              const queuedChanges = eraserChangeQueue
              eraserChangeQueue = null
              
              if (eraserCheckInterval) {
                clearInterval(eraserCheckInterval)
                eraserCheckInterval = null
              }
              
              // Merge current changes with queued changes
              const mergedChanges: RecordsDiff<TLRecord> = {
                added: { ...(queuedChanges.added || {}), ...(finalFilteredChanges.added || {}) },
                updated: { ...(queuedChanges.updated || {}), ...(finalFilteredChanges.updated || {}) },
                removed: { ...(queuedChanges.removed || {}), ...(finalFilteredChanges.removed || {}) }
              }

              requestAnimationFrame(() => {
                isLocalChange = true
                handle.change((doc) => {
                  applyTLStoreChangesToAutomerge(doc, mergedChanges)
                })
                // Trigger sync to broadcast merged changes
                const changedRecords = [
                  ...Object.values(mergedChanges.added || {}),
                  ...Object.values(mergedChanges.updated || {}),
                  ...Object.values(mergedChanges.removed || {})
                ]
                broadcastJsonSync(changedRecords)
              })
              
              return
            }
            // OPTIMIZED: Use requestIdleCallback to defer Automerge changes when browser is idle
            // This prevents blocking mouse interactions without queuing changes
            const applyChanges = () => {
              // Mark to prevent feedback loop when this change comes back from Automerge
              isLocalChange = true

              handle.change((doc) => {
                applyTLStoreChangesToAutomerge(doc, finalFilteredChanges)
              })

              // CRITICAL: Manually trigger JSON sync broadcast to other clients
              // Use requestAnimationFrame to defer this slightly so the change is fully processed
              const changedRecords = [
                ...Object.values(finalFilteredChanges.added || {}),
                ...Object.values(finalFilteredChanges.updated || {}),
                ...Object.values(finalFilteredChanges.removed || {})
              ]
              requestAnimationFrame(() => broadcastJsonSync(changedRecords))
            }
            
            // Use requestIdleCallback if available to apply changes when browser is idle
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(applyChanges, { timeout: 100 })
            } else {
              // Fallback: use requestAnimationFrame for next frame
              requestAnimationFrame(applyChanges)
            }
          }
          
          // Only log if there are many changes or if debugging is needed
          if (filteredTotalChanges > 3) {
            console.log(`✅ Applied ${filteredTotalChanges} TLDraw changes to Automerge document`)
          } else if (filteredTotalChanges > 0) {
            console.log(`✅ Applied ${filteredTotalChanges} TLDraw change(s) to Automerge document`)
          }
          
          // Check if the document actually changed
          const docAfter = handle.doc()
        } catch (error) {
          console.error("Error applying TLDraw changes to Automerge:", error)
        }
      }
    }, {
      // CRITICAL: Don't filter by source - listen to ALL changes
      // This ensures we catch richText/text changes regardless of their source
      // (TLDraw might emit these changes with a different source than "user")
      scope: "document",
    })

    unsubs.push(
      () => handle.off("change", automergeChangeHandler),
      unsubscribeTLDraw,
      () => {
        // Cleanup: flush any pending position updates and clear timeout
        if (positionUpdateTimeout) {
          clearTimeout(positionUpdateTimeout)
          positionUpdateTimeout = null
        }
        if (positionUpdateQueue) {
          flushPositionUpdates()
        }
        // Cleanup: flush any pending eraser changes and clear interval
        if (eraserCheckInterval) {
          clearInterval(eraserCheckInterval)
          eraserCheckInterval = null
        }
        if (eraserChangeQueue) {
          // Flush queued eraser changes on unmount
          const queuedChanges = eraserChangeQueue
          eraserChangeQueue = null
          if (handle) {
            isLocalChange = true
            handle.change((doc) => {
              applyTLStoreChangesToAutomerge(doc, queuedChanges)
            })
          }
        }
      }
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
            
            // REMOVED: Aggressive shape refresh that was causing coordinate loss
            // Shapes should be visible through normal patch application
            // If shapes aren't visible, it's likely a different issue that refresh won't fix
            
            setStoreWithStatus({
              store,
              status: "synced-remote",
              connectionStatus: "online",
            })
            return
          }
          
          // If doc has data but store doesn't, patches should have been generated when data was written
          // The automergeChangeHandler (set up above) should process them automatically
          // Just wait a bit for patches to be processed, then set status
          if (docShapes > 0 && existingStoreShapes.length === 0) {
            console.log(`📊 Doc has ${docShapes} shapes but store is empty. Waiting for patches to be processed by handler...`)
            
            // Wait briefly for patches to be processed by automergeChangeHandler
            // The handler is already set up, so it should catch patches from the initial data load
            let attempts = 0
            const maxAttempts = 10 // Wait up to 2 seconds (10 * 200ms)
            
            await new Promise<void>(resolve => {
              const checkForPatches = () => {
                attempts++
                const currentShapes = store.allRecords().filter((r: any) => r.typeName === 'shape')
                
                if (currentShapes.length > 0) {
                  console.log(`✅ Patches applied successfully: ${currentShapes.length} shapes loaded via patches`)
                  
                  // REMOVED: Aggressive shape refresh that was causing coordinate loss
                  // Shapes loaded via patches should be visible without forced refresh
                  
                  setStoreWithStatus({
                    store,
                    status: "synced-remote",
                    connectionStatus: "online",
                  })
                  resolve()
                } else if (attempts < maxAttempts) {
                  setTimeout(checkForPatches, 200)
                } else {
                  // Patches didn't come through - this should be rare if handler is set up before data load
                  // Log a warning but don't show disruptive confirmation dialog
                  console.warn(`⚠️ No patches received after ${maxAttempts} attempts for room initialization.`)
                  console.warn(`⚠️ This may happen if Automerge doc was initialized with server data before handler was ready.`)
                  console.warn(`⚠️ Store will remain empty - patches should handle data loading in normal operation.`)
                  
                  // Simplified fallback: Just log and continue with empty store
                  // Patches should handle data loading, so if they don't come through,
                  // it's likely the document is actually empty or there's a timing issue
                  // that will resolve on next sync
                  
                  setStoreWithStatus({
                    store,
                    status: "synced-remote",
                    connectionStatus: "online",
                  })
                  resolve()
                }
              }
              
              // Start checking immediately since handler is already set up
              setTimeout(checkForPatches, 100)
            })
            
            return
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
  adapter?: any
}) {
  const { handle, store, userMetadata, adapter } = params
  const presenceRef = useRef<Map<string, any>>(new Map())

  // Broadcast local presence to other clients
  useEffect(() => {
    if (!handle || !store || !adapter) {
      return
    }

    // Listen for changes to instance_presence records in the store
    // These represent user cursors, selections, etc.
    const handleStoreChange = () => {
      if (!store) return

      const allRecords = store.allRecords()

      // Filter for ALL presence-related records
      // instance_presence: Contains user cursor, name, color - THIS IS WHAT WE NEED!
      // instance_page_state: Contains selections, editing state
      // pointer: Contains pointer position
      const presenceRecords = allRecords.filter((r: any) => {
        const isPresenceType = r.typeName === 'instance_presence' ||
                               r.typeName === 'instance_page_state' ||
                               r.typeName === 'pointer'

        const hasPresenceId = r.id?.startsWith('instance_presence:') ||
                              r.id?.startsWith('instance_page_state:') ||
                              r.id?.startsWith('pointer:')

        return isPresenceType || hasPresenceId
      })

      if (presenceRecords.length > 0) {
        // Send presence update via WebSocket
        try {
          const presenceData: any = {}
          presenceRecords.forEach((record: any) => {
            presenceData[record.id] = record
          })

          adapter.send({
            type: 'presence',
            userId: userMetadata.userId,
            userName: userMetadata.name,
            userColor: userMetadata.color,
            data: presenceData
          })
        } catch (error) {
          console.error('Error broadcasting presence:', error)
        }
      }
    }

    // Throttle presence updates to avoid overwhelming the network
    const throttledUpdate = throttle(handleStoreChange, 100)

    const unsubscribe = store.listen(throttledUpdate, { scope: 'all' })

    return () => {
      unsubscribe()
    }
  }, [handle, store, userMetadata, adapter])

  return {
    updatePresence: () => {},
    presence: presenceRef.current,
  }
}
