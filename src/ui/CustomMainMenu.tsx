import {
    DefaultMainMenu,
    TldrawUiMenuItem,
    Editor,
    TLContent,
    DefaultMainMenuContent,
    useEditor,
} from "tldraw";

export function CustomMainMenu() {
    const editor = useEditor()

    const importJSON = (editor: Editor) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (typeof event.target?.result !== 'string') {
                    return
                }
                try {
                    const jsonData = JSON.parse(event.target.result)
                    console.log('Parsed JSON data:', jsonData)
                    
                    // Helper function to validate and normalize shape types
                    const validateAndNormalizeShapeType = (shape: any): string => {
                        if (!shape || !shape.type) return 'text'
                        
                        const validCustomShapes = ['ObsNote', 'VideoChat', 'Transcription', 'Prompt', 'ChatBox', 'Embed', 'Markdown', 'MycrozineTemplate', 'Slide', 'Holon', 'ObsidianBrowser', 'HolonBrowser', 'FathomMeetingsBrowser']
                        const validDefaultShapes = ['arrow', 'bookmark', 'draw', 'embed', 'frame', 'geo', 'group', 'highlight', 'image', 'line', 'note', 'text', 'video']
                        const allValidShapes = [...validCustomShapes, ...validDefaultShapes]
                        
                        // Check if original type is valid (preserves lowercase default shapes like 'embed', 'geo', etc.)
                        if (allValidShapes.includes(shape.type)) {
                            return shape.type
                        }
                        
                        // Normalize case: chatBox -> ChatBox, videoChat -> VideoChat, etc.
                        const normalizedType = shape.type.charAt(0).toUpperCase() + shape.type.slice(1)
                        
                        // Check if normalized version is valid (for custom shapes like ChatBox, VideoChat, etc.)
                        if (allValidShapes.includes(normalizedType)) {
                            return normalizedType
                        }
                        
                        // If not valid, convert to text shape
                        console.warn(`⚠️ Unknown or unsupported shape type "${shape.type}", converting to text shape for shape:`, shape.id)
                        return 'text'
                    }
                    
                    // Helper function to validate and fix invalid numeric values (NaN, Infinity)
                    const validateNumericValue = (value: any, defaultValue: number, name: string): number => {
                        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
                            console.warn(`⚠️ Invalid ${name} value (${value}), using default: ${defaultValue}`)
                            return defaultValue
                        }
                        return value
                    }
                    
                    // Helper function to validate shape geometry data
                    const validateShapeGeometry = (shape: any): boolean => {
                        if (!shape || !shape.id) return false
                        
                        // Validate basic numeric properties
                        shape.x = validateNumericValue(shape.x, 0, 'x')
                        shape.y = validateNumericValue(shape.y, 0, 'y')
                        shape.rotation = validateNumericValue(shape.rotation, 0, 'rotation')
                        shape.opacity = validateNumericValue(shape.opacity, 1, 'opacity')
                        
                        // Validate shape-specific geometry based on type
                        if (shape.type === 'line' && shape.props?.points) {
                            // Validate line points
                            if (Array.isArray(shape.props.points)) {
                                shape.props.points = shape.props.points.filter((point: any) => {
                                    if (!point || typeof point !== 'object') return false
                                    const x = validateNumericValue(point.x, 0, 'point.x')
                                    const y = validateNumericValue(point.y, 0, 'point.y')
                                    return true
                                }).map((point: any) => ({
                                    x: validateNumericValue(point.x, 0, 'point.x'),
                                    y: validateNumericValue(point.y, 0, 'point.y'),
                                    z: point.z !== undefined ? validateNumericValue(point.z, 0.5, 'point.z') : 0.5
                                }))
                                
                                // Line must have at least 2 points
                                if (shape.props.points.length < 2) {
                                    console.warn(`⚠️ Line shape has insufficient points (${shape.props.points.length}), skipping shape:`, shape.id)
                                    return false
                                }
                            }
                        }
                        
                        if (shape.type === 'draw' && shape.props?.segments) {
                            // Validate draw segments
                            if (Array.isArray(shape.props.segments)) {
                                shape.props.segments = shape.props.segments.filter((segment: any) => {
                                    if (!segment || typeof segment !== 'object') return false
                                    if (segment.points && Array.isArray(segment.points)) {
                                        segment.points = segment.points.filter((point: any) => {
                                            if (!point || typeof point !== 'object') return false
                                            const x = validateNumericValue(point.x, 0, 'segment.point.x')
                                            const y = validateNumericValue(point.y, 0, 'segment.point.y')
                                            return true
                                        }).map((point: any) => ({
                                            x: validateNumericValue(point.x, 0, 'segment.point.x'),
                                            y: validateNumericValue(point.y, 0, 'segment.point.y')
                                        }))
                                        return segment.points.length > 0
                                    }
                                    return false
                                })
                                
                                // Draw must have at least 1 segment with points
                                if (shape.props.segments.length === 0 || 
                                    !shape.props.segments.some((s: any) => s.points && s.points.length > 0)) {
                                    console.warn(`⚠️ Draw shape has no valid segments, skipping shape:`, shape.id)
                                    return false
                                }
                            }
                        }
                        
                        if (shape.type === 'arrow' && shape.props?.points) {
                            // Validate arrow points
                            if (Array.isArray(shape.props.points)) {
                                shape.props.points = shape.props.points.filter((point: any) => {
                                    if (!point || typeof point !== 'object') return false
                                    return true
                                }).map((point: any) => ({
                                    x: validateNumericValue(point.x, 0, 'arrow.point.x'),
                                    y: validateNumericValue(point.y, 0, 'arrow.point.y'),
                                    z: point.z !== undefined ? validateNumericValue(point.z, 0.5, 'arrow.point.z') : 0.5
                                }))
                                
                                // Arrow must have at least 2 points
                                if (shape.props.points.length < 2) {
                                    console.warn(`⚠️ Arrow shape has insufficient points (${shape.props.points.length}), skipping shape:`, shape.id)
                                    return false
                                }
                            }
                        }
                        
                        // Validate props numeric values
                        if (shape.props) {
                            if ('w' in shape.props) {
                                shape.props.w = validateNumericValue(shape.props.w, 100, 'props.w')
                            }
                            if ('h' in shape.props) {
                                shape.props.h = validateNumericValue(shape.props.h, 100, 'props.h')
                            }
                            if ('scale' in shape.props) {
                                shape.props.scale = validateNumericValue(shape.props.scale, 1, 'props.scale')
                            }
                        }
                        
                        return true
                    }
                    
                    // Handle different JSON formats
                    let contentToImport: TLContent
                    
                    // Function to fix incomplete shape data for proper rendering
                    const fixIncompleteShape = (shape: any, pageId: string): any => {
                        const fixedShape = { ...shape }
                        
                        // CRITICAL: Validate geometry first (fixes NaN/Infinity values)
                        if (!validateShapeGeometry(fixedShape)) {
                            console.warn(`⚠️ Shape failed geometry validation, skipping:`, fixedShape.id)
                            return null // Return null to indicate shape should be skipped
                        }
                        
                        // CRITICAL: Validate and normalize shape type
                        const normalizedType = validateAndNormalizeShapeType(fixedShape)
                        if (normalizedType !== fixedShape.type) {
                            console.log(`🔧 Normalizing shape type "${fixedShape.type}" to "${normalizedType}" for shape:`, fixedShape.id)
                            fixedShape.type = normalizedType
                            
                            // If converted to text, set up proper text shape props
                            if (normalizedType === 'text') {
                                if (!fixedShape.props) fixedShape.props = {}
                                fixedShape.props = {
                                    ...fixedShape.props,
                                    w: fixedShape.props.w || 300,
                                    color: fixedShape.props.color || 'black',
                                    size: fixedShape.props.size || 'm',
                                    font: fixedShape.props.font || 'draw',
                                    textAlign: fixedShape.props.textAlign || 'start',
                                    autoSize: fixedShape.props.autoSize !== undefined ? fixedShape.props.autoSize : false,
                                    scale: fixedShape.props.scale || 1,
                                    richText: fixedShape.props.richText || { content: [], type: 'doc' }
                                }
                                // Remove invalid properties for text shapes
                                const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'text', 'align', 'verticalAlign', 'growY', 'url']
                                invalidTextProps.forEach(prop => {
                                    if (prop in fixedShape.props) {
                                        delete (fixedShape.props as any)[prop]
                                    }
                                })
                            }
                        }
                        
                        // CRITICAL: Preserve existing coordinates - only set defaults if truly missing
                        // x/y can be 0, which is a valid coordinate, so check for undefined/null/NaN
                        // Note: validateShapeGeometry already ensures x/y are valid numbers, but we need to
                        // handle the case where they might be NaN or Infinity after validation
                        if (fixedShape.x === undefined || fixedShape.x === null || isNaN(fixedShape.x) || !isFinite(fixedShape.x)) {
                            fixedShape.x = Math.random() * 400 + 50 // Random position only if missing or invalid
                        }
                        if (fixedShape.y === undefined || fixedShape.y === null || isNaN(fixedShape.y) || !isFinite(fixedShape.y)) {
                            fixedShape.y = Math.random() * 300 + 50 // Random position only if missing or invalid
                        }
                        
                        // Preserve rotation, isLocked, opacity - only set defaults if missing
                        if (fixedShape.rotation === undefined || fixedShape.rotation === null) {
                            fixedShape.rotation = 0
                        }
                        if (fixedShape.isLocked === undefined || fixedShape.isLocked === null) {
                            fixedShape.isLocked = false
                        }
                        if (fixedShape.opacity === undefined || fixedShape.opacity === null) {
                            fixedShape.opacity = 1
                        }
                        if (!fixedShape.meta || typeof fixedShape.meta !== 'object') {
                            fixedShape.meta = {}
                        }
                        
                        // CRITICAL: Preserve parentId relationships (frames, groups, etc.)
                        // Only set to pageId if parentId is truly missing
                        // This preserves frame relationships and prevents content collapse
                        if (!fixedShape.parentId || fixedShape.parentId === '') {
                            fixedShape.parentId = pageId
                        }
                        
                        // CRITICAL: For geo shapes, w/h/geo MUST be in props, NOT at top level
                        if (fixedShape.type === 'geo') {
                            // Store w/h/geo values if they exist at top level
                            const wValue = fixedShape.w !== undefined ? fixedShape.w : 100
                            const hValue = fixedShape.h !== undefined ? fixedShape.h : 100
                            const geoValue = fixedShape.geo !== undefined ? fixedShape.geo : 'rectangle'
                            
                            // Remove w/h/geo from top level (TLDraw validation requires they be in props only)
                            delete fixedShape.w
                            delete fixedShape.h
                            delete fixedShape.geo
                            
                            // Ensure props exists and has the correct values
                            if (!fixedShape.props) fixedShape.props = {}
                            if (fixedShape.props.w === undefined) fixedShape.props.w = wValue
                            if (fixedShape.props.h === undefined) fixedShape.props.h = hValue
                            if (fixedShape.props.geo === undefined) fixedShape.props.geo = geoValue
                            
                            // Set default props if missing
                            if (!fixedShape.props.color) fixedShape.props.color = 'black'
                            if (!fixedShape.props.fill) fixedShape.props.fill = 'none'
                            if (!fixedShape.props.dash) fixedShape.props.dash = 'draw'
                            if (!fixedShape.props.size) fixedShape.props.size = 'm'
                            if (!fixedShape.props.font) fixedShape.props.font = 'draw'
                        } else if (fixedShape.type === 'VideoChat') {
                            // VideoChat shapes also need w/h in props, not top level
                            const wValue = fixedShape.w !== undefined ? fixedShape.w : 200
                            const hValue = fixedShape.h !== undefined ? fixedShape.h : 150
                            
                            delete fixedShape.w
                            delete fixedShape.h
                            
                            if (!fixedShape.props) fixedShape.props = {}
                            if (fixedShape.props.w === undefined) fixedShape.props.w = wValue
                            if (fixedShape.props.h === undefined) fixedShape.props.h = hValue
                            if (!fixedShape.props.color) fixedShape.props.color = 'black'
                            if (!fixedShape.props.fill) fixedShape.props.fill = 'none'
                            if (!fixedShape.props.dash) fixedShape.props.dash = 'draw'
                            if (!fixedShape.props.size) fixedShape.props.size = 'm'
                            if (!fixedShape.props.font) fixedShape.props.font = 'draw'
                        }
                        
                        return fixedShape
                    }
                    
                    // Check if it's a worker export format (has documents array)
                    if (jsonData.documents && Array.isArray(jsonData.documents)) {
                        console.log('Detected worker export format with', jsonData.documents.length, 'documents')
                        
                        // Convert worker export format to TLContent format
                        const pageId = jsonData.documents.find((doc: any) => doc.state?.typeName === 'page')?.state?.id || 'page:default'
                        const shapes = jsonData.documents
                            .filter((doc: any) => doc.state?.typeName === 'shape')
                            .map((doc: any) => fixIncompleteShape(doc.state, pageId))
                        
                        const bindings = jsonData.documents
                            .filter((doc: any) => doc.state?.typeName === 'binding')
                            .map((doc: any) => doc.state)
                        
                        const assets = jsonData.documents
                            .filter((doc: any) => doc.state?.typeName === 'asset')
                            .map((doc: any) => doc.state)
                        
                        console.log('Extracted:', { shapes: shapes.length, bindings: bindings.length, assets: assets.length })
                        
                        // CRITICAL: rootShapeIds should only include shapes that are direct children of the page
                        // Shapes inside frames should NOT be in rootShapeIds (they're children of frames)
                        const rootShapeIds = shapes
                            .filter((shape: any) => !shape.parentId || shape.parentId === pageId)
                            .map((shape: any) => shape.id)
                            .filter(Boolean)
                        
                        contentToImport = {
                            rootShapeIds: rootShapeIds,
                            schema: jsonData.schema || { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
                            shapes: shapes,
                            bindings: bindings,
                            assets: assets,
                        }
                    } else if (jsonData.store && jsonData.schema) {
                        console.log('Detected Automerge format')
                        // Convert Automerge format to TLContent format
                        const store = jsonData.store
                        const shapes: any[] = []
                        const bindings: any[] = []
                        const assets: any[] = []
                        
                        // Find the page ID first
                        const pageRecord = Object.values(store).find((record: any) => 
                            record && typeof record === 'object' && record.typeName === 'page'
                        ) as any
                        const pageId = pageRecord?.id || 'page:default'
                        
                        // Extract shapes, bindings, and assets from the store
                        Object.values(store).forEach((record: any) => {
                            if (record && typeof record === 'object') {
                                if (record.typeName === 'shape') {
                                    const fixedShape = fixIncompleteShape(record, pageId)
                                    if (fixedShape !== null) {
                                        shapes.push(fixedShape)
                                    }
                                } else if (record.typeName === 'binding') {
                                    bindings.push(record)
                                } else if (record.typeName === 'asset') { 
                                    assets.push(record)
                                }
                            }
                        })
                        
                        console.log('Extracted from Automerge format:', { shapes: shapes.length, bindings: bindings.length, assets: assets.length })
                        
                        // CRITICAL: rootShapeIds should only include shapes that are direct children of the page
                        // Shapes inside frames should NOT be in rootShapeIds (they're children of frames)
                        const rootShapeIds = shapes
                            .filter((shape: any) => !shape.parentId || shape.parentId === pageId)
                            .map((shape: any) => shape.id)
                            .filter(Boolean)
                        
                        contentToImport = {
                            rootShapeIds: rootShapeIds,
                            schema: jsonData.schema,
                            shapes: shapes,
                            bindings: bindings,
                            assets: assets,
                        }
                    } else if (jsonData.shapes && Array.isArray(jsonData.shapes)) {
                        console.log('Detected standard TLContent format with', jsonData.shapes.length, 'shapes')
                        // Find page ID from imported data or use current page
                        const importedPageId = jsonData.pages?.[0]?.id || 'page:default'
                        const currentPageId = editor.getCurrentPageId()
                        const pageId = importedPageId // Use imported page ID, putContentOntoCurrentPage will handle mapping
                        
                        // Fix shapes to ensure they have required properties
                        // Filter out null shapes (shapes that failed validation)
                        const fixedShapes = jsonData.shapes
                            .map((shape: any) => fixIncompleteShape(shape, pageId))
                            .filter((shape: any) => shape !== null)
                        
                        // CRITICAL: rootShapeIds should only include shapes that are direct children of the page
                        // Always recompute from fixed shapes to ensure correctness (shapes within frames should be excluded)
                        const rootShapeIds = fixedShapes
                            .filter((shape: any) => !shape.parentId || shape.parentId === pageId)
                            .map((shape: any) => shape.id)
                            .filter(Boolean)
                        
                        contentToImport = {
                            rootShapeIds: rootShapeIds,
                            schema: jsonData.schema || { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
                            shapes: fixedShapes,
                            bindings: jsonData.bindings || [],
                            assets: jsonData.assets || [],
                        }
                    } else {
                        console.log('Detected unknown format, attempting fallback')
                        // Try to extract shapes from any other format
                        const pageId = 'page:default'
                        // Filter out null shapes (shapes that failed validation)
                        const fixedShapes = (jsonData.shapes || [])
                            .map((shape: any) => fixIncompleteShape(shape, pageId))
                            .filter((shape: any) => shape !== null)
                        
                        // CRITICAL: rootShapeIds should only include shapes that are direct children of the page
                        // Always recompute from fixed shapes to ensure correctness (shapes within frames should be excluded)
                        const rootShapeIds = fixedShapes
                            .filter((shape: any) => !shape.parentId || shape.parentId === pageId)
                            .map((shape: any) => shape.id)
                            .filter(Boolean)
                        
                        contentToImport = {
                            rootShapeIds: rootShapeIds,
                            schema: jsonData.schema || { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
                            shapes: fixedShapes,
                            bindings: jsonData.bindings || [],
                            assets: jsonData.assets || [],
                        }
                    }
                    
                    // Validate all required properties
                    console.log('Final contentToImport:', contentToImport)
                    
                    if (!contentToImport.shapes || !Array.isArray(contentToImport.shapes)) {
                        console.error('Invalid JSON format: missing or invalid shapes array')
                        alert('Invalid JSON format. Please ensure the file contains valid TLDraw content.')
                        return
                    }
                    
                    if (!contentToImport.rootShapeIds || !Array.isArray(contentToImport.rootShapeIds)) {
                        console.error('Invalid JSON format: missing or invalid rootShapeIds array')
                        alert('Invalid JSON format. Please ensure the file contains valid TLDraw content.')
                        return
                    }
                    
                    if (!contentToImport.schema) {
                        console.error('Invalid JSON format: missing schema')
                        alert('Invalid JSON format. Please ensure the file contains valid TLDraw content.')
                        return
                    }
                    
                    if (!contentToImport.bindings || !Array.isArray(contentToImport.bindings)) {
                        contentToImport.bindings = []
                    }
                    
                    if (!contentToImport.assets || !Array.isArray(contentToImport.assets)) {
                        contentToImport.assets = []
                    }
                    
                    // CRITICAL: Final sanitization - validate geometry, validate shape types, ensure all geo shapes have w/h/geo in props, not top level
                    // Also ensure text shapes don't have props.text (should use props.richText instead)
                    if (contentToImport.shapes) {
                        contentToImport.shapes = contentToImport.shapes
                            .map((shape: any) => {
                                if (!shape || !shape.type) return null
                                
                                // CRITICAL: Validate geometry first (fixes NaN/Infinity values)
                                if (!validateShapeGeometry(shape)) {
                                    console.warn(`⚠️ Shape failed geometry validation in final sanitization, skipping:`, shape.id)
                                    return null
                                }
                                
                                return shape
                            })
                            .filter((shape: any) => shape !== null)
                            .map((shape: any) => {
                                if (!shape || !shape.type) return shape
                            
                            // Validate and normalize shape type
                            const normalizedType = validateAndNormalizeShapeType(shape)
                            if (normalizedType !== shape.type) {
                                console.log(`🔧 Normalizing shape type "${shape.type}" to "${normalizedType}" for shape:`, shape.id)
                                shape.type = normalizedType
                                
                                // If converted to text, set up proper text shape props
                                if (normalizedType === 'text') {
                                    if (!shape.props) shape.props = {}
                                    shape.props = {
                                        ...shape.props,
                                        w: shape.props.w || 300,
                                        color: shape.props.color || 'black',
                                        size: shape.props.size || 'm',
                                        font: shape.props.font || 'draw',
                                        textAlign: shape.props.textAlign || 'start',
                                        autoSize: shape.props.autoSize !== undefined ? shape.props.autoSize : false,
                                        scale: shape.props.scale || 1,
                                        richText: shape.props.richText || { content: [], type: 'doc' }
                                    }
                                    // Remove invalid properties for text shapes
                                    const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'text', 'align', 'verticalAlign', 'growY', 'url']
                                    invalidTextProps.forEach(prop => {
                                        if (prop in shape.props) {
                                            delete (shape.props as any)[prop]
                                        }
                                    })
                                }
                            }
                            
                            if (shape.type === 'geo') {
                                const wValue = 'w' in shape ? shape.w : undefined
                                const hValue = 'h' in shape ? shape.h : undefined
                                const geoValue = 'geo' in shape ? shape.geo : undefined
                                
                                // Remove from top level
                                delete shape.w
                                delete shape.h
                                delete shape.geo
                                
                                // Ensure props exists and move values there
                                if (!shape.props) shape.props = {}
                                if (wValue !== undefined && !shape.props.w) shape.props.w = wValue
                                if (hValue !== undefined && !shape.props.h) shape.props.h = hValue
                                if (geoValue !== undefined && !shape.props.geo) shape.props.geo = geoValue
                            }
                            
                            // CRITICAL: Remove invalid 'text' property from text shapes (TLDraw schema doesn't allow props.text)
                            // Text shapes should only use props.richText, not props.text
                            if (shape && shape.type === 'text' && shape.props && 'text' in shape.props) {
                                delete shape.props.text
                            }
                            
                            return shape
                        })
                    }
                    
                    console.log('About to call putContentOntoCurrentPage with:', contentToImport)
                    
                    try {
                        editor.putContentOntoCurrentPage(contentToImport, { select: true })
                    } catch (putContentError) {
                        console.error('putContentOntoCurrentPage failed, trying alternative approach:', putContentError)
                        
                        // Fallback: Create shapes individually
                        if (contentToImport.shapes && contentToImport.shapes.length > 0) {
                            console.log('Attempting to create shapes individually...')
                            
                            // Clear current page first
                            const currentShapes = editor.getCurrentPageShapes()
                            if (currentShapes.length > 0) {
                                editor.deleteShapes(currentShapes.map(shape => shape.id))
                            }
                            
                            // Create shapes one by one
                            contentToImport.shapes.forEach((shape: any) => {
                                try {
                                    if (shape && shape.id && shape.type) {
                                        // CRITICAL: Validate geometry first (fixes NaN/Infinity values)
                                        if (!validateShapeGeometry(shape)) {
                                            console.warn(`⚠️ Shape failed geometry validation in fallback, skipping:`, shape.id)
                                            return
                                        }
                                        
                                        // CRITICAL: Validate and normalize shape type
                                        const normalizedType = validateAndNormalizeShapeType(shape)
                                        if (normalizedType !== shape.type) {
                                            console.log(`🔧 Normalizing shape type "${shape.type}" to "${normalizedType}" for shape:`, shape.id)
                                            shape.type = normalizedType
                                            
                                            // If converted to text, set up proper text shape props
                                            if (normalizedType === 'text') {
                                                if (!shape.props) shape.props = {}
                                                shape.props = {
                                                    ...shape.props,
                                                    w: shape.props.w || 300,
                                                    color: shape.props.color || 'black',
                                                    size: shape.props.size || 'm',
                                                    font: shape.props.font || 'draw',
                                                    textAlign: shape.props.textAlign || 'start',
                                                    autoSize: shape.props.autoSize !== undefined ? shape.props.autoSize : false,
                                                    scale: shape.props.scale || 1,
                                                    richText: shape.props.richText || { content: [], type: 'doc' }
                                                }
                                                // Remove invalid properties for text shapes
                                                const invalidTextProps = ['h', 'geo', 'insets', 'scribbles', 'isMinimized', 'roomUrl', 'text', 'align', 'verticalAlign', 'growY', 'url']
                                                invalidTextProps.forEach(prop => {
                                                    if (prop in shape.props) {
                                                        delete (shape.props as any)[prop]
                                                    }
                                                })
                                            }
                                        }
                                        
                                        // Ensure isLocked property is set
                                        if (shape.isLocked === undefined) {
                                            shape.isLocked = false
                                        }
                                        
                                        // CRITICAL: Final sanitization - ensure geo shapes don't have w/h/geo at top level
                                        if (shape.type === 'geo') {
                                            const wValue = 'w' in shape ? shape.w : undefined
                                            const hValue = 'h' in shape ? shape.h : undefined
                                            const geoValue = 'geo' in shape ? shape.geo : undefined
                                            
                                            // Remove from top level
                                            delete shape.w
                                            delete shape.h
                                            delete shape.geo
                                            
                                            // Ensure props exists and move values there
                                            if (!shape.props) shape.props = {}
                                            if (wValue !== undefined && !shape.props.w) shape.props.w = wValue
                                            if (hValue !== undefined && !shape.props.h) shape.props.h = hValue
                                            if (geoValue !== undefined && !shape.props.geo) shape.props.geo = geoValue
                                        }
                                        
                                        // CRITICAL: Remove invalid 'text' property from text shapes (TLDraw schema doesn't allow props.text)
                                        // Text shapes should only use props.richText, not props.text
                                        if (shape.type === 'text' && shape.props && 'text' in shape.props) {
                                            delete shape.props.text
                                        }
                                        
                                        editor.createShape(shape)
                                    }
                                } catch (shapeError) {
                                    console.error('Failed to create shape:', shape, shapeError)
                                }
                            })
                            
                            // Create bindings if any
                            if (contentToImport.bindings && contentToImport.bindings.length > 0) {
                                contentToImport.bindings.forEach((binding: any) => {
                                    try {
                                        if (binding && binding.id) {
                                            editor.createBinding(binding)
                                        }
                                    } catch (bindingError) {
                                        console.error('Failed to create binding:', binding, bindingError)
                                    }
                                })
                            }
                            
                            console.log('Individual shape creation completed')
                        } else {
                            alert('No valid shapes found in the JSON file.')
                        }
                    }
                } catch (error) {
                    console.error('Error parsing JSON:', error)
                    alert('Error parsing JSON file. Please ensure the file is valid JSON.')
                }
            };
            if (file) {
                reader.readAsText(file);
            }
        };
        input.click();
    };
    const exportJSON = (editor: Editor) => {
        try {
            // Get all shapes from the current page
            const shapes = editor.getCurrentPageShapes()
            
            if (shapes.length === 0) {
                alert('No shapes to export')
                return
            }
            
            // Get the current page ID
            const currentPageId = editor.getCurrentPageId()
            
            // Get root shape IDs (shapes without a parent or with page as parent)
            const rootShapeIds = shapes
                .filter(shape => !shape.parentId || shape.parentId === currentPageId)
                .map(shape => shape.id)
            
            // Get all bindings from the store
            const store = editor.store
            const bindings = store.allRecords()
                .filter(record => record.typeName === 'binding')
                .map(record => record as any)
            
            // Get all assets from the store
            const assets = store.allRecords()
                .filter(record => record.typeName === 'asset')
                .map(record => record as any)
            
            // Get schema from the store
            const schema = editor.store.schema.serialize()
            
            // Construct the content object matching the import format
            const content: TLContent = {
                rootShapeIds: rootShapeIds,
                schema: schema,
                shapes: shapes.map(shape => shape as any),
                bindings: bindings,
                assets: assets,
            }
            
            // Convert to JSON string
            const jsonString = JSON.stringify(content, null, 2)
            
            // Create a blob and download it
            const blob = new Blob([jsonString], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `canvas-export-${Date.now()}.json`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error exporting JSON:', error)
            alert('Failed to export JSON. Please try again.')
        }
    };

    const fitToContent = (editor: Editor) => {
        // Get all shapes on the current page
        const shapes = editor.getCurrentPageShapes()
        if (shapes.length === 0) {
            console.log("No shapes to fit to")
            return
        }
        
        // Calculate bounds
        const bounds = {
            minX: Math.min(...shapes.map(s => s.x)),
            maxX: Math.max(...shapes.map(s => s.x)),
            minY: Math.min(...shapes.map(s => s.y)),
            maxY: Math.max(...shapes.map(s => s.y))
        }
        
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2
        const width = bounds.maxX - bounds.minX
        const height = bounds.maxY - bounds.minY
        const maxDimension = Math.max(width, height)
        const zoom = Math.min(1, 800 / maxDimension) // Fit in 800px viewport
        
        console.log("Fitting to content:", { bounds, centerX, centerY, zoom })
        
        // Set camera to show all shapes
        editor.setCamera({ x: centerX, y: centerY, z: zoom })
    };

    return (
        <DefaultMainMenu>
            <DefaultMainMenuContent />
            <TldrawUiMenuItem
                id="export"
                label="Export JSON"
                icon="external-link"
                readonlyOk
                onSelect={() => exportJSON(editor)}
            />
            <TldrawUiMenuItem
                id="import"
                label="Import JSON"
                icon="external-link"
                readonlyOk
                onSelect={() => importJSON(editor)}
            />
            <TldrawUiMenuItem
                id="fit-to-content"
                label="Fit to Content"
                icon="external-link"
                readonlyOk
                onSelect={() => fitToContent(editor)}
            />
        </DefaultMainMenu>
    )
}