import { clearStoredSession } from './auth/sessionPersistence';

/**
 * Clear the current session and stored data
 */
export const clearSession = (): void => {
  clearStoredSession();
}; 