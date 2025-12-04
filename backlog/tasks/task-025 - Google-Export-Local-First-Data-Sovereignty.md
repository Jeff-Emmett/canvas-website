---
id: task-025
title: 'Google Export: Local-First Data Sovereignty'
status: In Progress
assignee: []
created_date: '2025-12-04 20:25'
updated_date: '2025-12-04 20:28'
labels:
  - feature
  - google
  - encryption
  - privacy
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Import Google Workspace data (Gmail, Drive, Photos, Calendar) locally, encrypt with WebCrypto, store in IndexedDB. User controls what gets shared to board or backed up to R2.

Worktree: /home/jeffe/Github/canvas-website-branch-worktrees/google-export
Branch: feature/google-export

Architecture docs in: docs/GOOGLE_DATA_SOVEREIGNTY.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OAuth 2.0 with PKCE flow for Google APIs
- [ ] #2 IndexedDB schema for encrypted data storage
- [ ] #3 WebCrypto key derivation from master key
- [ ] #4 Gmail import with pagination and progress
- [ ] #5 Drive document import
- [ ] #6 Photos thumbnail import
- [ ] #7 Calendar event import
- [ ] #8 Share to board functionality
- [ ] #9 R2 encrypted backup/restore
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting implementation - reviewed architecture doc GOOGLE_DATA_SOVEREIGNTY.md
<!-- SECTION:NOTES:END -->
