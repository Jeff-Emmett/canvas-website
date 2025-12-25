---
id: task-026
title: Fix text shape sync between clients
status: Done
assignee: []
created_date: '2025-12-04 20:48'
updated_date: '2025-12-25 23:30'
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
- [x] #1 Text shapes sync correctly between multiple clients
- [x] #2 Text content preserved during automerge serialization/deserialization
- [x] #3 Both new and existing text shapes display correctly on all clients
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Fix Applied (2025-12-25)

Root cause: Text shapes arriving from other clients had `props.text` but the deserialization code was:
1. Initializing `richText` to empty `{ content: [], type: 'doc' }`
2. Then deleting `props.text`
3. Result: content lost

Fix: Added text → richText conversion for text shapes in `AutomergeToTLStore.ts` (lines 1162-1191), similar to the existing conversion for geo shapes.

The fix:
- Checks if `props.text` exists before initializing richText
- Converts text content to richText format
- Preserves original text in `meta.text` for backward compatibility
- Logs conversion for debugging
<!-- SECTION:NOTES:END -->
