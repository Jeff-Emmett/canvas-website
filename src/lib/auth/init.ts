import * as crypto from './crypto';
import { Session } from './types';

// Debug flag to enable detailed logging
const DEBUG = true;

/**
 * Initializes the authentication system
 * This now only checks if the browser supports required features
 * but does NOT attempt to authenticate the user automatically
 */
export const initialize = async (): Promise<Session> => {
  if (DEBUG) console.log('Initializing authentication system...');
  
  // Always return unauthenticated state initially
  // Authentication will only happen when user explicitly clicks the Sign In button
  return {
    username: '',
    authed: false,
    loading: false,
    backupCreated: null,
  };
};

/**
 * Checks if there's an existing valid session
 * This is only called when the user explicitly tries to authenticate
 */
export const checkExistingSession = async (): Promise<Session | null> => {
  if (!crypto.isBrowser()) return null;
  
  try {
    // Check if the browser supports the Web Crypto API
    if (!window.crypto || !window.crypto.subtle) {
      if (DEBUG) console.error('Web Crypto API not supported');
      return {
        username: '',
        authed: false,
        loading: false,
        backupCreated: null,
        error: 'Unsupported Browser',
      };
    }
    
    // Check for an existing session in localStorage
    const sessionData = localStorage.getItem('authSession');
    if (sessionData) {
      try {
        const parsedSession = JSON.parse(sessionData);
        const username = parsedSession.username;
        
        // Verify the username exists in our registered users
        const users = crypto.getRegisteredUsers();
        if (users.includes(username)) {
          if (DEBUG) console.log('Existing session found for user:', username);
          
          // In a real-world scenario, you'd verify the session validity here
          return {
            username,
            authed: true,
            loading: false,
            backupCreated: true,
          };
        }
      } catch (error) {
        if (DEBUG) console.error('Error parsing session data:', error);
      }
    }
    
    // No valid session found
    if (DEBUG) console.log('No valid session found');
    return null;
  } catch (error) {
    console.error('Error checking existing session:', error);
    
    if (error instanceof Error && error.name === 'SecurityError') {
      return {
        username: '',
        authed: false,
        loading: false,
        backupCreated: null,
        error: 'Insecure Context',
      };
    }
    
    return {
      username: '',
      authed: false,
      loading: false,
      backupCreated: null,
      error: 'Unsupported Browser',
    };
  }
};

/**
 * Saves the current session to localStorage
 * @param session The session to save
 */
export const saveSession = (session: Session): void => {
  if (!crypto.isBrowser()) return;
  
  try {
    // Only save if the user is authenticated
    if (session.authed && session.username) {
      const sessionData = {
        username: session.username,
        timestamp: new Date().getTime(),
      };
      
      localStorage.setItem('authSession', JSON.stringify(sessionData));
      if (DEBUG) console.log('Session saved for user:', session.username);
    } else {
      // Clear any existing session
      localStorage.removeItem('authSession');
      if (DEBUG) console.log('Session cleared');
    }
  } catch (error) {
    console.error('Error saving session:', error);
  }
};

/**
 * Clears the current session
 */
export const clearSession = (): void => {
  if (!crypto.isBrowser()) return;
  
  try {
    localStorage.removeItem('authSession');
    if (DEBUG) console.log('Session cleared');
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};