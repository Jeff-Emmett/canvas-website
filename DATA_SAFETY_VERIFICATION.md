# Data Safety Verification: TldrawDurableObject → AutomergeDurableObject Migration

## Overview

This document verifies that the migration from `TldrawDurableObject` to `AutomergeDurableObject` is safe and will not result in data loss.

## R2 Bucket Configuration ✅

### Production Environment
- **Bucket Binding**: `TLDRAW_BUCKET`
- **Bucket Name**: `jeffemmett-canvas`
- **Storage Path**: `rooms/${roomId}`
- **Configuration**: `wrangler.toml` lines 30-32

### Development Environment
- **Bucket Binding**: `TLDRAW_BUCKET`
- **Bucket Name**: `jeffemmett-canvas-preview`
- **Storage Path**: `rooms/${roomId}`
- **Configuration**: `wrangler.toml` lines 72-74

## Data Storage Architecture

### Where Data is Stored

1. **Document Data (R2 Storage)** ✅
   - **Location**: R2 bucket at path `rooms/${roomId}`
   - **Format**: JSON document containing the full board state
   - **Persistence**: Permanent storage, independent of Durable Object instances
   - **Access**: Both `TldrawDurableObject` and `AutomergeDurableObject` use the same R2 bucket and path

2. **Room ID (Durable Object Storage)** ⚠️
   - **Location**: Durable Object's internal storage (`ctx.storage`)
   - **Purpose**: Cached room ID for the Durable Object instance
   - **Recovery**: Can be re-initialized from URL path (`/connect/:roomId`)

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    R2 Bucket (TLDRAW_BUCKET)                 │
│                                                               │
│  rooms/room-123  ←─── Document Data (PERSISTENT)            │
│  rooms/room-456  ←─── Document Data (PERSISTENT)            │
│  rooms/room-789  ←─── Document Data (PERSISTENT)            │
└─────────────────────────────────────────────────────────────┘
                          ▲                    ▲
                          │                    │
        ┌─────────────────┘                    └─────────────────┐
        │                                                           │
┌───────┴────────┐                                    ┌─────────────┴────────┐
│ TldrawDurable  │                                    │ AutomergeDurable     │
│ Object         │                                    │ Object               │
│ (DEPRECATED)   │                                    │ (ACTIVE)             │
└────────────────┘                                    └──────────────────────┘
        │                                                           │
        └─────────────────── Both read/write ─────────────────────┘
                    to the same R2 location
```

## Migration Safety Guarantees

### ✅ No Data Loss Risk

1. **R2 Data is Independent**
   - Document data is stored in R2, not in Durable Object storage
   - R2 data persists even when Durable Object instances are deleted
   - Both classes use the same R2 bucket (`TLDRAW_BUCKET`) and path (`rooms/${roomId}`)

2. **Stub Class Ensures Compatibility**
   - `TldrawDurableObject` extends `AutomergeDurableObject`
   - Uses the same R2 bucket and storage path
   - Existing instances can access their data during migration

3. **Room ID Recovery**
   - `roomId` is passed in the URL path (`/connect/:roomId`)
   - Can be re-initialized if Durable Object storage is lost
   - Code handles missing `roomId` by reading from URL (see `AutomergeDurableObject.ts` lines 43-49)

4. **Automatic Format Conversion**
   - `AutomergeDurableObject` handles multiple data formats:
     - Automerge Array Format: `[{ state: {...} }, ...]`
     - Store Format: `{ store: { "recordId": {...}, ... }, schema: {...} }`
     - Old Documents Format: `{ documents: [{ state: {...} }, ...] }`
   - Conversion preserves all data, including custom shapes and records

### Migration Process

1. **Deployment with Stub**
   - `TldrawDurableObject` stub class is exported
   - Cloudflare recognizes the class exists
   - Existing instances can continue operating

2. **Delete-Class Migration**
   - Migration tag `v2` with `deleted_classes = ["TldrawDurableObject"]`
   - Cloudflare will delete Durable Object instances (not R2 data)
   - R2 data remains untouched

3. **Data Access After Migration**
   - New `AutomergeDurableObject` instances can access the same R2 data
   - Same bucket (`TLDRAW_BUCKET`) and path (`rooms/${roomId}`)
   - Automatic format conversion ensures compatibility

## Verification Checklist

- [x] R2 bucket binding is correctly configured (`TLDRAW_BUCKET`)
- [x] Both production and dev environments have R2 buckets configured
- [x] `AutomergeDurableObject` uses `env.TLDRAW_BUCKET`
- [x] Storage path is consistent (`rooms/${roomId}`)
- [x] Stub class extends `AutomergeDurableObject` (same R2 access)
- [x] Migration includes `delete-class` for `TldrawDurableObject`
- [x] Code handles missing `roomId` by reading from URL
- [x] Format conversion logic preserves all data types
- [x] Custom shapes and records are preserved during conversion

## Testing Recommendations

1. **Before Migration**
   - Verify R2 bucket contains expected room data
   - List rooms: `wrangler r2 object list TLDRAW_BUCKET --prefix "rooms/"`
   - Check a sample room's format

2. **After Migration**
   - Verify rooms are still accessible
   - Check that data format is correctly converted
   - Verify custom shapes and records are preserved
   - Monitor worker logs for conversion statistics

3. **Data Integrity Checks**
   - Shape count matches before/after
   - Custom shapes (ObsNote, Holon, etc.) have all properties
   - Custom records (obsidian_vault, etc.) are present
   - No validation errors in console

## Conclusion

✅ **The migration is safe and will not result in data loss.**

- All document data is stored in R2, which is independent of Durable Object instances
- Both classes use the same R2 bucket and storage path
- The stub class ensures compatibility during migration
- Format conversion logic preserves all data types
- Room IDs can be recovered from URL paths if needed

The only data that will be lost is the cached `roomId` in Durable Object storage, which can be easily re-initialized from the URL path.

