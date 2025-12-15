---
id: task-051
title: Offline storage and cold reload from offline state
status: In Progress
assignee: []
created_date: '2025-12-15 04:58'
updated_date: '2025-12-15 04:58'
labels:
  - feature
  - offline
  - storage
  - IndexedDB
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement offline storage fallback so that when a browser reloads without network connectivity, it automatically loads from local IndexedDB storage and renders the last known state of the board for that user.

## Implementation Summary (Completed)

### Changes Made:
1. **Board.tsx** - Updated render condition to allow rendering when offline with local data (`isOfflineWithLocalData` flag)
2. **useAutomergeStoreV2** - Added `isNetworkOnline` parameter and offline fast path that immediately loads records from Automerge doc without waiting for network patches
3. **useAutomergeSyncRepo** - Passes `isNetworkOnline` to `useAutomergeStoreV2`
4. **ConnectionStatusIndicator** - Updated messaging to clarify users are viewing locally cached canvas when offline

### How It Works:
1. useAutomergeSyncRepo detects no network and loads data from IndexedDB
2. useAutomergeStoreV2 receives handle with local data and detects offline state
3. Offline Fast Path immediately loads records into TLDraw store
4. Board.tsx renders with local data
5. ConnectionStatusIndicator shows "Working Offline - Viewing locally saved canvas"
6. When back online, Automerge automatically syncs via CRDT merge
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Board renders from local IndexedDB when browser reloads offline
- [ ] #2 User sees 'Working Offline' indicator with clear messaging
- [ ] #3 Changes made offline are saved locally
- [ ] #4 Auto-sync when network connectivity returns
- [ ] #5 No data loss during offline/online transitions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Testing Required
- Test cold reload while offline (airplane mode)
- Test with board containing various shape types
- Test transition from offline to online (auto-sync)
- Test making changes while offline and syncing
- Verify no data loss scenarios

Commit: 4df9e42 pushed to dev branch
<!-- SECTION:NOTES:END -->
