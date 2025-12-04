---
id: task-026
title: Fix text shape sync between clients
status: To Do
assignee: []
created_date: '2025-12-04 20:48'
labels:
  - bug
  - sync
  - automerge
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Text shapes created with the "T" text tool show up on the creating client but not on other clients viewing the same board.

Root cause investigation:
- Text shapes ARE being persisted to R2 (confirmed in server logs)
- Issue is on receiving client side in AutomergeToTLStore.ts
- Line 1142: 'text' is in invalidTextProps list and gets deleted
- If richText isn't properly populated before text is deleted, content is lost

Files to investigate:
- src/automerge/AutomergeToTLStore.ts (sanitization logic)
- src/automerge/TLStoreToAutomerge.ts (serialization logic)
- src/automerge/useAutomergeStoreV2.ts (store updates)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Text shapes sync correctly between multiple clients
- [ ] #2 Text content preserved during automerge serialization/deserialization
- [ ] #3 Both new and existing text shapes display correctly on all clients
<!-- AC:END -->
