---
id: task-053
title: Fix user identity caching on logout/login
status: Done
assignee: []
created_date: '2025-12-15 23:40'
updated_date: '2025-12-15 23:40'
labels:
  - bug-fix
  - auth
  - presence
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fixed issues with user identity state not being properly cleared/restored during logout and login cycles, causing duplicate cursors and stale presence data in the social network graph.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Crypto keys and tldraw user IDs persist across logout (account data)
- [x] #2 Session-specific data cleared on logout (permissions, graph cache)
- [x] #3 No duplicate cursors when logging out and back in
- [x] #4 Tools load properly after login from logged-out state
- [x] #5 CryptIDDropdown and NetworkGraph reset state on logout
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commits df80a3f and related changes to Board.tsx.

Key changes:
- sessionPersistence.ts: Added session-logged-in and session-cleared events, preserve tldraw user IDs and crypto keys on logout
- Board.tsx: Check localStorage directly for auth in onMount, listen for session events
- CryptIDDropdown.tsx: Clear connections state on logout
- useNetworkGraph.ts: Clear graph cache on logout

The root cause was clearing tldraw-user-id-* keys on logout, which created new presence IDs on each login while old presence records persisted in Automerge.
<!-- SECTION:NOTES:END -->
