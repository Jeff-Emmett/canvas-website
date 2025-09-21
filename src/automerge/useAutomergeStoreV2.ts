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

export function useAutomergeStoreV2({
  handle,
  userId: _userId,
}: {
  handle: DocHandle<any>
  userId: string
}): TLStoreWithStatus {
  console.log("useAutomergeStoreV2 called with handle:", !!handle)
  
  // Use default schema for now to avoid validation issues
  // Custom shapes will be handled through the shape utilities
  const customSchema = createTLSchema({
    shapes: defaultShapeSchemas,
    bindings: defaultBindingSchemas,
  })

  const [store] = useState(() => {
    const store = createTLStore({
      schema: customSchema,
    })
    return store
  })

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  })

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
            console.log(`✅ Successfully applied ${payload.patches.length} patches`)
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
            console.log(`Successfully applied ${successCount} out of ${payload.patches.length} patches`)
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
    const unsubscribeTLDraw = store.listen(({ changes }) => {
      if (isLocalChange) {
        console.log("Skipping TLDraw changes (local change)")
        return
      }

      try {
        isLocalChange = true
        handle.change((doc) => {
          applyTLStoreChangesToAutomerge(doc, changes)
        })
        console.log("Applied TLDraw changes to Automerge document")
        
        // Check if the document actually changed
        const docAfter = handle.doc()
      } catch (error) {
        console.error("Error applying TLDraw changes to Automerge:", error)
      }
    }, {
      source: "user",
      scope: "document",
    })

    unsubs.push(
      () => handle.off("change", automergeChangeHandler),
      unsubscribeTLDraw
    )

    // Initial load - populate TLDraw store from Automerge document
    const initializeStore = async () => {
      try {
        console.log("Starting TLDraw store initialization...")
        await handle.whenReady()
        console.log("Automerge handle is ready")
        
        const doc = handle.doc()
        console.log("Got Automerge document:", {
          hasStore: !!doc.store,
          storeKeys: doc.store ? Object.keys(doc.store).length : 0,
        })
        
            // Initialize store with existing records from Automerge
            if (doc.store) {
                const allStoreValues = Object.values(doc.store)
                console.log("All store values from Automerge:", allStoreValues.map((v: any) => ({
                  hasTypeName: !!v?.typeName,
                  hasId: !!v?.id,
                  typeName: v?.typeName,
            id: v?.id
          })))
          
          // Simple filtering - only keep valid records
          const records = allStoreValues.filter((record: any) => 
              record && record.typeName && record.id
            )
          
          console.log(`Found ${records.length} valid records in Automerge document`)
          
          // Comprehensive shape validation and fixes for any shape type
          const processedRecords = records.map((record: any) => {
            // Create a deep copy to avoid modifying immutable Automerge objects
            const processedRecord = JSON.parse(JSON.stringify(record))
        
            // Minimal shape validation - only fix critical issues
            if (processedRecord.typeName === 'shape') {
              // Ensure basic required properties exist
              if (processedRecord.x === undefined) processedRecord.x = 0
              if (processedRecord.y === undefined) processedRecord.y = 0
              if (processedRecord.rotation === undefined) processedRecord.rotation = 0
              if (processedRecord.isLocked === undefined) processedRecord.isLocked = false
              if (processedRecord.opacity === undefined) processedRecord.opacity = 1
              if (!processedRecord.meta) processedRecord.meta = {}
              
              // Ensure parentId exists
              if (!processedRecord.parentId) {
                const pageRecord = records.find((r: any) => r.typeName === 'page') as any
                if (pageRecord && pageRecord.id) {
                  processedRecord.parentId = pageRecord.id
                }
              }
              
              // Ensure shape has a valid type
              if (!processedRecord.type) {
                console.log(`Shape ${processedRecord.id} missing type, setting to 'geo'`)
                processedRecord.type = 'geo'
              }
              
              // Migrate old Transcribe shapes to geo shapes
              if (processedRecord.type === 'Transcribe') {
                console.log(`Migrating old Transcribe shape ${processedRecord.id} to geo shape`)
                processedRecord.type = 'geo'
                
                // Ensure required geo props exist
                if (!processedRecord.props.geo) processedRecord.props.geo = 'rectangle'
                if (!processedRecord.props.fill) processedRecord.props.fill = 'solid'
                if (!processedRecord.props.color) processedRecord.props.color = 'white'
                if (!processedRecord.props.dash) processedRecord.props.dash = 'draw'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.font) processedRecord.props.font = 'draw'
                if (!processedRecord.props.align) processedRecord.props.align = 'start'
                if (!processedRecord.props.verticalAlign) processedRecord.props.verticalAlign = 'start'
                if (!processedRecord.props.richText) processedRecord.props.richText = [] as any
                
                // Move transcript text from props to meta
                if (processedRecord.props.transcript) {
                  if (!processedRecord.meta) processedRecord.meta = {}
                  processedRecord.meta.text = processedRecord.props.transcript
                  delete processedRecord.props.transcript
                }
                
                // Clean up other old Transcribe-specific props
                const oldProps = ['isRecording', 'transcriptSegments', 'speakers', 'currentSpeakerId', 
                                'interimText', 'isCompleted', 'aiSummary', 'language', 'autoScroll', 
                                'showTimestamps', 'showSpeakerLabels', 'manualClear']
                oldProps.forEach(prop => {
                  if (processedRecord.props[prop] !== undefined) {
                    delete processedRecord.props[prop]
                  }
                })
              }
              
              // Ensure props object exists for all shapes
              if (!processedRecord.props) processedRecord.props = {}
              
              // Move properties from top level to props for shapes that support them
              // Arrow shapes don't have w/h in props, so handle them differently
              if (processedRecord.type !== 'arrow') {
                if ('w' in processedRecord && typeof processedRecord.w === 'number') {
                  console.log(`Moving w property from top level to props for shape ${processedRecord.id}`)
                  processedRecord.props.w = processedRecord.w
                  delete (processedRecord as any).w
                }
                
                if ('h' in processedRecord && typeof processedRecord.h === 'number') {
                  console.log(`Moving h property from top level to props for shape ${processedRecord.id}`)
                  processedRecord.props.h = processedRecord.h
                  delete (processedRecord as any).h
                }
              } else {
                // For arrow shapes, remove w/h properties entirely as they're not valid
                if ('w' in processedRecord) {
                  console.log(`Removing invalid w property from arrow shape ${processedRecord.id}`)
                  delete (processedRecord as any).w
                }
                if ('h' in processedRecord) {
                  console.log(`Removing invalid h property from arrow shape ${processedRecord.id}`)
                  delete (processedRecord as any).h
                }
              }
              
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
                if (!processedRecord.props.richText) processedRecord.props.richText = { content: [], type: 'doc' }
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
                // Ensure required text properties exist
                if (!processedRecord.props.color) processedRecord.props.color = 'black'
                if (!processedRecord.props.size) processedRecord.props.size = 'm'
                if (!processedRecord.props.font) processedRecord.props.font = 'draw'
                if (!processedRecord.props.textAlign) processedRecord.props.textAlign = 'start'
                if (!processedRecord.props.w) processedRecord.props.w = 100
                if (!processedRecord.props.richText) processedRecord.props.richText = { content: [], type: 'doc' }
                if (processedRecord.props.scale === undefined) processedRecord.props.scale = 1
                if (processedRecord.props.autoSize === undefined) processedRecord.props.autoSize = false
                
                // Remove any invalid properties
                const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'roomId']
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
                if (!processedRecord.props.segments) processedRecord.props.segments = []
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
              
              // Handle geo shapes specially - move geo property
              if (processedRecord.type === 'geo') {
                if ('geo' in processedRecord && processedRecord.geo) {
                  console.log(`Moving geo property from top level to props for shape ${processedRecord.id}`)
                  processedRecord.props.geo = processedRecord.geo
                  delete (processedRecord as any).geo
                }
                
                // Ensure required props exist
                if (!processedRecord.props.w) processedRecord.props.w = 100
                if (!processedRecord.props.h) processedRecord.props.h = 100
                if (!processedRecord.props.geo) processedRecord.props.geo = 'rectangle'
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
                
                // Remove invalid properties from props
                const invalidProps = ['insets', 'scribbles']
                invalidProps.forEach(prop => {
                  if (prop in processedRecord.props) {
                    console.log(`Removing invalid prop '${prop}' from geo shape ${processedRecord.id}`)
                    delete (processedRecord.props as any)[prop]
                  }
                })
              }
              
              // Handle rich text content that might be undefined or invalid
              if (processedRecord.props && processedRecord.props.richText !== undefined) {
                if (!Array.isArray(processedRecord.props.richText)) {
                  console.warn('Fixing invalid richText property for shape:', processedRecord.id, 'type:', processedRecord.type, 'was:', typeof processedRecord.props.richText)
                  processedRecord.props.richText = { content: [], type: 'doc' }
                } else {
                  // If it's an array, convert to proper richText object structure
                  console.log(`🔧 Converting richText array to object for shape ${processedRecord.id}`)
                  processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                }
              } else if (processedRecord.type === 'geo' || processedRecord.type === 'note') {
                // These shape types require richText, so create a default empty object
                if (!processedRecord.props) processedRecord.props = {}
                processedRecord.props.richText = { content: [], type: 'doc' }
              }
              
              // Remove invalid properties that cause validation errors (after moving geo properties)
              const invalidProperties = [
                'insets', 'scribbles', 'duplicateProps', 'isAspectRatioLocked', 
                'isFlippedHorizontal', 'isFlippedVertical', 'isFrozen', 'isSnappable', 
                'isTransparent', 'isVisible', 'isZIndexLocked', 'isHidden'
              ]
              invalidProperties.forEach(prop => {
                if (prop in processedRecord) {
                  console.log(`Removing invalid property '${prop}' from shape ${processedRecord.id}`)
                  delete (processedRecord as any)[prop]
                }
              })
              
              // Convert custom shape types to valid TLDraw types
              const customShapeTypeMap: { [key: string]: string } = {
                'VideoChat': 'embed',
                'Transcription': 'text',
                'SharedPiano': 'embed',
                'Prompt': 'text',
                'ChatBox': 'embed',
                'Embed': 'embed',
                'Markdown': 'text',
                'MycrozineTemplate': 'embed',
                'Slide': 'embed',
                'ObsNote': 'text'
              }
              
              if (customShapeTypeMap[processedRecord.type]) {
                console.log(`🔧 Converting custom shape type ${processedRecord.type} to ${customShapeTypeMap[processedRecord.type]} for shape:`, processedRecord.id)
                processedRecord.type = customShapeTypeMap[processedRecord.type]
              }
              
              // Universal shape validation - ensure any shape type can be imported
              if (processedRecord.props) {
                // Fix any richText issues for any shape type
                if (processedRecord.props.richText !== undefined) {
                  if (!Array.isArray(processedRecord.props.richText)) {
                    console.log(`🔧 Universal fix: Converting richText to proper object for shape ${processedRecord.id} (type: ${processedRecord.type})`)
                    processedRecord.props.richText = { content: [], type: 'doc' }
                  } else {
                    // Convert array to proper object structure
                    console.log(`🔧 Universal fix: Converting richText array to object for shape ${processedRecord.id} (type: ${processedRecord.type})`)
                    processedRecord.props.richText = { content: processedRecord.props.richText, type: 'doc' }
                  }
                }
                
                // Special handling for geo shapes
                if (processedRecord.type === 'geo') {
                  // Ensure geo shape has proper structure
                  if (!processedRecord.props.geo) {
                    processedRecord.props.geo = 'rectangle'
                  }
                  if (!processedRecord.props.w) {
                    processedRecord.props.w = 100
                  }
                  if (!processedRecord.props.h) {
                    processedRecord.props.h = 100
                  }
                  
                  // Remove invalid properties for geo shapes (including insets)
                  const invalidGeoProps = ['transcript', 'isTranscribing', 'isPaused', 'isEditing', 'roomUrl', 'roomId', 'prompt', 'value', 'agentBinding', 'isMinimized', 'noteId', 'title', 'content', 'tags', 'showPreview', 'backgroundColor', 'textColor', 'editingContent', 'vaultName', 'insets']
                  invalidGeoProps.forEach(prop => {
                    if (prop in processedRecord.props) {
                      console.log(`🔧 Removing invalid ${prop} property from geo shape:`, processedRecord.id)
                      delete processedRecord.props[prop]
                    }
                  })
                }
                
                // Fix note shapes - remove w/h properties
                if (processedRecord.type === 'note') {
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
                
                // Ensure all required properties exist for any shape type (except arrow and draw)
                if (processedRecord.type !== 'arrow' && processedRecord.type !== 'draw' && processedRecord.type !== 'text' && processedRecord.type !== 'note') {
                  const requiredProps = ['w', 'h']
                  requiredProps.forEach(prop => {
                    if (processedRecord.props[prop] === undefined) {
                      console.log(`🔧 Universal fix: Adding missing ${prop} for shape ${processedRecord.id} (type: ${processedRecord.type})`)
                      if (prop === 'w') processedRecord.props.w = 100
                      if (prop === 'h') processedRecord.props.h = 100
                    }
                  })
                } else if (processedRecord.type === 'text') {
                  // Text shapes only need w, not h
                  if (processedRecord.props.w === undefined) {
                    console.log(`🔧 Universal fix: Adding missing w for text shape ${processedRecord.id}`)
                    processedRecord.props.w = 100
                  }
                }
                
                // Clean up any null/undefined values in props
                Object.keys(processedRecord.props).forEach(propKey => {
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
            try {
              store.mergeRemoteChanges(() => {
                store.put(processedRecords)
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
              console.log(`Successfully loaded ${successCount} out of ${processedRecords.length} records`)
              console.log(`Failed records: ${failedRecords.length}`, failedRecords.map(r => r.id))
              
              // Try to fix and reload failed records
              if (failedRecords.length > 0) {
                console.log("Attempting to fix and reload failed records...")
                for (const record of failedRecords) {
                  try {
                    // Additional cleanup for failed records - create deep copy
                    const fixedRecord = JSON.parse(JSON.stringify(record))
                    
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
                    
                    // Remove any remaining top-level w/h properties for shapes (except arrow and draw)
                    if (fixedRecord.typeName === 'shape') {
                      if (fixedRecord.type !== 'arrow' && fixedRecord.type !== 'draw') {
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
                      
                    // Comprehensive richText validation - ensure it's always an object with content and type
                    if (fixedRecord.props) {
                      if (fixedRecord.props.richText !== undefined) {
                        if (!Array.isArray(fixedRecord.props.richText)) {
                          console.log(`🔧 Fixing richText for shape ${fixedRecord.id}: was ${typeof fixedRecord.props.richText}, setting to proper object`)
                          fixedRecord.props.richText = { content: [], type: 'doc' }
                        } else {
                          // If it's an array, convert to proper richText object structure
                          console.log(`🔧 Converting richText array to object for shape ${fixedRecord.id}`)
                          fixedRecord.props.richText = { content: fixedRecord.props.richText, type: 'doc' }
                        }
                      } else {
                        // All shapes should have richText as an object if not present
                        console.log(`🔧 Creating default richText object for shape ${fixedRecord.id} (type: ${fixedRecord.type})`)
                        fixedRecord.props.richText = { content: [], type: 'doc' }
                      }
                    } else {
                      // Ensure props object exists
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
                      
                      // Remove invalid properties for text shapes
                      const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl']
                      invalidTextProps.forEach(prop => {
                        if (prop in fixedRecord.props) {
                          console.log(`🔧 Removing invalid prop '${prop}' from text shape ${fixedRecord.id}`)
                          delete (fixedRecord.props as any)[prop]
                        }
                      })
                    }
                    
                    // Fix embed shapes - ensure they have required properties and remove invalid ones
                    if (fixedRecord.type === 'embed') {
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
                      
                      // Remove invalid properties for embed shapes
                      const invalidEmbedProps = ['isMinimized', 'roomUrl', 'roomId', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'richText']
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
                      
                      // Ensure parentId exists
                      if (!fixedRecord.parentId) {
                        const pageRecord = records.find((r: any) => r.typeName === 'page') as any
                        if (pageRecord && pageRecord.id) {
                          fixedRecord.parentId = pageRecord.id
                        }
                      }
                      
                      // Ensure props object exists
                      if (!fixedRecord.props) fixedRecord.props = {}
                      
                      // Ensure w and h exist in props (except for arrow and draw shapes)
                      if (fixedRecord.type !== 'arrow' && fixedRecord.type !== 'draw') {
                        if (fixedRecord.props.w === undefined) fixedRecord.props.w = 100
                        if (fixedRecord.props.h === undefined) fixedRecord.props.h = 100
                      } else if (fixedRecord.type === 'text') {
                        // Text shapes only need w, not h
                        if (fixedRecord.props.w === undefined) fixedRecord.props.w = 100
                      }
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
                if (shape.type !== 'arrow' && shape.type !== 'draw' && (!(shape.props as any)?.w || !(shape.props as any)?.h)) {
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
              console.log("No store data found in Automerge document")
            }
        }
        
        console.log("Setting store status to synced-remote")
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