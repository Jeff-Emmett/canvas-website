import { TLRecord, RecordId, TLStore, IndexKey } from "@tldraw/tldraw"
import * as Automerge from "@automerge/automerge"

// Helper function to validate if a string is a valid tldraw IndexKey
// tldraw uses fractional indexing based on https://observablehq.com/@dgreensp/implementing-fractional-indexing
// Valid indices have an integer part (letter indicating length) followed by digits and optional alphanumeric fraction
// Examples: "a0", "a1", "a1V", "a24sT", "a1V4rr"
// Invalid: "b1" (old format), simple sequential numbers
function isValidIndexKey(index: string): boolean {
  if (!index || typeof index !== 'string' || index.length === 0) {
    return false
  }

  // tldraw uses fractional indexing where:
  // - First character is a lowercase letter indicating integer part length (a=1, b=2, c=3, etc.)
  // - Followed by alphanumeric characters for the value and optional jitter
  // Examples: "a0", "a1", "b10", "b99", "c100", "a1V4rr", "b10Lz"
  //
  // Also uppercase letters for negative indices (Z=1, Y=2, etc.)

  // Valid fractional index: lowercase letter followed by alphanumeric characters
  if (/^[a-z][a-zA-Z0-9]+$/.test(index)) {
    return true
  }

  // Also allow uppercase prefix for negative/very high indices
  if (/^[A-Z][a-zA-Z0-9]+$/.test(index)) {
    return true
  }

  return false
}

