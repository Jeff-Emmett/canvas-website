---
id: task-023
title: Version History & Permissions Implementation Plan
status: To Do
assignee: []
created_date: '2025-12-04 13:10'
labels: [feature, permissions, version-history, collaboration, plan]
priority: high
dependencies: []
---

## Description

Comprehensive implementation plan for board permissions, R2 backup version browsing/restoration, and visual change highlighting. This task contains the full technical specification for implementation.

---

## 1. Access Model Summary

### Permission Levels
| Role | Capabilities |
|------|--------------|
| **OWNER** | Full control, delete board, transfer ownership, manage all permissions |
| **ADMIN** | Restore versions, manage EDITOR/VIEWER permissions, cannot delete board |
| **EDITOR** | Create/edit/delete shapes, changes are tracked |
| **VIEWER** | Read-only access, can see board but not modify |

### Access Logic (in order of precedence)
1. Has email permission → Access at assigned role (OWNER/ADMIN/EDITOR/VIEWER)
2. Signed in + no PIN set on board → EDITOR
3. Knows PIN (entered this session) → EDITOR
4. Otherwise → VIEWER (read-only)

### Ownership Rules
- New board created by signed-in user → auto OWNER
- Existing unclaimed board → "Claim admin" button to become OWNER
- Anonymous users cannot claim boards

### PIN System
- Optional 4-digit code set by OWNER
- Grants EDITOR access to anyone who enters it correctly
- Session-based (stored in sessionStorage, cleared on browser close)
- Stored hashed with salt in R2 metadata

---

## 2. Data Structures

### Board Metadata (R2: `rooms/${roomId}/metadata.json`)

```typescript
interface BoardMetadata {
  // Ownership
  owner: {
    cryptidUsername: string;
    publicKey: string;
    claimedAt: number; // timestamp
  } | null;

  // PIN for guest editor access
  pin: {
    hash: string;      // SHA-256(salt + pin)
    salt: string;      // Random 16-byte hex string
    attempts: number;  // Failed attempts counter
    lockedUntil: number | null; // Lockout timestamp
  } | null;

  // Explicit user permissions (by publicKey)
  permissions: {
    [publicKey: string]: {
      role: 'ADMIN' | 'EDITOR' | 'VIEWER';
      grantedBy: string;     // publicKey of granter
      grantedAt: number;     // timestamp
      email?: string;        // Optional email for display
      cryptidUsername?: string;
    };
  };

  // Default access for signed-in users without explicit permission
  defaultSignedInAccess: 'EDITOR' | 'VIEWER'; // Default: 'EDITOR'

  // Audit log (last 100 entries)
  auditLog: AuditEntry[];

  // Metadata
  createdAt: number;
  updatedAt: number;
}

interface AuditEntry {
  action: 'claim' | 'restore' | 'permission_change' | 'pin_set' | 'pin_removed' | 'ownership_transfer';
  actor: {
    cryptidUsername?: string;
    publicKey?: string;
  };
  timestamp: number;
  details: Record<string, any>;
}
```

### Shape Change Metadata (added to shape.meta)

```typescript
interface ShapeChangeMeta {
  createdBy?: {
    cryptidUsername: string;
    publicKey: string;
    timestamp: number;
  };
  modifiedBy?: {
    cryptidUsername: string;
    publicKey: string;
    timestamp: number;
  };
  deletedBy?: {  // For ghost shapes
    cryptidUsername: string;
    publicKey: string;
    timestamp: number;
  };
}
```

### Client-Side Seen State (localStorage)

```typescript
interface SeenState {
  [roomId: string]: {
    lastSeenTimestamp: number;
    seenShapeIds: string[];  // Shapes explicitly marked as seen
    acknowledgedDeletions: string[]; // Deleted shape IDs acknowledged
  };
}
```

---

## 3. Worker Endpoints

### Metadata Endpoints

