import { RecordsDiff, TLRecord } from "@tldraw/tldraw"

function sanitizeRecord(record: TLRecord): TLRecord {
  const sanitized = { ...record }
  
  // First, fix any problematic array fields that might cause validation errors
  // This is a catch-all for any record type that has these fields
  if ('insets' in sanitized && (sanitized.insets === undefined || !Array.isArray(sanitized.insets))) {
    console.log(`Fixing insets field for ${sanitized.typeName} record:`, {
      id: sanitized.id,
      originalValue: sanitized.insets,
      originalType: typeof sanitized.insets
    })
    ;(sanitized as any).insets = [false, false, false, false]
  }
  if ('scribbles' in sanitized && (sanitized.scribbles === undefined || !Array.isArray(sanitized.scribbles))) {
    console.log(`Fixing scribbles field for ${sanitized.typeName} record:`, {
      id: sanitized.id,
      originalValue: sanitized.scribbles,
      originalType: typeof sanitized.scribbles
    })
    ;(sanitized as any).scribbles = []
  }
  
  // Fix object fields that might be undefined
  if ('duplicateProps' in sanitized && (sanitized.duplicateProps === undefined || typeof sanitized.duplicateProps !== 'object')) {
    console.log(`Fixing duplicateProps field for ${sanitized.typeName} record:`, {
      id: sanitized.id,
      originalValue: sanitized.duplicateProps,
      originalType: typeof sanitized.duplicateProps
    })
    ;(sanitized as any).duplicateProps = { 
      shapeIds: [],
      offset: { x: 0, y: 0 }
    }
  }
  // Fix nested object properties
  else if ('duplicateProps' in sanitized && sanitized.duplicateProps && typeof sanitized.duplicateProps === 'object') {
    if (!('shapeIds' in sanitized.duplicateProps) || !Array.isArray(sanitized.duplicateProps.shapeIds)) {
      console.log(`Fixing duplicateProps.shapeIds field for ${sanitized.typeName} record:`, {
        id: sanitized.id,
        originalValue: sanitized.duplicateProps.shapeIds,
        originalType: typeof sanitized.duplicateProps.shapeIds
      })
      ;(sanitized as any).duplicateProps.shapeIds = []
    }
    // Fix missing offset field
    if (!('offset' in sanitized.duplicateProps) || typeof sanitized.duplicateProps.offset !== 'object') {
      console.log(`Fixing duplicateProps.offset field for ${sanitized.typeName} record:`, {
        id: sanitized.id,
        originalValue: sanitized.duplicateProps.offset,
        originalType: typeof sanitized.duplicateProps.offset
      })
      ;(sanitized as any).duplicateProps.offset = { x: 0, y: 0 }
    }
  }
  
  // Only add fields appropriate for the record type
  if (sanitized.typeName === 'shape') {
    // Shape-specific fields
    if (!sanitized.x) sanitized.x = 0
    if (!sanitized.y) sanitized.y = 0
    if (!sanitized.rotation) sanitized.rotation = 0
    if (!sanitized.isLocked) sanitized.isLocked = false
    if (!sanitized.opacity) sanitized.opacity = 1
    if (!sanitized.meta) sanitized.meta = {}
    
    // Geo shape specific fields
    if (sanitized.type === 'geo') {
      if (!(sanitized as any).insets) {
        (sanitized as any).insets = [0, 0, 0, 0]
      }
      if (!(sanitized as any).geo) {
        (sanitized as any).geo = 'rectangle'
      }
      if (!(sanitized as any).w) {
        (sanitized as any).w = 100
      }
      if (!(sanitized as any).h) {
        (sanitized as any).h = 100
      }
    }
  } else if (sanitized.typeName === 'document') {
    // Document-specific fields only
    if (!sanitized.meta) sanitized.meta = {}
  } else if (sanitized.typeName === 'instance') {
    // Instance-specific fields only
    if (!sanitized.meta) sanitized.meta = {}
    
    // Fix properties that need to be objects instead of null/undefined
    if ('scribble' in sanitized) {
      console.log(`Removing invalid scribble property from instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.scribble
      })
      delete (sanitized as any).scribble
    }
    if ('brush' in sanitized && (sanitized.brush === null || sanitized.brush === undefined)) {
      console.log(`Fixing brush property to be an object for instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.brush
      })
      ;(sanitized as any).brush = { x: 0, y: 0, w: 0, h: 0 }
    }
    if ('zoomBrush' in sanitized && (sanitized.zoomBrush === null || sanitized.zoomBrush === undefined)) {
      console.log(`Fixing zoomBrush property to be an object for instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.zoomBrush
      })
      ;(sanitized as any).zoomBrush = {}
    }
    if ('insets' in sanitized && (sanitized.insets === undefined || !Array.isArray(sanitized.insets))) {
      console.log(`Fixing insets property to be an array for instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.insets
      })
      ;(sanitized as any).insets = [false, false, false, false]
    }
    if ('canMoveCamera' in sanitized) {
      console.log(`Removing invalid canMoveCamera property from instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.canMoveCamera
      })
      delete (sanitized as any).canMoveCamera
    }
    
    // Fix isCoarsePointer property to be a boolean
    if ('isCoarsePointer' in sanitized && typeof sanitized.isCoarsePointer !== 'boolean') {
      console.log(`Fixing isCoarsePointer property to be a boolean for instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.isCoarsePointer
      })
      ;(sanitized as any).isCoarsePointer = false
    }
    
    // Fix isHoveringCanvas property to be a boolean
    if ('isHoveringCanvas' in sanitized && typeof sanitized.isHoveringCanvas !== 'boolean') {
      console.log(`Fixing isHoveringCanvas property to be a boolean for instance record:`, {
        id: sanitized.id,
        originalValue: sanitized.isHoveringCanvas
      })
      ;(sanitized as any).isHoveringCanvas = false
    }
    
    
    // Add required fields that might be missing
    const requiredFields = {
      followingUserId: null,
      opacityForNextShape: 1,
      stylesForNextShape: {},
      brush: { x: 0, y: 0, w: 0, h: 0 },
      zoomBrush: { x: 0, y: 0, w: 0, h: 0 },
      scribbles: [],
      cursor: { type: "default", rotation: 0 },
      isFocusMode: false,
      exportBackground: true,
      isDebugMode: false,
      isToolLocked: false,
      screenBounds: { x: 0, y: 0, w: 720, h: 400 },
      isGridMode: false,
      isPenMode: false,
      chatMessage: "",
      isChatting: false,
      highlightedUserIds: [],
      isFocused: true,
      devicePixelRatio: 2,
      insets: [false, false, false, false],
      isCoarsePointer: false,
      isHoveringCanvas: false,
      openMenus: [],
      isChangingStyle: false,
      isReadonly: false,
      duplicateProps: { // Object field that was missing
        shapeIds: [],
        offset: { x: 0, y: 0 }
      }
    }
    
    // Add missing required fields
    Object.entries(requiredFields).forEach(([key, defaultValue]) => {
      if (!(key in sanitized)) {
        console.log(`Adding missing ${key} field to instance record:`, {
          id: sanitized.id,
          defaultValue
        })
        ;(sanitized as any)[key] = defaultValue
      }
    })
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
      doc.store[record.id] = sanitizedRecord
    })
  }

  // Handle updated records
  if (changes.updated) {
    Object.values(changes.updated).forEach(([_, record]) => {
      const sanitizedRecord = sanitizeRecord(record)
      deepCompareAndUpdate(doc.store[record.id], sanitizedRecord)
    })
  }

  // Handle removed records
  if (changes.removed) {
    Object.values(changes.removed).forEach((record) => {
      delete doc.store[record.id]
    })
  }

}