export function applyAutomergePatchesToTLStore(
  patches: Automerge.Patch[],
  store: TLStore,
  automergeDoc?: any // Optional Automerge document to read full records from
) {
  const toRemove: TLRecord["id"][] = []
  const updatedObjects: { [id: string]: TLRecord } = {}

  patches.forEach((patch) => {
    if (!isStorePatch(patch)) return

    const id = pathToId(patch.path)
    
    // Skip records with empty or invalid IDs
    if (!id || id === '') {
      return
    }
    
    // CRITICAL: Skip custom record types that aren't TLDraw records
    // These should only exist in Automerge, not in TLDraw store
    // Components like ObsidianVaultBrowser read directly from Automerge
    if (typeof id === 'string' && id.startsWith('obsidian_vault:')) {
      return // Skip - not a TLDraw record, don't process
    }
    
    const existingRecord = getRecordFromStore(store, id)
    
    // CRITICAL: For shapes, get coordinates and parentId from store's current state BEFORE any patch processing
    // This ensures we preserve coordinates and parent relationships even if patches don't include them
    // This is especially important when patches come back after store.put operations
    let storeCoordinates: { x?: number; y?: number } = {}
    let storeParentId: string | undefined = undefined
    if (existingRecord && existingRecord.typeName === 'shape') {
      const storeX = (existingRecord as any).x
      const storeY = (existingRecord as any).y
      if (typeof storeX === 'number' && !isNaN(storeX) && storeX !== null && storeX !== undefined) {
        storeCoordinates.x = storeX
      }
      if (typeof storeY === 'number' && !isNaN(storeY) && storeY !== null && storeY !== undefined) {
        storeCoordinates.y = storeY
      }
      // CRITICAL: Preserve parentId from store (might be a frame or group!)
      const existingParentId = (existingRecord as any).parentId
      if (existingParentId && typeof existingParentId === 'string') {
        storeParentId = existingParentId
      }
    }
    
    // CRITICAL: If record doesn't exist in store yet, try to get it from Automerge document
    // This prevents coordinates from defaulting to 0,0 when patches create new records
    let automergeRecord: any = null
    let automergeParentId: string | undefined = undefined
    if (!existingRecord && automergeDoc && automergeDoc.store && automergeDoc.store[id]) {
      try {
        automergeRecord = automergeDoc.store[id]
        // Extract coordinates and parentId from Automerge record if it's a shape
        if (automergeRecord && automergeRecord.typeName === 'shape') {
          const docX = automergeRecord.x
          const docY = automergeRecord.y
          if (typeof docX === 'number' && !isNaN(docX) && docX !== null && docX !== undefined) {
            storeCoordinates.x = docX
          }
          if (typeof docY === 'number' && !isNaN(docY) && docY !== null && docY !== undefined) {
            storeCoordinates.y = docY
          }
          // CRITICAL: Preserve parentId from Automerge document (might be a frame!)
          if (automergeRecord.parentId && typeof automergeRecord.parentId === 'string') {
            automergeParentId = automergeRecord.parentId
          }
        }
      } catch (e) {
        // If we can't read from Automerge doc, continue without it
        console.warn(`Could not read record ${id} from Automerge document:`, e)
      }
    }
    
    // Infer typeName from ID pattern if record doesn't exist
    let defaultTypeName = 'shape'
    let defaultRecord: any = {
      id,
      typeName: 'shape',
      type: 'geo', // Default shape type
      x: 0,
      y: 0,
      rotation: 0,
      isLocked: false,
      opacity: 1,
      meta: {},
      props: {}
    }
    
    // Check if ID pattern indicates a record type
    // Note: obsidian_vault records are skipped above, so we don't need to handle them here
    if (typeof id === 'string') {
      if (id.startsWith('shape:')) {
        defaultTypeName = 'shape'
        // Keep default shape record structure
      } else if (id.startsWith('page:')) {
        defaultTypeName = 'page'
        defaultRecord = {
          id,
          typeName: 'page',
          name: '',
          index: 'a0' as any,
          meta: {}
        }
      } else if (id.startsWith('camera:')) {
        defaultTypeName = 'camera'
        defaultRecord = {
          id,
          typeName: 'camera',
          x: 0,
          y: 0,
          z: 1,
          meta: {}
        }
      } else if (id.startsWith('instance:')) {
        defaultTypeName = 'instance'
        defaultRecord = {
          id,
          typeName: 'instance',
          currentPageId: 'page:page' as any,
          meta: {}
        }
      } else if (id.startsWith('pointer:')) {
        defaultTypeName = 'pointer'
        defaultRecord = {
          id,
          typeName: 'pointer',
          x: 0,
          y: 0,
          lastActivityTimestamp: 0,
          meta: {}
        }
      } else if (id.startsWith('document:')) {
        defaultTypeName = 'document'
        defaultRecord = {
          id,
          typeName: 'document',
          gridSize: 10,
          name: '',
          meta: {}
        }
      }
    }
    
    // CRITICAL: When creating a new record, prefer using the full record from Automerge document
    // This ensures we get all properties including coordinates, not just defaults
    let record: any
    if (updatedObjects[id]) {
      record = updatedObjects[id]
    } else if (existingRecord) {
      record = JSON.parse(JSON.stringify(existingRecord))
    } else if (automergeRecord) {
      // Use the full record from Automerge document - this has all properties including coordinates
      record = JSON.parse(JSON.stringify(automergeRecord))
    } else {
      // Fallback to default record only if we can't get it from anywhere else
      record = defaultRecord
    }
    
    // CRITICAL: For shapes, ensure x and y are always present (even if record came from updatedObjects)
    // This prevents coordinates from being lost when records are created from patches
    if (record.typeName === 'shape') {
      if (typeof record.x !== 'number' || record.x === null || isNaN(record.x)) {
        record = { ...record, x: defaultRecord.x || 0 }
      }
      if (typeof record.y !== 'number' || record.y === null || isNaN(record.y)) {
        record = { ...record, y: defaultRecord.y || 0 }
      }
    }
    
    // CRITICAL: Ensure typeName matches ID pattern (fixes misclassification)
    // Note: obsidian_vault records are skipped above, so we don't need to handle them here
    if (typeof id === 'string') {
      let correctTypeName = record.typeName
      if (id.startsWith('shape:') && record.typeName !== 'shape') {
        correctTypeName = 'shape'
      } else if (id.startsWith('page:') && record.typeName !== 'page') {
        correctTypeName = 'page'
      } else if (id.startsWith('camera:') && record.typeName !== 'camera') {
        correctTypeName = 'camera'
      } else if (id.startsWith('instance:') && record.typeName !== 'instance') {
        correctTypeName = 'instance'
      } else if (id.startsWith('pointer:') && record.typeName !== 'pointer') {
        correctTypeName = 'pointer'
      } else if (id.startsWith('document:') && record.typeName !== 'document') {
        correctTypeName = 'document'
      }
      
      // Create new object with correct typeName if it changed
      if (correctTypeName !== record.typeName) {
        record = { ...record, typeName: correctTypeName } as TLRecord
      }
    }

    // CRITICAL: Store original x and y before patch application to preserve them
    // Priority: Use coordinates from store's current state (most reliable), then from record, then undefined
    // This ensures we preserve coordinates even when patches come back after store.put operations
    const recordX = (record.typeName === 'shape' && typeof record.x === 'number' && !isNaN(record.x)) ? record.x : undefined
    const recordY = (record.typeName === 'shape' && typeof record.y === 'number' && !isNaN(record.y)) ? record.y : undefined
    const originalX = storeCoordinates.x !== undefined ? storeCoordinates.x : recordX
    const originalY = storeCoordinates.y !== undefined ? storeCoordinates.y : recordY
    const hadOriginalCoordinates = originalX !== undefined && originalY !== undefined
    
    // CRITICAL: Store original richText and arrow text before patch application to preserve them
    // This ensures richText and arrow text aren't lost when patches only update other properties
    let originalRichText: any = undefined
    let originalArrowText: any = undefined
    if (record.typeName === 'shape') {
      // Get richText from store's current state (most reliable)
      if (existingRecord && (existingRecord as any).props && (existingRecord as any).props.richText) {
        originalRichText = (existingRecord as any).props.richText
      } else if ((record as any).props && (record as any).props.richText) {
        originalRichText = (record as any).props.richText
      }
      
      // Get arrow text from store's current state (most reliable)
      if ((record as any).type === 'arrow') {
        if (existingRecord && (existingRecord as any).props && (existingRecord as any).props.text !== undefined) {
          originalArrowText = (existingRecord as any).props.text
        } else if ((record as any).props && (record as any).props.text !== undefined) {
          originalArrowText = (record as any).props.text
        }
      }
    }

    switch (patch.action) {
      case "insert": {
        updatedObjects[id] = applyInsertToObject(patch, record)
        break
      }
      case "put":
        updatedObjects[id] = applyPutToObject(patch, record)
        break
      case "del": {
        const id = pathToId(patch.path)
        toRemove.push(id as TLRecord["id"])
        break
      }
      case "splice": {
        updatedObjects[id] = applySpliceToObject(patch, record)
        break
      }
      case "inc": {
        updatedObjects[id] = applyIncToObject(patch, record)
        break
      }
      case "mark":
      case "unmark":
      case "conflict": {
        // These actions are not currently supported for TLDraw
        console.log("Unsupported patch action:", patch.action)
        break
      }
      default: {
        console.log("Unsupported patch:", patch)
      }
    }
    
    // CRITICAL: After patch application, ensure x and y coordinates are preserved for shapes
    // This prevents coordinates from being reset to 0,0 when patches don't include them
    if (updatedObjects[id] && updatedObjects[id].typeName === 'shape') {
      const patchedRecord = updatedObjects[id]
      const patchedX = (patchedRecord as any).x
      const patchedY = (patchedRecord as any).y
      const patchedHasValidX = typeof patchedX === 'number' && !isNaN(patchedX) && patchedX !== null && patchedX !== undefined
      const patchedHasValidY = typeof patchedY === 'number' && !isNaN(patchedY) && patchedY !== null && patchedY !== undefined
      
      // CRITICAL: If we had original coordinates, preserve them unless patch explicitly set different valid coordinates
      // This prevents coordinates from collapsing to 0,0 after bulk upload
      if (hadOriginalCoordinates) {
        // Only use patched coordinates if they're explicitly set and different from original
        // Otherwise, preserve the original coordinates
        if (patchedHasValidX && patchedX !== originalX) {
          // Patch explicitly set a different X coordinate - use it
          updatedObjects[id] = { ...patchedRecord, x: patchedX }
        } else {
          // Preserve original X coordinate
          updatedObjects[id] = { ...patchedRecord, x: originalX }
        }
        
        if (patchedHasValidY && patchedY !== originalY) {
          // Patch explicitly set a different Y coordinate - use it
          updatedObjects[id] = { ...updatedObjects[id], y: patchedY } as TLRecord
        } else {
          // Preserve original Y coordinate
          updatedObjects[id] = { ...updatedObjects[id], y: originalY } as TLRecord
        }
      } else {
        // No original coordinates - use patched values or defaults
        if (!patchedHasValidX) {
          updatedObjects[id] = { ...patchedRecord, x: defaultRecord.x || 0 }
        }
        if (!patchedHasValidY) {
          updatedObjects[id] = { ...updatedObjects[id], y: defaultRecord.y || 0 } as TLRecord
        }
      }
      
      // CRITICAL: Preserve richText and arrow text after patch application
      // This prevents richText and arrow text from being lost when patches only update other properties
      const currentRecord = updatedObjects[id]
      
      // Preserve richText for geo/note/text shapes
      if (originalRichText !== undefined && (currentRecord as any).type !== 'arrow') {
        const patchedProps = (currentRecord as any).props || {}
        const patchedRichText = patchedProps.richText
        // If patch didn't include richText, preserve the original
        if (patchedRichText === undefined || patchedRichText === null) {
          updatedObjects[id] = {
            ...currentRecord,
            props: {
              ...patchedProps,
              richText: originalRichText
            }
          } as TLRecord
        }
      }
      
      // Preserve arrow text for arrow shapes
      if (originalArrowText !== undefined && (currentRecord as any).type === 'arrow') {
        const patchedProps = (currentRecord as any).props || {}
        const patchedText = patchedProps.text
        // If patch didn't include text, preserve the original
        if (patchedText === undefined || patchedText === null) {
          updatedObjects[id] = {
            ...currentRecord,
            props: {
              ...patchedProps,
              text: originalArrowText
            }
          } as TLRecord
        }
      }

      // CRITICAL: Preserve parentId from store or Automerge document
      // This prevents shapes from losing their frame/group parent relationships
      // which causes them to reset to (0,0) on the page instead of maintaining their position in the frame
      // Priority: store parentId (most reliable), then Automerge parentId, then patch value
      const preservedParentId = storeParentId || automergeParentId
      if (preservedParentId !== undefined) {
        const patchedParentId = (currentRecord as any).parentId
        // If patch didn't include parentId, or it's missing/default, use the preserved parentId
        if (!patchedParentId || (patchedParentId === 'page:page' && preservedParentId !== 'page:page')) {
          updatedObjects[id] = {
            ...currentRecord,
            parentId: preservedParentId
          } as TLRecord
        }
      }
    }
    
    // CRITICAL: Re-check typeName after patch application to ensure it's still correct
    // Note: obsidian_vault records are skipped above, so we don't need to handle them here
  })
  
  // Sanitize records before putting them in the store
  const toPut: TLRecord[] = []
  const failedRecords: any[] = []
  
  Object.values(updatedObjects).forEach(record => {
    // Skip records with empty or invalid IDs
    if (!record || !record.id || record.id === '') {
      return
    }
    
    // CRITICAL: Skip custom record types that aren't TLDraw records
    // These should only exist in Automerge, not in TLDraw store
    if (typeof record.id === 'string' && record.id.startsWith('obsidian_vault:')) {
      return // Skip - not a TLDraw record
    }
    
    // Filter out SharedPiano shapes since they're no longer supported
    if (record.typeName === 'shape' && (record as any).type === 'SharedPiano') {
      console.log(`⚠️ Filtering out deprecated SharedPiano shape: ${record.id}`)
      return // Skip - SharedPiano is deprecated
    }
    
    try {
      const sanitized = sanitizeRecord(record)
      toPut.push(sanitized)
    } catch (error) {
      // If it's a missing typeName/id error, skip it
      if (error instanceof Error && 
          (error.message.includes('missing required typeName') || 
           error.message.includes('missing required id'))) {
        // Skip records with missing required fields
        return
      }
      console.error("Failed to sanitize record:", error, record)
      failedRecords.push(record)
    }
  })

  // put / remove the records in the store
  // Log patch application for debugging
  console.log(`🔧 AutomergeToTLStore: Applying ${patches.length} patches, ${toPut.length} records to put, ${toRemove.length} records to remove`)

  // DEBUG: Log shape updates being applied to store
  toPut.forEach(record => {
    if (record.typeName === 'shape' && (record as any).props?.w) {
      console.log(`🔧 AutomergeToTLStore: Putting shape ${(record as any).type} ${record.id}:`, {
        w: (record as any).props.w,
        h: (record as any).props.h,
        x: (record as any).x,
        y: (record as any).y
      })
    }
  })
  
  if (failedRecords.length > 0) {
    console.log({ patches, toPut: toPut.length, failed: failedRecords.length })
  }
  
  if (failedRecords.length > 0) {
    console.error("Failed to sanitize records:", failedRecords)
  }
  
    // CRITICAL: Final safety check - ensure no geo shapes have w/h/geo at top level
    // Also ensure text shapes don't have props.text (should use props.richText instead)
    const finalSanitized = toPut.map(record => {
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
        
        // CRITICAL: props.geo is REQUIRED for geo shapes - TLDraw validation will fail without it
        // Use geoValue if available, otherwise default to 'rectangle'
        if (geoValue !== undefined) {
          cleaned.props.geo = geoValue
        } else if (!cleaned.props.geo || cleaned.props.geo === undefined || cleaned.props.geo === null) {
          // Default to rectangle if geo is missing
          cleaned.props.geo = 'rectangle'
        }
        
        // CRITICAL: props.dash is REQUIRED for geo shapes - TLDraw validation will fail without it
        // Ensure it's always set, defaulting to 'draw' if missing
        if (!cleaned.props.dash || cleaned.props.dash === undefined || cleaned.props.dash === null) {
          cleaned.props.dash = 'draw'
        }
        
        return cleaned as TLRecord
      }
    
    // CRITICAL: Remove props.text from text shapes (TLDraw schema doesn't allow it)
    if (record.typeName === 'shape' && record.type === 'text' && (record as any).props && 'text' in (record as any).props) {
      const cleaned = { ...record }
      if (cleaned.props && 'text' in cleaned.props) {
        delete (cleaned.props as any).text
      }
      return cleaned as TLRecord
    }
    
    return record
  })
  
  store.mergeRemoteChanges(() => {
    if (toRemove.length) store.remove(toRemove)
    if (finalSanitized.length) store.put(finalSanitized)
  })
}

