# Offline Storage Feasibility Assessment


Summary
Difficulty: Medium — Feasible with Automerge's built-in support.
Why it's feasible
Automerge Repo supports storage adapters — you can add an IndexedDB adapter alongside the network adapter
CRDT merging — Automerge handles conflict resolution automatically
Existing architecture — minimal changes needed; mainly adding a storage adapter
What needs to be done
Add IndexedDB storage adapter (easy)
Install/create an IndexedDB storage adapter
Add it to the Repo configuration
Fix document ID consistency (important)
Currently uses repo.create() which generates new IDs each time
Need to use repo.find(roomId) or store a roomId → documentId mapping
This is the main blocker for local storage persistence
Handle online/offline transitions (medium)
Listen for network status changes
Trigger sync when coming back online
The existing network adapter already handles reconnection
Update initialization logic (medium)
Load from IndexedDB first (instant offline access)
Then sync with server when online
Automerge will automatically merge changes
Estimated effort
Research & setup: 1-2 hours
Implementation: 4-6 hours
Testing: 2-3 hours
Total: ~1 day of focused work
Main challenge
The document ID consistency issue. The code comment says "We can't use repo.find() with a custom ID because Automerge requires specific document ID formats" — this needs to be resolved. Options:
Store a mapping of roomId → documentId in IndexedDB
Use a deterministic algorithm to convert roomId to a valid Automerge document ID
Use Automerge's document ID generation but persist the mapping
Benefits
Instant offline access — no loading spinners
Automatic conflict resolution — Automerge handles merging
Better UX — works seamlessly offline
Resilience — works even if server is temporarily unavailable
I've created a detailed feasibility document at OFFLINE_STORAGE_FEASIBILITY.md with implementation steps, code examples, and considerations.
Should I start implementing this, or do you want to review the feasibility document first?


## Summary

**Difficulty: Medium** - The implementation is straightforward thanks to Automerge's built-in support for storage adapters, but requires careful integration with the existing sync architecture.

## Current Architecture

1. **Client-side**: Uses `@automerge/automerge-repo` with `CloudflareNetworkAdapter` for WebSocket sync
2. **Server-side**: `AutomergeDurableObject` stores documents in R2 and handles WebSocket connections
3. **Persistence flow**: 
   - Client saves to worker via POST `/room/:roomId`
   - Worker persists to R2 (throttled to every 2 seconds)
   - Client loads initial data from server via GET `/room/:roomId`

## What's Needed

### 1. Add IndexedDB Storage Adapter (Easy)

Automerge Repo supports storage adapters out of the box. You'll need to:

- Install `@automerge/automerge-repo-storage-indexeddb` (if available) or create a custom IndexedDB adapter
- Add the storage adapter to the Repo configuration alongside the network adapter
- The Repo will automatically persist document changes to IndexedDB

**Code changes needed:**
```typescript
// In useAutomergeSyncRepo.ts
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"

const [repo] = useState(() => {
  const adapter = new CloudflareNetworkAdapter(workerUrl, roomId, applyJsonSyncData)
  const storageAdapter = new IndexedDBStorageAdapter() // Add this
  return new Repo({
    network: [adapter],
    storage: [storageAdapter] // Add this
  })
})
```

### 2. Load from Local Storage on Startup (Medium)

Modify the initialization logic to:
- Check IndexedDB for existing document data
- Load from IndexedDB first (for instant offline access)
- Then sync with server when online
- Automerge will automatically merge local and remote changes

**Code changes needed:**
```typescript
// In useAutomergeSyncRepo.ts - modify initializeHandle
const initializeHandle = async () => {
  // Check if document exists in IndexedDB first
  const localDoc = await repo.find(roomId) // This will load from IndexedDB if available
  
  // Then sync with server (if online)
  if (navigator.onLine) {
    // Existing server sync logic
  }
}
```

### 3. Handle Online/Offline Transitions (Medium)

- Detect network status changes
- When coming online, ensure sync happens
- The existing `CloudflareNetworkAdapter` already handles reconnection, but you may want to add explicit sync triggers

**Code changes needed:**
```typescript
// Add network status listener
useEffect(() => {
  const handleOnline = () => {
    console.log('🌐 Back online - syncing with server')
    // Trigger sync - Automerge will handle merging automatically
    if (handle) {
      // The network adapter will automatically reconnect and sync
    }
  }
  
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [handle])
```

### 4. Document ID Consistency (Important)

