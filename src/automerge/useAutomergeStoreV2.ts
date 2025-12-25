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
import { MycroZineGeneratorShape } from "@/shapes/MycroZineGeneratorShapeUtil"
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
// MycelialIntelligence moved to permanent UI bar - shape kept for backwards compatibility
import { MycelialIntelligenceShape } from "@/shapes/MycelialIntelligenceShapeUtil"
// Open Mapping - OSM map shape for geographic visualization
import { MapShape } from "@/shapes/MapShapeUtil"
// Calendar shape for calendar functionality
import { CalendarShape } from "@/shapes/CalendarShapeUtil"
import { CalendarEventShape } from "@/shapes/CalendarEventShapeUtil"
// Drawfast shape for quick drawing/sketching
import { DrawfastShape } from "@/shapes/DrawfastShapeUtil"
// Additional shapes from Board.tsx
import { HolonBrowserShape } from "@/shapes/HolonBrowserShapeUtil"
import { PrivateWorkspaceShape } from "@/shapes/PrivateWorkspaceShapeUtil"
import { GoogleItemShape } from "@/shapes/GoogleItemShapeUtil"
import { WorkflowBlockShape } from "@/shapes/WorkflowBlockShapeUtil"

export function useAutomergeStoreV2({
  handle,
  userId: _userId,
  adapter,
  isNetworkOnline = true,
}: {
  handle: DocHandle<any>
  userId: string
  adapter?: any
  isNetworkOnline?: boolean
}): TLStoreWithStatus {
  // useAutomergeStoreV2 initializing
  
  // Create store with shape utils and explicit schema for all custom shapes
  // Note: Some shapes don't have `static override props`, so we must explicitly list them all
  const [store] = useState(() => {
    const shapeUtils = [
      ChatBoxShape,
      VideoChatShape,
      EmbedShape,
      MarkdownShape,
      MycrozineTemplateShape,
      MycroZineGeneratorShape,
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
      MycelialIntelligenceShape, // Deprecated - kept for backwards compatibility
      MapShape, // Open Mapping - OSM map shape
      CalendarShape, // Calendar with view switching
      CalendarEventShape, // Calendar individual events
      DrawfastShape, // Drawfast quick sketching
      HolonBrowserShape, // Holon browser
      PrivateWorkspaceShape, // Private workspace for Google Export
      GoogleItemShape, // Individual Google items
      WorkflowBlockShape, // Workflow builder blocks
    ]

    // CRITICAL: Explicitly list ALL custom shape types to ensure they're registered
    // This is a fallback in case dynamic extraction from shape utils fails
    const knownCustomShapeTypes = [
      'ChatBox',
      'VideoChat',
      'Embed',
      'Markdown',
      'MycrozineTemplate',
      'MycroZineGenerator',
      'Slide',
      'Prompt',
      'Transcription',
      'ObsNote',
      'FathomNote',
      'Holon',
      'ObsidianBrowser',
      'FathomMeetingsBrowser',
      'ImageGen',
      'VideoGen',
      'Multmux',
      'MycelialIntelligence', // Deprecated - kept for backwards compatibility
      'Map', // Open Mapping - OSM map shape
      'Calendar', // Calendar with view switching
      'CalendarEvent', // Calendar individual events
      'Drawfast', // Drawfast quick sketching
      'HolonBrowser', // Holon browser
      'PrivateWorkspace', // Private workspace for Google Export
      'GoogleItem', // Individual Google items
      'WorkflowBlock', // Workflow builder blocks
    ]

    // Build schema with explicit entries for all custom shapes
    const customShapeSchemas: Record<string, any> = {}

    // First, register all known custom shape types with empty schemas as fallback
    knownCustomShapeTypes.forEach(type => {
      customShapeSchemas[type] = {} as any
    })

    // Then, override with actual props for shapes that have them defined
    shapeUtils.forEach((util) => {
      const type = (util as any).type
      if (type && (util as any).props) {
        // Shape has static props - use them for proper validation
        customShapeSchemas[type] = {
          props: (util as any).props,
          migrations: (util as any).migrations,
        }
      }
    })

    // Log what shapes were registered for debugging
    // Custom shape schemas registered

    const customSchema = createTLSchema({
      shapes: {
        ...defaultShapeSchemas,
        ...customShapeSchemas,
      },
      bindings: defaultBindingSchemas,
    })

    const store = createTLStore({
      schema: customSchema,
      shapeUtils: shapeUtils,
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
      // Store synced
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

    // Track pending local changes using a COUNTER instead of a boolean.
    // The old boolean approach failed because during rapid changes (like dragging),
    // multiple echoes could arrive but only the first was skipped.
    // With a counter:
    // - Increment before each handle.change()
    // - Decrement (and skip) for each echo that arrives
    // - Process changes only when counter is 0 (those are remote changes)
    let pendingLocalChanges = 0

    // Helper function to broadcast changes via JSON sync
    // DISABLED: This causes last-write-wins conflicts
    // Automerge should handle sync automatically via binary protocol
    // We're keeping this function but disabling all actual broadcasting
    const broadcastJsonSync = (addedOrUpdatedRecords: any[], deletedRecordIds: string[] = []) => {
      // TEMPORARY FIX: Manually broadcast changes via WebSocket since Automerge Repo sync isn't working
      // This sends the full changed records as JSON to other clients
      // TODO: Fix Automerge Repo's binary sync protocol to work properly

      if ((!addedOrUpdatedRecords || addedOrUpdatedRecords.length === 0) && deletedRecordIds.length === 0) {
        return
      }

      // Broadcasting changes via JSON sync (logging disabled for performance)

      if (adapter && typeof (adapter as any).send === 'function') {
        // Send changes to other clients via the network adapter
        // CRITICAL: Always include a documentId for the server to process correctly
        const docId: string = handle?.documentId || `automerge:${Date.now()}`;
        const adapterSend = (adapter as any).send.bind(adapter);
        adapterSend({
          type: 'sync',
          data: {
            store: Object.fromEntries(addedOrUpdatedRecords.map(r => [r.id, r])),
            deleted: deletedRecordIds // Include list of deleted record IDs
          },
          documentId: docId,
          timestamp: Date.now()
        })
      } else {
        console.warn('⚠️ Cannot broadcast - adapter not available')
      }
    }

    // Listen for changes from Automerge and apply them to TLDraw
    const automergeChangeHandler = (payload: DocHandleChangePayload<any>) => {
      const patchCount = payload.patches?.length || 0

      // Skip echoes of our own local changes using a counter.
      // Each local handle.change() increments the counter, and each echo decrements it.
      // Only process changes when counter is 0 (those are remote changes from other clients).
      if (pendingLocalChanges > 0) {
        pendingLocalChanges--
        return
      }

      try {
        // Apply patches from Automerge to TLDraw store
        if (payload.patches && payload.patches.length > 0) {
          try {
            // CRITICAL: Pass Automerge document to patch handler so it can read full records
            // This prevents coordinates from defaulting to 0,0 when patches create new records
            const automergeDoc = handle.doc()
            applyAutomergePatchesToTLStore(payload.patches, store, automergeDoc)
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
              // Partial patches applied
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
              return false
            }
            return true
          })
          
          if (filteredRecords.length > 0) {
            store.mergeRemoteChanges(() => {
              const pageRecords = filteredRecords.filter(r => r.typeName === 'page')
              const shapeRecords = filteredRecords.filter(r => r.typeName === 'shape')
              const otherRecords = filteredRecords.filter(r => r.typeName !== 'page' && r.typeName !== 'shape')
              const recordsToAdd = [...pageRecords, ...otherRecords, ...shapeRecords]
              store.put(recordsToAdd)
            })
          }
        } catch (error) {
          console.error(`❌ Error manually processing initial data:`, error)
        }
      }
    }

    // Throttle position-only updates (x/y changes) to reduce automerge saves during movement
    let positionUpdateQueue: RecordsDiff<TLRecord> | null = null
    let positionUpdateTimeout: NodeJS.Timeout | null = null
    const POSITION_UPDATE_THROTTLE_MS = 50 // Save position updates every 50ms for near real-time feel
    
    const flushPositionUpdates = () => {
      if (positionUpdateQueue && handle) {
        const queuedChanges = positionUpdateQueue
        positionUpdateQueue = null

        // Apply immediately for real-time sync
        try {
          pendingLocalChanges++
          handle.change((doc) => {
            applyTLStoreChangesToAutomerge(doc, queuedChanges)
          })
          // Trigger sync to broadcast position updates
          // CRITICAL: updated records are [before, after] tuples - extract the 'after' value
          const addedOrUpdatedRecords = [
            ...Object.values(queuedChanges.added || {}),
            ...Object.values(queuedChanges.updated || {}).map((tuple: any) => Array.isArray(tuple) ? tuple[1] : tuple)
          ]
          const deletedRecordIds = Object.keys(queuedChanges.removed || {})
          broadcastJsonSync(addedOrUpdatedRecords, deletedRecordIds)
        } catch (error) {
          console.error("Error applying throttled position updates to Automerge:", error)
        }
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
    let lastEraserCheckTime = 0
    let cachedEraserActive = false
    const ERASER_ACTIVITY_THRESHOLD = 2000 // Increased to 2 seconds to handle longer eraser drags
    const ERASER_CHECK_CACHE_MS = 100 // Only refresh eraser state every 100ms to avoid expensive checks
    let eraserChangeQueue: RecordsDiff<TLRecord> | null = null
    let eraserCheckInterval: NodeJS.Timeout | null = null

    // Helper to check if eraser tool is actively erasing (to prevent saves during eraser drag)
    // OPTIMIZED: Uses cached state and only refreshes periodically to avoid expensive store.allRecords() calls
    const isEraserActive = (): boolean => {
      const now = Date.now()

      // Use cached result if checked recently
      if (now - lastEraserCheckTime < ERASER_CHECK_CACHE_MS) {
        return cachedEraserActive
      }
      lastEraserCheckTime = now

      // If eraser was selected and recent activity, assume still active
      if (eraserToolSelected && now - lastEraserActivity < ERASER_ACTIVITY_THRESHOLD) {
        cachedEraserActive = true
        return true
      }

      // If no recent eraser activity and not marked as selected, quickly return false
      if (!eraserToolSelected && now - lastEraserActivity > ERASER_ACTIVITY_THRESHOLD) {
        cachedEraserActive = false
        return false
      }

      // Only do expensive check if eraser might be transitioning
      try {
        // Use store.get() for specific records instead of allRecords() for better performance
        const instancePageState = store.get('instance_page_state:page:page' as any)

        // Check instance_page_state for erasingShapeIds (most reliable indicator)
        if (instancePageState &&
            (instancePageState as any).erasingShapeIds &&
            Array.isArray((instancePageState as any).erasingShapeIds) &&
            (instancePageState as any).erasingShapeIds.length > 0) {
          lastEraserActivity = now
          eraserToolSelected = true
          cachedEraserActive = true
          return true // Eraser is actively erasing shapes
        }

        // Check if eraser tool is selected
        const instance = store.get('instance:instance' as any)
        const currentToolId = instance ? (instance as any).currentToolId : null

        if (currentToolId === 'eraser') {
          eraserToolSelected = true
          lastEraserActivity = now
          cachedEraserActive = true
          return true
        } else {
          eraserToolSelected = false
        }

        cachedEraserActive = false
        return false
      } catch (e) {
        // If we can't check, use last known state with timeout
        if (eraserToolSelected && now - lastEraserActivity < ERASER_ACTIVITY_THRESHOLD) {
          cachedEraserActive = true
          return true
        }
        cachedEraserActive = false
        return false
      }
    }
    
    // Track eraser activity from shape deletions
    // OPTIMIZED: Only check for eraser tool when shapes are removed, and use cached tool state
    const checkForEraserActivity = (changes: RecordsDiff<TLRecord>) => {
      // If shapes are being removed and eraser tool might be active, mark activity
      if (changes.removed) {
        const removedKeys = Object.keys(changes.removed)
        // Quick check: if no shape keys, skip
        const hasRemovedShapes = removedKeys.some(key => key.startsWith('shape:'))
        if (hasRemovedShapes) {
          // Use cached eraserToolSelected state if recent, avoid expensive allRecords() call
          const now = Date.now()
          if (eraserToolSelected || now - lastEraserActivity < ERASER_ACTIVITY_THRESHOLD) {
            lastEraserActivity = now
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
      
      // Calculate change counts (minimal, needed for early return)
      const filteredTotalChanges = Object.keys(filteredChanges.added || {}).length + Object.keys(filteredChanges.updated || {}).length + Object.keys(filteredChanges.removed || {}).length

      // Skip if no meaningful changes after filtering ephemeral records
      if (filteredTotalChanges === 0) {
        return
      }

      // CRITICAL: Skip broadcasting changes that came from remote sources to prevent feedback loops
      // Only broadcast changes that originated from user interactions (source === 'user')
      if (source === 'remote') {
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
                    pendingLocalChanges++
                    handle.change((doc) => {
                      applyTLStoreChangesToAutomerge(doc, queuedChanges)
                    })
                    // Trigger sync to broadcast eraser changes
                    // CRITICAL: updated records are [before, after] tuples - extract the 'after' value
                    const addedOrUpdatedRecords = [
                      ...Object.values(queuedChanges.added || {}),
                      ...Object.values(queuedChanges.updated || {}).map((tuple: any) => Array.isArray(tuple) ? tuple[1] : tuple)
                    ]
                    const deletedRecordIds = Object.keys(queuedChanges.removed || {})
                    broadcastJsonSync(addedOrUpdatedRecords, deletedRecordIds)
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

              // Apply immediately for real-time sync
              pendingLocalChanges++
              handle.change((doc) => {
                applyTLStoreChangesToAutomerge(doc, mergedChanges)
              })
              // Trigger sync to broadcast merged changes
              // CRITICAL: updated records are [before, after] tuples - extract the 'after' value
              const addedOrUpdatedRecords = [
                ...Object.values(mergedChanges.added || {}),
                ...Object.values(mergedChanges.updated || {}).map((tuple: any) => Array.isArray(tuple) ? tuple[1] : tuple)
              ]
              const deletedRecordIds = Object.keys(mergedChanges.removed || {})
              broadcastJsonSync(addedOrUpdatedRecords, deletedRecordIds)
              
              return
            }
            // Apply changes immediately for real-time sync (no deferral)
            // The old requestIdleCallback approach caused multi-second delays
            pendingLocalChanges++
            handle.change((doc) => {
              applyTLStoreChangesToAutomerge(doc, finalFilteredChanges)
            })

            // CRITICAL: Broadcast immediately for real-time collaboration
            // CRITICAL: updated records are [before, after] tuples - extract the 'after' value
            const addedOrUpdatedRecords = [
              ...Object.values(finalFilteredChanges.added || {}),
              ...Object.values(finalFilteredChanges.updated || {}).map((tuple: any) => Array.isArray(tuple) ? tuple[1] : tuple)
            ]
            const deletedRecordIds = Object.keys(finalFilteredChanges.removed || {})
            broadcastJsonSync(addedOrUpdatedRecords, deletedRecordIds)
          }
          
          // Logging disabled for performance during continuous drawing
          
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
            pendingLocalChanges++
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

        // Determine connection status based on network state
        const connectionStatus = isNetworkOnline ? "online" : "offline"

        if (doc.store) {
          const storeKeys = Object.keys(doc.store)
          const docShapes = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length

          // If store already has shapes, patches have been applied (dev mode behavior)
          if (existingStoreShapes.length > 0) {

            // REMOVED: Aggressive shape refresh that was causing coordinate loss
            // Shapes should be visible through normal patch application
            // If shapes aren't visible, it's likely a different issue that refresh won't fix

            setStoreWithStatus({
              store,
              status: "synced-remote",
              connectionStatus,
            })
            return
          }

          // OFFLINE FAST PATH: When offline with local data, load immediately
          // Don't wait for patches that will never come from the network
          if (!isNetworkOnline && docShapes > 0) {

            // Manually load data from Automerge doc since patches won't come through
            try {
              const allRecords: TLRecord[] = []
              Object.entries(doc.store).forEach(([id, record]: [string, any]) => {
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
                  return false
                }
                return true
              })

              if (filteredRecords.length > 0) {
                store.mergeRemoteChanges(() => {
                  const pageRecords = filteredRecords.filter(r => r.typeName === 'page')
                  const shapeRecords = filteredRecords.filter(r => r.typeName === 'shape')
                  const otherRecords = filteredRecords.filter(r => r.typeName !== 'page' && r.typeName !== 'shape')
                  const recordsToAdd = [...pageRecords, ...otherRecords, ...shapeRecords]
                  store.put(recordsToAdd)
                })
              }
            } catch (error) {
              console.error(`❌ Error loading offline data:`, error)
            }

            setStoreWithStatus({
              store,
              status: "synced-remote", // Use synced-remote so Board renders
              connectionStatus: "offline",
            })
            return
          }

          // If doc has data but store doesn't, patches should have been generated when data was written
          // The automergeChangeHandler (set up above) should process them automatically
          // Just wait a bit for patches to be processed, then set status
          if (docShapes > 0 && existingStoreShapes.length === 0) {

            // Wait briefly for patches to be processed by automergeChangeHandler
            // The handler is already set up, so it should catch patches from the initial data load
            let attempts = 0
            const maxAttempts = 10 // Wait up to 2 seconds (10 * 200ms)

            await new Promise<void>(resolve => {
              const checkForPatches = () => {
                attempts++
                const currentShapes = store.allRecords().filter((r: any) => r.typeName === 'shape')

                if (currentShapes.length > 0) {

                  // REMOVED: Aggressive shape refresh that was causing coordinate loss
                  // Shapes loaded via patches should be visible without forced refresh

                  setStoreWithStatus({
                    store,
                    status: "synced-remote",
                    connectionStatus,
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
                    connectionStatus,
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
            setStoreWithStatus({
              store,
              status: "synced-remote",
              connectionStatus,
            })
            return
          }
        } else {
          // No store in doc - empty document
          setStoreWithStatus({
            store,
            status: "synced-remote",
            connectionStatus: isNetworkOnline ? "online" : "offline",
          })
          return
        }
      } catch (error) {
        console.error("Error in patch-based initialization:", error)
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: isNetworkOnline ? "online" : "offline",
        })
      }
    }
    
    initializeStore()

      return () => {
        unsubs.forEach((unsub) => unsub())
      }
    }, [handle, store, isNetworkOnline])
    
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
