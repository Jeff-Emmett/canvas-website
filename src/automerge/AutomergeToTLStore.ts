import { TLRecord, RecordId, TLStore } from "@tldraw/tldraw"
import * as Automerge from "@automerge/automerge"

export function applyAutomergePatchesToTLStore(
  patches: Automerge.Patch[],
  store: TLStore
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
    
    let record = updatedObjects[id] || (existingRecord ? JSON.parse(JSON.stringify(existingRecord)) : defaultRecord)
    
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
    // We need to preserve coordinates from existing records to prevent them from being reset
    const originalX = (record.typeName === 'shape' && typeof record.x === 'number' && !isNaN(record.x)) ? record.x : undefined
    const originalY = (record.typeName === 'shape' && typeof record.y === 'number' && !isNaN(record.y)) ? record.y : undefined
    const hadOriginalCoordinates = originalX !== undefined && originalY !== undefined

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
    // Ensure required shape fields exist
    // CRITICAL: Only set defaults if coordinates are truly missing or invalid
    // DO NOT overwrite valid coordinates (including 0, which is a valid position)
    // Only set to 0 if the value is undefined, null, or NaN
    if (sanitized.x === undefined || sanitized.x === null || (typeof sanitized.x === 'number' && isNaN(sanitized.x))) {
      sanitized.x = 0
    }
    if (sanitized.y === undefined || sanitized.y === null || (typeof sanitized.y === 'number' && isNaN(sanitized.y))) {
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
    if (!sanitized.index) sanitized.index = 'a1'
    if (!sanitized.parentId) sanitized.parentId = 'page:page'
    if (!sanitized.props || typeof sanitized.props !== 'object') sanitized.props = {}
    
    // CRITICAL: Ensure props is a deep mutable copy to preserve all nested properties
    // This is essential for custom shapes like ObsNote and for preserving richText in geo shapes
    // Use JSON parse/stringify to create a deep copy of nested objects (like richText.content)
    sanitized.props = JSON.parse(JSON.stringify(sanitized.props))
    
    // CRITICAL: Map old shape type names to new ones (migration support)
    // This handles renamed shape types from old data
    if (sanitized.type === 'Transcribe') {
      sanitized.type = 'Transcription'
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
      
      // Line shapes REQUIRE points property
      if (!sanitized.props.points || typeof sanitized.props.points !== 'object' || Array.isArray(sanitized.props.points)) {
        sanitized.props.points = {
          'a1': { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
          'a2': { id: 'a2', index: 'a2' as any, x: 100, y: 0 }
        }
      }
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
    }
    
    // CRITICAL: Remove invalid 'text' property from text shapes (TLDraw schema doesn't allow props.text)
    // Text shapes should only use props.richText, not props.text
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
      
      // Only remove properties that cause validation errors (not all "invalid" ones)
      if ('h' in sanitized.props) delete sanitized.props.h
      if ('geo' in sanitized.props) delete sanitized.props.geo
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
