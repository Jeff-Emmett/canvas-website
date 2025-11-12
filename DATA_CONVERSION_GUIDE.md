# Data Conversion Guide: TLDraw Sync to Automerge Sync

This guide explains the data conversion process from the old TLDraw sync format to the new Automerge sync format, and how to verify the conversion is working correctly.

## Data Format Changes

### Old Format (TLDraw Sync)
```json
{
  "documents": [
    { "state": { "id": "shape:abc123", "typeName": "shape", ... } },
    { "state": { "id": "page:page", "typeName": "page", ... } }
  ],
  "schema": { ... }
}
```

### New Format (Automerge Sync)
```json
{
  "store": {
    "shape:abc123": { "id": "shape:abc123", "typeName": "shape", ... },
    "page:page": { "id": "page:page", "typeName": "page", ... }
  },
  "schema": { ... }
}
```

## Conversion Process

The conversion happens automatically when a document is loaded from R2. The `AutomergeDurableObject.getDocument()` method detects the format and converts it:

1. **Automerge Array Format**: Detected by `Array.isArray(rawDoc)`
   - Converts via `convertAutomergeToStore()`
   - Extracts `record.state` and uses it as the store record

2. **Store Format**: Detected by `rawDoc.store` existing
   - Already in correct format, uses as-is
   - No conversion needed

3. **Old Documents Format**: Detected by `rawDoc.documents` existing but no `store`
   - Converts via `migrateDocumentsToStore()`
   - Maps `doc.state.id` to `store[doc.state.id] = doc.state`

4. **Shape Property Migration**: After format conversion, all shapes are migrated via `migrateShapeProperties()`
   - Ensures required properties exist (x, y, rotation, isLocked, opacity, meta, index)
   - Moves `w`/`h` from top-level to `props` for geo shapes
   - Fixes richText structure
   - Preserves custom shape properties

## Validation & Error Handling

The conversion functions now include comprehensive validation:

- **Missing state.id**: Skipped with warning
- **Missing state.typeName**: Skipped with warning
- **Null/undefined records**: Skipped with warning
- **Invalid ID types**: Skipped with warning
- **Malformed shapes**: Fixed during shape migration

All validation errors are logged with detailed statistics.

## Custom Records

Custom record types (like `obsidian_vault:`) are preserved during conversion:
- Tracked during conversion
- Verified in logs
- Preserved in the final store

## Custom Shapes

Custom shape types are preserved:
- ObsNote
- Holon
- FathomMeetingsBrowser
- HolonBrowser
- LocationShare
- ObsidianBrowser

All custom shape properties are preserved during migration.

## Logging

The conversion process logs comprehensive statistics:

```
📊 Automerge to Store conversion statistics:
  - total: Number of records processed
  - converted: Number successfully converted
  - skipped: Number skipped (invalid)
  - errors: Number of errors
  - customRecordCount: Number of custom records
  - errorCount: Number of error details
```

Similar statistics are logged for:
- Documents to Store migration
- Shape property migration

## Testing

### Test Edge Cases

Run the test script to verify edge case handling:

```bash
npx tsx test-data-conversion.ts
```

This tests:
- Missing state.id
- Missing state.typeName
- Null/undefined records
- Missing state property
- Invalid ID types
- Custom records
- Malformed shapes
- Empty documents
- Mixed valid/invalid records

### Test with Real R2 Data

To test with actual R2 data:

1. **Check Worker Logs**: When a document is loaded, check the Cloudflare Worker logs for conversion statistics
2. **Verify Data Integrity**: After conversion, verify:
   - All shapes appear correctly
   - All properties are preserved
   - No validation errors in TLDraw
   - Custom records are present
   - Custom shapes work correctly

3. **Monitor Conversion**: Watch for:
   - High skip counts (may indicate data issues)
   - Errors during conversion
   - Missing custom records
   - Shape migration issues

## Migration Checklist

- [x] Format detection (Automerge array, store format, old documents format)
- [x] Validation for malformed records
- [x] Error handling and logging
- [x] Custom record preservation
- [x] Custom shape preservation
- [x] Shape property migration
- [x] Comprehensive logging
- [x] Edge case testing

## Troubleshooting

### High Skip Counts
If many records are being skipped:
1. Check error details in logs
2. Verify data format in R2
3. Check for missing required fields

### Missing Custom Records
If custom records are missing:
1. Check logs for custom record count
2. Verify records start with expected prefix (e.g., `obsidian_vault:`)
3. Check if records were filtered during conversion

### Shape Validation Errors
If shapes have validation errors:
1. Check shape migration logs
2. Verify required properties are present
3. Check for w/h in wrong location (should be in props for geo shapes)

## Backward Compatibility

The conversion is backward compatible:
- Old format documents are automatically converted
- New format documents are used as-is
- No data loss during conversion
- All properties are preserved

## Future Improvements

Potential improvements:
1. Add migration flag to track converted documents
2. Add backup before conversion
3. Add rollback mechanism
4. Add conversion progress tracking for large documents

