import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { Session, SessionError, PermissionLevel } from '../lib/auth/types';
import { AuthService } from '../lib/auth/authService';
import { saveSession, clearStoredSession } from '../lib/auth/sessionPersistence';
import { WORKER_URL } from '../constants/workerUrl';
import * as crypto from '../lib/auth/crypto';

interface AuthContextType {
  session: Session;
  setSession: (updatedSession: Partial<Session>) => void;
  updateSession: (updatedSession: Partial<Session>) => void;
  clearSession: () => void;
  initialize: () => Promise<void>;
  login: (username: string) => Promise<boolean>;
  register: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Fetch and cache the user's permission level for a specific board */
  fetchBoardPermission: (boardId: string) => Promise<PermissionLevel>;
  /** Check if user can edit the current board */
  canEdit: () => boolean;
  /** Check if user is admin for the current board */
  isAdmin: () => boolean;
  /** Current access token from URL (if any) */
  accessToken: string | null;
  /** Set access token (from URL parameter) */
  setAccessToken: (token: string | null) => void;
}

const initialSession: Session = {
  username: '',
  authed: false,
  loading: true,
  backupCreated: null,
  obsidianVaultPath: undefined,
  obsidianVaultName: undefined
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<Session>(initialSession);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  // Track when auth state changes to bypass cache for a short period
  // This prevents stale callbacks from using old cached permissions
  const authChangedAtRef = useRef<number>(0);

  // Extract access token from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('🔑 Access token found in URL');
      setAccessTokenState(token);
      // Optionally remove from URL to clean it up (but keep the token in state)
      // This prevents the token from being shared if someone copies the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  // Update session with partial data
  const setSession = useCallback((updatedSession: Partial<Session>) => {
    setSessionState(prev => {
      const newSession = { ...prev, ...updatedSession };

      // Save session to localStorage if authenticated
      if (newSession.authed && newSession.username) {
        saveSession(newSession);
      }

      return newSession;
    });
  }, []);

  /**
   * Initialize the authentication state
   */
  const initialize = useCallback(async (): Promise<void> => {
    setSessionState(prev => ({ ...prev, loading: true }));

    try {
      const { session: newSession } = await AuthService.initialize();
      setSessionState(newSession);

      // Save session to localStorage if authenticated
      if (newSession.authed && newSession.username) {
        saveSession(newSession);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        loading: false,
        authed: false,
        error: error as SessionError
      }));
    }
  }, []);

  /**
   * Login with a username
   */
  const login = useCallback(async (username: string): Promise<boolean> => {
    setSessionState(prev => ({ ...prev, loading: true }));

    try {
      const result = await AuthService.login(username);

      if (result.success && result.session) {
        // IMPORTANT: Mark auth as just changed - prevents stale callbacks from using cache
        authChangedAtRef.current = Date.now();

        // IMPORTANT: Clear permission cache when auth state changes
        // This forces a fresh permission fetch with the new credentials
        setSessionState({
          ...result.session,
          boardPermissions: {},
          currentBoardPermission: undefined,
        });
        console.log('🔐 Login successful - cleared permission cache, authChangedAt:', authChangedAtRef.current);

        // Save session to localStorage if authenticated
        if (result.session.authed && result.session.username) {
          saveSession(result.session);
        }
        return true;
      } else {
        setSessionState(prev => ({
          ...prev,
          loading: false,
          error: result.error as SessionError
        }));
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setSessionState(prev => ({
        ...prev,
        loading: false,
        error: error as SessionError
      }));
      return false;
    }
  }, []);

  /**
   * Register a new user
   */
  const register = useCallback(async (username: string): Promise<boolean> => {
    setSessionState(prev => ({ ...prev, loading: true }));

    try {
      const result = await AuthService.register(username);

      if (result.success && result.session) {
        // IMPORTANT: Mark auth as just changed - prevents stale callbacks from using cache
        authChangedAtRef.current = Date.now();

        // IMPORTANT: Clear permission cache when auth state changes
        // This forces a fresh permission fetch with the new credentials
        setSessionState({
          ...result.session,
          boardPermissions: {},
          currentBoardPermission: undefined,
        });
        console.log('🔐 Registration successful - cleared permission cache, authChangedAt:', authChangedAtRef.current);

        // Save session to localStorage if authenticated
        if (result.session.authed && result.session.username) {
          saveSession(result.session);
        }
        return true;
      } else {
        setSessionState(prev => ({
          ...prev,
          loading: false,
          error: result.error as SessionError
        }));
        return false;
      }
    } catch (error) {
      console.error('Register error:', error);
      setSessionState(prev => ({
        ...prev,
        loading: false,
        error: error as SessionError
      }));
      return false;
    }
  }, []);

  /**
   * Clear the current session
   */
  const clearSession = useCallback((): void => {
    // IMPORTANT: Mark auth as just changed - prevents stale callbacks from using cache
    authChangedAtRef.current = Date.now();

    clearStoredSession();
    setSessionState({
      username: '',
      authed: false,
      loading: false,
      backupCreated: null,
      obsidianVaultPath: undefined,
      obsidianVaultName: undefined,
      // IMPORTANT: Clear permission cache on logout to force fresh fetch on next login
      boardPermissions: {},
      currentBoardPermission: undefined,
    });
    console.log('🔐 Session cleared - marked auth as changed, authChangedAt:', authChangedAtRef.current);
  }, []);

  /**
   * Logout the current user
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await AuthService.logout();
      clearSession();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [clearSession]);

  // Setter for access token
  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    // Clear cached permissions when token changes (they may be different)
    if (token) {
      setSessionState(prev => ({
        ...prev,
        boardPermissions: {},
        currentBoardPermission: undefined,
      }));
    }
  }, []);

  /**
   * Fetch and cache the user's permission level for a specific board
   * Includes access token if available (from share link)
   */
  const fetchBoardPermission = useCallback(async (boardId: string): Promise<PermissionLevel> => {
    // IMPORTANT: Check if auth state changed recently (within last 5 seconds)
    // If so, bypass cache entirely to prevent stale callbacks from returning old cached values
    const authChangedRecently = Date.now() - authChangedAtRef.current < 5000;
    if (authChangedRecently) {
      console.log('🔐 Auth changed recently, bypassing permission cache');
    }

    // Check cache first (but only if no access token and auth didn't just change)
    if (!accessToken && !authChangedRecently && session.boardPermissions?.[boardId]) {
      console.log('🔐 Using cached permission for board:', boardId, session.boardPermissions[boardId]);
      return session.boardPermissions[boardId];
    }

    try {
      // Get public key for auth header if user is authenticated
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      let publicKeyUsed: string | null = null;
      if (session.authed && session.username) {
        const publicKey = crypto.getPublicKey(session.username);
        if (publicKey) {
          headers['X-CryptID-PublicKey'] = publicKey;
          publicKeyUsed = publicKey;
        }
      }

      // Debug: Log what we're sending
      console.log('🔐 fetchBoardPermission:', {
        boardId,
        sessionAuthed: session.authed,
        sessionUsername: session.username,
        publicKeyUsed: publicKeyUsed ? `${publicKeyUsed.substring(0, 20)}...` : null,
        hasAccessToken: !!accessToken
      });

      // Build URL with optional access token
      let url = `${WORKER_URL}/boards/${boardId}/permission`;
      if (accessToken) {
        url += `?token=${encodeURIComponent(accessToken)}`;
        console.log('🔑 Including access token in permission check');
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('Failed to fetch board permission:', response.status);
        // NEW: Default to 'edit' for everyone (open by default)
        console.log('🔐 Using default permission (API failed): edit');
        return 'edit';
      }

      const data = await response.json() as {
        permission: PermissionLevel;
        isOwner: boolean;
        boardExists: boolean;
        grantedByToken?: boolean;
        isExplicitPermission?: boolean; // Whether this permission was explicitly set
        isProtected?: boolean; // Whether board is in protected mode
        isGlobalAdmin?: boolean; // Whether user is global admin
      };

      // Debug: Log what we received
      console.log('🔐 Permission response:', data);

      if (data.grantedByToken) {
        console.log('🔓 Permission granted via access token:', data.permission);
      }
      if (data.isGlobalAdmin) {
        console.log('🔓 User is global admin');
      }

      // NEW PERMISSION MODEL (Dec 2024):
      // - Everyone (including anonymous) can EDIT by default
      // - Only protected boards restrict editing to listed editors
      // The backend now returns the correct permission, so we just use it directly
      let effectivePermission = data.permission;

      // Log why view permission was given (for debugging protected boards)
      if (data.permission === 'view' && data.isProtected) {
        console.log('🔒 View-only: board is protected and user is not an editor');
      }

      // Cache the permission
      setSessionState(prev => ({
        ...prev,
        currentBoardPermission: effectivePermission,
        boardPermissions: {
          ...prev.boardPermissions,
          [boardId]: effectivePermission,
        },
      }));

      return effectivePermission;
    } catch (error) {
      console.error('Error fetching board permission:', error);
      // NEW: Default to 'edit' for everyone (open by default)
      console.log('🔐 Using default permission (error): edit');
      return 'edit';
    }
  }, [session.authed, session.username, session.boardPermissions, accessToken]);

  /**
   * Check if user can edit the current board
   * NEW: Returns true by default (open permission model)
   */
  const canEdit = useCallback((): boolean => {
    const permission = session.currentBoardPermission;
    if (!permission) {
      // NEW: If no permission set, default to edit (open by default)
      return true;
    }
    return permission === 'edit' || permission === 'admin';
  }, [session.currentBoardPermission]);

  /**
   * Check if user is admin for the current board
   */
  const isAdmin = useCallback((): boolean => {
    return session.currentBoardPermission === 'admin';
  }, [session.currentBoardPermission]);

  // Initialize on mount
  useEffect(() => {
    try {
      initialize();
    } catch (error) {
      console.error('Auth initialization error in useEffect:', error);
      // Set a safe fallback state
      setSessionState(prev => ({
        ...prev,
        loading: false,
        authed: false
      }));
    }
  }, []); // Empty dependency array - only run once on mount

  const contextValue: AuthContextType = useMemo(() => ({
    session,
    setSession,
    updateSession: setSession,
    clearSession,
    initialize,
    login,
    register,
    logout,
    fetchBoardPermission,
    canEdit,
    isAdmin,
    accessToken,
    setAccessToken,
  }), [session, setSession, clearSession, initialize, login, register, logout, fetchBoardPermission, canEdit, isAdmin, accessToken, setAccessToken]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
