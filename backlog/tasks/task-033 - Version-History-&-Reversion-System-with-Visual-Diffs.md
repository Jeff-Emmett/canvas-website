---
id: task-033
title: Version History & Reversion System with Visual Diffs
status: In Progress
assignee: []
created_date: '2025-12-04 21:44'
labels:
  - feature
  - version-control
  - automerge
  - r2
  - ui
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a comprehensive version history and reversion system that allows users to:
1. View and revert to historical board states
2. See visual diffs highlighting new/deleted shapes since their last visit
3. Walk through CRDT history step-by-step
4. Restore accidentally deleted shapes

Key features:
- Time rewind button next to the star dashboard button
- Popup menu showing historical versions
- Yellow glow on newly added shapes (first time user sees them)
- Dim grey on deleted shapes with "undo discard" option
- Permission-based (admin, editor, viewer)
- Integration with R2 backups and Automerge CRDT history
- Compare user's local state with server state to highlight diffs
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version history button renders next to star button with time-rewind icon
- [ ] #2 Clicking button opens popup showing list of historical versions
- [ ] #3 User can select a version to preview or revert to
- [ ] #4 Newly added shapes since last user visit have yellow glow effect
- [ ] #5 Deleted shapes show dimmed with 'undo discard' option
- [ ] #6 Version navigation respects user permissions (admin/editor/viewer)
- [ ] #7 Works with R2 backup snapshots for coarse-grained history
- [ ] #8 Leverages Automerge CRDT for fine-grained change tracking
- [ ] #9 User's last-seen state stored in localStorage for diff comparison
- [ ] #10 Visual effects are subtle and non-intrusive
<!-- AC:END -->
