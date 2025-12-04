---
id: task-020
title: Implement Google Data Sovereignty (Local-First Encrypted Storage)
status: To Do
assignee: []
created_date: '2025-12-04 12:32'
labels:
  - feature
  - security
  - google-integration
  - offline-storage
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement secure, local-first storage for Google Workspace data (Gmail, Drive, Photos, Calendar) with client-side encryption, selective sharing to canvas boards, and optional R2 encrypted backup. See docs/GOOGLE_DATA_SOVEREIGNTY.md for full architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IndexedDB schema created for encrypted Google data
- [ ] #2 Key derivation from existing WebCrypto auth keys
- [ ] #3 Google OAuth 2.0 with PKCE implemented
- [ ] #4 Gmail messages can be imported and encrypted locally
- [ ] #5 Drive documents can be imported and encrypted locally
- [ ] #6 Photos thumbnails can be imported and encrypted locally
- [ ] #7 Calendar events can be imported and encrypted locally
- [ ] #8 Data can be selectively shared to canvas board (Automerge sync)
- [ ] #9 Encrypted R2 backup and restore working
- [ ] #10 Safari 7-day eviction mitigations in place
- [ ] #11 Storage quota warnings implemented
<!-- AC:END -->
