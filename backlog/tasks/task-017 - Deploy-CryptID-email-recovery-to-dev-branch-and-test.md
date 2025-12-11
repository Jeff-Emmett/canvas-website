---
id: task-017
title: Deploy CryptID email recovery to dev branch and test
status: In Progress
assignee: []
created_date: '2025-12-04 12:00'
updated_date: '2025-12-11 15:15'
labels:
  - feature
  - cryptid
  - auth
  - testing
  - dev-branch
dependencies:
  - task-018
  - task-019
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Push the existing CryptID email recovery code changes to dev branch and test the full flow before merging to main.

**Code Changes Ready:**
- src/App.tsx - Routes for /verify-email, /link-device
- src/components/auth/CryptID.tsx - Email linking flow
- src/components/auth/Profile.tsx - Email management UI, device list
- src/css/crypto-auth.css - Styling for email/device modals
- worker/types.ts - Updated D1 types
- worker/worker.ts - Auth API routes
- worker/cryptidAuth.ts - Auth handlers (already committed)

**Test Scenarios:**
1. Link email to existing CryptID account
2. Verify email via link
3. Request device link from new device
4. Approve device link via email
5. View and revoke linked devices
6. Recover account on new device via email
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All CryptID changes committed to dev branch
- [ ] #2 Worker deployed to dev environment
- [ ] #3 Link email flow works end-to-end
- [ ] #4 Email verification completes successfully
- [ ] #5 Device linking via email works
- [ ] #6 Device revocation works
- [ ] #7 Profile shows linked email and devices
- [ ] #8 No console errors in happy path
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch created: `feature/cryptid-email-recovery`

Code committed and pushed to Gitea

PR available at: https://gitea.jeffemmett.com/jeffemmett/canvas-website/compare/main...feature/cryptid-email-recovery
<!-- SECTION:NOTES:END -->
