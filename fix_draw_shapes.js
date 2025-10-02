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
        if (doc.state && doc.state.typeName === 'shape' && doc.state.type === 'draw') {
            const segments = doc.state.props?.segments;
            if (segments) {
                // Check each segment for single-point issues
                const validSegments = segments.filter(segment => {
                    if (segment.points && segment.points.length === 1) {
                        // For single-point segments, we have two options:
                        // 1. Remove the segment entirely
                        // 2. Add a second point to make it valid
                        
                        // Let's remove single-point segments as they're likely incomplete
                        removedCount++;
                        return false;
                    }
                    return true;
                });
                
                if (validSegments.length === 0) {
                    // If no valid segments remain, remove the entire shape
                    removedCount++;
                    return false;
                } else {
                    // Update the segments
                    doc.state.props.segments = validSegments;
                    fixedCount++;
                }
            }
        }
        return true;
    });
    
    // Write the fixed data
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    
    console.log(`Successfully fixed draw shapes:`);
    console.log(`- Fixed shapes: ${fixedCount}`);
    console.log(`- Removed invalid shapes: ${removedCount}`);
    console.log(`- Output saved to: ${outputFile}`);
    
} catch (error) {
    console.error('Error fixing draw shapes:', error.message);
    process.exit(1);
}