function deepCompareAndUpdate(objectA: any, objectB: any) {
  if (Array.isArray(objectB)) {
    if (!Array.isArray(objectA)) {
      // if objectA is not an array, replace it with objectB
      objectA = objectB.slice()
    } else {
      // compare and update array elements
      for (let i = 0; i < objectB.length; i++) {
        if (i >= objectA.length) {
          objectA.push(objectB[i])
        } else {
          if (isObject(objectB[i]) || Array.isArray(objectB[i])) {
            // if element is an object or array, recursively compare and update
            deepCompareAndUpdate(objectA[i], objectB[i])
          } else if (objectA[i] !== objectB[i]) {
            // update the element
            objectA[i] = objectB[i]
          }
        }
      }
      // remove extra elements
      if (objectA.length > objectB.length) {
        objectA.splice(objectB.length)
      }
    }
  } else if (isObject(objectB)) {
    for (const [key, value] of Object.entries(objectB)) {
      if (objectA[key] === undefined) {
        // if key is not in objectA, add it
        objectA[key] = value
      } else {
        if (isObject(value) || Array.isArray(value)) {
          // if value is an object or array, recursively compare and update
          deepCompareAndUpdate(objectA[key], value)
        } else if (objectA[key] !== value) {
          // update the value
          objectA[key] = value
        }
      }
    }
    for (const key of Object.keys(objectA)) {
      if ((objectB as any)[key] === undefined) {
        // if key is not in objectB, remove it
        delete objectA[key]
      }
    }
  }
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
