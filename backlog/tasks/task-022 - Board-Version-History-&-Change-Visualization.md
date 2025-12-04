---
id: task-022
title: Board Version History & Change Visualization
status: To Do
assignee: []
created_date: '2025-12-04 12:59'
labels:
  - feature
  - collaboration
  - R2
  - tldraw
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement R2 backup version browsing/restoration and visual change highlighting for multi-user collaboration:

1. **Version History Tool**: UI element to browse and restore board backups from R2
   - List available backup versions (by date)
   - Preview backup contents before restore
   - One-click restore to previous version
   - Confirmation dialog to prevent accidental overwrites

2. **Change Visualization**: Visual indicators for recent changes by other users
   - Yellow glow around newly created objects (until viewed/acknowledged)
   - Grey glow around recently deleted objects (shown as ghosts until seen)
   - User attribution for changes (who made what change)
   - "Mark all as seen" functionality
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version history panel shows available backup dates
- [ ] #2 Can preview a backup before restoring
- [ ] #3 Can restore a board to a previous version
- [ ] #4 New objects from other users show yellow glow
- [ ] #5 Deleted objects show grey ghost glow until acknowledged
- [ ] #6 Changes can be marked as 'seen'
<!-- AC:END -->
