---
id: task-001
title: offline local storage
status: To Do
assignee: []
created_date: '2025-12-03 23:42'
updated_date: '2025-12-04 20:27'
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
- [ ] #1 Real WebSocket connection state tracking (not hardcoded 'online')
- [ ] #2 navigator.onLine integration for network detection
- [ ] #3 UI indicator component showing connection status
- [ ] #4 Visual feedback when working offline
- [ ] #5 Auto-reconnect with status updates
- [ ] #6 Safari 7-day eviction mitigation (service worker or periodic touch)
<!-- AC:END -->
