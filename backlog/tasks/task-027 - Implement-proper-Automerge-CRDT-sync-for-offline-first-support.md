---
id: task-027
title: Implement proper Automerge CRDT sync for offline-first support
status: In Progress
assignee: []
created_date: '2025-12-04 21:06'
updated_date: '2025-12-25 23:59'
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

### 2025-12-05: Data Safety Mitigations Added

Added safety mitigations for Automerge format conversion (commit f8092d8 on feature/google-export):

**Pre-conversion backups:**
- Before any format migration, raw document backed up to R2
- Location: `pre-conversion-backups/{roomId}/{timestamp}_{formatType}.json`

**Conversion threshold guards:**
- 10% loss threshold: Conversion aborts if too many records would be lost
- 5% shape loss warning: Emits warning if shapes are lost

**Unknown format handling:**
- Unknown formats backed up before creating empty document
- Raw document keys logged for investigation

**Also fixed:**
- Keyboard shortcuts dialog error (tldraw i18n objects)
- Google Workspace integration now first in Settings > Integrations

Fixed persistence issue: Modified handlePeerDisconnect to flush pending saves and updated client-side merge strategy in useAutomergeSyncRepo.ts to properly bootstrap from server when local is empty while preserving offline changes

Fixed TypeScript errors in networking module: corrected useSession->useAuth import, added myConnections to NetworkGraph type, fixed GraphEdge type alignment between client and worker

## Investigation Summary (2025-12-25)

**Current Architecture:**
- Worker: CRDT sync enabled with SyncManager
- Client: CloudflareNetworkAdapter with binary message support
- Storage: IndexedDB for offline persistence

**Issue:** Automerge Repo not generating sync messages when `handle.change()` is called. JSON sync workaround in use.

**Suspected Root Cause:**
The Automerge Repo requires proper peer discovery. The adapter emits `peer-candidate` for server, but Repo may not be establishing proper sync relationship.

**Remaining ACs:**
- #2 Client-server binary protocol (partially working - needs Repo to generate messages)
- #3 Deletions persist (needs testing once binary sync works)
- #4 Concurrent edits merge (needs testing)
- #6 All functionality works (JSON workaround is functional)

**Next Steps:**
1. Add debug logging to adapter.send() to verify Repo calls
2. Check sync states between local peer and server
3. May need to manually trigger sync or fix Repo configuration

Dec 25: Added debug logging and peer-candidate re-emission fix to CloudflareAdapter.ts

Key fix: Re-emit peer-candidate after documentId is set to trigger Repo sync (timing issue)

Committed and pushed to dev branch - needs testing to verify binary sync is now working
<!-- SECTION:NOTES:END -->
