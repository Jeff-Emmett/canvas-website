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

import { applyAutomergePatchesToTLStore } from "./AutomergeToTLStore.js"
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
          try {
            applyAutomergePatchesToTLStore(payload.patches, store)
            // Only log if there are many patches or if debugging is needed
            if (payload.patches.length > 5) {
              console.log(`✅ Successfully applied ${payload.patches.length} patches`)
            }
          } catch (patchError) {
            console.error("Error applying patches, attempting individual patch application:", patchError)
            // Try applying patches one by one to identify problematic ones
            let successCount = 0
            for (const patch of payload.patches) {
              try {
                applyAutomergePatchesToTLStore([patch], store)
                successCount++
              } catch (individualPatchError) {
                console.error(`Failed to apply individual patch:`, individualPatchError)
                // Log the problematic patch for debugging
                console.error("Problematic patch details:", {
                  action: patch.action,
                  path: patch.path,
                  value: 'value' in patch ? patch.value : undefined,
                  patchId: patch.path[1],
                  errorMessage: individualPatchError instanceof Error ? individualPatchError.message : String(individualPatchError)
                })
                
                // Try to get more context about the failing record
                const recordId = patch.path[1] as string
                try {
                  const existingRecord = store.get(recordId as any)
                  console.error("Existing record that failed:", existingRecord)
                } catch (e) {
                  console.error("Could not retrieve existing record:", e)
                }
              }
            }
            // Only log if there are failures or many patches
            if (successCount < payload.patches.length || payload.patches.length > 5) {
              console.log(`Successfully applied ${successCount} out of ${payload.patches.length} patches`)
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
            if (doc.store) {
                const storeKeys = Object.keys(doc.store)
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
          
          console.log(`📊 After filtering: ${records.length} valid records from ${allStoreValues.length} total store values`)
          
          // Only log if there are many records or if debugging is needed
          if (records.length > 50) {
            console.log(`Found ${records.length} valid records in Automerge document`)
          }
          
          // CRITICAL FIXES ONLY - preserve all other properties
          // Note: obsidian_vault records are filtered out above - they're not TLDraw records
          const processedRecords = records.map((record: any) => {
            // Create a deep copy to avoid modifying immutable Automerge objects
            // Use a more robust serialization that handles Automerge proxies
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
            
            // CRITICAL FIXES ONLY - preserve all other properties
            if (processedRecord.typeName === 'shape') {
              // Ensure basic required properties exist
              if (typeof processedRecord.x !== 'number') processedRecord.x = 0
              if (typeof processedRecord.y !== 'number') processedRecord.y = 0
              if (typeof processedRecord.rotation !== 'number') processedRecord.rotation = 0
              if (typeof processedRecord.isLocked !== 'boolean') processedRecord.isLocked = false
              if (typeof processedRecord.opacity !== 'number') processedRecord.opacity = 1
              if (!processedRecord.meta || typeof processedRecord.meta !== 'object') processedRecord.meta = {}
              if (!processedRecord.index) processedRecord.index = 'a1'
              if (!processedRecord.parentId) {
                // Find all page records
                const pageRecords = records.filter((r: any) => r.typeName === 'page') as any[]
                // Prefer 'page:page' if it exists, otherwise use the first page found
                const pageRecord = pageRecords.find((p: any) => p.id === 'page:page') || pageRecords[0]
                if (pageRecord && pageRecord.id) {
                  processedRecord.parentId = pageRecord.id
                } else {
                  // Default to 'page:page' - TLDraw will create it if needed
                  processedRecord.parentId = 'page:page'
                }
              } else {
                // Validate that the parentId points to an existing page
                const parentPage = records.find((r: any) => r.typeName === 'page' && r.id === processedRecord.parentId)
                if (!parentPage) {
                  // Parent page doesn't exist, assign to first available page or default
                  const pageRecords = records.filter((r: any) => r.typeName === 'page') as any[]
                  const pageRecord = pageRecords.find((p: any) => p.id === 'page:page') || pageRecords[0]
                  if (pageRecord && pageRecord.id) {
                    console.log(`🔧 Shape ${processedRecord.id} has invalid parentId ${processedRecord.parentId}, reassigning to ${pageRecord.id}`)
                    processedRecord.parentId = pageRecord.id
                  } else {
                    processedRecord.parentId = 'page:page'
                  }
                }
              }
              if (!processedRecord.props || typeof processedRecord.props !== 'object') processedRecord.props = {}
              
              // CRITICAL: Infer type from properties BEFORE defaulting to 'geo'
              // This ensures arrows and other shapes are properly recognized
              if (!processedRecord.type || typeof processedRecord.type !== 'string') {
                // Check for arrow-specific properties first
                if (processedRecord.props?.start !== undefined || 
                    processedRecord.props?.end !== undefined || 
                    processedRecord.props?.arrowheadStart !== undefined || 
                    processedRecord.props?.arrowheadEnd !== undefined ||
                    processedRecord.props?.kind === 'line' ||
                    processedRecord.props?.kind === 'curved' ||
                    processedRecord.props?.kind === 'straight') {
                  processedRecord.type = 'arrow'
                }
                // Check for line-specific properties
                else if (processedRecord.props?.points !== undefined) {
                  processedRecord.type = 'line'
                }
                // Check for geo-specific properties (w/h/geo)
                else if (processedRecord.props?.geo !== undefined || 
                         ('w' in processedRecord && 'h' in processedRecord) ||
                         ('w' in processedRecord.props && 'h' in processedRecord.props)) {
                  processedRecord.type = 'geo'
                }
                // Check for note-specific properties
                else if (processedRecord.props?.growY !== undefined || 
                         processedRecord.props?.verticalAlign !== undefined) {
                  processedRecord.type = 'note'
                }
                // Check for text-specific properties
                else if (processedRecord.props?.textAlign !== undefined || 
                         processedRecord.props?.autoSize !== undefined) {
                  processedRecord.type = 'text'
                }
                // Check for draw-specific properties
                else if (processedRecord.props?.segments !== undefined) {
                  processedRecord.type = 'draw'
                }
                // Default to geo only if no other indicators found
                else {
                  processedRecord.type = 'geo'
                }
              }
              
              // CRITICAL: For geo shapes, move w/h/geo from top-level to props (required by TLDraw schema)
              if (processedRecord.type === 'geo' || ('w' in processedRecord && 'h' in processedRecord && processedRecord.type !== 'arrow')) {
                if (!processedRecord.type || processedRecord.type === 'geo') {
                  processedRecord.type = 'geo'
                }
                
                // Move w from top-level to props
                if ('w' in processedRecord && processedRecord.w !== undefined) {
                  if (!('w' in processedRecord.props) || processedRecord.props.w === undefined) {
                    processedRecord.props.w = processedRecord.w
                  }
                  delete (processedRecord as any).w
                }
                
                // Move h from top-level to props
                if ('h' in processedRecord && processedRecord.h !== undefined) {
                  if (!('h' in processedRecord.props) || processedRecord.props.h === undefined) {
                    processedRecord.props.h = processedRecord.h
                  }
                  delete (processedRecord as any).h
                }
                
                // Move geo from top-level to props
                if ('geo' in processedRecord && processedRecord.geo !== undefined) {
                  if (!('geo' in processedRecord.props) || processedRecord.props.geo === undefined) {
                    processedRecord.props.geo = processedRecord.geo
                  }
                  delete (processedRecord as any).geo
                }
                
                // Fix richText structure if it exists (preserve content)
                if (processedRecord.props.richText) {
                  if (Array.isArray(processedRecord.props.richText)) {
                    processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                  } else if (typeof processedRecord.props.richText === 'object' && processedRecord.props.richText !== null) {
                    if (!processedRecord.props.richText.type) {
                      processedRecord.props.richText = { ...processedRecord.props.richText, type: 'doc' }
                    }
                    if (!processedRecord.props.richText.content) {
                      processedRecord.props.richText = { ...processedRecord.props.richText, content: [] }
                    }
                  }
                }
              }
              
              // CRITICAL: For arrow shapes, preserve text property
              if (processedRecord.type === 'arrow') {
                if ((processedRecord.props as any).text === undefined || (processedRecord.props as any).text === null) {
                  (processedRecord.props as any).text = ''
                }
              }
              
              // CRITICAL: For line shapes, ensure points structure exists (required by schema)
              if (processedRecord.type === 'line') {
                if ('w' in processedRecord.props) delete (processedRecord.props as any).w
                if ('h' in processedRecord.props) delete (processedRecord.props as any).h
                if (!processedRecord.props.points || typeof processedRecord.props.points !== 'object' || Array.isArray(processedRecord.props.points)) {
                  processedRecord.props.points = {
                    'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
                    'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
                  }
                }
              }
              
              // CRITICAL: For group shapes, remove w/h from props (they cause validation errors)
              if (processedRecord.type === 'group') {
                if ('w' in processedRecord.props) delete (processedRecord.props as any).w
                if ('h' in processedRecord.props) delete (processedRecord.props as any).h
              }
              
              // CRITICAL: For image/video shapes, fix crop structure if it exists
              if (processedRecord.type === 'image' || processedRecord.type === 'video') {
                if (processedRecord.props.crop !== null && processedRecord.props.crop !== undefined) {
                  if (!processedRecord.props.crop.topLeft || !processedRecord.props.crop.bottomRight) {
                    if (processedRecord.props.crop.x !== undefined && processedRecord.props.crop.y !== undefined) {
                      processedRecord.props.crop = {
                        topLeft: { x: processedRecord.props.crop.x || 0, y: processedRecord.props.crop.y || 0 },
                        bottomRight: { 
                          x: (processedRecord.props.crop.x || 0) + (processedRecord.props.crop.w || 1), 
                          y: (processedRecord.props.crop.y || 0) + (processedRecord.props.crop.h || 1) 
                        }
                      }
                    } else {
                      processedRecord.props.crop = {
                        topLeft: { x: 0, y: 0 },
                        bottomRight: { x: 1, y: 1 }
                      }
                    }
                  }
                }
              }
              
              // CRITICAL: Fix richText structure for note shapes if it exists
              if (processedRecord.type === 'note' && processedRecord.props.richText) {
                if (Array.isArray(processedRecord.props.richText)) {
                  processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                } else if (typeof processedRecord.props.richText === 'object' && processedRecord.props.richText !== null) {
                  if (!processedRecord.props.richText.type) {
                    processedRecord.props.richText = { ...processedRecord.props.richText, type: 'doc' }
                  }
                  if (!processedRecord.props.richText.content) {
                    processedRecord.props.richText = { ...processedRecord.props.richText, content: [] }
                  }
                }
              }
              
              // Ensure props object exists for all shapes
              if (!processedRecord.props) processedRecord.props = {}
              
              // Preserve original data structure - only move properties when TLDraw validation requires it
              // Arrow shapes don't have w/h properties, so remove them if present
              if (processedRecord.type === 'arrow') {
                if ('w' in processedRecord) {
                  console.log(`Removing invalid w property from arrow shape ${processedRecord.id}`)
                  delete (processedRecord as any).w
                }
                if ('h' in processedRecord) {
                  console.log(`Removing invalid h property from arrow shape ${processedRecord.id}`)
                  delete (processedRecord as any).h
                }
              }
              // For other shapes, preserve the original structure - don't move w/h unless validation fails
              
              // Handle arrow shapes specially - ensure they have required properties
              if (processedRecord.type === 'arrow') {
                // Ensure required arrow properties exist
                if (!processedRecord.props.kind) processedRecord.props.kind = 'line'
                if (!processedRecord.props.labelColor) processedRecord.props.labelColor = 'black'
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.fill) processedRecord.props.fill = 'none'
                if (!processedRecord.props.dash) processedRecord.props.dash = 'draw'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.arrowheadStart) processedRecord.props.arrowheadStart = 'none'
                if (!processedRecord.props.arrowheadEnd) processedRecord.props.arrowheadEnd = 'arrow'
                if (!processedRecord.props.font) processedRecord.props.font = 'draw'
                if (!processedRecord.props.start) processedRecord.props.start = { x: 0, y: 0 }
                if (!processedRecord.props.end) processedRecord.props.end = { x: 100, y: 0 }
                if (processedRecord.props.bend === undefined) processedRecord.props.bend = 0
                if (!processedRecord.props.text) processedRecord.props.text = ''
                if (processedRecord.props.labelPosition === undefined) processedRecord.props.labelPosition = 0.5
                if (processedRecord.props.scale === undefined) processedRecord.props.scale = 1
                if (processedRecord.props.elbowMidPoint === undefined) processedRecord.props.elbowMidPoint = 0.5
                
                // Remove any invalid properties
                const invalidArrowProps = ['w', 'h', 'geo', 'insets', 'scribbles']
                invalidArrowProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    console.log(`Removing invalid prop '${prop}' from arrow shape ${processedRecord.id}`)
                    delete (processedRecord.props as any)[prop]
                  }
                })
              }
              
              // Handle note shapes specially - ensure they have required properties
              if (processedRecord.type === 'note') {
                // Ensure required note properties exist
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.labelColor) processedRecord.props.labelColor = 'black'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.font) processedRecord.props.font = 'draw'
                if (processedRecord.props.fontSizeAdjustment === undefined) processedRecord.props.fontSizeAdjustment = 0
                if (!processedRecord.props.align) processedRecord.props.align = 'start'
                if (!processedRecord.props.verticalAlign) processedRecord.props.verticalAlign = 'start'
                if (processedRecord.props.growY === undefined) processedRecord.props.growY = 0
                if (!processedRecord.props.url) processedRecord.props.url = ''
                // Note: richText is not required for note shapes
                if (processedRecord.props.scale === undefined) processedRecord.props.scale = 1
                
                // Remove any invalid properties
                const invalidNoteProps = ['w', 'h', 'geo', 'insets', 'scribbles']
                invalidNoteProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    console.log(`Removing invalid prop '${prop}' from note shape ${processedRecord.id}`)
                    delete (processedRecord.props as any)[prop]
                  }
                })
              }
              
              // Handle text shapes specially - ensure they have required properties
              if (processedRecord.type === 'text') {
                // Ensure required text properties exist (matching default tldraw text shape schema)
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.font) processedRecord.props.font = 'draw'
                if (!processedRecord.props.textAlign) processedRecord.props.textAlign = 'start'
                if (processedRecord.props.w === undefined || processedRecord.props.w === null) {
                  processedRecord.props.w = 100
                }
                if (processedRecord.props.scale === undefined) processedRecord.props.scale = 1
                if (processedRecord.props.autoSize === undefined) processedRecord.props.autoSize = false
                
                // Ensure richText property exists for text shapes
                if (!processedRecord.props.richText) {
                  console.log(`🔧 Creating default richText object for text shape ${processedRecord.id}`)
                  processedRecord.props.richText = { content: [], type: 'doc' }
                }
                
                // Remove any invalid properties (including 'text' property which is not in default schema)
                // Note: richText is actually required for text shapes, so don't remove it
                const invalidTextProps = ['text', 'h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'roomId', 'align', 'verticalAlign', 'growY', 'url']
                invalidTextProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    console.log(`Removing invalid prop '${prop}' from text shape ${processedRecord.id}`)
                    delete (processedRecord.props as any)[prop]
                  }
                })
              }
              
              // Handle draw shapes specially - ensure they have required properties
              if (processedRecord.type === 'draw') {
                // Ensure required draw properties exist
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.fill) processedRecord.props.fill = 'none'
                if (!processedRecord.props.dash) processedRecord.props.dash = 'draw'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                
                // Validate and fix segments array - this is critical for preventing Polyline2d errors
                if (!processedRecord.props.segments || !Array.isArray(processedRecord.props.segments)) {
                  console.log(`🔧 Fixing missing/invalid segments for draw shape ${processedRecord.id}`)
                  processedRecord.props.segments = [
                    {
                      type: "free",
                      points: [
                        { x: 0, y: 0, z: 0.5 },
                        { x: 10, y: 10, z: 0.5 }
                      ]
                    }
                  ]
                } else {
                  // Validate each segment in the array
                  // Polyline2d requires at least 2 points per segment
                  const validSegments = []
                  for (let i = 0; i < processedRecord.props.segments.length; i++) {
                    const segment = processedRecord.props.segments[i]
                    if (segment && typeof segment === 'object' && 
                        segment.type && 
                        Array.isArray(segment.points) && 
                        segment.points.length >= 2) {
                      // Validate points in the segment
                      const validPoints = segment.points.filter((point: any) => 
                        point && 
                        typeof point === 'object' && 
                        typeof point.x === 'number' && 
                        typeof point.y === 'number' &&
                        !isNaN(point.x) && !isNaN(point.y)
                      )
                      // Polyline2d requires at least 2 points
                      if (validPoints.length >= 2) {
                        validSegments.push({
                          type: segment.type,
                          points: validPoints
                        })
                      } else if (validPoints.length === 1) {
                        // If only 1 point, duplicate it to create a valid 2-point segment
                        console.log(`🔧 Draw shape ${processedRecord.id} segment ${i} has only 1 point, duplicating to create valid segment`)
                        validSegments.push({
                          type: segment.type,
                          points: [validPoints[0], { ...validPoints[0] }]
                        })
                      }
                    }
                  }
                  
                  if (validSegments.length === 0) {
                    console.log(`🔧 All segments invalid for draw shape ${processedRecord.id}, creating default segment`)
                    processedRecord.props.segments = [
                      {
                        type: "free",
                        points: [
                          { x: 0, y: 0, z: 0.5 },
                          { x: 10, y: 10, z: 0.5 }
                        ]
                      }
                    ]
                  } else {
                    processedRecord.props.segments = validSegments
                  }
                }
                
                if (processedRecord.props.isComplete === undefined) processedRecord.props.isComplete = true
                if (processedRecord.props.isClosed === undefined) processedRecord.props.isClosed = false
                if (processedRecord.props.isPen === undefined) processedRecord.props.isPen = false
                if (processedRecord.props.scale === undefined) processedRecord.props.scale = 1
                
                // Remove any invalid properties
                const invalidDrawProps = ['w', 'h', 'geo', 'insets', 'scribbles', 'richText']
                invalidDrawProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    console.log(`Removing invalid prop '${prop}' from draw shape ${processedRecord.id}`)
                    delete (processedRecord.props as any)[prop]
                  }
                })
              }
              
              // Handle geo shapes specially - ensure geo property is in props where TLDraw expects it
              if (processedRecord.type === 'geo') {
                // Ensure props exists
                if (!processedRecord.props) processedRecord.props = {}
                
                // CRITICAL: ALWAYS remove w/h/geo from top level (TLDraw validation fails if they exist at top level)
                // Move w from top level to props (preserve value if not already in props)
                if ('w' in processedRecord) {
                  console.log(`🔧 Geo shape fix: Removing w from top level for shape ${processedRecord.id}`)
                  if (!('w' in processedRecord.props) || processedRecord.props.w === undefined) {
                    processedRecord.props.w = (processedRecord as any).w
                  }
                  delete (processedRecord as any).w
                }
                
                // Move h from top level to props (preserve value if not already in props)
                if ('h' in processedRecord) {
                  console.log(`🔧 Geo shape fix: Removing h from top level for shape ${processedRecord.id}`)
                  if (!('h' in processedRecord.props) || processedRecord.props.h === undefined) {
                    processedRecord.props.h = (processedRecord as any).h
                  }
                  delete (processedRecord as any).h
                }
                
                // Move geo from top level to props (preserve value if not already in props)
                if ('geo' in processedRecord) {
                  console.log(`🔧 Geo shape fix: Removing geo from top level for shape ${processedRecord.id}`)
                  if (!('geo' in processedRecord.props) || processedRecord.props.geo === undefined) {
                    processedRecord.props.geo = (processedRecord as any).geo
                  }
                  delete (processedRecord as any).geo
                }
                
                // Ensure geo property exists in props with a default value
                if (!processedRecord.props.geo) {
                  processedRecord.props.geo = 'rectangle'
                }
                
                // Ensure w/h exist in props with defaults if missing
                if (!processedRecord.props) processedRecord.props = {}
                if (processedRecord.props.w === undefined || processedRecord.props.w === null) {
                  processedRecord.props.w = 100
                }
                if (processedRecord.props.h === undefined || processedRecord.props.h === null) {
                  processedRecord.props.h = 100
                }
                if (processedRecord.props.geo === undefined || processedRecord.props.geo === null) {
                  processedRecord.props.geo = 'rectangle'
                }
                if (!processedRecord.props.dash) processedRecord.props.dash = 'draw'
                if (!processedRecord.props.growY) processedRecord.props.growY = 0
                if (!processedRecord.props.url) processedRecord.props.url = ''
                if (!processedRecord.props.scale) processedRecord.props.scale = 1
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.labelColor) processedRecord.props.labelColor = 'black'
                if (!processedRecord.props.fill) processedRecord.props.fill = 'none'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.font) processedRecord.props.font = 'draw'
                if (!processedRecord.props.align) processedRecord.props.align = 'middle'
                if (!processedRecord.props.verticalAlign) processedRecord.props.verticalAlign = 'middle'
                // Note: richText IS required for geo shapes in TLDraw
                if (!processedRecord.props.richText) processedRecord.props.richText = { content: [], type: 'doc' }
                // Ensure basic geo properties exist
                if (!processedRecord.props.geo) processedRecord.props.geo = 'rectangle'
                if (!processedRecord.props.fill) processedRecord.props.fill = 'solid'
                if (!processedRecord.props.color) processedRecord.props.color = 'white'
                
                // Validate geo property
                const validGeoTypes = [
                  'cloud', 'rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon', 
                  'hexagon', 'octagon', 'star', 'rhombus', 'rhombus-2', 'oval', 
                  'trapezoid', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 
                  'x-box', 'check-box', 'heart'
                ]
                
                if (!validGeoTypes.includes(processedRecord.props.geo)) {
                  console.log(`Setting valid geo property for shape ${processedRecord.id} (was: ${processedRecord.props.geo})`)
                  processedRecord.props.geo = 'rectangle'
                }
                
                // Remove invalid properties from props (only log if actually removing)
                const invalidProps = ['insets', 'scribbles']
                invalidProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    delete (processedRecord.props as any)[prop]
                  }
                })
              }
              
              // Handle rich text content that might be undefined or invalid
              // Only process richText for shapes that actually use it (text, note, geo, etc.)
              // CRITICAL: geo shapes (rectangles) can legitimately have richText in TLDraw
              if (processedRecord.type === 'text' || processedRecord.type === 'note' || processedRecord.type === 'geo') {
                if (processedRecord.props && processedRecord.props.richText !== undefined) {
                  if (!Array.isArray(processedRecord.props.richText) && typeof processedRecord.props.richText !== 'object') {
                    console.warn('Fixing invalid richText property for shape:', processedRecord.id, 'type:', processedRecord.type, 'was:', typeof processedRecord.props.richText)
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  } else if (Array.isArray(processedRecord.props.richText)) {
                    // If it's an array, convert to proper richText object structure
                    console.log(`🔧 Converting richText array to object for shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                  }
                } else {
                  // Create default empty richText object for text shapes (but not for geo/note unless they already have it)
                  if (processedRecord.type === 'text') {
                    if (!processedRecord.props) processedRecord.props = {}
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  }
                }
              } else if (processedRecord.props && processedRecord.props.richText !== undefined) {
                // Remove richText from shapes that don't use it (but preserve for geo/note which are handled above)
                delete (processedRecord.props as any).richText
              }
              
              // Remove invalid properties that cause validation errors (after moving geo properties)
              const invalidProperties = [
                'insets', 'scribbles', 'duplicateProps', 'isAspectRatioLocked', 
                'isFlippedHorizontal', 'isFlippedVertical', 'isFrozen', 'isSnappable', 
                'isTransparent', 'isVisible', 'isZIndexLocked', 'isHidden'
              ]
              invalidProperties.forEach(prop => {
                if (prop in processedRecord) {
                  delete (processedRecord as any)[prop]
                }
              })
              
              // Custom shapes are supported natively by our custom schema - no conversion needed!
              // Just ensure they have the required properties for their type
              if (processedRecord.type === 'VideoChat' || processedRecord.type === 'ChatBox' || 
                  processedRecord.type === 'Embed' || processedRecord.type === 'SharedPiano' ||
                  processedRecord.type === 'MycrozineTemplate' || processedRecord.type === 'Slide') {
                // These are embed-like shapes - ensure they have basic properties
                if (!processedRecord.props) processedRecord.props = {}
                if (processedRecord.props.w === undefined || processedRecord.props.w === null) {
                  processedRecord.props.w = 300
                }
                if (processedRecord.props.h === undefined || processedRecord.props.h === null) {
                  processedRecord.props.h = 200
                }
                console.log(`🔧 Ensured embed-like shape ${processedRecord.type} has required properties:`, processedRecord.props)
              } else if (processedRecord.type === 'Prompt' || processedRecord.type === 'Transcription' || 
                         processedRecord.type === 'Markdown') {
                // These are text-like shapes - ensure they have text properties
                if (!processedRecord.props) processedRecord.props = {}
                if (processedRecord.props.w === undefined || processedRecord.props.w === null) {
                  processedRecord.props.w = 300
                }
                
                // Convert value property to richText if it exists (for Prompt shapes)
                if (processedRecord.props.value && !processedRecord.props.richText) {
                  processedRecord.props.richText = {
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: processedRecord.props.value
                          }
                        ]
                      }
                    ],
                    type: 'doc'
                  }
                  console.log(`🔧 Converted value to richText for ${processedRecord.type} shape ${processedRecord.id}`)
                }
                
                if (!processedRecord.props.richText) {
                  processedRecord.props.richText = { content: [], type: 'doc' }
                }
                console.log(`🔧 Ensured text-like shape ${processedRecord.type} has required properties:`, processedRecord.props)
              }
              
              // Validate that the shape type is supported by our schema
              const validCustomShapes = ['ObsNote', 'VideoChat', 'Transcription', 'SharedPiano', 'Prompt', 'ChatBox', 'Embed', 'Markdown', 'MycrozineTemplate', 'Slide', 'FathomTranscript', 'Holon', 'ObsidianBrowser', 'HolonBrowser', 'FathomMeetingsBrowser', 'LocationShare']
              const validDefaultShapes = ['arrow', 'bookmark', 'draw', 'embed', 'frame', 'geo', 'group', 'highlight', 'image', 'line', 'note', 'text', 'video']
              const allValidShapes = [...validCustomShapes, ...validDefaultShapes]
              
              if (!allValidShapes.includes(processedRecord.type)) {
                console.log(`🔧 Unknown shape type ${processedRecord.type}, converting to text shape for shape:`, processedRecord.id)
                processedRecord.type = 'text'
                if (!processedRecord.props) processedRecord.props = {}
                // Preserve existing props and only set defaults for missing required text shape properties
                // This prevents losing metadata or other valid properties
                processedRecord.props = {
                  ...processedRecord.props, // Preserve existing props
                  w: processedRecord.props.w || 300,
                  color: processedRecord.props.color || 'black',
                  size: processedRecord.props.size || 'm',
                  font: processedRecord.props.font || 'draw',
                  textAlign: processedRecord.props.textAlign || 'start',
                  autoSize: processedRecord.props.autoSize !== undefined ? processedRecord.props.autoSize : false,
                  scale: processedRecord.props.scale || 1,
                  richText: processedRecord.props.richText || { content: [], type: 'doc' }
                }
                // Remove invalid properties for text shapes (but preserve meta and other valid top-level properties)
                const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'text', 'align', 'verticalAlign', 'growY', 'url']
                invalidTextProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    delete (processedRecord.props as any)[prop]
                  }
                })
                console.log(`🔧 Converted unknown shape to text:`, processedRecord.props)
              }
              
              // Universal shape validation - ensure any shape type can be imported
              // CRITICAL: Fix image and video shapes FIRST - ensure crop has correct structure
              // Tldraw expects crop to be { topLeft: { x, y }, bottomRight: { x, y } } or null
              if (processedRecord.type === 'image' || processedRecord.type === 'video') {
                // Ensure props exists for image/video shapes
                if (!processedRecord.props) {
                  processedRecord.props = {}
                }
                // Fix crop structure
                if (processedRecord.props.crop !== null && processedRecord.props.crop !== undefined) {
                  // If crop exists but has wrong structure, fix it
                  if (!processedRecord.props.crop.topLeft || !processedRecord.props.crop.bottomRight) {
                    // Convert old format { x, y, w, h } to new format, or set default
                    if (processedRecord.props.crop.x !== undefined && processedRecord.props.crop.y !== undefined) {
                      // Old format: convert to new format
                      processedRecord.props.crop = {
                        topLeft: { x: processedRecord.props.crop.x || 0, y: processedRecord.props.crop.y || 0 },
                        bottomRight: { 
                          x: (processedRecord.props.crop.x || 0) + (processedRecord.props.crop.w || 1), 
                          y: (processedRecord.props.crop.y || 0) + (processedRecord.props.crop.h || 1) 
                        }
                      }
                    } else {
                      // Invalid structure: set to default (full crop)
                      processedRecord.props.crop = {
                        topLeft: { x: 0, y: 0 },
                        bottomRight: { x: 1, y: 1 }
                      }
                    }
                  } else {
                    // Ensure topLeft and bottomRight are proper objects
                    if (!processedRecord.props.crop.topLeft || typeof processedRecord.props.crop.topLeft !== 'object') {
                      processedRecord.props.crop.topLeft = { x: 0, y: 0 }
                    }
                    if (!processedRecord.props.crop.bottomRight || typeof processedRecord.props.crop.bottomRight !== 'object') {
                      processedRecord.props.crop.bottomRight = { x: 1, y: 1 }
                    }
                  }
                } else {
                  // Crop is null/undefined: set to null (no crop)
                  processedRecord.props.crop = null
                }
              }
              
              // CRITICAL: Fix line shapes - ensure valid points and remove invalid w/h properties
              if (processedRecord.type === 'line') {
                if (!processedRecord.props) {
                  processedRecord.props = {}
                }
                // Line shapes should NOT have w or h properties
                if ('w' in processedRecord.props) {
                  console.log(`🔧 Universal fix: Removing invalid w property from line shape ${processedRecord.id}`)
                  delete processedRecord.props.w
                }
                if ('h' in processedRecord.props) {
                  console.log(`🔧 Universal fix: Removing invalid h property from line shape ${processedRecord.id}`)
                  delete processedRecord.props.h
                }
                
                // Line shapes REQUIRE points property: Record<string, { id: string, index: IndexKey, x: number, y: number }>
                if (!processedRecord.props.points || typeof processedRecord.props.points !== 'object' || Array.isArray(processedRecord.props.points)) {
                  console.log(`🔧 Universal fix: Creating default points for line shape ${processedRecord.id}`)
                  // Create default points with at least 2 points
                  const point1 = { id: 'a1', index: 'a1' as any, x: 0, y: 0 }
                  const point2 = { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
                  processedRecord.props.points = {
                    'a1': point1,
                    'a2': point2
                  }
                } else {
                  // Validate and fix existing points
                  const validPoints: Record<string, { id: string, index: any, x: number, y: number }> = {}
                  let pointIndex = 0
                  const indices = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10']
                  
                  for (const [key, point] of Object.entries(processedRecord.props.points)) {
                    if (point && typeof point === 'object' && 
                        typeof (point as any).x === 'number' && 
                        typeof (point as any).y === 'number' &&
                        !isNaN((point as any).x) && !isNaN((point as any).y)) {
                      const index = indices[pointIndex] || `a${pointIndex + 1}`
                      validPoints[index] = {
                        id: index,
                        index: index as any,
                        x: (point as any).x,
                        y: (point as any).y
                      }
                      pointIndex++
                    }
                  }
                  
                  if (Object.keys(validPoints).length === 0) {
                    // No valid points, create default
                    console.log(`🔧 Universal fix: No valid points found for line shape ${processedRecord.id}, creating default points`)
                    processedRecord.props.points = {
                      'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
                      'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
                    }
                  } else if (Object.keys(validPoints).length === 1) {
                    // Only one point, add a second one
                    const firstPoint = Object.values(validPoints)[0]
                    const secondIndex = indices[1] || 'a2'
                    validPoints[secondIndex] = {
                      id: secondIndex,
                      index: secondIndex as any,
                      x: firstPoint.x + 100,
                      y: firstPoint.y
                    }
                    processedRecord.props.points = validPoints
                  } else {
                    processedRecord.props.points = validPoints
                  }
                }
                
                // Ensure other required line shape properties exist
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.dash) processedRecord.props.dash = 'draw'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.spline) processedRecord.props.spline = 'line'
                if (processedRecord.props.scale === undefined || processedRecord.props.scale === null) {
                  processedRecord.props.scale = 1
                }
              }
              
              // CRITICAL: Fix group shapes - remove invalid w/h properties
              if (processedRecord.type === 'group') {
                if (!processedRecord.props) {
                  processedRecord.props = {}
                }
                // Group shapes should NOT have w or h properties
                if ('w' in processedRecord.props) {
                  console.log(`🔧 Universal fix: Removing invalid w property from group shape ${processedRecord.id}`)
                  delete processedRecord.props.w
                }
                if ('h' in processedRecord.props) {
                  console.log(`🔧 Universal fix: Removing invalid h property from group shape ${processedRecord.id}`)
                  delete processedRecord.props.h
                }
              }
              
              if (processedRecord.props) {
                
                // Fix any richText issues for text shapes only
                if (processedRecord.type === 'text' && processedRecord.props.richText !== undefined) {
                  if (!Array.isArray(processedRecord.props.richText)) {
                    console.log(`🔧 Universal fix: Converting richText to proper object for text shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  } else {
                    // Convert array to proper object structure
                    console.log(`🔧 Universal fix: Converting richText array to object for text shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                  }
                }
                
                // Special handling for geo shapes
                if (processedRecord.type === 'geo') {
                  // Geo shapes should have richText property but not text property
                  if ('text' in processedRecord.props) {
                    console.log(`🔧 Removing invalid text property from geo shape ${processedRecord.id}`)
                    delete processedRecord.props.text
                  }
                  
                  // Ensure richText property exists and is properly structured for geo shapes
                  if (!processedRecord.props.richText) {
                    console.log(`🔧 Adding missing richText property for geo shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  } else if (Array.isArray(processedRecord.props.richText)) {
                    console.log(`🔧 Converting richText array to object for geo shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                  } else if (typeof processedRecord.props.richText !== 'object' || processedRecord.props.richText === null) {
                    console.log(`🔧 Fixing invalid richText structure for geo shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  } else if (!processedRecord.props.richText.content) {
                    // If richText exists but content is missing, preserve the rest and add empty content
                    console.log(`🔧 Adding missing content to richText for geo shape ${processedRecord.id}`)
                    processedRecord.props.richText = {
                      ...processedRecord.props.richText,
                      content: processedRecord.props.richText.content || [],
                      type: processedRecord.props.richText.type || 'doc'
                    }
                  }
                  
                  // Ensure geo shape has proper structure
                  if (!processedRecord.props.geo) {
                    processedRecord.props.geo = 'rectangle'
                  }
                  if (processedRecord.props.w === undefined || processedRecord.props.w === null) {
                    processedRecord.props.w = 100
                  }
                  if (processedRecord.props.h === undefined || processedRecord.props.h === null) {
                    processedRecord.props.h = 100
                  }
                  
                  // Fix dash property - ensure it's a valid value
                  if (processedRecord.props.dash === '' || processedRecord.props.dash === undefined) {
                    processedRecord.props.dash = 'solid'
                  } else if (!['draw', 'solid', 'dashed', 'dotted'].includes(processedRecord.props.dash)) {
                    console.log(`🔧 Fixing invalid dash value '${processedRecord.props.dash}' for geo shape:`, processedRecord.id)
                    processedRecord.props.dash = 'solid'
                  }
                  
                  // Fix scale property - ensure it's a number
                  if (processedRecord.props.scale === undefined || processedRecord.props.scale === null) {
                    processedRecord.props.scale = 1
                  } else if (typeof processedRecord.props.scale !== 'number') {
                    console.log(`🔧 Fixing invalid scale value '${processedRecord.props.scale}' for geo shape:`, processedRecord.id)
                    processedRecord.props.scale = 1
                  }
                  
                  // Remove invalid properties for geo shapes (including insets) - but NOT richText as it's required
                  const invalidGeoOtherProps = ['transcript', 'isTranscribing', 'isPaused', 'isEditing', 'roomUrl', 'roomId', 'prompt', 'value', 'agentBinding', 'isMinimized', 'noteId', 'title', 'content', 'tags', 'showPreview', 'backgroundColor', 'textColor', 'editingContent', 'vaultName', 'insets']
                  invalidGeoOtherProps.forEach(prop => {
                    if (prop in processedRecord.props) {
                      console.log(`🔧 Removing invalid ${prop} property from geo shape:`, processedRecord.id)
                      delete processedRecord.props[prop]
                    }
                  })
                }
                
                // Fix note shapes - ensure richText exists and remove invalid w/h properties
                if (processedRecord.type === 'note') {
                  // Note shapes REQUIRE richText property (it's part of the schema)
                  if (!processedRecord.props.richText || typeof processedRecord.props.richText !== 'object') {
                    console.log(`🔧 Adding missing richText property for note shape ${processedRecord.id}`)
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  }
                  if ('w' in processedRecord.props) {
                    console.log(`🔧 Removing invalid w property from note shape:`, processedRecord.id)
                    delete processedRecord.props.w
                  }
                  if ('h' in processedRecord.props) {
                    console.log(`🔧 Removing invalid h property from note shape:`, processedRecord.id)
                    delete processedRecord.props.h
                  }
                }
                
                // Fix text shapes - remove h property
                if (processedRecord.type === 'text') {
                  if ('h' in processedRecord.props) {
                    console.log(`🔧 Removing invalid h property from text shape:`, processedRecord.id)
                    delete processedRecord.props.h
                  }
                }
                
                // Fix embed shapes - ensure required properties and remove invalid ones
                if (processedRecord.type === 'embed') {
                  if (!processedRecord.props.url) {
                    console.log(`🔧 Adding missing url property for embed shape:`, processedRecord.id)
                    processedRecord.props.url = ''
                  }
                  if (!processedRecord.props.w) {
                    processedRecord.props.w = 400
                  }
                  if (!processedRecord.props.h) {
                    processedRecord.props.h = 300
                  }
                  
                  // Remove invalid properties for embed shapes
                  const invalidEmbedProps = ['isMinimized', 'roomUrl', 'roomId', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'richText']
                  invalidEmbedProps.forEach(prop => {
                    if (prop in processedRecord.props) {
                      console.log(`🔧 Removing invalid prop '${prop}' from embed shape ${processedRecord.id}`)
                      delete (processedRecord.props as any)[prop]
                    }
                  })
                }
                
                // Ensure all required properties exist for any shape type (except arrow, draw, line, text, note, and group)
                if (processedRecord.type !== 'arrow' && processedRecord.type !== 'draw' && processedRecord.type !== 'line' && processedRecord.type !== 'text' && processedRecord.type !== 'note' && processedRecord.type !== 'group') {
                  const requiredProps = ['w', 'h']
                  requiredProps.forEach(prop => {
                    if (processedRecord.props[prop] === undefined) {
                      console.log(`🔧 Universal fix: Adding missing ${prop} for shape ${processedRecord.id} (type: ${processedRecord.type})`)
                      if (prop === 'w' && processedRecord.props.w === undefined) processedRecord.props.w = 100
                      if (prop === 'h' && processedRecord.props.h === undefined) processedRecord.props.h = 100
                    }
                  })
                } else if (processedRecord.type === 'text') {
                  // Text shapes only need w, not h
                  if (processedRecord.props.w === undefined || processedRecord.props.w === null) {
                    console.log(`🔧 Universal fix: Adding missing w for text shape ${processedRecord.id}`)
                    processedRecord.props.w = 100
                  }
                }
                
                // Clean up any null/undefined values in props (but preserve required objects like crop for images/videos)
                // IMPORTANT: crop is already set above for image/video shapes, so we must skip it here
                Object.keys(processedRecord.props).forEach(propKey => {
                  // Skip crop for image/video shapes - it must be an object, not undefined
                  if ((processedRecord.type === 'image' || processedRecord.type === 'video') && propKey === 'crop') {
                    return // crop is required and already set above
                  }
                  if (processedRecord.props[propKey] === null || processedRecord.props[propKey] === undefined) {
                    console.log(`🔧 Universal fix: Removing null/undefined prop ${propKey} from shape ${processedRecord.id}`)
                    delete processedRecord.props[propKey]
                  }
                })
              }
            }
            
            // Fix instance records
            if (processedRecord.typeName === 'instance') {
              if (!processedRecord.meta) processedRecord.meta = {}
              if ('insets' in processedRecord && !Array.isArray(processedRecord.insets)) {
                processedRecord.insets = [false, false, false, false]
              }
              // Always ensure scribbles is an array, even if undefined
              if (!Array.isArray(processedRecord.scribbles)) {
                processedRecord.scribbles = []
              }
              // Always ensure duplicateProps is an object with required properties
              if (typeof processedRecord.duplicateProps !== 'object' || processedRecord.duplicateProps === null) {
                processedRecord.duplicateProps = {}
              }
              // Ensure duplicateProps has the required shapeIds array
              if (!Array.isArray(processedRecord.duplicateProps.shapeIds)) {
                processedRecord.duplicateProps.shapeIds = []
              }
              // Ensure duplicateProps has the required offset object
              if (typeof processedRecord.duplicateProps.offset !== 'object' || processedRecord.duplicateProps.offset === null) {
                processedRecord.duplicateProps.offset = { x: 0, y: 0 }
              }
            }
        
            return processedRecord
          })
          
          console.log(`Processed ${processedRecords.length} records for loading`)
          
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
          
          // Debug: Log shape structures before loading
          const shapesToLoad = processedRecords.filter(r => r.typeName === 'shape')
          console.log(`📊 About to load ${shapesToLoad.length} shapes into store`)
          
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
            
            // Log all shapes with their positions
            console.log("📊 All processed shapes:", shapesToLoad.map(s => ({
              id: s.id,
              type: s.type,
              x: s.x,
              y: s.y,
              hasProps: !!s.props,
              propsW: s.props?.w,
              propsH: s.props?.h,
              parentId: s.parentId
            })))
          }
          
          // Load records into store
          if (processedRecords.length > 0) {
            console.log("Attempting to load records into store...")
            
            // Final validation: ensure all shapes are properly structured
            processedRecords.forEach(record => {
              if (record.typeName === 'shape') {
                // Final check for geo shapes - ALWAYS remove w/h/geo from top level (even if in props)
                if (record.type === 'geo') {
                  // ALWAYS delete w from top level (TLDraw validation fails if it exists at top level)
                  if ('w' in record) {
                    console.log(`🔧 FINAL PRE-STORE FIX: Removing w from top level for geo shape ${record.id}`)
                    if (!record.props) record.props = {}
                    if (!('w' in record.props) || record.props.w === undefined) {
                      record.props.w = (record as any).w
                    }
                    delete (record as any).w
                  }
                  // ALWAYS delete h from top level
                  if ('h' in record) {
                    console.log(`🔧 FINAL PRE-STORE FIX: Removing h from top level for geo shape ${record.id}`)
                    if (!record.props) record.props = {}
                    if (!('h' in record.props) || record.props.h === undefined) {
                      record.props.h = (record as any).h
                    }
                    delete (record as any).h
                  }
                  // ALWAYS delete geo from top level
                  if ('geo' in record) {
                    console.log(`🔧 FINAL PRE-STORE FIX: Removing geo from top level for geo shape ${record.id}`)
                    if (!record.props) record.props = {}
                    if (!('geo' in record.props) || record.props.geo === undefined) {
                      record.props.geo = (record as any).geo
                    }
                    delete (record as any).geo
                  }
                }
                
                // Ensure text shapes have richText
                if (record.type === 'text') {
                  if (!record.props) {
                    record.props = {}
                  }
                  if (!record.props.richText) {
                    console.log(`🔧 Final fix: Adding richText to text shape ${record.id}`)
                    record.props.richText = { content: [], type: 'doc' }
                  }
                }
              }
            })
            
            try {
              store.mergeRemoteChanges(() => {
                // CRITICAL: Final safety check - ensure no geo shapes have w/h/geo at top level
                // Note: obsidian_vault records are already filtered out above
                const sanitizedRecords = processedRecords.map(record => {
                  if (record.typeName === 'shape' && record.type === 'geo') {
                    const sanitized = { ...record }
                    // ALWAYS remove from top level if present
                    if ('w' in sanitized) {
                      console.log(`🔧 LAST-CHANCE FIX: Removing w from top level for geo shape ${sanitized.id}`)
                      if (!sanitized.props) sanitized.props = {}
                      if (!('w' in sanitized.props) || sanitized.props.w === undefined) {
                        sanitized.props.w = (sanitized as any).w
                      }
                      delete (sanitized as any).w
                    }
                    if ('h' in sanitized) {
                      console.log(`🔧 LAST-CHANCE FIX: Removing h from top level for geo shape ${sanitized.id}`)
                      if (!sanitized.props) sanitized.props = {}
                      if (!('h' in sanitized.props) || sanitized.props.h === undefined) {
                        sanitized.props.h = (sanitized as any).h
                      }
                      delete (sanitized as any).h
                    }
                    if ('geo' in sanitized) {
                      console.log(`🔧 LAST-CHANCE FIX: Removing geo from top level for geo shape ${sanitized.id}`)
                      if (!sanitized.props) sanitized.props = {}
                      if (!('geo' in sanitized.props) || sanitized.props.geo === undefined) {
                        sanitized.props.geo = (sanitized as any).geo
                      }
                      delete (sanitized as any).geo
                    }
                    return sanitized
                  }
                  return record
                })
                
                // Put TLDraw records into store
                if (sanitizedRecords.length > 0) {
                  store.put(sanitizedRecords)
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
                // Final validation for individual record: ensure text shapes have richText
                if (record.type === 'text') {
                  if (!record.props) {
                    record.props = {}
                  }
                  if (!record.props.richText) {
                    console.log(`🔧 Individual fix: Adding richText to text shape ${record.id}`)
                    record.props.richText = { content: [], type: 'doc' }
                  }
                }
                
                try {
                  // CRITICAL: Final validation before putting record into store
                  if (record.typeName === 'shape' && record.type === 'geo') {
                    // ALWAYS remove w/h/geo from top level (TLDraw validation fails if they exist at top level)
                    if ('w' in record) {
                      console.log(`🔧 INDIVIDUAL PRE-STORE FIX: Removing w from top level for geo shape ${record.id}`)
                      if (!record.props) record.props = {}
                      if (!('w' in record.props) || record.props.w === undefined) {
                        record.props.w = (record as any).w
                      }
                      delete (record as any).w
                    }
                    if ('h' in record) {
                      console.log(`🔧 INDIVIDUAL PRE-STORE FIX: Removing h from top level for geo shape ${record.id}`)
                      if (!record.props) record.props = {}
                      if (!('h' in record.props) || record.props.h === undefined) {
                        record.props.h = (record as any).h
                      }
                      delete (record as any).h
                    }
                    if ('geo' in record) {
                      console.log(`🔧 INDIVIDUAL PRE-STORE FIX: Removing geo from top level for geo shape ${record.id}`)
                      if (!record.props) record.props = {}
                      if (!('geo' in record.props) || record.props.geo === undefined) {
                        record.props.geo = (record as any).geo
                      }
                      delete (record as any).geo
                    }
                    
                    // Ensure geo property exists in props
                    if (!record.props) record.props = {}
                    if (!record.props.geo) {
                      record.props.geo = 'rectangle'
                    }
                  }
                  
                  // CRITICAL: Final safety check - ensure no geo shapes have w/h/geo at top level
                  let recordToPut = record
                  if (record.typeName === 'shape' && record.type === 'geo') {
                    // Store values before removing from top level
                    const wValue = 'w' in record ? (record as any).w : undefined
                    const hValue = 'h' in record ? (record as any).h : undefined
                    const geoValue = 'geo' in record ? (record as any).geo : undefined
                    
                    // Create cleaned record without w/h/geo at top level
                    const cleaned: any = {}
                    for (const key in record) {
                      if (key !== 'w' && key !== 'h' && key !== 'geo') {
                        cleaned[key] = (record as any)[key]
                      }
                    }
                    
                    // Ensure props exists and move values there if needed
                    if (!cleaned.props) cleaned.props = {}
                    if (wValue !== undefined && (!('w' in cleaned.props) || cleaned.props.w === undefined)) {
                      cleaned.props.w = wValue
                    }
                    if (hValue !== undefined && (!('h' in cleaned.props) || cleaned.props.h === undefined)) {
                      cleaned.props.h = hValue
                    }
                    if (geoValue !== undefined && (!('geo' in cleaned.props) || cleaned.props.geo === undefined)) {
                      cleaned.props.geo = geoValue
                    }
                    
                    recordToPut = cleaned as any
                  }
                  
                  store.mergeRemoteChanges(() => {
                    store.put([recordToPut])
                  })
                  successCount++
                  console.log(`✅ Successfully loaded record ${record.id} (${record.typeName})`)
                } catch (individualError) {
                  console.error(`❌ Failed to load record ${record.id} (${record.typeName}):`, individualError)
                  console.log("Problematic record structure:", {
                    id: record.id,
                    typeName: record.typeName,
                    type: record.type,
                    hasW: 'w' in record,
                    hasH: 'h' in record,
                    w: record.w,
                    h: record.h,
                    propsW: record.props?.w,
                    propsH: record.props?.h,
                    allKeys: Object.keys(record)
                  })
                  failedRecords.push(record)
                }
              }
              // Only log if there are failures or many records
              if (successCount < processedRecords.length || processedRecords.length > 50) {
                console.log(`Successfully loaded ${successCount} out of ${processedRecords.length} records`)
              }
              // Only log if debugging is needed
              // console.log(`Failed records: ${failedRecords.length}`, failedRecords.map(r => r.id))
              
              // Try to fix and reload failed records
              if (failedRecords.length > 0) {
                // Only log if debugging is needed
                // console.log("Attempting to fix and reload failed records...")
                for (const record of failedRecords) {
                  try {
                    // Additional cleanup for failed records - create deep copy
                    let fixedRecord = JSON.parse(JSON.stringify(record))
                    
                    // Fix instance records specifically
                    if (fixedRecord.typeName === 'instance') {
                      if (!fixedRecord.meta) fixedRecord.meta = {}
                      if (!Array.isArray(fixedRecord.insets)) {
                        fixedRecord.insets = [false, false, false, false]
                      }
                      if (!Array.isArray(fixedRecord.scribbles)) {
                        fixedRecord.scribbles = []
                      }
                      if (typeof fixedRecord.duplicateProps !== 'object' || fixedRecord.duplicateProps === null) {
                        fixedRecord.duplicateProps = {}
                      }
                      if (!Array.isArray(fixedRecord.duplicateProps.shapeIds)) {
                        fixedRecord.duplicateProps.shapeIds = []
                      }
                      if (typeof fixedRecord.duplicateProps.offset !== 'object' || fixedRecord.duplicateProps.offset === null) {
                        fixedRecord.duplicateProps.offset = { x: 0, y: 0 }
                      }
                    }
                    
                    // Remove any remaining top-level w/h properties for shapes (except arrow, draw, and text)
                    if (fixedRecord.typeName === 'shape') {
                      if (fixedRecord.type !== 'arrow' && fixedRecord.type !== 'draw' && fixedRecord.type !== 'text') {
                        if ('w' in fixedRecord) {
                          if (!fixedRecord.props) fixedRecord.props = {}
                          fixedRecord.props.w = fixedRecord.w
                          delete (fixedRecord as any).w
                        }
                        if ('h' in fixedRecord) {
                          if (!fixedRecord.props) fixedRecord.props = {}
                          fixedRecord.props.h = fixedRecord.h
                          delete (fixedRecord as any).h
                        }
                      } else if (fixedRecord.type === 'text') {
                        // Text shapes only need w, not h
                        if ('w' in fixedRecord) {
                          if (!fixedRecord.props) fixedRecord.props = {}
                          fixedRecord.props.w = fixedRecord.w
                          delete (fixedRecord as any).w
                        }
                        if ('h' in fixedRecord) {
                          delete (fixedRecord as any).h
                        }
                      } else {
                        // For arrow and draw shapes, remove w/h entirely
                        if ('w' in fixedRecord) {
                          delete (fixedRecord as any).w
                        }
                        if ('h' in fixedRecord) {
                          delete (fixedRecord as any).h
                        }
                      }
                    }
                      
                    // Comprehensive richText validation - ensure it's always an object with content and type for text shapes
                    if (fixedRecord.type === 'text' && fixedRecord.props) {
                      if (fixedRecord.props.richText !== undefined) {
                        if (!Array.isArray(fixedRecord.props.richText)) {
                          console.log(`🔧 Fixing richText for text shape ${fixedRecord.id}: was ${typeof fixedRecord.props.richText}, setting to proper object`)
                          fixedRecord.props.richText = { content: [], type: 'doc' }
                        } else {
                          // If it's an array, convert to proper richText object structure
                          console.log(`🔧 Converting richText array to object for text shape ${fixedRecord.id}`)
                          fixedRecord.props.richText = { content: fixedRecord.props.richText, type: 'doc' }
                        }
                      } else {
                        // Text shapes must have richText as an object
                        console.log(`🔧 Creating default richText object for text shape ${fixedRecord.id}`)
                        fixedRecord.props.richText = { content: [], type: 'doc' }
                      }
                    } else if (fixedRecord.type === 'text' && !fixedRecord.props) {
                      // Ensure props object exists for text shapes
                      fixedRecord.props = { richText: { content: [], type: 'doc' } }
                    }
                    
                    // Fix text shapes - ensure they have required properties including color
                    if (fixedRecord.type === 'text') {
                      if (!fixedRecord.props.color) {
                        console.log(`🔧 Adding missing color property for text shape ${fixedRecord.id}`)
                        fixedRecord.props.color = 'black'
                      }
                      if (!fixedRecord.props.size) {
                        fixedRecord.props.size = 'm'
                      }
                      if (!fixedRecord.props.font) {
                        fixedRecord.props.font = 'draw'
                      }
                      if (!fixedRecord.props.textAlign) {
                        fixedRecord.props.textAlign = 'start'
                      }
                      if (!fixedRecord.props.w) {
                        fixedRecord.props.w = 100
                      }
                      if (fixedRecord.props.scale === undefined) {
                        fixedRecord.props.scale = 1
                      }
                      if (fixedRecord.props.autoSize === undefined) {
                        fixedRecord.props.autoSize = false
                      }
                      if (!fixedRecord.props.richText) {
                        console.log(`🔧 Creating default richText object for text shape ${fixedRecord.id}`)
                        fixedRecord.props.richText = { content: [], type: 'doc' }
                      }
                      
                      // Remove invalid properties for text shapes (matching default text shape schema)
                      // Note: richText is actually required for text shapes, so don't remove it
                      const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'text', 'align', 'verticalAlign', 'growY', 'url']
                      invalidTextProps.forEach(prop => {
                        if (prop in fixedRecord.props) {
                          console.log(`🔧 Removing invalid prop '${prop}' from text shape ${fixedRecord.id}`)
                          delete (fixedRecord.props as any)[prop]
                        }
                      })
                    }
                    
                    // Fix embed shapes - ensure they have required properties and remove invalid ones
                    if (fixedRecord.type === 'Embed' || fixedRecord.type === 'embed') {
                      if (!fixedRecord.props.url) {
                        console.log(`🔧 Adding missing url property for embed shape ${fixedRecord.id}`)
                        fixedRecord.props.url = ''
                      }
                      if (!fixedRecord.props.w) {
                        fixedRecord.props.w = 400
                      }
                      if (!fixedRecord.props.h) {
                        fixedRecord.props.h = 300
                      }
                      if (fixedRecord.props.isMinimized === undefined) {
                        fixedRecord.props.isMinimized = false
                      }
                      
                      // Remove invalid properties for embed shapes (matching custom EmbedShape schema)
                      const invalidEmbedProps = ['doesResize', 'doesResizeHeight', 'roomUrl', 'roomId', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'richText']
                      invalidEmbedProps.forEach(prop => {
                        if (prop in fixedRecord.props) {
                          console.log(`🔧 Removing invalid prop '${prop}' from embed shape ${fixedRecord.id}`)
                          delete (fixedRecord.props as any)[prop]
                        }
                      })
                    }
                    
                    // Remove any other problematic properties from shapes
                    const invalidProps = ['insets', 'scribbles', 'geo']
                    invalidProps.forEach(prop => {
                      if (prop in fixedRecord) {
                        delete (fixedRecord as any)[prop]
                      }
                    })
                    
                    // Final validation - ensure all required properties exist
                    if (fixedRecord.typeName === 'shape') {
                      // Ensure basic required properties
                      if (fixedRecord.x === undefined) fixedRecord.x = 0
                      if (fixedRecord.y === undefined) fixedRecord.y = 0
                      if (fixedRecord.rotation === undefined) fixedRecord.rotation = 0
                      if (fixedRecord.isLocked === undefined) fixedRecord.isLocked = false
                      if (fixedRecord.opacity === undefined) fixedRecord.opacity = 1
                      if (!fixedRecord.meta) fixedRecord.meta = {}
                      
                      // CRITICAL: Final geo shape validation - ALWAYS remove w/h/geo from top level
                      if (fixedRecord.type === 'geo') {
                        // Store values before removing from top level
                        const wValue = 'w' in fixedRecord ? (fixedRecord as any).w : undefined
                        const hValue = 'h' in fixedRecord ? (fixedRecord as any).h : undefined
                        const geoValue = 'geo' in fixedRecord ? (fixedRecord as any).geo : undefined
                        
                        // Ensure props exists
                        if (!fixedRecord.props) fixedRecord.props = {}
                        
                        // ALWAYS remove w from top level (even if value is 0 or undefined)
                        if ('w' in fixedRecord) {
                          if (!('w' in fixedRecord.props) || fixedRecord.props.w === undefined) {
                            fixedRecord.props.w = wValue !== undefined ? wValue : 100
                          }
                          delete (fixedRecord as any).w
                        }
                        
                        // ALWAYS remove h from top level (even if value is 0 or undefined)
                        if ('h' in fixedRecord) {
                          if (!('h' in fixedRecord.props) || fixedRecord.props.h === undefined) {
                            fixedRecord.props.h = hValue !== undefined ? hValue : 100
                          }
                          delete (fixedRecord as any).h
                        }
                        
                        // ALWAYS remove geo from top level (even if value is undefined)
                        if ('geo' in fixedRecord) {
                          if (!('geo' in fixedRecord.props) || fixedRecord.props.geo === undefined) {
                            fixedRecord.props.geo = geoValue !== undefined ? geoValue : 'rectangle'
                          }
                          delete (fixedRecord as any).geo
                        }
                        
                        // Ensure geo property exists in props
                        if (!fixedRecord.props.geo) {
                          fixedRecord.props.geo = 'rectangle'
                        }
                        
                        // Ensure w and h are in props
                        if (fixedRecord.props.w === undefined) fixedRecord.props.w = 100
                        if (fixedRecord.props.h === undefined) fixedRecord.props.h = 100
                      }
                      
                      // Ensure parentId exists
                      if (!fixedRecord.parentId) {
                        const pageRecord = records.find((r: any) => r.typeName === 'page') as any
                        if (pageRecord && pageRecord.id) {
                          fixedRecord.parentId = pageRecord.id
                        }
                      }
                      
                      // Ensure props object exists
                      if (!fixedRecord.props) fixedRecord.props = {}
                      
                      // Ensure w and h exist in props (except for arrow, draw, line, text, note, and group shapes)
                      if (fixedRecord.type !== 'arrow' && fixedRecord.type !== 'draw' && fixedRecord.type !== 'line' && fixedRecord.type !== 'text' && fixedRecord.type !== 'note' && fixedRecord.type !== 'group') {
                        if (fixedRecord.props.w === undefined) fixedRecord.props.w = 100
                        if (fixedRecord.props.h === undefined) fixedRecord.props.h = 100
                      } else if (fixedRecord.type === 'text') {
                        // Text shapes only need w, not h
                        if (fixedRecord.props.w === undefined) fixedRecord.props.w = 100
                      } else if (fixedRecord.type === 'line') {
                        // Line shapes should NOT have w or h properties
                        if ('w' in fixedRecord.props) {
                          console.log(`🔧 FINAL FIX: Removing invalid w property from line shape ${fixedRecord.id}`)
                          delete fixedRecord.props.w
                        }
                        if ('h' in fixedRecord.props) {
                          console.log(`🔧 FINAL FIX: Removing invalid h property from line shape ${fixedRecord.id}`)
                          delete fixedRecord.props.h
                        }
                        
                        // Ensure line shapes have valid points
                        if (!fixedRecord.props.points || typeof fixedRecord.props.points !== 'object' || Array.isArray(fixedRecord.props.points)) {
                          console.log(`🔧 FINAL FIX: Creating default points for line shape ${fixedRecord.id}`)
                          fixedRecord.props.points = {
                            'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
                            'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
                          }
                        } else {
                          // Validate points
                          const validPoints: Record<string, { id: string, index: any, x: number, y: number }> = {}
                          let pointIndex = 0
                          const indices = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10']
                          
                          for (const [key, point] of Object.entries(fixedRecord.props.points)) {
                            if (point && typeof point === 'object' && 
                                typeof (point as any).x === 'number' && 
                                typeof (point as any).y === 'number' &&
                                !isNaN((point as any).x) && !isNaN((point as any).y)) {
                              const index = indices[pointIndex] || `a${pointIndex + 1}`
                              validPoints[index] = {
                                id: index,
                                index: index as any,
                                x: (point as any).x,
                                y: (point as any).y
                              }
                              pointIndex++
                            }
                          }
                          
                          if (Object.keys(validPoints).length === 0) {
                            fixedRecord.props.points = {
                              'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
                              'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
                            }
                          } else if (Object.keys(validPoints).length === 1) {
                            const firstPoint = Object.values(validPoints)[0]
                            const secondIndex = indices[1] || 'a2'
                            validPoints[secondIndex] = {
                              id: secondIndex,
                              index: secondIndex as any,
                              x: firstPoint.x + 100,
                              y: firstPoint.y
                            }
                            fixedRecord.props.points = validPoints
                          } else {
                            fixedRecord.props.points = validPoints
                          }
                        }
                        
                        // Ensure other required line shape properties
                        if (!fixedRecord.props.color) fixedRecord.props.color = 'black'
                        if (!fixedRecord.props.dash) fixedRecord.props.dash = 'draw'
                        if (!fixedRecord.props.size) fixedRecord.props.size = 'm'
                        if (!fixedRecord.props.spline) fixedRecord.props.spline = 'line'
                        if (fixedRecord.props.scale === undefined || fixedRecord.props.scale === null) {
                          fixedRecord.props.scale = 1
                        }
                      } else if (fixedRecord.type === 'note') {
                        // Note shapes should NOT have w or h properties, but DO need richText
                        if ('w' in fixedRecord.props) {
                          console.log(`🔧 FINAL FIX: Removing invalid w property from note shape ${fixedRecord.id}`)
                          delete fixedRecord.props.w
                        }
                        if ('h' in fixedRecord.props) {
                          console.log(`🔧 FINAL FIX: Removing invalid h property from note shape ${fixedRecord.id}`)
                          delete fixedRecord.props.h
                        }
                        // Note shapes REQUIRE richText property
                        if (!fixedRecord.props.richText || typeof fixedRecord.props.richText !== 'object') {
                          console.log(`🔧 FINAL FIX: Adding missing richText property for note shape ${fixedRecord.id}`)
                          fixedRecord.props.richText = { content: [], type: 'doc' }
                        }
                      } else if (fixedRecord.type === 'group') {
                        // Group shapes should NOT have w or h properties
                        if ('w' in fixedRecord.props) {
                          console.log(`🔧 FINAL FIX: Removing invalid w property from group shape ${fixedRecord.id}`)
                          delete fixedRecord.props.w
                        }
                        if ('h' in fixedRecord.props) {
                          console.log(`🔧 FINAL FIX: Removing invalid h property from group shape ${fixedRecord.id}`)
                          delete fixedRecord.props.h
                        }
                      }
                    }
                    
                    // CRITICAL: Final safety check - ensure no geo shapes have w/h/geo at top level
                    if (fixedRecord.typeName === 'shape' && fixedRecord.type === 'geo') {
                      // Store values before removing from top level
                      const wValue = 'w' in fixedRecord ? (fixedRecord as any).w : undefined
                      const hValue = 'h' in fixedRecord ? (fixedRecord as any).h : undefined
                      const geoValue = 'geo' in fixedRecord ? (fixedRecord as any).geo : undefined
                      
                      // Create cleaned record without w/h/geo at top level
                      const cleaned: any = {}
                      for (const key in fixedRecord) {
                        if (key !== 'w' && key !== 'h' && key !== 'geo') {
                          cleaned[key] = (fixedRecord as any)[key]
                        }
                      }
                      
                      // Ensure props exists and move values there if needed
                      if (!cleaned.props) cleaned.props = {}
                      if (wValue !== undefined && (!('w' in cleaned.props) || cleaned.props.w === undefined)) {
                        cleaned.props.w = wValue
                      }
                      if (hValue !== undefined && (!('h' in cleaned.props) || cleaned.props.h === undefined)) {
                        cleaned.props.h = hValue
                      }
                      if (geoValue !== undefined && (!('geo' in cleaned.props) || cleaned.props.geo === undefined)) {
                        cleaned.props.geo = geoValue
                      }
                      
                      fixedRecord = cleaned as any
                    }
                    
                    // CRITICAL: Final safety check - ensure text shapes don't have props.text (TLDraw schema doesn't allow it)
                    // Text shapes should only use props.richText, not props.text
                    if (fixedRecord.typeName === 'shape' && fixedRecord.type === 'text' && fixedRecord.props && 'text' in fixedRecord.props) {
                      delete (fixedRecord.props as any).text
                    }
                    
                    store.mergeRemoteChanges(() => {
                      store.put([fixedRecord])
                    })
                    console.log(`✅ Successfully loaded fixed record ${fixedRecord.id}`)
                    successCount++
                  } catch (retryError) {
                    console.error(`❌ Still failed to load record ${record.id} after fix attempt:`, retryError)
                  }
                }
              }
            }
          }
                
            // Verify loading
            const storeRecords = store.allRecords()
            const shapes = storeRecords.filter(r => r.typeName === 'shape')
            console.log(`📊 Store verification: ${processedRecords.length} processed records, ${storeRecords.length} total store records, ${shapes.length} shapes`)
            
            // Debug: Check if shapes have the right structure
            if (shapes.length > 0) {
              console.log("📊 Sample loaded shape:", {
                id: shapes[0].id,
                type: shapes[0].type,
                x: shapes[0].x,
                y: shapes[0].y,
                hasProps: !!shapes[0].props,
                propsKeys: shapes[0].props ? Object.keys(shapes[0].props) : [],
                allKeys: Object.keys(shapes[0])
              })
              
              // Validate all shapes have proper structure
              const invalidShapes = shapes.filter(shape => {
                const issues = []
                if (!shape.props) issues.push('missing props')
                // Only check w/h for shapes that actually need them
                const shapesWithoutWH = ['arrow', 'draw', 'text', 'note', 'line']
                if (!shapesWithoutWH.includes(shape.type) && (!(shape.props as any)?.w || !(shape.props as any)?.h)) {
                  issues.push('missing w/h in props')
                }
                if ('w' in shape || 'h' in shape) {
                  issues.push('w/h at top level instead of props')
                }
                return issues.length > 0
              })
              
              if (invalidShapes.length > 0) {
                console.warn(`⚠️ Found ${invalidShapes.length} shapes with structural issues:`, invalidShapes.map(s => ({
                  id: s.id,
                  type: s.type,
                  issues: {
                    missingProps: !s.props,
                    missingWH: s.type !== 'arrow' && s.type !== 'draw' && (!(s.props as any)?.w || !(s.props as any)?.h),
                    topLevelWH: 'w' in s || 'h' in s
                  }
                })))
              }
            }
            
            // Debug: Check for any shapes that might have validation issues
            const shapesWithTopLevelW = shapes.filter(s => 'w' in s)
            const shapesWithTopLevelH = shapes.filter(s => 'h' in s)
            if (shapesWithTopLevelW.length > 0 || shapesWithTopLevelH.length > 0) {
              console.warn(`📊 Found ${shapesWithTopLevelW.length} shapes with top-level w, ${shapesWithTopLevelH.length} with top-level h`)
              
              // Fix shapes with top-level w/h properties
              shapesWithTopLevelW.forEach(shape => {
                console.log(`🔧 Fixing shape ${shape.id} with top-level w property`)
                if (!shape.props) shape.props = {}
                ;(shape.props as any).w = (shape as any).w
                delete (shape as any).w
              })
              
              shapesWithTopLevelH.forEach(shape => {
                console.log(`🔧 Fixing shape ${shape.id} with top-level h property`)
                if (!shape.props) shape.props = {}
                ;(shape.props as any).h = (shape as any).h
                delete (shape as any).h
              })
            }
            
            if (shapes.length === 0) {
              // Only log if debugging is needed
              // console.log("No store data found in Automerge document")
            }
        }
        
        // Only log if debugging is needed
        // console.log("Setting store status to synced-remote")
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
      } catch (error) {
        console.error("Error initializing store from Automerge:", error)
        
        // Try to recover by creating a minimal valid store
        try {
          console.log("Attempting to recover with minimal store...")
          const minimalStore = createTLStore({
            schema: customSchema,
          })
          
          // Add basic page and camera records
          minimalStore.mergeRemoteChanges(() => {
            minimalStore.put([
              {
                id: 'page:page' as any,
                typeName: 'page',
                name: 'Page',
                index: 'a0' as any,
                meta: {}
              },
              {
                id: 'camera:page:page' as any,
                typeName: 'camera',
                x: 0,
                y: 0,
                z: 1,
                meta: {}
              }
            ])
          })
          
          setStoreWithStatus({
            store: minimalStore,
            status: "synced-remote",
            connectionStatus: "offline",
            error: error instanceof Error ? error : new Error("Store initialization failed, using minimal store") as any,
          })
        } catch (recoveryError) {
          console.error("Failed to recover with minimal store:", recoveryError)
          setStoreWithStatus({
            store,
            status: "not-synced",
            error: error instanceof Error ? error : new Error("Unknown error") as any,
          })
        }
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