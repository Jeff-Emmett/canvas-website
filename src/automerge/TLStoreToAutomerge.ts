import { RecordsDiff, TLRecord } from "@tldraw/tldraw"

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

function sanitizeRecord(record: TLRecord): TLRecord {
  const sanitized = { ...record }
  
  // CRITICAL FIXES ONLY - preserve all other properties
  // This function preserves ALL shape types (native and custom):
  // - Geo shapes (rectangles, ellipses, etc.) - handled below
  // - Arrow shapes - handled below
  // - Custom shapes (ObsNote, Holon, etc.) - all props preserved via deep copy
  // - All other native shapes (text, note, draw, line, group, image, video, etc.)
  
  // Ensure required top-level fields exist
  if (sanitized.typeName === 'shape') {
    if (typeof sanitized.x !== 'number') sanitized.x = 0
    if (typeof sanitized.y !== 'number') sanitized.y = 0
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
    if (!sanitized.props || typeof sanitized.props !== 'object') sanitized.props = {}
    
    // CRITICAL: Extract richText BEFORE deep copy to handle TLDraw RichText instances properly
    // TLDraw RichText objects may have methods/getters that don't serialize well
    let richTextValue: any = undefined
    try {
      // Safely check if richText exists using 'in' operator to avoid triggering getters
      const props = sanitized.props || {}
      if ('richText' in props) {
        try {
          // Use Object.getOwnPropertyDescriptor to safely check if it's a getter
          const descriptor = Object.getOwnPropertyDescriptor(props, 'richText')
          let rt: any = undefined
          
          if (descriptor && descriptor.get) {
            // It's a getter - try to call it safely
            try {
              rt = descriptor.get.call(props)
            } catch (getterError) {
              console.warn(`🔧 TLStoreToAutomerge: Error calling richText getter for shape ${sanitized.id}:`, getterError)
              rt = undefined
            }
          } else {
            // It's a regular property - access it directly
            rt = (props as any).richText
          }
          
          // Now process the value
          if (rt !== undefined && rt !== null) {
            // Check if it's a function (shouldn't happen, but be safe)
            if (typeof rt === 'function') {
              console.warn(`🔧 TLStoreToAutomerge: richText is a function for shape ${sanitized.id}, skipping`)
              richTextValue = { content: [], type: 'doc' }
            } 
            // Check if it's an array
            else if (Array.isArray(rt)) {
              richTextValue = { content: JSON.parse(JSON.stringify(rt)), type: 'doc' }
            } 
            // Check if it's an object
            else if (typeof rt === 'object') {
              // Extract plain object representation - use JSON to ensure it's serializable
              try {
                const serialized = JSON.parse(JSON.stringify(rt))
                richTextValue = {
                  type: serialized.type || 'doc',
                  content: serialized.content !== undefined ? serialized.content : []
                }
              } catch (serializeError) {
                // If serialization fails, try to extract manually
                richTextValue = {
                  type: (rt as any).type || 'doc',
                  content: (rt as any).content !== undefined ? (rt as any).content : []
                }
              }
            } 
            // Invalid type
            else {
              console.warn(`🔧 TLStoreToAutomerge: Invalid richText type for shape ${sanitized.id}:`, typeof rt)
              richTextValue = { content: [], type: 'doc' }
            }
          }
        } catch (e) {
          console.warn(`🔧 TLStoreToAutomerge: Error extracting richText for shape ${sanitized.id}:`, e)
          richTextValue = { content: [], type: 'doc' }
        }
      }
    } catch (e) {
      console.warn(`🔧 TLStoreToAutomerge: Error checking richText for shape ${sanitized.id}:`, e)
    }
    
    // CRITICAL: For all shapes, ensure props is a deep mutable copy to preserve all properties
    // This is essential for custom shapes like ObsNote and for preserving richText in geo shapes
    // Use JSON parse/stringify to create a deep copy of nested objects (like richText.content)
    // Remove richText temporarily to avoid serialization issues
    try {
      const propsWithoutRichText: any = {}
      // Copy all props except richText
      for (const key in sanitized.props) {
        if (key !== 'richText') {
          propsWithoutRichText[key] = (sanitized.props as any)[key]
        }
      }
      sanitized.props = JSON.parse(JSON.stringify(propsWithoutRichText))
    } catch (e) {
      console.warn(`🔧 TLStoreToAutomerge: Error deep copying props for shape ${sanitized.id}:`, e)
      // Fallback: just copy props without deep copy
      sanitized.props = { ...sanitized.props }
      if (richTextValue !== undefined) {
        delete (sanitized.props as any).richText
      }
    }
    
    // CRITICAL: For geo shapes, move w/h/geo from top-level to props (required by TLDraw schema)
    if (sanitized.type === 'geo') {
      
      // Move w from top-level to props if needed
      if ('w' in sanitized && sanitized.w !== undefined) {
        if ((sanitized.props as any).w === undefined) {
          (sanitized.props as any).w = (sanitized as any).w
        }
        delete (sanitized as any).w
      }
      
      // Move h from top-level to props if needed
      if ('h' in sanitized && sanitized.h !== undefined) {
        if ((sanitized.props as any).h === undefined) {
          (sanitized.props as any).h = (sanitized as any).h
        }
        delete (sanitized as any).h
      }
      
      // Move geo from top-level to props if needed
      if ('geo' in sanitized && sanitized.geo !== undefined) {
        if ((sanitized.props as any).geo === undefined) {
          (sanitized.props as any).geo = (sanitized as any).geo
        }
        delete (sanitized as any).geo
      }
      
      // CRITICAL: Restore richText for geo shapes after deep copy
      // Fix richText structure if it exists (preserve content, ensure proper format)
      if (richTextValue !== undefined) {
        // Clean NaN values to prevent SVG export errors
        (sanitized.props as any).richText = cleanRichTextNaN(richTextValue)
      }
      // CRITICAL: Preserve meta.text for geo shapes - it's used by runLLMprompt for backwards compatibility
      // Ensure meta.text is preserved if it exists
      if ((sanitized.meta as any)?.text !== undefined) {
        // meta.text is already preserved since we copied meta above
        // Just ensure it's not accidentally deleted
      }
      // Note: We don't delete richText if it's missing - it's optional for geo shapes
    }
    
    // CRITICAL: For arrow shapes, preserve text property
    if (sanitized.type === 'arrow') {
      // CRITICAL: Preserve text property - only set default if truly missing (preserve empty strings and all other values)
      if ((sanitized.props as any).text === undefined || (sanitized.props as any).text === null) {
        (sanitized.props as any).text = ''
      }
      // Note: We preserve text even if it's an empty string - that's a valid value
    }
    
    // CRITICAL: For note shapes, preserve richText property (required for note shapes)
    if (sanitized.type === 'note') {
      // CRITICAL: Use the extracted richText value if available, otherwise create default
      if (richTextValue !== undefined) {
        // Clean NaN values to prevent SVG export errors
        (sanitized.props as any).richText = cleanRichTextNaN(richTextValue)
      } else {
        // Note shapes require richText - create default if missing
        (sanitized.props as any).richText = { content: [], type: 'doc' }
      }
    }
    
    // CRITICAL: For ObsNote shapes, ensure all props are preserved (title, content, tags, etc.)
    if (sanitized.type === 'ObsNote') {
      // Props are already a mutable copy from above, so all properties are preserved
      // No special handling needed - just ensure props exists (which we did above)
    }
    
    // CRITICAL: For image/video shapes, fix crop structure if it exists
    if (sanitized.type === 'image' || sanitized.type === 'video') {
      const props = (sanitized.props as any)
      
      if (props.crop !== null && props.crop !== undefined) {
        // Fix crop structure if it has wrong format
        if (!props.crop.topLeft || !props.crop.bottomRight) {
          if (props.crop.x !== undefined && props.crop.y !== undefined) {
            // Convert old format { x, y, w, h } to new format
            props.crop = {
              topLeft: { x: props.crop.x || 0, y: props.crop.y || 0 },
              bottomRight: { 
                x: (props.crop.x || 0) + (props.crop.w || 1), 
                y: (props.crop.y || 0) + (props.crop.h || 1) 
              }
            }
          } else {
            // Invalid structure: set to default
            props.crop = {
              topLeft: { x: 0, y: 0 },
              bottomRight: { x: 1, y: 1 }
            }
          }
        }
      }
    }
    
    // CRITICAL: For group shapes, remove w/h from props (they cause validation errors)
    if (sanitized.type === 'group') {
      if ('w' in sanitized.props) delete (sanitized.props as any).w
      if ('h' in sanitized.props) delete (sanitized.props as any).h
    }
  } else if (sanitized.typeName === 'document') {
    // CRITICAL: Preserve all existing meta properties
    if (!sanitized.meta || typeof sanitized.meta !== 'object') {
      sanitized.meta = {}
    } else {
      sanitized.meta = { ...sanitized.meta }
    }
  } else if (sanitized.typeName === 'instance') {
    // CRITICAL: Preserve all existing meta properties
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
    if ('duplicateProps' in sanitized && (sanitized.duplicateProps === undefined || typeof sanitized.duplicateProps !== 'object')) {
      (sanitized as any).duplicateProps = { 
        shapeIds: [],
        offset: { x: 0, y: 0 }
      }
    }
  }
  
  return sanitized
}

