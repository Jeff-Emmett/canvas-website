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
                    
                    // Check if it's a worker export format (has documents array)
                    if (jsonData.documents && Array.isArray(jsonData.documents)) {
                        console.log('Detected worker export format with', jsonData.documents.length, 'documents')
                        
                        // Convert worker export format to TLContent format
                        const shapes = jsonData.documents
                            .filter((doc: any) => doc.state?.typeName === 'shape')
                            .map((doc: any) => doc.state)
                        
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
                    } else if (jsonData.shapes && Array.isArray(jsonData.shapes)) {
                        console.log('Detected standard TLContent format with', jsonData.shapes.length, 'shapes')
                        // Already in TLContent format, but ensure all required properties exist
                        contentToImport = {
                            rootShapeIds: jsonData.rootShapeIds || jsonData.shapes.map((shape: any) => shape.id).filter(Boolean),
                            schema: jsonData.schema || { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
                            shapes: jsonData.shapes,
                            bindings: jsonData.bindings || [],
                            assets: jsonData.assets || [],
                        }
                    } else {
                        console.log('Detected unknown format, attempting fallback')
                        // Try to extract shapes from any other format
                        contentToImport = {
                            rootShapeIds: jsonData.rootShapeIds || [],
                            schema: jsonData.schema || { schemaVersion: 1, storeVersion: 4, recordVersions: {} },
                            shapes: jsonData.shapes || [],
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
        </DefaultMainMenu>
    )
}