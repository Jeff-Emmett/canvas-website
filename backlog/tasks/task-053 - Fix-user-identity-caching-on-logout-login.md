---
id: task-053
title: Fix user identity caching on logout/login
status: Done
assignee: []
created_date: '2025-12-15 23:40'
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
- [ ] #1 Crypto keys and tldraw user IDs persist across logout (account data)
- [ ] #2 Session-specific data cleared on logout (permissions, graph cache)
- [ ] #3 No duplicate cursors when logging out and back in
- [ ] #4 Tools load properly after login from logged-out state
- [ ] #5 CryptIDDropdown and NetworkGraph reset state on logout
<!-- AC:END -->