// Helper function to clean NaN values from richText content
// This prevents SVG export errors when TLDraw tries to render text with invalid coordinates
function cleanRichTextNaN(richText: any): any {
  if (!richText || typeof richText !== 'object') {
    return richText
  }
  
  // Deep clone to avoid mutating the original
  const cleaned = JSON.parse(JSON.stringify(richText))
  
  // Recursively clean content array
  if (Array.isArray(cleaned.content)) {
    cleaned.content = cleaned.content.map((item: any) => {
      if (typeof item === 'object' && item !== null) {
        // Remove any NaN values from the item
        const cleanedItem: any = {}
        for (const key in item) {
          const value = item[key]
          // Skip NaN values - they cause SVG export errors
          if (typeof value === 'number' && isNaN(value)) {
            // Skip NaN values
            continue
          }
          // Recursively clean nested objects
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            cleanedItem[key] = cleanRichTextNaN(value)
          } else if (Array.isArray(value)) {
            cleanedItem[key] = value.map((v: any) => 
              typeof v === 'object' && v !== null ? cleanRichTextNaN(v) : v
            )
          } else {
            cleanedItem[key] = value
          }
        }
        return cleanedItem
      }
      return item
    })
  }
  
  return cleaned
}

// Minimal sanitization - only fix critical issues that break TLDraw
// EXPORTED: Use this same sanitization for patch-based loading (same as dev mode)
export function sanitizeRecord(record: any): TLRecord {
  const sanitized = { ...record }
  
  // CRITICAL FIXES ONLY - preserve all other properties
  
  // Only fix critical structural issues
  if (!sanitized.id || sanitized.id === '') {
    throw new Error("Record missing required id field")
  }
  
  if (!sanitized.typeName || sanitized.typeName === '') {
    throw new Error("Record missing required typeName field")
  }
  
  // For shapes, only ensure basic required fields exist
  if (sanitized.typeName === 'shape') {
    // CRITICAL: Remove instance-only properties from shapes (these cause validation errors)
    // These properties should only exist on instance records, not shape records
    const instanceOnlyProperties = ['insets', 'brush', 'zoomBrush', 'scribbles', 'duplicateProps']
    instanceOnlyProperties.forEach(prop => {
      if (prop in sanitized) {
        delete (sanitized as any)[prop]
      }
    })
    
    // Ensure required shape fields exist
    // CRITICAL: Only set defaults if coordinates are truly missing or invalid
    // DO NOT overwrite valid coordinates (including 0, which is a valid position)
    // Only set to 0 if the value is undefined, null, or NaN
    if (sanitized.x === undefined || sanitized.x === null || (typeof sanitized.x === 'number' && isNaN(sanitized.x))) {
      console.warn(`⚠️ Shape ${sanitized.id} (${sanitized.type}) has invalid x coordinate, defaulting to 0. Original value:`, sanitized.x)
      sanitized.x = 0
    }
    if (sanitized.y === undefined || sanitized.y === null || (typeof sanitized.y === 'number' && isNaN(sanitized.y))) {
      console.warn(`⚠️ Shape ${sanitized.id} (${sanitized.type}) has invalid y coordinate, defaulting to 0. Original value:`, sanitized.y)
      sanitized.y = 0
    }
    if (typeof sanitized.rotation !== 'number') sanitized.rotation = 0
    if (typeof sanitized.isLocked !== 'boolean') sanitized.isLocked = false
    if (typeof sanitized.opacity !== 'number') sanitized.opacity = 1
    // CRITICAL: Preserve all existing meta properties - only create empty object if meta doesn't exist
    if (!sanitized.meta || typeof sanitized.meta !== 'object') {
      sanitized.meta = {}
    } else {
      // Ensure meta is a mutable copy to preserve all properties (including text for rectangles)
      sanitized.meta = { ...sanitized.meta }
    }
    // CRITICAL: IndexKey must follow tldraw's fractional indexing format
    // Valid format: starts with 'a' followed by digits, optionally followed by alphanumeric jitter
    // Examples: "a1", "a2", "a10", "a1V", "a24sT", "a1V4rr" (fractional between a1 and a2)
    // Invalid: "c1", "b1", "z999" (old format - not valid fractional indices)
    if (!isValidIndexKey(sanitized.index)) {
      console.warn(`⚠️ Invalid index "${sanitized.index}" for shape ${sanitized.id}, resetting to 'a1'`)
      sanitized.index = 'a1' as IndexKey
    }
    if (!sanitized.parentId) sanitized.parentId = 'page:page'
    if (!sanitized.props || typeof sanitized.props !== 'object') sanitized.props = {}
    
    // CRITICAL: Ensure props is a deep mutable copy to preserve all nested properties
    // This is essential for custom shapes like ObsNote and for preserving richText in geo shapes
    // Use JSON parse/stringify to create a deep copy of nested objects (like richText.content)
    try {
      sanitized.props = JSON.parse(JSON.stringify(sanitized.props))
    } catch (e) {
      // If JSON serialization fails (e.g., due to functions or circular references),
      // create a shallow copy and recursively clean it
      console.warn(`⚠️ Could not deep copy props for shape ${sanitized.id}, using shallow copy:`, e)
      const propsCopy: any = {}
      for (const key in sanitized.props) {
        try {
          const value = sanitized.props[key]
          // Skip functions
          if (typeof value === 'function') {
            continue
          }
          // Try to serialize individual values
          try {
            propsCopy[key] = JSON.parse(JSON.stringify(value))
          } catch (valueError) {
            // If individual value can't be serialized, use it as-is if it's a primitive
            if (value === null || value === undefined || typeof value !== 'object') {
              propsCopy[key] = value
            }
            // Otherwise skip it
          }
        } catch (keyError) {
          // Skip properties that can't be accessed
          continue
        }
      }
      sanitized.props = propsCopy
    }
    
    // CRITICAL: Map old shape type names to new ones (migration support)
    // This handles renamed shape types from old data
    if (sanitized.type === 'Transcribe') {
      sanitized.type = 'Transcription'
    }

    // CRITICAL: Normalize case for custom shape types (lowercase → PascalCase)
    // The schema expects PascalCase (e.g., "ChatBox" not "chatBox")
    const customShapeTypeMap: Record<string, string> = {
      'chatBox': 'ChatBox',
      'videoChat': 'VideoChat',
      'embed': 'Embed',
      'markdown': 'Markdown',
      'mycrozineTemplate': 'MycrozineTemplate',
      'slide': 'Slide',
      'prompt': 'Prompt',
      'transcription': 'Transcription',
      'obsNote': 'ObsNote',
      'fathomNote': 'FathomNote',
      'holon': 'Holon',
      'obsidianBrowser': 'ObsidianBrowser',
      'fathomMeetingsBrowser': 'FathomMeetingsBrowser',
      'imageGen': 'ImageGen',
      'videoGen': 'VideoGen',
      'multmux': 'Multmux',
    }

    // Normalize the shape type if it's a custom type with incorrect case
    if (sanitized.type && typeof sanitized.type === 'string' && customShapeTypeMap[sanitized.type]) {
      console.log(`🔧 Normalizing shape type: "${sanitized.type}" → "${customShapeTypeMap[sanitized.type]}"`)
      sanitized.type = customShapeTypeMap[sanitized.type]
    }

    // CRITICAL: Sanitize Multmux shapes AFTER case normalization - ensure all required props exist
    // Old shapes may have wsUrl (removed) or undefined values
    if (sanitized.type === 'Multmux') {
      console.log(`🔧 Sanitizing Multmux shape ${sanitized.id}:`, JSON.stringify(sanitized.props))
      // Remove deprecated wsUrl prop
      if ('wsUrl' in sanitized.props) {
        delete sanitized.props.wsUrl
      }
      // CRITICAL: Create a clean props object with all required values
      // This ensures no undefined values slip through validation
      // Every value MUST be explicitly defined - undefined values cause ValidationError
      const w = (typeof sanitized.props.w === 'number' && !isNaN(sanitized.props.w)) ? sanitized.props.w : 800
      const h = (typeof sanitized.props.h === 'number' && !isNaN(sanitized.props.h)) ? sanitized.props.h : 600
      const sessionId = (typeof sanitized.props.sessionId === 'string') ? sanitized.props.sessionId : ''
      const sessionName = (typeof sanitized.props.sessionName === 'string') ? sanitized.props.sessionName : ''
      const token = (typeof sanitized.props.token === 'string') ? sanitized.props.token : ''
      // Fix old port (3000 -> 3002) during sanitization
      let serverUrl = (typeof sanitized.props.serverUrl === 'string') ? sanitized.props.serverUrl : 'http://localhost:3002'
      if (serverUrl === 'http://localhost:3000') {
        serverUrl = 'http://localhost:3002'
      }
      const pinnedToView = (sanitized.props.pinnedToView === true) ? true : false
      // Filter out any undefined or non-string elements from tags array
      let tags: string[] = ['terminal', 'multmux']
      if (Array.isArray(sanitized.props.tags)) {
        const filteredTags = sanitized.props.tags.filter((t: any) => typeof t === 'string' && t !== '')
        if (filteredTags.length > 0) {
          tags = filteredTags
        }
      }

      // Build clean props object - all values are guaranteed to be defined
      const cleanProps = {
        w: w,
        h: h,
        sessionId: sessionId,
        sessionName: sessionName,
        token: token,
        serverUrl: serverUrl,
        pinnedToView: pinnedToView,
        tags: tags,
      }

      // CRITICAL: Verify no undefined values before assigning
      // This is a safety check - if any value is undefined, something went wrong above
      for (const [key, value] of Object.entries(cleanProps)) {
        if (value === undefined) {
          console.error(`❌ CRITICAL: Multmux prop ${key} is undefined after sanitization! This should never happen.`)
          // Fix it with a default value based on key
          switch (key) {
            case 'w': (cleanProps as any).w = 800; break
            case 'h': (cleanProps as any).h = 600; break
            case 'sessionId': (cleanProps as any).sessionId = ''; break
            case 'sessionName': (cleanProps as any).sessionName = ''; break
            case 'token': (cleanProps as any).token = ''; break
            case 'serverUrl': (cleanProps as any).serverUrl = 'http://localhost:3002'; break
            case 'pinnedToView': (cleanProps as any).pinnedToView = false; break
            case 'tags': (cleanProps as any).tags = ['terminal', 'multmux']; break
          }
        }
      }

      sanitized.props = cleanProps
      console.log(`🔧 Sanitized Multmux shape ${sanitized.id} props:`, JSON.stringify(sanitized.props))
    }

    // CRITICAL: Infer type from properties BEFORE defaulting to 'geo'
    // This ensures arrows and other shapes are properly recognized
    if (!sanitized.type || typeof sanitized.type !== 'string') {
      // Check for arrow-specific properties first
      if (sanitized.props?.start !== undefined || 
          sanitized.props?.end !== undefined || 
          sanitized.props?.arrowheadStart !== undefined || 
          sanitized.props?.arrowheadEnd !== undefined ||
          sanitized.props?.kind === 'line' ||
          sanitized.props?.kind === 'curved' ||
          sanitized.props?.kind === 'straight') {
        sanitized.type = 'arrow'
      }
      // Check for line-specific properties
      else if (sanitized.props?.points !== undefined) {
        sanitized.type = 'line'
      }
      // Check for geo-specific properties (w/h/geo)
      else if (sanitized.props?.geo !== undefined || 
               ('w' in sanitized && 'h' in sanitized) ||
               ('w' in sanitized.props && 'h' in sanitized.props)) {
        sanitized.type = 'geo'
      }
      // Check for note-specific properties
      else if (sanitized.props?.growY !== undefined || 
               sanitized.props?.verticalAlign !== undefined) {
        sanitized.type = 'note'
      }
      // Check for text-specific properties
      else if (sanitized.props?.textAlign !== undefined || 
               sanitized.props?.autoSize !== undefined) {
        sanitized.type = 'text'
      }
      // Check for draw-specific properties
      else if (sanitized.props?.segments !== undefined) {
        sanitized.type = 'draw'
      }
      // Default to geo only if no other indicators found
      else {
        sanitized.type = 'geo'
      }
    }
    
    // CRITICAL: For geo shapes, move w/h/geo from top level to props (required by TLDraw schema)
    if (sanitized.type === 'geo' || ('w' in sanitized && 'h' in sanitized && sanitized.type !== 'arrow')) {
      // If type is missing but has w/h, assume it's a geo shape (but only if not already identified as arrow)
      if (!sanitized.type || sanitized.type === 'geo') {
        sanitized.type = 'geo'
      }
      
      // Ensure props exists
      if (!sanitized.props) sanitized.props = {}
      
      // Store values before removing from top level
      const wValue = 'w' in sanitized ? (sanitized as any).w : undefined
      const hValue = 'h' in sanitized ? (sanitized as any).h : undefined
      const geoValue = 'geo' in sanitized ? (sanitized as any).geo : undefined
      
      // Move w from top level to props (if present at top level)
      if (wValue !== undefined) {
        if (!('w' in sanitized.props) || sanitized.props.w === undefined) {
          sanitized.props.w = wValue
        }
        delete (sanitized as any).w
      }
      
      // Move h from top level to props (if present at top level)
      if (hValue !== undefined) {
        if (!('h' in sanitized.props) || sanitized.props.h === undefined) {
          sanitized.props.h = hValue
        }
        delete (sanitized as any).h
      }
      
      // Move geo from top level to props (if present at top level)
      if (geoValue !== undefined) {
        if (!('geo' in sanitized.props) || sanitized.props.geo === undefined) {
          sanitized.props.geo = geoValue
        }
        delete (sanitized as any).geo
      }
      
      // CRITICAL: props.geo is REQUIRED for geo shapes - TLDraw validation will fail without it
      // Ensure it's always set, defaulting to 'rectangle' if missing
      if (!sanitized.props.geo || sanitized.props.geo === undefined || sanitized.props.geo === null) {
        sanitized.props.geo = 'rectangle'
      }
      
      // CRITICAL: props.dash is REQUIRED for geo shapes - TLDraw validation will fail without it
      // Ensure it's always set, defaulting to 'draw' if missing
      if (!sanitized.props.dash || sanitized.props.dash === undefined || sanitized.props.dash === null) {
        sanitized.props.dash = 'draw'
      }
      
    }
    
    // Only fix type if completely missing
    if (!sanitized.type || typeof sanitized.type !== 'string') {
      // Simple type inference - only if absolutely necessary
      if (sanitized.props?.geo) {
        sanitized.type = 'geo'
      } else {
        sanitized.type = 'geo' // Safe default
      }
    }
    
    // CRITICAL: Fix crop structure for image/video shapes if it exists
    if (sanitized.type === 'image' || sanitized.type === 'video') {
      if (sanitized.props.crop !== null && sanitized.props.crop !== undefined) {
        if (!sanitized.props.crop.topLeft || !sanitized.props.crop.bottomRight) {
          if (sanitized.props.crop.x !== undefined && sanitized.props.crop.y !== undefined) {
            // Convert old format to new format
            sanitized.props.crop = {
              topLeft: { x: sanitized.props.crop.x || 0, y: sanitized.props.crop.y || 0 },
              bottomRight: { 
                x: (sanitized.props.crop.x || 0) + (sanitized.props.crop.w || 1), 
                y: (sanitized.props.crop.y || 0) + (sanitized.props.crop.h || 1) 
              }
            }
          } else {
            sanitized.props.crop = {
              topLeft: { x: 0, y: 0 },
              bottomRight: { x: 1, y: 1 }
            }
          }
        }
      }
    }
    
    // CRITICAL: Fix line shapes - ensure valid points structure (required by schema)
    if (sanitized.type === 'line') {
      // Remove invalid w/h from props (they cause validation errors)
      if ('w' in sanitized.props) delete sanitized.props.w
      if ('h' in sanitized.props) delete sanitized.props.h

      // Line shapes REQUIRE points property with at least 2 points
      if (!sanitized.props.points || typeof sanitized.props.points !== 'object' || Array.isArray(sanitized.props.points)) {
        sanitized.props.points = {
          'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
          'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
        }
      } else {
        // Ensure the points object has at least 2 valid points
        const pointKeys = Object.keys(sanitized.props.points)
        if (pointKeys.length < 2) {
          sanitized.props.points = {
            'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
            'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
          }
        }
      }
    }

    // CRITICAL: Fix draw shapes - ensure valid segments structure (required by schema)
    // Draw shapes with empty segments cause "No nearest point found" errors
    if (sanitized.type === 'draw') {
      // Remove invalid w/h from props (they cause validation errors)
      if ('w' in sanitized.props) delete sanitized.props.w
      if ('h' in sanitized.props) delete sanitized.props.h

      // Draw shapes REQUIRE segments property with at least one segment containing points
      if (!sanitized.props.segments || !Array.isArray(sanitized.props.segments) || sanitized.props.segments.length === 0) {
        // Create a minimal valid segment with at least 2 points
        sanitized.props.segments = [{
          type: 'free',
          points: [
            { x: 0, y: 0, z: 0.5 },
            { x: 10, y: 0, z: 0.5 }
          ]
        }]
      } else {
        // Ensure each segment has valid points
        sanitized.props.segments = sanitized.props.segments.map((segment: any) => {
          if (!segment.points || !Array.isArray(segment.points) || segment.points.length < 2) {
            return {
              type: segment.type || 'free',
              points: [
                { x: 0, y: 0, z: 0.5 },
                { x: 10, y: 0, z: 0.5 }
              ]
            }
          }
          return segment
        })
      }

      // Ensure required draw shape properties exist
      if (typeof sanitized.props.isClosed !== 'boolean') sanitized.props.isClosed = false
      if (typeof sanitized.props.isComplete !== 'boolean') sanitized.props.isComplete = true
      if (typeof sanitized.props.isPen !== 'boolean') sanitized.props.isPen = false
    }
    
    // CRITICAL: Fix group shapes - remove invalid w/h from props
    if (sanitized.type === 'group') {
      if ('w' in sanitized.props) delete sanitized.props.w
      if ('h' in sanitized.props) delete sanitized.props.h
    }
    
    // CRITICAL: Fix note shapes - ensure richText structure if it exists
    if (sanitized.type === 'note') {
      if (sanitized.props.richText) {
        if (Array.isArray(sanitized.props.richText)) {
          sanitized.props.richText = { content: sanitized.props.richText, type: 'doc' }
        } else if (typeof sanitized.props.richText === 'object' && sanitized.props.richText !== null) {
          if (!sanitized.props.richText.type) sanitized.props.richText = { ...sanitized.props.richText, type: 'doc' }
          if (!sanitized.props.richText.content) sanitized.props.richText = { ...sanitized.props.richText, content: [] }
        }
      }
      // CRITICAL: Clean NaN values from richText content to prevent SVG export errors
      if (sanitized.props.richText) {
        sanitized.props.richText = cleanRichTextNaN(sanitized.props.richText)
      }
    }
    
    // CRITICAL: Convert props.text to props.richText for geo shapes (tldraw schema change)
    // tldraw no longer accepts props.text on geo shapes - must use richText
    // This migration handles shapes that were saved before the schema change
    if (sanitized.type === 'geo' && 'text' in sanitized.props && typeof sanitized.props.text === 'string') {
      const textContent = sanitized.props.text

      // Convert text string to richText format for tldraw
      sanitized.props.richText = {
        type: 'doc',
        content: textContent ? [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: textContent
          }]
        }] : []
      }

      // CRITICAL: Preserve original text in meta.text for backward compatibility
      // This is used by search (src/utils/searchUtils.ts) and other legacy code
      if (!sanitized.meta) sanitized.meta = {}
      sanitized.meta.text = textContent

      // Remove invalid props.text
      delete sanitized.props.text
    }

    // CRITICAL: Fix richText structure for geo shapes (preserve content)
    if (sanitized.type === 'geo' && sanitized.props.richText) {
      if (Array.isArray(sanitized.props.richText)) {
        sanitized.props.richText = { content: sanitized.props.richText, type: 'doc' }
      } else if (typeof sanitized.props.richText === 'object' && sanitized.props.richText !== null) {
        if (!sanitized.props.richText.type) sanitized.props.richText = { ...sanitized.props.richText, type: 'doc' }
        if (!sanitized.props.richText.content) sanitized.props.richText = { ...sanitized.props.richText, content: [] }
      }
      // CRITICAL: Clean NaN values from richText content to prevent SVG export errors
      sanitized.props.richText = cleanRichTextNaN(sanitized.props.richText)
    }
    
    // CRITICAL: Fix arrow shapes - ensure valid start/end structure (required by schema)
    // Arrows with invalid start/end cause "No nearest point found" errors
    if (sanitized.type === 'arrow') {
      // Ensure start property exists and has valid structure
      if (!sanitized.props.start || typeof sanitized.props.start !== 'object') {
        sanitized.props.start = { x: 0, y: 0 }
      } else {
        // Ensure start has x and y properties (could be bound to a shape or free)
        const start = sanitized.props.start as any
        if (start.type === 'binding') {
          // Binding type must have boundShapeId, normalizedAnchor, and other properties
          if (!start.boundShapeId) {
            // Invalid binding - convert to point
            sanitized.props.start = { x: start.x ?? 0, y: start.y ?? 0 }
          }
        } else if (start.type === 'point' || start.type === undefined) {
          // Point type must have x and y
          if (typeof start.x !== 'number' || typeof start.y !== 'number') {
            sanitized.props.start = { x: 0, y: 0 }
          }
        }
      }

      // Ensure end property exists and has valid structure
      if (!sanitized.props.end || typeof sanitized.props.end !== 'object') {
        sanitized.props.end = { x: 100, y: 0 }
      } else {
        // Ensure end has x and y properties (could be bound to a shape or free)
        const end = sanitized.props.end as any
        if (end.type === 'binding') {
          // Binding type must have boundShapeId
          if (!end.boundShapeId) {
            // Invalid binding - convert to point
            sanitized.props.end = { x: end.x ?? 100, y: end.y ?? 0 }
          }
        } else if (end.type === 'point' || end.type === undefined) {
          // Point type must have x and y
          if (typeof end.x !== 'number' || typeof end.y !== 'number') {
            sanitized.props.end = { x: 100, y: 0 }
          }
        }
      }

      // Ensure bend is a valid number
      if (typeof sanitized.props.bend !== 'number' || isNaN(sanitized.props.bend)) {
        sanitized.props.bend = 0
      }

      // Ensure arrowhead properties exist
      if (!sanitized.props.arrowheadStart) sanitized.props.arrowheadStart = 'none'
      if (!sanitized.props.arrowheadEnd) sanitized.props.arrowheadEnd = 'arrow'

      // Ensure text property exists and is a string
      if (sanitized.props.text === undefined || sanitized.props.text === null) {
        sanitized.props.text = ''
      } else if (typeof sanitized.props.text !== 'string') {
        // If text is not a string (e.g., RichText object), convert it to string
        try {
          if (typeof sanitized.props.text === 'object' && sanitized.props.text !== null) {
            // Try to extract text from RichText object
            const textObj = sanitized.props.text as any
            if (Array.isArray(textObj.content)) {
              // Extract text from RichText content
              const extractText = (content: any[]): string => {
                return content.map((item: any) => {
                  if (item.type === 'text' && item.text) {
                    return item.text
                  } else if (item.content && Array.isArray(item.content)) {
                    return extractText(item.content)
                  }
                  return ''
                }).join('')
              }
              sanitized.props.text = extractText(textObj.content)
            } else if (textObj.text && typeof textObj.text === 'string') {
              sanitized.props.text = textObj.text
            } else {
              sanitized.props.text = String(sanitized.props.text)
            }
          } else {
            sanitized.props.text = String(sanitized.props.text)
          }
        } catch (e) {
          console.warn(`⚠️ AutomergeToTLStore: Error converting arrow text to string for ${sanitized.id}:`, e)
          sanitized.props.text = String(sanitized.props.text)
        }
      }
      // Note: We preserve text even if it's an empty string - that's a valid value
    }
    
    // CRITICAL: Fix richText structure for text shapes - REQUIRED field
    if (sanitized.type === 'text') {
      // Text shapes MUST have props.richText as an object - initialize if missing
      if (!sanitized.props.richText || typeof sanitized.props.richText !== 'object' || sanitized.props.richText === null) {
        sanitized.props.richText = { content: [], type: 'doc' }
      } else if (Array.isArray(sanitized.props.richText)) {
        sanitized.props.richText = { content: sanitized.props.richText, type: 'doc' }
      } else if (typeof sanitized.props.richText === 'object' && sanitized.props.richText !== null) {
        if (!sanitized.props.richText.type) sanitized.props.richText = { ...sanitized.props.richText, type: 'doc' }
        if (!sanitized.props.richText.content) sanitized.props.richText = { ...sanitized.props.richText, content: [] }
      }
      // CRITICAL: Clean NaN values from richText content to prevent SVG export errors
      sanitized.props.richText = cleanRichTextNaN(sanitized.props.richText)
      
      // CRITICAL: Ensure required text shape properties exist (TLDraw validation requires these)
      // color is REQUIRED and must be one of the valid color values
      const validColors = ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white']
      if (!sanitized.props.color || typeof sanitized.props.color !== 'string' || !validColors.includes(sanitized.props.color)) {
        sanitized.props.color = 'black'
      }
      // Ensure other required properties have defaults
      if (typeof sanitized.props.w !== 'number') sanitized.props.w = 300
      if (!sanitized.props.size || typeof sanitized.props.size !== 'string') sanitized.props.size = 'm'
      if (!sanitized.props.font || typeof sanitized.props.font !== 'string') sanitized.props.font = 'draw'
      if (!sanitized.props.textAlign || typeof sanitized.props.textAlign !== 'string') sanitized.props.textAlign = 'start'
      if (typeof sanitized.props.autoSize !== 'boolean') sanitized.props.autoSize = false
      if (typeof sanitized.props.scale !== 'number') sanitized.props.scale = 1
      
      // Remove invalid properties for text shapes (these cause validation errors)
      // Remove properties that are only valid for custom shapes, not standard TLDraw text shapes
      // CRITICAL: 'text' property is NOT allowed - text shapes must use props.richText instead
      const invalidTextProps = ['h', 'geo', 'text', 'isEditing', 'editingContent', 'isTranscribing', 'isPaused', 'fixedHeight', 'pinnedToView', 'isModified', 'originalContent', 'editingName', 'editingDescription', 'isConnected', 'holonId', 'noteId', 'title', 'content', 'tags', 'showPreview', 'backgroundColor', 'textColor']
      invalidTextProps.forEach(prop => {
        if (prop in sanitized.props) {
          delete sanitized.props[prop]
        }
      })
    }
    
    // CRITICAL: Additional safety check - Remove invalid 'text' property from text shapes
    // Text shapes should only use props.richText, not props.text
    // This is a redundant check to ensure text property is always removed
    if (sanitized.type === 'text' && 'text' in sanitized.props) {
      delete sanitized.props.text
    }
    
    // CRITICAL: Only convert unknown shapes with richText to text if they're truly unknown
    // DO NOT convert geo/note shapes - they can legitimately have richText
    if (sanitized.props?.richText && sanitized.type !== 'text' && sanitized.type !== 'geo' && sanitized.type !== 'note') {
      // This is an unknown shape type with richText - convert to text shape
      // But preserve all existing properties first
      const existingProps = { ...sanitized.props }
      sanitized.type = 'text'
      sanitized.props = existingProps
      
      // Fix richText structure if needed
      if (Array.isArray(sanitized.props.richText)) {
        sanitized.props.richText = { content: sanitized.props.richText, type: 'doc' }
      } else if (typeof sanitized.props.richText === 'object' && sanitized.props.richText !== null) {
        if (!sanitized.props.richText.type) sanitized.props.richText = { ...sanitized.props.richText, type: 'doc' }
        if (!sanitized.props.richText.content) sanitized.props.richText = { ...sanitized.props.richText, content: [] }
      }
      // CRITICAL: Clean NaN values from richText content to prevent SVG export errors
      sanitized.props.richText = cleanRichTextNaN(sanitized.props.richText)
      
      // CRITICAL: Ensure required text shape properties exist (TLDraw validation requires these)
      // color is REQUIRED and must be one of the valid color values
      const validColors = ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white']
      if (!sanitized.props.color || typeof sanitized.props.color !== 'string' || !validColors.includes(sanitized.props.color)) {
        sanitized.props.color = 'black'
      }
      // Ensure other required properties have defaults
      if (typeof sanitized.props.w !== 'number') sanitized.props.w = 300
      if (!sanitized.props.size || typeof sanitized.props.size !== 'string') sanitized.props.size = 'm'
      if (!sanitized.props.font || typeof sanitized.props.font !== 'string') sanitized.props.font = 'draw'
      if (!sanitized.props.textAlign || typeof sanitized.props.textAlign !== 'string') sanitized.props.textAlign = 'start'
      if (typeof sanitized.props.autoSize !== 'boolean') sanitized.props.autoSize = false
      if (typeof sanitized.props.scale !== 'number') sanitized.props.scale = 1
      
      // Remove invalid properties for text shapes (these cause validation errors)
      // Remove properties that are only valid for custom shapes, not standard TLDraw text shapes
      const invalidTextProps = ['h', 'geo', 'isEditing', 'editingContent', 'isTranscribing', 'isPaused', 'fixedHeight', 'pinnedToView', 'isModified', 'originalContent', 'editingName', 'editingDescription', 'isConnected', 'holonId', 'noteId', 'title', 'content', 'tags', 'showPreview', 'backgroundColor', 'textColor']
      invalidTextProps.forEach(prop => {
        if (prop in sanitized.props) {
          delete sanitized.props[prop]
        }
      })
    }
  } else if (sanitized.typeName === 'instance') {
    // CRITICAL: Handle instance records - ensure required fields exist
    if (!sanitized.meta || typeof sanitized.meta !== 'object') {
      sanitized.meta = {}
    } else {
      sanitized.meta = { ...sanitized.meta }
    }
    // Only fix critical instance fields that cause validation errors
    if ('brush' in sanitized && (sanitized.brush === null || sanitized.brush === undefined)) {
      (sanitized as any).brush = { x: 0, y: 0, w: 0, h: 0 }
    }
    if ('zoomBrush' in sanitized && (sanitized.zoomBrush === null || sanitized.zoomBrush === undefined)) {
      (sanitized as any).zoomBrush = { x: 0, y: 0, w: 0, h: 0 }
    }
    if ('insets' in sanitized && (sanitized.insets === undefined || !Array.isArray(sanitized.insets))) {
      (sanitized as any).insets = [false, false, false, false]
    }
    if ('scribbles' in sanitized && (sanitized.scribbles === undefined || !Array.isArray(sanitized.scribbles))) {
      (sanitized as any).scribbles = []
    }
    // CRITICAL: duplicateProps is REQUIRED for instance records - TLDraw validation will fail without it
    if (!('duplicateProps' in sanitized) || sanitized.duplicateProps === undefined || typeof sanitized.duplicateProps !== 'object') {
      (sanitized as any).duplicateProps = { 
        shapeIds: [],
        offset: { x: 0, y: 0 }
      }
    }
  } else if (sanitized.typeName === 'document') {
    // CRITICAL: Preserve all existing meta properties
    if (!sanitized.meta || typeof sanitized.meta !== 'object') {
      sanitized.meta = {}
    } else {
      sanitized.meta = { ...sanitized.meta }
    }
  } else if (sanitized.typeName === 'page') {
    // CRITICAL: Preserve all existing meta properties
    if (!sanitized.meta || typeof sanitized.meta !== 'object') {
      sanitized.meta = {}
    } else {
      sanitized.meta = { ...sanitized.meta }
    }
  }
  
  // CRITICAL: Final safety check - ensure text shapes never have invalid 'text' property
  // This is a last-resort check before returning to catch any edge cases
  if (sanitized.typeName === 'shape' && sanitized.type === 'text' && sanitized.props && 'text' in sanitized.props) {
    delete sanitized.props.text
  }
  
  return sanitized
}

