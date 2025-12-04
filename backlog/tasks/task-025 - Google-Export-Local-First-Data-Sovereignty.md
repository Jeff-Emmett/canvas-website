---
id: task-025
title: 'Google Export: Local-First Data Sovereignty'
status: Done
assignee: []
created_date: '2025-12-04 20:25'
updated_date: '2025-12-04 20:51'
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
- [x] #1 OAuth 2.0 with PKCE flow for Google APIs
- [x] #2 IndexedDB schema for encrypted data storage
- [x] #3 WebCrypto key derivation from master key
- [x] #4 Gmail import with pagination and progress
- [x] #5 Drive document import
- [x] #6 Photos thumbnail import
- [x] #7 Calendar event import
- [x] #8 Share to board functionality
- [x] #9 R2 encrypted backup/restore
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting implementation - reviewed architecture doc GOOGLE_DATA_SOVEREIGNTY.md

Implemented core Google Data Sovereignty module:

- types.ts: Type definitions for all encrypted data structures

- encryption.ts: WebCrypto AES-256-GCM encryption, HKDF key derivation, PKCE utilities

- database.ts: IndexedDB schema with stores for gmail, drive, photos, calendar, sync metadata, encryption metadata, tokens

- oauth.ts: OAuth 2.0 PKCE flow for Google APIs with encrypted token storage

- importers/gmail.ts: Gmail import with pagination, progress tracking, batch storage

- importers/drive.ts: Drive import with folder navigation, Google Docs export

- importers/photos.ts: Photos import with thumbnail caching, album support

- importers/calendar.ts: Calendar import with date range filtering, recurring events

- share.ts: Share service for creating tldraw shapes from encrypted data

- backup.ts: R2 backup service with encrypted manifest, checksum verification

- index.ts: Main module with GoogleDataService class and singleton pattern

TypeScript compilation passes - all core modules implemented
<!-- SECTION:NOTES:END -->