```typescript
// GET /room/:roomId/metadata
// Returns board metadata (filtered based on requester's role)
// Response: { owner, myRole, hasPin, permissions (if ADMIN+), ... }

// POST /room/:roomId/claim
// Claim ownership of unclaimed board
// Body: { publicKey, cryptidUsername }
// Response: { success, metadata }

// POST /room/:roomId/pin
// Set or update PIN (OWNER only)
// Body: { pin: string (4 digits), publicKey }
// Response: { success }

// DELETE /room/:roomId/pin
// Remove PIN (OWNER only)
// Body: { publicKey }
// Response: { success }

// POST /room/:roomId/pin/verify
// Verify PIN for guest access
// Body: { pin: string }
// Response: { success, granted: 'EDITOR' }

// POST /room/:roomId/permissions
// Update user permissions (OWNER/ADMIN)
// Body: {
//   publicKey: string, // requester
//   targetPublicKey: string,
//   role: 'ADMIN' | 'EDITOR' | 'VIEWER' | null, // null = remove
//   targetEmail?: string
// }
// Response: { success }

// POST /room/:roomId/transfer
// Transfer ownership (OWNER only)
// Body: { publicKey, newOwnerPublicKey }
// Response: { success }
```

### Version History Endpoints

```typescript
// GET /room/:roomId/versions
// List available backup versions (ADMIN+ only)
// Query: ?limit=30&before=2025-12-01
// Response: {
//   versions: [
//     { date: '2025-12-04', key: '2025-12-04/rooms/abc123', size: 12345 },
//     ...
//   ]
// }

// GET /room/:roomId/versions/:date
// Preview a specific backup (ADMIN+ only)
// Response: {
//   date,
//   shapeCount,
//   recordCount,
//   preview: { shapes: [...first 50 shapes...] }
// }

// POST /room/:roomId/restore
// Restore from backup (ADMIN+ only)
// Body: {
//   date: string,
//   publicKey: string,
//   cryptidUsername: string
// }
// Response: { success, restoredShapeCount }
```

---

## 4. Implementation Phases

### Phase 1: Types & Metadata Storage
**Files to create/modify:**
- `worker/types.ts` - Add BoardMetadata, AuditEntry interfaces
- `worker/boardMetadata.ts` - CRUD functions for metadata in R2
- `src/lib/board/types.ts` - Client-side type definitions

**Tasks:**
1. Define all TypeScript interfaces
2. Create `getBoardMetadata(r2, roomId)` function
3. Create `updateBoardMetadata(r2, roomId, updates)` function
4. Add metadata initialization on board creation

### Phase 2: Permission Logic
**Files to create/modify:**
- `worker/permissions.ts` - Permission checking logic
- `worker/AutomergeDurableObject.ts` - Add permission checks to sync

**Tasks:**
1. Create `getEffectiveRole(metadata, publicKey, hasValidPin)` function
2. Create `canPerformAction(role, action)` helper
3. Add permission check before accepting WebSocket edits
4. Return role info in WebSocket handshake

### Phase 3: Worker Endpoints
**Files to modify:**
- `worker/worker.ts` - Add all new routes

**Tasks:**
1. Implement `/room/:roomId/metadata` GET
2. Implement `/room/:roomId/claim` POST
3. Implement `/room/:roomId/pin` POST/DELETE
4. Implement `/room/:roomId/pin/verify` POST
5. Implement `/room/:roomId/permissions` POST
6. Implement `/room/:roomId/versions` GET
7. Implement `/room/:roomId/versions/:date` GET
8. Implement `/room/:roomId/restore` POST

### Phase 4: Client Permission Service
**Files to create:**
- `src/lib/board/permissionService.ts` - Client-side permission management
- `src/lib/board/pinStorage.ts` - Session-based PIN storage

**Tasks:**
1. Create `BoardPermissionService` class
2. Implement `getMyRole(roomId)` method
3. Implement `verifyPin(roomId, pin)` method
4. Implement `claimBoard(roomId)` method
5. Create React context for permission state

