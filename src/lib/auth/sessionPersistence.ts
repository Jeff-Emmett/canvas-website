// Session persistence service for maintaining authentication state across browser sessions

import { Session } from './types';

const SESSION_STORAGE_KEY = 'canvas_auth_session';

export interface StoredSession {
  username: string;
  authed: boolean;
  timestamp: number;
  backupCreated: boolean | null;
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
      backupCreated: session.backupCreated
    };
    
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    console.log('Session saved to localStorage:', storedSession);
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
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
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as StoredSession;
    
    // Check if session is not too old (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (Date.now() - parsed.timestamp > maxAge) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      console.log('Session expired, removed from localStorage');
      return null;
    }
    
    console.log('Session loaded from localStorage:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error loading session:', error);
    return null;
  }
};

/**
 * Clear stored session
 */
export const clearStoredSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing session:', error);
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