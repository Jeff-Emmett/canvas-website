---
id: task-027
title: Implement proper Automerge CRDT sync for offline-first support
status: In Progress
assignee: []
created_date: '2025-12-04 21:06'
updated_date: '2025-12-05 03:53'
labels:
  - offline-sync
  - crdt
  - automerge
  - architecture
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current "last-write-wins" full document replacement with proper Automerge CRDT sync protocol. This ensures deletions are preserved across offline/reconnect scenarios and concurrent edits merge correctly.

Current problem: Server does `currentDoc.store = { ...newDoc.store }` which is full replacement, not merge. This causes "ghost resurrection" of deleted shapes when offline clients reconnect.

Solution: Use Automerge's native binary sync protocol with proper CRDT merge semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server stores Automerge binary documents in R2 (not JSON)
- [ ] #2 Client-server communication uses Automerge sync protocol (binary messages)
- [ ] #3 Deletions persist correctly when offline client reconnects
- [ ] #4 Concurrent edits merge deterministically without data loss
- [x] #5 Existing JSON rooms are migrated to Automerge format
- [ ] #6 All existing functionality continues to work
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress Update (2025-12-04)

### Implemented:
1. **automerge-init.ts** - WASM initialization for Cloudflare Workers using slim variant
2. **automerge-sync-manager.ts** - Core CRDT sync manager with proper merge semantics
3. **automerge-r2-storage.ts** - Binary R2 storage for Automerge documents
4. **wasm.d.ts** - TypeScript declarations for WASM imports

### Integration Fixes:
- `getDocument()` now returns CRDT document when sync manager is active
- `handleBinaryMessage()` syncs `currentDoc` with CRDT state after updates
- `schedulePersistToR2()` delegates to sync manager when CRDT mode is enabled
- Fixed CloudflareAdapter TypeScript errors (peer-candidate peerMetadata)

### Current State:
- `useCrdtSync = true` flag is enabled
- Worker compiles and runs successfully
- JSON sync fallback works for backward compatibility
- Binary sync infrastructure is in place
- Needs production testing with multi-client sync and delete operations

**Merged to dev branch (2025-12-05):**
- All Automerge CRDT infrastructure merged
- WASM initialization, sync manager, R2 storage
- Integration fixes for getDocument(), handleBinaryMessage(), schedulePersistToR2()
- Ready for production testing
<!-- SECTION:NOTES:END -->