### Phase 5: UI Components
**Files to create:**
- `src/components/BoardSettings/PermissionsPanel.tsx`
- `src/components/BoardSettings/VersionHistoryPanel.tsx`
- `src/components/BoardSettings/PinSetup.tsx`
- `src/components/PinEntryDialog.tsx`
- `src/components/ClaimBoardButton.tsx`

**Tasks:**
1. Create permissions management UI (OWNER/ADMIN view)
2. Create version history browser with preview
3. Create PIN entry dialog for guest access
4. Create "Claim this board" button for unclaimed boards
5. Add read-only indicator for VIEWERs

### Phase 6: Change Tracking & Visualization
**Files to create/modify:**
- `src/lib/board/changeTracking.ts` - Track changes by user
- `src/hooks/useChangeVisualization.ts` - Glow effect logic
- `src/components/ChangeIndicator.tsx` - Visual indicators

**Tasks:**
1. Add `createdBy`/`modifiedBy` metadata to shapes on edit
2. Track changes in local state (new shapes since last seen)
3. Implement yellow glow CSS for new shapes
4. Implement grey ghost effect for deleted shapes
5. Add "Mark all as seen" button
6. Add user attribution badges on hover

---

## 5. CSS for Visual Effects

```css
/* Yellow glow for new shapes from other users */
.shape-new-unseen {
  filter: drop-shadow(0 0 8px rgba(255, 200, 0, 0.8));
  animation: pulse-yellow 2s ease-in-out infinite;
}

@keyframes pulse-yellow {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 200, 0, 0.8)); }
  50% { filter: drop-shadow(0 0 16px rgba(255, 200, 0, 0.5)); }
}

/* Grey ghost for recently deleted shapes */
.shape-deleted-ghost {
  opacity: 0.3;
  filter: grayscale(100%) drop-shadow(0 0 4px rgba(128, 128, 128, 0.5));
  pointer-events: none;
}

/* User attribution badge */
.shape-attribution {
  position: absolute;
  top: -20px;
  left: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  white-space: nowrap;
}
```

---

## 6. Security Considerations

### PIN Security
- Store as SHA-256(salt + pin)
- Generate new 16-byte random salt each time PIN is set
- Rate limit: Lock after 5 failed attempts for 15 minutes
- PIN verification happens server-side only

### Permission Verification
- Always verify permissions server-side in Durable Object
- Client-side checks are for UX only (hide/disable buttons)
- WebSocket messages include sender's publicKey for verification

### Audit Logging
- Log all permission changes, restores, ownership transfers
- Keep last 100 entries per board
- Include actor identity and timestamp

---

## 7. Testing Checklist

- [ ] Anonymous user can view but not edit
- [ ] Signed-in user can edit unclaimed board
- [ ] Board creator is auto-assigned as OWNER
- [ ] "Claim admin" button works for unclaimed boards
- [ ] OWNER can set/remove PIN
- [ ] PIN grants EDITOR access when verified
- [ ] PIN lockout after 5 failed attempts
- [ ] OWNER can assign ADMIN/EDITOR/VIEWER roles
- [ ] ADMIN can manage EDITOR/VIEWER but not other ADMINs
- [ ] Version history shows available backups
- [ ] Version preview shows shape count and sample
- [ ] Restore replaces current board with backup
- [ ] New shapes from others show yellow glow
- [ ] Deleted shapes show grey ghost
- [ ] "Mark as seen" clears visual indicators
- [ ] Read-only mode works for VIEWERs

---

## Acceptance Criteria

- [ ] Board creator becomes OWNER automatically
- [ ] OWNER can set optional 4-digit PIN
- [ ] OWNER can assign ADMIN/EDITOR/VIEWER roles to users
- [ ] ADMINs can restore board versions
- [ ] EDITORs can modify board content
- [ ] VIEWERs have read-only access
- [ ] Version history panel shows available backup dates
- [ ] Can preview a backup before restoring
- [ ] New objects from other users show yellow glow
- [ ] Deleted objects show grey ghost glow until acknowledged
- [ ] Changes show user attribution
- [ ] Changes can be marked as seen
