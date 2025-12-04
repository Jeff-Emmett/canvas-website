---
id: task-022
title: Board Version History & Change Visualization
status: To Do
assignee: []
created_date: '2025-12-04 12:59'
updated_date: '2025-12-04 13:00'
labels:
  - feature
  - collaboration
  - R2
  - tldraw
  - permissions
  - security
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement board permissions, R2 backup version browsing/restoration, and visual change highlighting:

## 1. Board Ownership & Permissions Model

**Ownership:**
- First user to create/claim a board becomes OWNER
- Owner can set a 4-digit PIN to protect admin functions
- Owner can transfer ownership to another user

**Permission Levels:**
- **OWNER**: Full control, can delete board, transfer ownership, manage all permissions
- **ADMIN**: Can restore versions, manage EDITOR/VIEWER permissions, cannot delete board
- **EDITOR**: Can create/edit/delete shapes, changes are tracked
- **VIEWER**: Read-only access, can see board but not modify

**4-PIN Password System:**
- Optional PIN set by OWNER to protect admin actions
- Required for: restoring versions, changing permissions, deleting content
- Stored hashed in R2 metadata or D1
- Rate-limited attempts to prevent brute force

## 2. Version History Tool (ADMIN+ only)
- List available backup versions (by date)
- Preview backup contents before restore
- One-click restore with PIN confirmation
- Audit log of who restored what and when

## 3. Change Visualization
- Yellow glow: new objects from other users (until viewed)
- Grey glow: deleted objects as ghosts (until acknowledged)
- User attribution badges showing who made each change
- Filter changes by user
- "Mark all as seen" functionality

## 4. Storage Architecture
- Board metadata in D1 or R2 JSON: owner, permissions map, PIN hash
- Permission checks in Durable Object before allowing edits
- WebSocket messages include user identity for attribution
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Board creator becomes OWNER automatically
- [ ] #2 OWNER can set optional 4-digit PIN
- [ ] #3 OWNER can assign ADMIN/EDITOR/VIEWER roles to users
- [ ] #4 ADMINs can restore board versions (with PIN if set)
- [ ] #5 EDITORs can modify board content
- [ ] #6 VIEWERs have read-only access

- [ ] #7 Version history panel shows available backup dates
- [ ] #8 Can preview a backup before restoring
- [ ] #9 New objects from other users show yellow glow
- [ ] #10 Deleted objects show grey ghost glow until acknowledged
- [ ] #11 Changes show user attribution (who made the change)
- [ ] #12 Changes can be marked as seen
<!-- AC:END -->