Currently, the code creates a new document handle each time (`repo.create()`). For local storage to work properly, you need:
- Consistent document IDs per room
- The challenge: Automerge requires specific document ID formats (like `automerge:xxxxx`)
- **Solution options:**
  1. Use `repo.find()` with a properly formatted Automerge document ID (derive from roomId)
  2. Store a mapping of roomId → documentId in IndexedDB
  3. Use a deterministic way to generate document IDs from roomId

**Code changes needed:**
```typescript
// Option 1: Generate deterministic Automerge document ID from roomId
const documentId = `automerge:${roomId}` // May need proper formatting
const handle = repo.find(documentId) // This will load from IndexedDB or create new

// Option 2: Store mapping in IndexedDB
const storedMapping = await getDocumentIdMapping(roomId)
const documentId = storedMapping || generateNewDocumentId()
const handle = repo.find(documentId)
await saveDocumentIdMapping(roomId, documentId)
```

**Note**: The current code comment says "We can't use repo.find() with a custom ID because Automerge requires specific document ID formats" - this needs to be resolved. You may need to:
- Use Automerge's document ID generation but store the mapping
- Or use a deterministic algorithm to convert roomId to valid Automerge document ID format

## Benefits

1. **Instant Offline Access**: Users can immediately see and edit their data without waiting for server response
2. **Automatic Merging**: Automerge's CRDT nature means local and remote changes merge automatically without conflicts
3. **Better UX**: No loading spinners when offline - data is instantly available
4. **Resilience**: Works even if server is temporarily unavailable

## Challenges & Considerations

### 1. Storage Quota Limits
- IndexedDB has browser-specific limits (typically 50% of disk space)
- Large documents could hit quota limits
- **Solution**: Monitor storage usage and implement cleanup for old documents

### 2. Document ID Management
- Need to ensure consistent document IDs per room
- Current code uses `repo.create()` which generates new IDs
- **Solution**: Use `repo.find(roomId)` with a consistent ID format

### 3. Initial Load Strategy
- Should load from IndexedDB first (fast) or server first (fresh)?
- **Recommendation**: Load from IndexedDB first for instant UI, then sync with server in background

### 4. Conflict Resolution
- Automerge handles this automatically, but you may want to show users when their offline changes were merged
- **Solution**: Use Automerge's change tracking to show merge notifications

### 5. Storage Adapter Availability
- Need to verify if `@automerge/automerge-repo-storage-indexeddb` exists
- If not, you'll need to create a custom adapter (still straightforward)

## Implementation Steps

1. **Research**: Check if `@automerge/automerge-repo-storage-indexeddb` package exists
2. **Install**: Add storage adapter package or create custom adapter
3. **Modify Repo Setup**: Add storage adapter to Repo configuration
4. **Update Document Loading**: Use `repo.find()` instead of `repo.create()` for consistent IDs
5. **Add Network Detection**: Listen for online/offline events
6. **Test**: Verify offline editing works and syncs correctly when back online
7. **Handle Edge Cases**: Storage quota, document size limits, etc.

## Estimated Effort

- **Research & Setup**: 1-2 hours
- **Implementation**: 4-6 hours
- **Testing**: 2-3 hours
- **Total**: ~1 day of focused work

## Code Locations to Modify

1. `src/automerge/useAutomergeSyncRepo.ts` - Main sync hook (add storage adapter, modify initialization)
2. `src/automerge/CloudflareAdapter.ts` - Network adapter (may need minor changes for offline detection)
3. Potentially create: `src/automerge/IndexedDBStorageAdapter.ts` - If custom adapter needed

## Conclusion

This is a **medium-complexity** feature that's very feasible. Automerge's architecture is designed for this exact use case, and the main work is:
1. Adding the storage adapter (straightforward)
2. Ensuring consistent document IDs (important fix)
3. Handling online/offline transitions (moderate complexity)

The biggest benefit is that Automerge's CRDT nature means you don't need to write complex merge logic - it handles conflict resolution automatically.

---

## Related: Google Data Sovereignty

Beyond canvas document storage, we also support importing and securely storing Google Workspace data locally. See **[docs/GOOGLE_DATA_SOVEREIGNTY.md](./docs/GOOGLE_DATA_SOVEREIGNTY.md)** for the complete architecture covering:

- **Gmail** - Import and encrypt emails locally
- **Drive** - Import and encrypt documents locally
- **Photos** - Import thumbnails with on-demand full resolution
- **Calendar** - Import and encrypt events locally

Key principles:
1. **Local-first**: All data stored in encrypted IndexedDB
2. **User-controlled encryption**: Keys derived from WebCrypto auth, never leave browser
3. **Selective sharing**: Choose what to share to canvas boards
4. **Optional R2 backup**: Encrypted cloud backup (you hold the keys)

This builds on the same IndexedDB + Automerge foundation described above.

