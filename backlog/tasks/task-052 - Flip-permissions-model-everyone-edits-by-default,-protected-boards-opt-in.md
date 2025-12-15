---
id: task-052
title: 'Flip permissions model: everyone edits by default, protected boards opt-in'
status: In Progress
assignee: []
created_date: '2025-12-15 17:23'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Change the default permission model so ALL users (including anonymous) can edit by default. Boards can be marked as "protected" by an admin, making them view-only for non-designated users.

Key changes:
1. Add is_protected column to boards table
2. Add global_admins table (jeffemmett@gmail.com as initial admin)
3. Flip getEffectivePermission logic
4. Create BoardSettingsDropdown component with view-only toggle
5. Add user invite for protected boards
6. Admin request email flow
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Anonymous users can edit unprotected boards
- [ ] #2 Protected boards are view-only for non-editors
- [ ] #3 Global admin (jeffemmett@gmail.com) has admin on all boards
- [ ] #4 Settings dropdown shows view-only toggle for admins
- [ ] #5 Can add/remove editors on protected boards
- [ ] #6 Admin request button sends email
<!-- AC:END -->
