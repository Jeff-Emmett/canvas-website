/**
 * Permission levels for board access:
 * - 'view': Read-only access, cannot create/edit/delete shapes
 * - 'edit': Can create, edit, and delete shapes
 * - 'admin': Full access including permission management and board settings
 */
export type PermissionLevel = 'view' | 'edit' | 'admin';

export interface Session {
  username: string;
  authed: boolean;
  loading: boolean;
  backupCreated: boolean | null;
  obsidianVaultPath?: string;
  obsidianVaultName?: string;
  error?: string;
  // Board permission for current board (populated when viewing a board)
  currentBoardPermission?: PermissionLevel;
  // Cache of board permissions by board ID
  boardPermissions?: Record<string, PermissionLevel>;
}

export enum SessionError {
  PROGRAM_FAILURE = 'PROGRAM_FAILURE',
  FILESYSTEM_INIT_FAILURE = 'FILESYSTEM_INIT_FAILURE',
  DATAROOT_NOT_FOUND = 'DATAROOT_NOT_FOUND',
  UNKNOWN = 'UNKNOWN'
}

export const errorToMessage = (error: SessionError): string | undefined => {
  switch (error) {
    case SessionError.PROGRAM_FAILURE:
      return `Program failure occurred`;

    case SessionError.FILESYSTEM_INIT_FAILURE:
      return `Failed to initialize filesystem`;

    case SessionError.DATAROOT_NOT_FOUND:
      return `Data root not found`;

    case SessionError.UNKNOWN:
      return `An unknown error occurred`;

    default:
      return undefined;
  }
};
  