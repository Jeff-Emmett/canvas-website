---
id: task-027
title: Implement proper Automerge CRDT sync for offline-first support
status: In Progress
assignee: []
created_date: '2025-12-04 21:06'
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
- [ ] #1 Server stores Automerge binary documents in R2 (not JSON)
- [ ] #2 Client-server communication uses Automerge sync protocol (binary messages)
- [ ] #3 Deletions persist correctly when offline client reconnects
- [ ] #4 Concurrent edits merge deterministically without data loss
- [ ] #5 Existing JSON rooms are migrated to Automerge format
- [ ] #6 All existing functionality continues to work
<!-- AC:END -->
