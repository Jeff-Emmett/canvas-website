/**
 * usePermissions Hook
 *
 * React hook for accessing user permissions on a board.
 * Integrates with AuthContext and permission utilities.
 */

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getUserPermissionContext,
  UserPermissionContext,
  BoardPermission,
  BoardRole,
} from '../lib/permissions';

export interface UsePermissionsReturn extends UserPermissionContext {
  userId: string | undefined;
  boardId: string;
  isAuthenticated: boolean;
  loading: boolean;
  // Convenience permission checks
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRevert: boolean;
  canRestoreDeleted: boolean;
  canViewHistory: boolean;
  canMarkAsSeen: boolean;
}

/**
 * Hook to get current user's permissions for a board
 */
export function usePermissions(boardId: string): UsePermissionsReturn {
  const { session } = useAuth();
  const userId = session.authed ? session.username : undefined;

  const permissionContext = useMemo(() => {
    return getUserPermissionContext(userId || '', boardId);
  }, [userId, boardId]);

  return {
    userId,
    boardId,
    isAuthenticated: session.authed,
    loading: session.loading,
    ...permissionContext,
    // Flatten permissions for convenience
    canView: permissionContext.permissions.canView,
    canEdit: permissionContext.permissions.canEdit,
    canDelete: permissionContext.permissions.canDelete,
    canRevert: permissionContext.permissions.canRevert,
    canRestoreDeleted: permissionContext.permissions.canRestoreDeleted,
    canViewHistory: permissionContext.permissions.canViewHistory,
    canMarkAsSeen: permissionContext.permissions.canMarkAsSeen,
  };
}

export default usePermissions;