export function applyTLStoreChangesToAutomerge(
  doc: any,
  changes: RecordsDiff<TLRecord>
) {
  
  // Ensure doc.store exists
  if (!doc.store) {
    doc.store = {}
  }

  // Handle added records
  if (changes.added) {
    Object.values(changes.added).forEach((record) => {
      // Sanitize record before saving to ensure all required fields are present
      const sanitizedRecord = sanitizeRecord(record)
      // CRITICAL: Create a deep copy to ensure all properties (including richText and text) are preserved
      // This prevents Automerge from treating the object as read-only
      const recordToSave = JSON.parse(JSON.stringify(sanitizedRecord))
      // Let Automerge handle the assignment - it will merge automatically
      doc.store[record.id] = recordToSave
    })
  }

  // Handle updated records
  // Simplified: Replace entire record and let Automerge handle merging
  // This is simpler than deep comparison and leverages Automerge's conflict resolution
  if (changes.updated) {
    Object.values(changes.updated).forEach(([_, record]) => {
      // DEBUG: Log richText, meta.text, and Obsidian note properties before sanitization
      if (record.typeName === 'shape') {
        if (record.type === 'geo' && (record.props as any)?.richText) {
          console.log(`🔍 TLStoreToAutomerge: Geo shape ${record.id} has richText before sanitization:`, {
            hasRichText: !!(record.props as any).richText,
            richTextType: typeof (record.props as any).richText,
            richTextContent: Array.isArray((record.props as any).richText) ? 'array' : (record.props as any).richText?.content ? 'object with content' : 'object without content'
          })
        }
        if (record.type === 'geo' && (record.meta as any)?.text !== undefined) {
          console.log(`🔍 TLStoreToAutomerge: Geo shape ${record.id} has meta.text before sanitization:`, {
            hasMetaText: !!(record.meta as any).text,
            metaTextValue: (record.meta as any).text,
            metaTextType: typeof (record.meta as any).text
          })
        }
        if (record.type === 'note' && (record.props as any)?.richText) {
          console.log(`🔍 TLStoreToAutomerge: Note shape ${record.id} has richText before sanitization:`, {
            hasRichText: !!(record.props as any).richText,
            richTextType: typeof (record.props as any).richText,
            richTextContent: Array.isArray((record.props as any).richText) ? 'array' : (record.props as any).richText?.content ? 'object with content' : 'object without content',
            richTextContentLength: Array.isArray((record.props as any).richText?.content) ? (record.props as any).richText.content.length : 'not array'
          })
        }
        if (record.type === 'arrow' && (record.props as any)?.text !== undefined) {
          console.log(`🔍 TLStoreToAutomerge: Arrow shape ${record.id} has text before sanitization:`, {
            hasText: !!(record.props as any).text,
            textValue: (record.props as any).text,
            textType: typeof (record.props as any).text
          })
        }
        if (record.type === 'ObsNote') {
          console.log(`🔍 TLStoreToAutomerge: ObsNote shape ${record.id} before sanitization:`, {
            hasTitle: !!(record.props as any).title,
            hasContent: !!(record.props as any).content,
            hasTags: Array.isArray((record.props as any).tags),
            title: (record.props as any).title,
            contentLength: (record.props as any).content?.length || 0,
            tagsCount: Array.isArray((record.props as any).tags) ? (record.props as any).tags.length : 0
          })
        }
      }
      
      const sanitizedRecord = sanitizeRecord(record)
      
      // DEBUG: Log richText, meta.text, and Obsidian note properties after sanitization
      if (sanitizedRecord.typeName === 'shape') {
        if (sanitizedRecord.type === 'geo' && (sanitizedRecord.props as any)?.richText) {
          console.log(`🔍 TLStoreToAutomerge: Geo shape ${sanitizedRecord.id} has richText after sanitization:`, {
            hasRichText: !!(sanitizedRecord.props as any).richText,
            richTextType: typeof (sanitizedRecord.props as any).richText,
            richTextContent: Array.isArray((sanitizedRecord.props as any).richText) ? 'array' : (sanitizedRecord.props as any).richText?.content ? 'object with content' : 'object without content'
          })
        }
        if (sanitizedRecord.type === 'geo' && (sanitizedRecord.meta as any)?.text !== undefined) {
          console.log(`🔍 TLStoreToAutomerge: Geo shape ${sanitizedRecord.id} has meta.text after sanitization:`, {
            hasMetaText: !!(sanitizedRecord.meta as any).text,
            metaTextValue: (sanitizedRecord.meta as any).text,
            metaTextType: typeof (sanitizedRecord.meta as any).text
          })
        }
        if (sanitizedRecord.type === 'note' && (sanitizedRecord.props as any)?.richText) {
          console.log(`🔍 TLStoreToAutomerge: Note shape ${sanitizedRecord.id} has richText after sanitization:`, {
            hasRichText: !!(sanitizedRecord.props as any).richText,
            richTextType: typeof (sanitizedRecord.props as any).richText,
            richTextContent: Array.isArray((sanitizedRecord.props as any).richText) ? 'array' : (sanitizedRecord.props as any).richText?.content ? 'object with content' : 'object without content',
            richTextContentLength: Array.isArray((sanitizedRecord.props as any).richText?.content) ? (sanitizedRecord.props as any).richText.content.length : 'not array'
          })
        }
        if (sanitizedRecord.type === 'arrow' && (sanitizedRecord.props as any)?.text !== undefined) {
          console.log(`🔍 TLStoreToAutomerge: Arrow shape ${sanitizedRecord.id} has text after sanitization:`, {
            hasText: !!(sanitizedRecord.props as any).text,
            textValue: (sanitizedRecord.props as any).text,
            textType: typeof (sanitizedRecord.props as any).text
          })
        }
        if (sanitizedRecord.type === 'ObsNote') {
          console.log(`🔍 TLStoreToAutomerge: ObsNote shape ${sanitizedRecord.id} after sanitization:`, {
            hasTitle: !!(sanitizedRecord.props as any).title,
            hasContent: !!(sanitizedRecord.props as any).content,
            hasTags: Array.isArray((sanitizedRecord.props as any).tags),
            title: (sanitizedRecord.props as any).title,
            contentLength: (sanitizedRecord.props as any).content?.length || 0,
            tagsCount: Array.isArray((sanitizedRecord.props as any).tags) ? (sanitizedRecord.props as any).tags.length : 0
          })
        }
      }
      
      // CRITICAL: Create a deep copy to ensure all properties (including richText and text) are preserved
      // This prevents Automerge from treating the object as read-only
      // Note: sanitizedRecord.props is already a deep copy from sanitizeRecord, but we need to deep copy the entire record
      const recordToSave = JSON.parse(JSON.stringify(sanitizedRecord))
      
      // DEBUG: Log richText, meta.text, and Obsidian note properties after deep copy
      if (recordToSave.typeName === 'shape') {
        if (recordToSave.type === 'geo' && recordToSave.props?.richText) {
          console.log(`🔍 TLStoreToAutomerge: Geo shape ${recordToSave.id} has richText after deep copy:`, {
            hasRichText: !!recordToSave.props.richText,
            richTextType: typeof recordToSave.props.richText,
            richTextContent: Array.isArray(recordToSave.props.richText) ? 'array' : recordToSave.props.richText?.content ? 'object with content' : 'object without content',
            richTextContentLength: Array.isArray(recordToSave.props.richText?.content) ? recordToSave.props.richText.content.length : 'not array'
          })
        }
        if (recordToSave.type === 'geo' && recordToSave.meta?.text !== undefined) {
          console.log(`🔍 TLStoreToAutomerge: Geo shape ${recordToSave.id} has meta.text after deep copy:`, {
            hasMetaText: !!recordToSave.meta.text,
            metaTextValue: recordToSave.meta.text,
            metaTextType: typeof recordToSave.meta.text
          })
        }
        if (recordToSave.type === 'note' && recordToSave.props?.richText) {
          console.log(`🔍 TLStoreToAutomerge: Note shape ${recordToSave.id} has richText after deep copy:`, {
            hasRichText: !!recordToSave.props.richText,
            richTextType: typeof recordToSave.props.richText,
            richTextContent: Array.isArray(recordToSave.props.richText) ? 'array' : recordToSave.props.richText?.content ? 'object with content' : 'object without content',
            richTextContentLength: Array.isArray(recordToSave.props.richText?.content) ? recordToSave.props.richText.content.length : 'not array'
          })
        }
        if (recordToSave.type === 'arrow' && recordToSave.props?.text !== undefined) {
          console.log(`🔍 TLStoreToAutomerge: Arrow shape ${recordToSave.id} has text after deep copy:`, {
            hasText: !!recordToSave.props.text,
            textValue: recordToSave.props.text,
            textType: typeof recordToSave.props.text
          })
        }
        if (recordToSave.type === 'ObsNote') {
          console.log(`🔍 TLStoreToAutomerge: ObsNote shape ${recordToSave.id} after deep copy:`, {
            hasTitle: !!recordToSave.props.title,
            hasContent: !!recordToSave.props.content,
            hasTags: Array.isArray(recordToSave.props.tags),
            title: recordToSave.props.title,
            contentLength: recordToSave.props.content?.length || 0,
            tagsCount: Array.isArray(recordToSave.props.tags) ? recordToSave.props.tags.length : 0,
            allPropsKeys: Object.keys(recordToSave.props || {})
          })
        }
      }
      
      // Replace the entire record - Automerge will handle merging with concurrent changes
      doc.store[record.id] = recordToSave
    })
  }

  // Handle removed records
  if (changes.removed) {
    Object.values(changes.removed).forEach((record) => {
      delete doc.store[record.id]
    })
  }

}

// Removed deepCompareAndUpdate - we now replace entire records and let Automerge handle merging
// This simplifies the code and leverages Automerge's built-in conflict resolution
