---
id: task-045
title: Implement offline-first loading from IndexedDB
status: Done
assignee: []
created_date: '2025-12-08 08:47'
labels:
  - bug-fix
  - offline
  - automerge
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fixed a bug where the app would hang indefinitely when the server wasn't running because `await adapter.whenReady()` blocked IndexedDB loading. Now the app loads from IndexedDB first (offline-first), then syncs with server in the background with a 5-second timeout.
<!-- SECTION:DESCRIPTION:END -->
