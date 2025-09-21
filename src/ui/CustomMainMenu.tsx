import {
    DefaultMainMenu,
    TldrawUiMenuItem,
    Editor,
    TLContent,
    DefaultMainMenuContent,
    useEditor,
    useExportAs,
} from "tldraw";

export function CustomMainMenu() {
    const editor = useEditor()
    const exportAs = useExportAs()

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
                    
                    // Handle different JSON formats
                    let contentToImport: TLContent
                    
                    // Function to fix incomplete shape data for proper rendering
                    const fixIncompleteShape = (shape: any, pageId: string): any => {
                        const fixedShape = { ...shape }
                        
                        // Add missing required properties for all shapes
                        if (!fixedShape.x) fixedShape.x = Math.random() * 400 + 50 // Random position
                        if (!fixedShape.y) fixedShape.y = Math.random() * 300 + 50
                        if (!fixedShape.rotation) fixedShape.rotation = 0
                        if (!fixedShape.isLocked) fixedShape.isLocked = false
                        if (!fixedShape.opacity) fixedShape.opacity = 1
                        if (!fixedShape.meta) fixedShape.meta = {}
                        if (!fixedShape.parentId) fixedShape.parentId = pageId
                        
                        // Add shape-specific properties
                        if (fixedShape.type === 'geo') {
                            if (!fixedShape.w) fixedShape.w = 100
                            if (!fixedShape.h) fixedShape.h = 100
                            if (!fixedShape.geo) fixedShape.geo = 'rectangle'
                            if (!fixedShape.insets) fixedShape.insets = [0, 0, 0, 0]
                            if (!fixedShape.props) fixedShape.props = {
                                geo: 'rectangle',
                                w: fixedShape.w,
                                h: fixedShape.h,
                                color: 'black',
                                fill: 'none',
                                dash: 'draw',
                                size: 'm',
                                font: 'draw'
                            }
                        } else if (fixedShape.type === 'VideoChat') {
                            if (!fixedShape.w) fixedShape.w = 200
                            if (!fixedShape.h) fixedShape.h = 150
                            if (!fixedShape.props) fixedShape.props = {
                                w: fixedShape.w,
                                h: fixedShape.h,
                                color: 'black',
                                fill: 'none',
                                dash: 'draw',
                                size: 'm',
                                font: 'draw'
                            }
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
                        
                        contentToImport = {
                            rootShapeIds: shapes.map((shape: any) => shape.id).filter(Boolean),
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
                                    shapes.push(fixIncompleteShape(record, pageId))
                                } else if (record.typeName === 'binding') {
                                    bindings.push(record)
                                } else if (record.typeName === 'asset') { 
                                    assets.push(record)
                                }
                            }
                        })
                        
                        console.log('Extracted from Automerge format:', { shapes: shapes.length, bindings: bindings.length, assets: assets.length })
                        
                        contentToImport = {
                            rootShapeIds: shapes.map((shape: any) => shape.id).filter(Boolean),
                            schema: jsonData.schema,
                            shapes: shapes,
                            bindings: bindings,
                            assets: assets,
                        }
                    } else if (jsonData.shapes && Array.isArray(jsonData.shapes)) {
                        console.log('Detected standard TLContent format with', jsonData.shapes.length, 'shapes')
                        // Find page ID or use default
                        const pageId = jsonData.pages?.[0]?.id || 'page:default'
                        // Fix shapes to ensure they have required properties
                        const fixedShapes = jsonData.shapes.map((shape: any) => fixIncompleteShape(shape, pageId))
                        contentToImport = {
                            rootShapeIds: jsonData.rootShapeIds || fixedShapes.map((shape: any) => shape.id).filter(Boolean),
                            schema: jsonData.schema || { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
                            shapes: fixedShapes,
                            bindings: jsonData.bindings || [],
                            assets: jsonData.assets || [],
                        }
                    } else {
                        console.log('Detected unknown format, attempting fallback')
                        // Try to extract shapes from any other format
                        const pageId = 'page:default'
                        const fixedShapes = (jsonData.shapes || []).map((shape: any) => fixIncompleteShape(shape, pageId))
                        contentToImport = {
                            rootShapeIds: jsonData.rootShapeIds || fixedShapes.map((shape: any) => shape.id).filter(Boolean),
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
                                        // Ensure isLocked property is set
                                        if (shape.isLocked === undefined) {
                                            shape.isLocked = false
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
        const exportName = `props-${Math.round(+new Date() / 1000).toString().slice(5)}`
        exportAs(Array.from(editor.getCurrentPageShapeIds()), 'json' as any, exportName)
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

    const testIncompleteData = (editor: Editor) => {
        // Test function to demonstrate fixing incomplete shape data
        const testData = {
            documents: [
                { id: "document:document", typeName: "document", type: undefined },
                { id: "page:dt0NcJ3xCkZPVsyvmA6_5", typeName: "page", type: undefined },
                { id: "shape:IhBti_jyuXFfGeoEhTzst", type: "geo", typeName: "shape" },
                { id: "shape:dif5y2vQfGRZMlWRC1GWv", type: "VideoChat", typeName: "shape" },
                { id: "shape:n15Zcn2dC1K82I8NVueiH", type: "geo", typeName: "shape" }
            ]
        };
        
        console.log('Testing incomplete data fix:', testData);
        
        // Simulate the import process
        const pageId = testData.documents.find((doc: any) => doc.typeName === 'page')?.id || 'page:default';
        const shapes = testData.documents
            .filter((doc: any) => doc.typeName === 'shape')
            .map((doc: any) => {
                const fixedShape = { ...doc };
                
                // Add missing required properties
                if (!fixedShape.x) fixedShape.x = Math.random() * 400 + 50;
                if (!fixedShape.y) fixedShape.y = Math.random() * 300 + 50;
                if (!fixedShape.rotation) fixedShape.rotation = 0;
                if (!fixedShape.isLocked) fixedShape.isLocked = false;
                if (!fixedShape.opacity) fixedShape.opacity = 1;
                if (!fixedShape.meta) fixedShape.meta = {};
                if (!fixedShape.parentId) fixedShape.parentId = pageId;
                
                // Add shape-specific properties
                if (fixedShape.type === 'geo') {
                    if (!fixedShape.w) fixedShape.w = 100;
                    if (!fixedShape.h) fixedShape.h = 100;
                    if (!fixedShape.geo) fixedShape.geo = 'rectangle';
                    if (!fixedShape.insets) fixedShape.insets = [0, 0, 0, 0];
                    if (!fixedShape.props) fixedShape.props = {
                        geo: 'rectangle',
                        w: fixedShape.w,
                        h: fixedShape.h,
                        color: 'black',
                        fill: 'none',
                        dash: 'draw',
                        size: 'm',
                        font: 'draw',
                        align: 'middle',
                        verticalAlign: 'middle',
                        growY: 0,
                        url: '',
                        scale: 1,
                        labelColor: 'black',
                        richText: [] as any
                    };
                } else if (fixedShape.type === 'VideoChat') {
                    if (!fixedShape.w) fixedShape.w = 200;
                    if (!fixedShape.h) fixedShape.h = 150;
                    if (!fixedShape.props) fixedShape.props = {
                        w: fixedShape.w,
                        h: fixedShape.h,
                        color: 'black',
                        fill: 'none',
                        dash: 'draw',
                        size: 'm',
                        font: 'draw'
                    };
                }
                
                return fixedShape;
            });
        
        console.log('Fixed shapes:', shapes);
        
        // Import the fixed data
        const contentToImport: TLContent = {
            rootShapeIds: shapes.map((shape: any) => shape.id).filter(Boolean),
            schema: { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
            shapes: shapes,
            bindings: [],
            assets: [],
        };
        
        try {
            editor.putContentOntoCurrentPage(contentToImport, { select: true });
            console.log('Successfully imported test data!');
        } catch (error) {
            console.error('Failed to import test data:', error);
        }
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
                id="test-incomplete"
                label="Test Incomplete Data Fix"
                icon="external-link"
                readonlyOk
                onSelect={() => testIncompleteData(editor)}
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