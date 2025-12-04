/**
 * Permission Types and Utilities
 *
 * Defines roles and permissions for board access control.
 * Currently uses localStorage-based role assignment per board.
 * Can be extended to integrate with server-side permission checking.
 */

export type BoardRole = 'admin' | 'editor' | 'viewer';

export interface BoardPermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRevert: boolean;
  canRestoreDeleted: boolean;
  canViewHistory: boolean;
  canMarkAsSeen: boolean;
}

/**
 * Permission matrix by role
 */
const ROLE_PERMISSIONS: Record<BoardRole, BoardPermission> = {
  admin: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canRevert: true,
    canRestoreDeleted: true,
    canViewHistory: true,
    canMarkAsSeen: true,
  },
  editor: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canRevert: false, // Editors cannot revert to old versions
    canRestoreDeleted: true,
    canViewHistory: true,
    canMarkAsSeen: true,
  },
  viewer: {
    canView: true,
    canEdit: false,
    canDelete: false,
    canRevert: false,
    canRestoreDeleted: false,
    canViewHistory: true, // Viewers can see history but not act on it
    canMarkAsSeen: true,
  },
};

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: BoardRole): BoardPermission {
  return ROLE_PERMISSIONS[role];
}

/**
 * Storage key for user role per board
 */
function getRoleStorageKey(userId: string, boardId: string): string {
  return `board_role_${userId}_${boardId}`;
}

/**
 * Get the user's role for a specific board
 * Falls back to 'editor' if not set (default for authenticated users)
 */
export function getUserBoardRole(userId: string, boardId: string): BoardRole {
  if (!userId) return 'viewer'; // Unauthenticated users are viewers

  try {
    const stored = localStorage.getItem(getRoleStorageKey(userId, boardId));
    if (stored && ['admin', 'editor', 'viewer'].includes(stored)) {
      return stored as BoardRole;
    }
  } catch (error) {
    console.warn('Error reading board role:', error);
  }

  // Default: check if user is the board creator
  const boardCreator = getBoardCreator(boardId);
  if (boardCreator === userId) {
    return 'admin';
  }

  return 'editor'; // Default for authenticated users
}

/**
 * Set the user's role for a specific board (admin-only operation)
 */
export function setUserBoardRole(userId: string, boardId: string, role: BoardRole): void {
  try {
    localStorage.setItem(getRoleStorageKey(userId, boardId), role);
  } catch (error) {
    console.error('Error saving board role:', error);
  }
}

/**
 * Storage key for board creator
 */
function getCreatorStorageKey(boardId: string): string {
  return `board_creator_${boardId}`;
}

/**
 * Get the creator of a board
 */
export function getBoardCreator(boardId: string): string | null {
  try {
    return localStorage.getItem(getCreatorStorageKey(boardId));
  } catch (error) {
    console.warn('Error reading board creator:', error);
    return null;
  }
}

/**
 * Set the creator of a board (called when board is created)
 */
export function setBoardCreator(boardId: string, userId: string): void {
  try {
    const existing = getBoardCreator(boardId);
    if (!existing) {
      localStorage.setItem(getCreatorStorageKey(boardId), userId);
    }
  } catch (error) {
    console.error('Error saving board creator:', error);
  }
}

/**
 * Check if user has a specific permission on a board
 */
export function hasPermission(
  userId: string,
  boardId: string,
  permission: keyof BoardPermission
): boolean {
  const role = getUserBoardRole(userId, boardId);
  const permissions = getPermissionsForRole(role);
  return permissions[permission];
}

/**
 * Get all permissions for a user on a board
 */
export function getUserBoardPermissions(userId: string, boardId: string): BoardPermission {
  const role = getUserBoardRole(userId, boardId);
  return getPermissionsForRole(role);
}

/**
 * React hook-friendly permission checker
 * Returns permission object and role for a user on a board
 */
export interface UserPermissionContext {
  role: BoardRole;
  permissions: BoardPermission;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
}

export function getUserPermissionContext(userId: string, boardId: string): UserPermissionContext {
  const role = getUserBoardRole(userId, boardId);
  const permissions = getPermissionsForRole(role);

  return {
    role,
    permissions,
    isAdmin: role === 'admin',
    isEditor: role === 'editor',
    isViewer: role === 'viewer',
  };
}