const isStorePatch = (patch: Automerge.Patch): boolean => {
  return patch.path[0] === "store" && patch.path.length > 1
}

// Helper function to safely get a record from the store
const getRecordFromStore = (store: TLStore, id: string): TLRecord | null => {
  try {
    return store.get(id as any) as TLRecord | null
  } catch {
    return null
  }
}

// path: ["store", "camera:page:page", "x"] => "camera:page:page"
const pathToId = (path: Automerge.Prop[]): RecordId<any> => {
  return path[1] as RecordId<any>
}

const applyInsertToObject = (patch: Automerge.InsertPatch, object: any): TLRecord => {
  const { path, values } = patch
  let current = object
  const insertionPoint = path[path.length - 1] as number
  const pathEnd = path[path.length - 2] as string
  const parts = path.slice(2, -2)
  
  // Create missing properties as we navigate
  for (const part of parts) {
    if (current[part] === undefined || current[part] === null) {
      // Create missing property - use array for numeric indices
      if (typeof part === 'number' || (typeof part === 'string' && !isNaN(Number(part)))) {
        current[part] = []
      } else {
        current[part] = {}
      }
    }
    current = current[part]
  }
  
  // Ensure pathEnd exists and is an array
  if (current[pathEnd] === undefined || current[pathEnd] === null) {
    current[pathEnd] = []
  }
  
  // splice is a mutator... yay.
  const clone = Array.isArray(current[pathEnd]) ? current[pathEnd].slice(0) : []
  clone.splice(insertionPoint, 0, ...values)
  current[pathEnd] = clone
  return object
}

