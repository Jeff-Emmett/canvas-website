# Testing R2 Data Conversion

This guide helps you test the data conversion from old tldraw sync format to new automerge sync format using actual data from your R2 bucket.

## Overview

The conversion system handles three data formats:
1. **Automerge Array Format**: `[{ state: {...} }, ...]`
2. **Store Format**: `{ store: { "recordId": {...}, ... }, schema: {...} }` (already converted)
3. **Old Documents Format**: `{ documents: [{ state: {...} }, ...] }` (legacy tldraw sync)

## Testing Steps

### 1. Identify Test Rooms

First, identify rooms in your R2 bucket that use the old format:

```bash
# List all rooms in R2
# You can use wrangler CLI or Cloudflare dashboard
wrangler r2 object list TLDRAW_BUCKET --prefix "rooms/"
```

### 2. Check Data Format

For each room, check its format:

```typescript
// Example: Check a room's format
const roomId = "your-room-id"
const doc = await r2.get(`rooms/${roomId}`)
const data = await doc.json()

// Check format
if (Array.isArray(data)) {
  console.log("Format: Automerge Array")
} else if (data.store) {
  console.log("Format: Store Format (already converted)")
} else if (data.documents) {
  console.log("Format: Old Documents Format (needs conversion)")
} else {
  console.log("Format: Unknown")
}
```

### 3. Test Conversion

The conversion happens automatically when a room is loaded. To test:

1. **Load the room in your app** - The `AutomergeDurableObject.getDocument()` method will automatically detect and convert the format
2. **Check the logs** - Look for conversion statistics in the worker logs:
   - `📊 Automerge to Store conversion statistics`
   - `📊 Documents to Store migration statistics`
   - `📊 Shape migration statistics`

### 4. Verify Data Integrity

After conversion, verify:

1. **All shapes are present**: Check that shape count matches
2. **Custom shapes preserved**: Verify ObsNote, Holon, etc. have all their properties
3. **Custom records preserved**: Check that obsidian_vault records are present
4. **No validation errors**: Shapes should render without errors

## Expected Log Output

When a room is converted, you should see logs like:

```
Converting Automerge document format to store format for room abc123
📊 Automerge to Store conversion statistics: {
  total: 150,
  converted: 148,
  skipped: 2,
  errors: 0,
  storeKeys: 148,
  customRecordCount: 1,
  customRecordIds: ['obsidian_vault:test'],
  errorCount: 0
}
✅ Verified 1 custom records preserved during conversion

🔄 Server-side: Starting shape migration for room abc123
📊 Shape migration statistics: {
  total: 120,
  migrated: 45,
  skipped: 75,
  errors: 0,
  shapeTypes: { geo: 50, arrow: 20, ObsNote: 10, ... },
  customShapesCount: 10,
  customShapeIds: ['shape:obs1', 'shape:holon1', ...],
  errorCount: 0
}
✅ Verified 10 custom shapes preserved during migration
```

## Manual Testing Script

You can create a test script to verify conversion:

```typescript
// test-r2-room.ts
import { AutomergeDurableObject } from './worker/AutomergeDurableObject'

async function testRoomConversion(roomId: string) {
  // This would need to be run in a Cloudflare Worker context
  // or use wrangler dev to test locally
  
  const env = {
    TLDRAW_BUCKET: yourR2Bucket
  }
  
  // Create a mock Durable Object state
  const ctx = {
    storage: {
      get: async (key: string) => roomId,
      put: async (key: string, value: any) => {}
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => await fn()
  }
  
  const do = new AutomergeDurableObject(ctx as any, env as any)
  
  // Load and convert
  const doc = await do.getDocument()
  
  // Verify
  console.log('Conversion complete:', {
    storeKeys: Object.keys(doc.store).length,
    shapes: Object.values(doc.store).filter((r: any) => r.typeName === 'shape').length,
    customRecords: Object.values(doc.store).filter((r: any) => 
      r.id && typeof r.id === 'string' && r.id.startsWith('obsidian_vault:')
    ).length
  })
}
```

## Common Issues and Solutions

### Issue: Records are skipped during conversion

**Cause**: Missing required fields (id, typeName, state)

**Solution**: Check the error details in logs. The conversion will skip invalid records but log warnings.

### Issue: Custom shapes missing properties

**Cause**: Shape migration may have failed

**Solution**: Check shape migration logs. Custom shape props should be preserved automatically.

### Issue: Custom records (obsidian_vault) missing

**Cause**: They were filtered out during conversion

**Solution**: This shouldn't happen - custom records are preserved. Check logs for `customRecordCount`.

## Validation Checklist

After conversion, verify:

- [ ] All shapes are present (count matches)
- [ ] Custom shapes (ObsNote, Holon, etc.) have all properties
- [ ] Custom records (obsidian_vault) are preserved
- [ ] No validation errors when loading the room
- [ ] Shapes render correctly in the UI
- [ ] All text content is preserved
- [ ] All metadata is preserved

## Rollback Plan

If conversion fails:

1. The original data in R2 is **not modified** until the first save
2. You can restore from backup if needed
3. Check worker logs for specific errors
4. The conversion creates a new document if it fails, so original data is safe

## Next Steps

1. Test with a few sample rooms first
2. Monitor logs for any warnings or errors
3. Verify data integrity after conversion
4. Once confident, the conversion will happen automatically for all rooms
