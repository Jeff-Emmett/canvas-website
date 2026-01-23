---
id: task-063
title: Fix Obsidian vault storage overflow - store content in IndexedDB
status: Done
assignee: []
created_date: '2026-01-22 20:03'
updated_date: '2026-01-23 08:41'
labels:
  - bug
  - obsidian
  - automerge
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Obsidian vault browser is storing full note content in Automerge, causing capacity overflow errors and localStorage quota exceeded errors. Need to:
1. Store only metadata in Automerge (id, title, tags, links, paths)
2. Store full content in IndexedDB separately
3. Clear existing vault data from Automerge for privacy
4. Load content on-demand when notes are opened
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete:
- Created NoteContentStore (src/lib/noteContentStore.ts) for IndexedDB storage
- Added light record types (ObsidianObsNoteMeta, FolderNodeMeta, ObsidianVaultRecordLight)
- Modified saveVaultToAutomerge to save only metadata to Automerge, content to IndexedDB
- Added clearVaultFromAutomerge function
- Added on-demand content loading via loadNoteContentFromIDB
- Added 'Clear from Sync' button to UI
- TypeScript compiles cleanly, build succeeds
<!-- SECTION:NOTES:END -->
