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
    const existingRecord = getRecordFromStore(store, id)
    const record = updatedObjects[id] || (existingRecord ? JSON.parse(JSON.stringify(existingRecord)) : { 
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
    })

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
  })
  
  // Sanitize records before putting them in the store
  const toPut: TLRecord[] = []
  const failedRecords: any[] = []
  
  Object.values(updatedObjects).forEach(record => {
    try {
      const sanitized = sanitizeRecord(record)
      toPut.push(sanitized)
    } catch (error) {
      console.error("Failed to sanitize record:", error, record)
      failedRecords.push(record)
    }
  })

  // put / remove the records in the store
  console.log({ patches, toPut: toPut.length, failed: failedRecords.length })
  
  if (failedRecords.length > 0) {
    console.error("Failed to sanitize records:", failedRecords)
  }
  
  store.mergeRemoteChanges(() => {
    if (toRemove.length) store.remove(toRemove)
    if (toPut.length) store.put(toPut)
  })
}

// Sanitize record to remove invalid properties
function sanitizeRecord(record: any): TLRecord {
  const sanitized = { ...record }
  
  // Ensure required fields exist for all records
  if (!sanitized.id) {
    console.error("Record missing required id field:", record)
    throw new Error("Record missing required id field")
  }
  
  if (!sanitized.typeName) {
    console.error("Record missing required typeName field:", record)
    throw new Error("Record missing required typeName field")
  }
  
  // Remove invalid properties from shapes
  if (sanitized.typeName === 'shape') {
    // Ensure required shape fields exist
    if (!sanitized.type || typeof sanitized.type !== 'string') {
      console.error("Shape missing or invalid type field:", {
        id: sanitized.id,
        typeName: sanitized.typeName,
        currentType: sanitized.type,
        record: sanitized
      })
      // Try to infer type from other properties or use a default
      if (sanitized.props?.geo) {
        sanitized.type = 'geo'
      } else if (sanitized.props?.text) {
        sanitized.type = 'text'
      } else if (sanitized.props?.roomUrl) {
        sanitized.type = 'VideoChat'
      } else if (sanitized.props?.roomId) {
        sanitized.type = 'ChatBox'
      } else if (sanitized.props?.url) {
        sanitized.type = 'Embed'
      } else if (sanitized.props?.prompt) {
        sanitized.type = 'Prompt'
      } else if (sanitized.props?.isMinimized !== undefined) {
        sanitized.type = 'SharedPiano'
      } else if (sanitized.props?.isTranscribing !== undefined) {
        sanitized.type = 'Transcription'
      } else if (sanitized.props?.noteId) {
        sanitized.type = 'ObsNote'
      } else {
        sanitized.type = 'geo' // Default fallback
      }
      console.log(`🔧 Fixed missing/invalid type field for shape ${sanitized.id}, set to: ${sanitized.type}`)
    }
    
    // Ensure type is a valid string
    if (typeof sanitized.type !== 'string') {
      console.error("Shape type is not a string:", sanitized.type, "for shape:", sanitized.id)
      sanitized.type = 'geo' // Force to valid string
    }
    
    // Ensure other required shape fields exist
    if (typeof sanitized.x !== 'number') {
      sanitized.x = 0
    }
    if (typeof sanitized.y !== 'number') {
      sanitized.y = 0
    }
    if (typeof sanitized.rotation !== 'number') {
      sanitized.rotation = 0
    }
    if (typeof sanitized.isLocked !== 'boolean') {
      sanitized.isLocked = false
    }
    if (typeof sanitized.opacity !== 'number') {
      sanitized.opacity = 1
    }
    if (!sanitized.meta || typeof sanitized.meta !== 'object') {
      sanitized.meta = {}
    }
    // Remove top-level properties that should only be in props
    const invalidTopLevelProperties = ['insets', 'scribbles', 'duplicateProps', 'geo', 'w', 'h']
    invalidTopLevelProperties.forEach(prop => {
      if (prop in sanitized) {
        console.log(`Moving ${prop} property from top-level to props for shape during patch application:`, {
          id: sanitized.id,
          type: sanitized.type,
          originalValue: sanitized[prop]
        })
        
        // Move to props if props exists, otherwise create props
        if (!sanitized.props) {
          sanitized.props = {}
        }
        sanitized.props[prop] = sanitized[prop]
        delete sanitized[prop]
      }
    })
    
    // Ensure props object exists for all shapes
    if (!sanitized.props) {
      sanitized.props = {}
    }
    
    // Fix geo shape specific properties
    if (sanitized.type === 'geo') {
      // Ensure geo shape has proper structure
      if (!sanitized.props.geo) {
        sanitized.props.geo = 'rectangle'
      }
      if (!sanitized.props.w) {
        sanitized.props.w = 100
      }
      if (!sanitized.props.h) {
        sanitized.props.h = 100
      }
      
      // Remove invalid properties for geo shapes (including insets)
      const invalidGeoProps = ['transcript', 'isTranscribing', 'isPaused', 'isEditing', 'roomUrl', 'roomId', 'prompt', 'value', 'agentBinding', 'isMinimized', 'noteId', 'title', 'content', 'tags', 'showPreview', 'backgroundColor', 'textColor', 'editingContent', 'vaultName', 'insets']
      invalidGeoProps.forEach(prop => {
        if (prop in sanitized.props) {
          console.log(`Removing invalid ${prop} property from geo shape:`, sanitized.id)
          delete sanitized.props[prop]
        }
      })
    }
    
    // Fix note shape specific properties
    if (sanitized.type === 'note') {
      // Remove w/h properties from note shapes as they're not valid
      if ('w' in sanitized.props) {
        console.log(`Removing invalid w property from note shape:`, sanitized.id)
        delete sanitized.props.w
      }
      if ('h' in sanitized.props) {
        console.log(`Removing invalid h property from note shape:`, sanitized.id)
        delete sanitized.props.h
      }
    }
    
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
    
    if (customShapeTypeMap[sanitized.type]) {
      console.log(`Converting custom shape type ${sanitized.type} to ${customShapeTypeMap[sanitized.type]} for shape:`, sanitized.id)
      sanitized.type = customShapeTypeMap[sanitized.type]
    }
    
    // Ensure proper props for converted shape types
    if (sanitized.type === 'embed') {
      // Ensure embed shapes have required properties
      if (!sanitized.props.url) {
        sanitized.props.url = ''
      }
      if (!sanitized.props.w) {
        sanitized.props.w = 400
      }
      if (!sanitized.props.h) {
        sanitized.props.h = 300
      }
      // Remove invalid properties for embed shapes
      const invalidEmbedProps = ['isMinimized', 'roomUrl', 'roomId', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'richText']
      invalidEmbedProps.forEach(prop => {
        if (prop in sanitized.props) {
          console.log(`Removing invalid ${prop} property from embed shape:`, sanitized.id)
          delete sanitized.props[prop]
        }
      })
    }
    
    if (sanitized.type === 'text') {
      // Ensure text shapes have required properties
      if (!sanitized.props.text) {
        sanitized.props.text = ''
      }
      if (!sanitized.props.w) {
        sanitized.props.w = 200
      }
      if (!sanitized.props.color) {
        sanitized.props.color = 'black'
      }
      if (!sanitized.props.size) {
        sanitized.props.size = 'm'
      }
      if (!sanitized.props.font) {
        sanitized.props.font = 'draw'
      }
      if (!sanitized.props.textAlign) {
        sanitized.props.textAlign = 'start'
      }
      // Text shapes don't have h property
      if ('h' in sanitized.props) {
        delete sanitized.props.h
      }
      // Remove invalid properties for text shapes
      const invalidTextProps = ['isMinimized', 'roomUrl', 'roomId', 'geo', 'insets', 'scribbles']
      invalidTextProps.forEach(prop => {
        if (prop in sanitized.props) {
          console.log(`Removing invalid ${prop} property from text shape:`, sanitized.id)
          delete sanitized.props[prop]
        }
      })
    }
    
    // General cleanup: remove any properties that might cause validation errors
    const validShapeProps: { [key: string]: string[] } = {
      'geo': ['w', 'h', 'geo', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'url'],
      'text': ['w', 'text', 'color', 'fill', 'dash', 'size', 'font', 'align', 'verticalAlign', 'growY', 'url'],
      'embed': ['w', 'h', 'url', 'doesResize', 'doesResizeHeight'],
      'note': ['color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'url'],
      'arrow': ['start', 'end', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'url', 'arrowheadStart', 'arrowheadEnd'],
      'draw': ['points', 'color', 'fill', 'dash', 'size'],
      'bookmark': ['w', 'h', 'url', 'doesResize', 'doesResizeHeight'],
      'image': ['w', 'h', 'assetId', 'crop', 'doesResize', 'doesResizeHeight'],
      'video': ['w', 'h', 'assetId', 'crop', 'doesResize', 'doesResizeHeight'],
      'frame': ['w', 'h', 'name', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'url'],
      'group': ['w', 'h'],
      'highlight': ['w', 'h', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'url'],
      'line': ['x', 'y', 'color', 'fill', 'dash', 'size', 'text', 'font', 'align', 'verticalAlign', 'growY', 'url']
    }
    
    // Remove invalid properties based on shape type
    if (validShapeProps[sanitized.type]) {
      const validProps = validShapeProps[sanitized.type]
      Object.keys(sanitized.props).forEach(prop => {
        if (!validProps.includes(prop)) {
          console.log(`Removing invalid property ${prop} from ${sanitized.type} shape:`, sanitized.id)
          delete sanitized.props[prop]
        }
      })
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
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error("NO WAY")
    }
    current = current[part]
  }
  // splice is a mutator... yay.
  const clone = current[pathEnd].slice(0)
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

  // default case
  for (const part of parts) {
    current = current[part]
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
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error("NO WAY")
    }
    current = current[part]
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
