---
id: task-001
title: offline local storage
status: To Do
assignee: []
created_date: '2025-12-03 23:42'
updated_date: '2025-12-04 20:25'
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
Add IndexedDB persistence layer to the existing Automerge sync system. Board data should be cached locally for offline access, with graceful online/offline transitions.

Key requirements:
- Store board state in IndexedDB (not localStorage - 5MB limit insufficient)
- Integrate with existing useAutomergeSync hook
- Detect online/offline status and show connection indicator
- Sync local changes when connection restores
- Handle Safari's 7-day eviction with service worker touch
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IndexedDB schema for board documents and assets
- [ ] #2 Persist Automerge document to IndexedDB on changes
- [ ] #3 Load from IndexedDB on initial page load (before WebSocket connects)
- [ ] #4 Online/offline status detection with UI indicator
- [ ] #5 Queue local changes during offline and sync on reconnect
- [ ] #6 Handle storage quota limits gracefully
- [ ] #7 Safari 7-day eviction mitigation via service worker
<!-- AC:END -->
