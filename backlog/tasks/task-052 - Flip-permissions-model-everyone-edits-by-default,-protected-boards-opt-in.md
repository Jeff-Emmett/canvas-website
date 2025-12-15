---
id: task-052
title: 'Flip permissions model: everyone edits by default, protected boards opt-in'
status: Done
assignee: []
created_date: '2025-12-15 17:23'
updated_date: '2025-12-15 19:26'
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
- [x] #1 Anonymous users can edit unprotected boards
- [x] #2 Protected boards are view-only for non-editors
- [x] #3 Global admin (jeffemmett@gmail.com) has admin on all boards
- [x] #4 Settings dropdown shows view-only toggle for admins
- [x] #5 Can add/remove editors on protected boards
- [x] #6 Admin request button sends email
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (Dec 15, 2025)

### Backend Changes (commit 2fe96fa)
- **worker/schema.sql**: Added `is_protected` column to boards, created `global_admins` table
- **worker/types.ts**: Added `GlobalAdmin` interface, extended `PermissionCheckResult`
- **worker/boardPermissions.ts**: Rewrote `getEffectivePermission()` with new logic, added `isGlobalAdmin()`, new API handlers
- **worker/worker.ts**: Added routes for `/boards/:boardId/info`, `/boards/:boardId/editors`, `/admin/request`
- **worker/migrations/001_add_protected_boards.sql**: Migration script created

### D1 Migration (executed manually)
```sql
ALTER TABLE boards ADD COLUMN is_protected INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_boards_protected ON boards(is_protected);
CREATE TABLE IF NOT EXISTS global_admins (email TEXT PRIMARY KEY, added_at TEXT, added_by TEXT);
INSERT OR IGNORE INTO global_admins (email) VALUES ('jeffemmett@gmail.com');
```

### Frontend Changes (commit 3f71222)
- **src/ui/components.tsx**: Integrated board protection settings into existing settings dropdown
  - Protection toggle (view-only mode)
  - Editor list management (add/remove)
  - Global Admin badge display
- **src/context/AuthContext.tsx**: Changed default permission to 'edit' for everyone
- **src/routes/Board.tsx**: Updated `isReadOnly` logic for new permission model
- **src/components/BoardSettingsDropdown.tsx**: Created standalone component (kept for reference)

### Worker Deployment
- Deployed to Cloudflare Workers (version 5ddd1e23-d32f-459f-bc5c-cf3f799ab93f)

### Remaining
- [ ] AC #6: Admin request email flow (Resend integration needed)

### Resend Email Integration (commit a46ce44)
- Added `RESEND_API_KEY` secret to Cloudflare Worker
- Fixed from email to use verified domain: `Canvas <noreply@jeffemmett.com>`
- Admin request emails will be sent to jeffemmett@gmail.com
- Test email sent successfully: ID 7113526b-ce1e-43e7-b18d-42b3d54823d1

**All acceptance criteria now complete!**
<!-- SECTION:NOTES:END -->
