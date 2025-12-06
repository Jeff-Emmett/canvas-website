import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
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
        setSessionState(result.session);

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
        setSessionState(result.session);

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
    clearStoredSession();
    setSessionState({
      username: '',
      authed: false,
      loading: false,
      backupCreated: null,
      obsidianVaultPath: undefined,
      obsidianVaultName: undefined
    });
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

  /**
   * Fetch and cache the user's permission level for a specific board
   */
  const fetchBoardPermission = useCallback(async (boardId: string): Promise<PermissionLevel> => {
    // Check cache first
    if (session.boardPermissions?.[boardId]) {
      return session.boardPermissions[boardId];
    }

    try {
      // Get public key for auth header if user is authenticated
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session.authed && session.username) {
        const publicKey = crypto.getPublicKey(session.username);
        if (publicKey) {
          headers['X-CryptID-PublicKey'] = publicKey;
        }
      }

      const response = await fetch(`${WORKER_URL}/boards/${boardId}/permission`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('Failed to fetch board permission:', response.status);
        // Default to 'view' for unauthenticated, 'edit' for authenticated
        return session.authed ? 'edit' : 'view';
      }

      const data = await response.json() as {
        permission: PermissionLevel;
        isOwner: boolean;
        boardExists: boolean;
      };

      // Cache the permission
      setSessionState(prev => ({
        ...prev,
        currentBoardPermission: data.permission,
        boardPermissions: {
          ...prev.boardPermissions,
          [boardId]: data.permission,
        },
      }));

      return data.permission;
    } catch (error) {
      console.error('Error fetching board permission:', error);
      // Default to 'view' for unauthenticated, 'edit' for authenticated
      return session.authed ? 'edit' : 'view';
    }
  }, [session.authed, session.username, session.boardPermissions]);

  /**
   * Check if user can edit the current board
   */
  const canEdit = useCallback((): boolean => {
    const permission = session.currentBoardPermission;
    if (!permission) {
      // If no permission set, default based on auth status
      return session.authed;
    }
    return permission === 'edit' || permission === 'admin';
  }, [session.currentBoardPermission, session.authed]);

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
  }), [session, setSession, clearSession, initialize, login, register, logout, fetchBoardPermission, canEdit, isAdmin]);

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
