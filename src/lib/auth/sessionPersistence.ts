// Session persistence service for maintaining authentication state across browser sessions

import { Session } from './types';

const SESSION_STORAGE_KEY = 'canvas_auth_session';

export interface StoredSession {
  username: string;
  authed: boolean;
  timestamp: number;
  backupCreated: boolean | null;
  obsidianVaultPath?: string;
  obsidianVaultName?: string;
}

/**
 * Save session to localStorage
 */
export const saveSession = (session: Session): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const storedSession: StoredSession = {
      username: session.username,
      authed: session.authed,
      timestamp: Date.now(),
      backupCreated: session.backupCreated,
      obsidianVaultPath: session.obsidianVaultPath,
      obsidianVaultName: session.obsidianVaultName
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));

    // Dispatch event to notify components that session was saved (e.g., after login)
    // This helps components like Board.tsx update their state immediately
    if (session.authed && session.username) {
      window.dispatchEvent(new CustomEvent('session-logged-in', {
        detail: { username: session.username }
      }));
    }

    return true;
  } catch (error) {
    console.error('🔧 Error saving session:', error);
    return false;
  }
};

/**
 * Load session from localStorage
 */
export const loadSession = (): StoredSession | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as StoredSession;

    // Check if session is not too old (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (Date.now() - parsed.timestamp > maxAge) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('🔧 Error loading session:', error);
    return null;
  }
};

/**
 * Clear stored session and all related user data
 * This ensures a clean slate when logging out
 */
export const clearStoredSession = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    // Get the current username before clearing (to clean up user-specific keys)
    const currentSession = loadSession();
    const username = currentSession?.username;

    // Clear the main session
    localStorage.removeItem(SESSION_STORAGE_KEY);

    // IMPORTANT: Do NOT clear tldraw-user-id-* keys!
    // These must persist so the same user keeps the same presence ID across login/logout cycles.
    // If we clear them, each login creates a NEW presence ID, but old presence records
    // persist in the shared Automerge document and sync back - causing stacked cursors.

    // IMPORTANT: Do NOT clear crypto keys or user account data - they must persist for re-login!
    // The following are PRESERVED across logout (tied to user ACCOUNT, not session):
    // - tldraw-user-id-${username} (presence ID - must stay same to avoid duplicate cursors)
    // - ${username}_authData (crypto challenge/signature required for login)
    // - ${username}_publicKey (public key for verification)
    // - ${username}_fathomApiKey (integration credentials)
    // - ${username}_miroApiKey (integration credentials)
    // - registeredUsers (list of registered accounts on this device)
    //
    // Only SESSION-SPECIFIC data is cleared below:

    // Clear any cached permission data (session-specific)
    localStorage.removeItem('boardPermissions');
    localStorage.removeItem('currentBoardPermission');

    // Clear network graph cache to force fresh state (session-specific)
    localStorage.removeItem('network_graph_cache');

    // Clear current room ID to prevent stale room associations (session-specific)
    localStorage.removeItem('currentRoomId');

    // Dispatch event to notify all components to clear their state
    // This helps ensure components like CryptIDDropdown, NetworkGraphPanel, etc.
    // properly reset their internal state
    window.dispatchEvent(new CustomEvent('session-cleared', {
      detail: { previousUsername: username }
    }));

    return true;
  } catch (error) {
    console.error('🔧 Error clearing session:', error);
    return false;
  }
};

/**
 * Check if user has valid stored session
 */
export const hasValidStoredSession = (): boolean => {
  const session = loadSession();
  return session !== null && session.authed && session.username !== null;
};

/**
 * Get stored username
 */
export const getStoredUsername = (): string | null => {
  const session = loadSession();
  return session?.username || null;
}; 