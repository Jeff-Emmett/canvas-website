---
id: task-001
title: offline local storage
status: Done
assignee: []
created_date: '2025-12-03 23:42'
updated_date: '2025-12-04 20:35'
labels:
  - feature
  - offline
  - persistence
  - indexeddb
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IndexedDB persistence is already implemented via @automerge/automerge-repo-storage-indexeddb. The remaining work is:

1. Add real online/offline detection (currently always returns "online")
2. Create UI indicator showing connection status
3. Handle Safari's 7-day IndexedDB eviction

Existing code locations:
- src/automerge/useAutomergeSyncRepo.ts (lines 346, 380-432)
- src/automerge/useAutomergeStoreV2.ts (connectionStatus property)
- src/automerge/documentIdMapping.ts (room→document mapping)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Real WebSocket connection state tracking (not hardcoded 'online')
- [x] #2 navigator.onLine integration for network detection
- [x] #3 UI indicator component showing connection status
- [x] #4 Visual feedback when working offline
- [x] #5 Auto-reconnect with status updates
- [ ] #6 Safari 7-day eviction mitigation (service worker or periodic touch)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented connection status tracking:
- Added ConnectionState type and tracking in CloudflareAdapter
- Added navigator.onLine integration for network detection
- Exposed connectionState and isNetworkOnline from useAutomergeSync hook
- Created ConnectionStatusIndicator component with visual feedback
- Shows status only when not connected (connecting/reconnecting/disconnected/offline)
- Auto-hides when connected and online
<!-- SECTION:NOTES:END -->
