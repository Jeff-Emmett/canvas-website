---
id: task-042
title: User Permissions - View, Edit, Admin Levels
status: In Progress
assignee: [@claude]
created_date: '2025-12-05 14:00'
updated_date: '2025-12-05 14:00'
labels:
  - feature
  - auth
  - permissions
  - cryptid
  - security
dependencies:
  - task-018
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a three-tier permission system for canvas boards:

**Permission Levels:**
1. **View** - Can see board contents, cannot edit. Default for anonymous/unauthenticated users.
2. **Edit** - Can see and modify board contents. Requires CryptID authentication.
3. **Admin** - Full access + can manage board settings and user permissions. Board owner by default.

**Key Features:**
- Anonymous users can view any shared board but cannot edit
- Creating a CryptID (username only, no password) grants edit access
- CryptID uses WebCrypto API for browser-based cryptographic keys (W3C standard)
- Session state encrypted and stored offline for authenticated users
- Admins can invite users with specific permission levels

**Anonymous User Banner:**
Display a banner for unauthenticated users:
> "If you want to edit this board, just sign in by creating a username as your CryptID - no password required! Your CryptID is secured with encrypted keys, right in your browser, by a W3C standard algorithm. As a bonus, your session will be stored for offline access, encrypted in your browser storage by the same key, allowing you to use it securely any time you like, with full data portability."

**Technical Foundation:**
- Builds on existing CryptID WebCrypto authentication (`auth-webcrypto` branch)
- Extends D1 database schema for board-level permissions
- Read-only mode in tldraw editor for view-only users
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Anonymous users can view any shared board content
- [ ] #2 Anonymous users cannot create, edit, or delete shapes
- [ ] #3 Anonymous users see a dismissible banner prompting CryptID sign-up
- [ ] #4 Creating a CryptID grants immediate edit access to current board
- [ ] #5 Board creator automatically becomes admin
- [ ] #6 Admins can view and manage board permissions
- [ ] #7 Permission levels enforced on both client and server (worker)
- [ ] #8 Authenticated user sessions stored encrypted in browser storage
- [ ] #9 Read-only toolbar/UI state for view-only users
- [ ] #10 Permission state syncs correctly across devices via CryptID
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Branch:** `feature/user-permissions`

**Completed:**
- [x] Database schema for boards and board_permissions tables
- [x] Permission types (PermissionLevel) in worker and client
- [x] Permission API handlers (boardPermissions.ts)
- [x] AuthContext updated with permission fetching/caching
- [x] AnonymousViewerBanner component with CryptID signup

**In Progress:**
- [ ] Board component read-only mode integration
- [ ] Automerge sync permission checking

**Dependencies:**
- `task-018` - D1 database creation (blocking for production)
- `auth-webcrypto` branch - WebCrypto authentication (merged)
<!-- SECTION:NOTES:END -->