const applyPutToObject = (patch: Automerge.PutPatch, object: any): TLRecord => {
  const { path, value } = patch
  let current = object
  // special case
  if (path.length === 2) {
    // this would be creating the object, but we have done
    return object
  }

  const parts = path.slice(2, -2)
  const property = path[path.length - 1] as string
  const target = path[path.length - 2] as string

  if (path.length === 3) {
    return { ...object, [property]: value }
  }

  // default case - create missing properties as we navigate
  for (const part of parts) {
    if (current[part] === undefined || current[part] === null) {
      // Create missing property - use object for named properties, array for numeric indices
      if (typeof part === 'number' || (typeof part === 'string' && !isNaN(Number(part)))) {
        current[part] = []
      } else {
        current[part] = {}
      }
    }
    current = current[part]
  }
  
  // Ensure target exists
  if (current[target] === undefined || current[target] === null) {
    current[target] = {}
  }
  
  current[target] = { ...current[target], [property]: value }
  return object
}

const applySpliceToObject = (patch: Automerge.SpliceTextPatch, object: any): TLRecord => {
  const { path, value } = patch
  let current = object
  const insertionPoint = path[path.length - 1] as number
  const pathEnd = path[path.length - 2] as string
  const parts = path.slice(2, -2)
  
  // Create missing properties as we navigate
  for (const part of parts) {
    if (current[part] === undefined || current[part] === null) {
      // Create missing property - use array for numeric indices or when splicing
      if (typeof part === 'number' || (typeof part === 'string' && !isNaN(Number(part)))) {
        current[part] = []
      } else {
        current[part] = {}
      }
    }
    current = current[part]
  }
  
  // Ensure pathEnd exists and is an array for splicing
  if (current[pathEnd] === undefined || current[pathEnd] === null) {
    current[pathEnd] = []
  }
  
  // TODO: we're not supporting actual splices yet because TLDraw won't generate them natively
  if (insertionPoint !== 0) {
    throw new Error("Splices are not supported yet")
  }
  current[pathEnd] = value // .splice(insertionPoint, 0, value)
  return object
}

const applyIncToObject = (patch: Automerge.IncPatch, object: any): TLRecord => {
  const { path, value } = patch
  let current = object
  const parts = path.slice(2, -1)
  const pathEnd = path[path.length - 1] as string
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error("NO WAY")
    }
    current = current[part]
  }
  current[pathEnd] = (current[pathEnd] || 0) + value
  return object
}
