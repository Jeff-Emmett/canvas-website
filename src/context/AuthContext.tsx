import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  backupCreated: null
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<Session>(initialSession);
  const [fileSystem, setFileSystemState] = useState<FileSystem | null>(null);

  // Update session with partial data
  const setSession = (updatedSession: Partial<Session>) => {
    setSessionState(prev => {
      const newSession = { ...prev, ...updatedSession };
      
      // Save session to localStorage if authenticated
      if (newSession.authed && newSession.username) {
        saveSession(newSession);
      }
      
      return newSession;
    });
  };

  // Set file system
  const setFileSystem = (fs: FileSystem | null) => {
    setFileSystemState(fs);
  };

  /**
   * Initialize the authentication state
   */
  const initialize = async (): Promise<void> => {
    setSession({ loading: true });
    
    try {
      const { session: newSession, fileSystem: newFs } = await AuthService.initialize();
      setSession(newSession);
      setFileSystem(newFs);
    } catch (error) {
      setSession({ 
        loading: false, 
        authed: false,
        error: error as SessionError
      });
    }
  };

  /**
   * Login with a username
   */
  const login = async (username: string): Promise<boolean> => {
    setSession({ loading: true });
    
    const result = await AuthService.login(username);
    
    if (result.success && result.session && result.fileSystem) {
      setSession(result.session);
      setFileSystem(result.fileSystem);
      return true;
    } else {
      setSession({ 
        loading: false,
        error: result.error as SessionError
      });
      return false;
    }
  };

  /**
   * Register a new user
   */
  const register = async (username: string): Promise<boolean> => {
    setSession({ loading: true });
    
    const result = await AuthService.register(username);
    
    if (result.success && result.session && result.fileSystem) {
      setSession(result.session);
      setFileSystem(result.fileSystem);
      return true;
    } else {
      setSession({ 
        loading: false,
        error: result.error as SessionError
      });
      return false;
    }
  };

  /**
   * Clear the current session
   */
  const clearSession = (): void => {
    clearStoredSession();
    setSession({
      username: '',
      authed: false,
      loading: false,
      backupCreated: null
    });
    setFileSystem(null);
  };

  /**
   * Logout the current user
   */
  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
      clearSession();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, []);

  const contextValue: AuthContextType = {
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
  };

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