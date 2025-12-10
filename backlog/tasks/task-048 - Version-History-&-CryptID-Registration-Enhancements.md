---
id: task-048
title: Version History & CryptID Registration Enhancements
status: Done
assignee: []
created_date: '2025-12-10 22:22'
updated_date: '2025-12-10 22:22'
labels:
  - feature
  - auth
  - history
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add version history feature with diff visualization and enhance CryptID registration flow with email backup
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Email Service (SendGrid → Resend)
- Updated `worker/types.ts` to use `RESEND_API_KEY`
- Updated `worker/cryptidAuth.ts` sendEmail() to use Resend API

### CryptID Registration Flow
- Multi-step registration: welcome → username → email → success
- Detailed explainer about passwordless authentication
- Email backup for multi-device access
- Added `email` field to Session type

### Version History Feature

**Backend API Endpoints:**
- `GET /room/:roomId/history` - Get version history
- `GET /room/:roomId/snapshot/:hash` - Get snapshot at version
- `POST /room/:roomId/diff` - Compute diff between versions  
- `POST /room/:roomId/revert` - Revert to a version

**Frontend Components:**
- `VersionHistoryPanel.tsx` - Timeline with diff visualization
- `useVersionHistory.ts` - React hook for programmatic access
- GREEN highlighting for added shapes
- RED highlighting for removed shapes
- PURPLE highlighting for modified shapes

### Other Fixes
- Network graph connect/trust buttons now work
- CryptID dropdown integration buttons improved
- Obsidian vault connection modal added

Pushed to dev branch: commit 195cc7f
<!-- SECTION:NOTES:END -->
