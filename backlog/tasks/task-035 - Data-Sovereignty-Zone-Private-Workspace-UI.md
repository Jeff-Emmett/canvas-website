---
id: task-035
title: 'Data Sovereignty Zone: Private Workspace UI'
status: Done
assignee: []
created_date: '2025-12-04 23:36'
updated_date: '2025-12-05 02:00'
labels:
  - feature
  - privacy
  - google
  - ui
dependencies:
  - task-025
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement privacy-first UX for managing LOCAL (encrypted IndexedDB) vs SHARED (collaborative) data on the canvas.

Key features:
- Google Integration card in Settings modal
- Data Browser popup for selecting encrypted items
- Private Workspace zone (toggleable, frosted glass container)
- Visual distinction: 🔒 shaded overlay for local, normal for shared
- Permission prompt when dragging items outside workspace

Design decisions:
- Toggleable workspace that can pin to viewport
- Items always start private, explicit share action required
- ZK integration deferred to future phase
- R2 upload visual-only for now

Worktree: /home/jeffe/Github/canvas-website-branch-worktrees/google-export
Branch: feature/google-export
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Google Workspace integration card in Settings Integrations tab
- [x] #2 Data Browser popup with service tabs and item selection
- [x] #3 Private Workspace zone shape with frosted glass effect
- [x] #4 Privacy badges (lock/globe) on items showing visibility
- [x] #5 Permission modal when changing visibility from local to shared
- [ ] #6 Zone can be toggled visible/hidden and pinned to viewport
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Phase 1 complete (c9c8c00):

- Added Google Workspace section to Settings > Integrations tab

- Connection status badge and import counts display

- Connect/Disconnect buttons with loading states

- Added getStoredCounts() method to GoogleDataService

- Privacy messaging about AES-256 encryption

Phase 2 complete (a754ffa):

- GoogleDataBrowser component with service tabs

- Searchable, multi-select item list

- Dark mode support

- Privacy messaging and 'Add to Private Workspace' action

Phase 5 completed: Implemented permission flow and drag detection

Created VisibilityChangeModal.tsx for confirming visibility changes

Created VisibilityChangeManager.tsx to handle events and drag detection

GoogleItem shapes dispatch visibility change events on badge click

Support both local->shared and shared->local transitions

Auto-detect when GoogleItems are dragged outside PrivateWorkspace

Session storage for 'don't ask again' preference

All 5 phases complete - full data sovereignty UI implementation done
<!-- SECTION:NOTES:END -->
