import fs from 'fs';

const inputFile = '/home/jeffe/Github/canvas-website/src/shapes/mycofi_room.json';
const outputFile = '/home/jeffe/Github/canvas-website/src/shapes/mycofi_room_fixed.json';

try {
    // Read the JSON file
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    let fixedCount = 0;
    let removedCount = 0;
    
    // Process all documents
    data.documents = data.documents.filter(doc => {
        if (doc.state && doc.state.typeName === 'shape') {
            const state = doc.state;
            const x = state.x || 0;
            const y = state.y || 0;
            
            // Check for extremely large coordinates that could cause hit testing issues
            if (Math.abs(x) > 100000 || Math.abs(y) > 100000 || 
                !isFinite(x) || !isFinite(y)) {
                
                console.log(`Fixing shape ${state.id} with extreme position: (${x}, ${y})`);
                
                // Reset to a reasonable position (center of canvas)
                state.x = 0;
                state.y = 0;
                fixedCount++;
            }
            
            // Check for extremely large dimensions
            if (state.props) {
                const w = state.props.w || 0;
                const h = state.props.h || 0;
                
                if (w > 100000 || h > 100000 || !isFinite(w) || !isFinite(h)) {
                    console.log(`Fixing shape ${state.id} with extreme dimensions: ${w}x${h}`);
                    
                    // Reset to reasonable default dimensions
                    state.props.w = Math.min(w, 200);
                    state.props.h = Math.min(h, 200);
                    fixedCount++;
                }
            }
            
            // Check for invalid rotation values
            if (state.rotation !== undefined && !isFinite(state.rotation)) {
                console.log(`Fixing shape ${state.id} with invalid rotation: ${state.rotation}`);
                state.rotation = 0;
                fixedCount++;
            }
            
            // Check for draw shapes with problematic segments
            if (state.type === 'draw' && state.props?.segments) {
                const validSegments = state.props.segments.filter(segment => {
                    if (segment.points && segment.points.length === 1) {
                        // Remove single-point segments as they can cause hit testing issues
                        return false;
                    }
                    return true;
                });
                
                if (validSegments.length === 0) {
                    // If no valid segments remain, remove the entire shape
                    console.log(`Removing shape ${state.id} with no valid segments`);
                    removedCount++;
                    return false;
                } else if (validSegments.length !== state.props.segments.length) {
                    // Update the segments
                    state.props.segments = validSegments;
                    fixedCount++;
                }
            }
        }
        return true;
    });
    
    // Write the fixed data
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    
    console.log(`\\nSuccessfully fixed board data:`);
    console.log(`- Fixed shapes: ${fixedCount}`);
    console.log(`- Removed invalid shapes: ${removedCount}`);
    console.log(`- Output saved to: ${outputFile}`);
    
} catch (error) {
    console.error('Error fixing board data:', error.message);
    process.exit(1);
}






