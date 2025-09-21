import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type FileSystem from '@oddjs/odd/fs/index';
import { Session, SessionError } from '../lib/auth/types';
import { AuthService } from '../lib/auth/authService';
import { saveSession, clearStoredSession } from '../lib/auth/sessionPersistence';

interface AuthContextType {
  session: Session;
  setSession: (updatedSession: Partial<Session>) => void;
  updateSession: (updatedSession: Partial<Session>) => void;
  clearSession: () => void;
  fileSystem: FileSystem | null;
  setFileSystem: (fs: FileSystem | null) => void;
  initialize: () => Promise<void>;
  login: (username: string) => Promise<boolean>;
  register: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const initialSession: Session = {
  username: '',
  authed: false,
  loading: true,
  backupCreated: null,
  obsidianVaultPath: undefined,
  obsidianVaultName: undefined
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<Session>(initialSession);
  const [fileSystem, setFileSystemState] = useState<FileSystem | null>(null);

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

  // Set file system
  const setFileSystem = useCallback((fs: FileSystem | null) => {
    setFileSystemState(fs);
  }, []);

  /**
   * Initialize the authentication state
   */
  const initialize = useCallback(async (): Promise<void> => {
    setSessionState(prev => ({ ...prev, loading: true }));
    
    try {
      const { session: newSession, fileSystem: newFs } = await AuthService.initialize();
      setSessionState(newSession);
      setFileSystemState(newFs);
      
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
      
      if (result.success && result.session && result.fileSystem) {
        setSessionState(result.session);
        setFileSystemState(result.fileSystem);
        
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
      
      if (result.success && result.session && result.fileSystem) {
        setSessionState(result.session);
        setFileSystemState(result.fileSystem);
        
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
    setFileSystemState(null);
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
    fileSystem,
    setFileSystem,
    initialize,
    login,
    register,
    logout
  }), [session, setSession, clearSession, fileSystem, setFileSystem, initialize, login, register, logout]);

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