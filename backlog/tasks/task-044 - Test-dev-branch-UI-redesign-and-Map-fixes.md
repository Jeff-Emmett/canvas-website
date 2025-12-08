---
id: task-044
title: Test dev branch UI redesign and Map fixes
status: Done
assignee: []
created_date: '2025-12-07 23:26'
updated_date: '2025-12-08 01:19'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test the changes pushed to dev branch in commit 8123f0f
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CryptID dropdown works (sign in/out, Google integration)
- [ ] #2 Settings gear dropdown shows dark mode toggle
- [ ] #3 Social Network graph shows user as lone node when solo
- [ ] #4 Map marker tool adds markers on click
- [ ] #5 Map scroll wheel zooms correctly
- [ ] #6 Old boards with Map shapes load without validation errors
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Session completed. All changes pushed to dev branch:
- UI redesign: unified top-right menu with grey oval container
- Social Network graph: dark theme with directional arrows
- MI bar: responsive layout (bottom on mobile)
- Map fixes: tool clicks work, scroll zoom works
- Automerge: Map shape schema validation fix
- Network graph: graceful fallback on API errors
<!-- SECTION:NOTES:END -->
