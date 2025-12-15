---
id: task-054
title: Re-enable Map tool with GPS location sharing
status: Done
assignee: []
created_date: '2025-12-15 23:40'
updated_date: '2025-12-15 23:40'
labels:
  - feature
  - map
  - collaboration
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Re-enabled the Map tool in the toolbar and context menu. Added GPS location sharing feature allowing collaborators to share their real-time location on the map with colored markers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map tool visible in toolbar (globe icon)
- [x] #2 Map tool available in context menu under Create Tool
- [x] #3 GPS location sharing toggle button works
- [x] #4 Collaborator locations shown as colored markers
- [x] #5 GPS watch cleaned up on component unmount
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commit 2d9d216.

Changes:
- CustomToolbar.tsx: Uncommented Map tool
- CustomContextMenu.tsx: Uncommented Map tool in Create Tool submenu
- MapShapeUtil.tsx: Added GPS location sharing with collaborator markers

GPS feature includes toggle button, real-time location updates, colored markers for each collaborator, and proper cleanup on unmount.
<!-- SECTION:NOTES:END -->
