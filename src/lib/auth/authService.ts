import { Session } from './types';
import { CryptoAuthService } from './cryptoAuthService';
import { loadSession, saveSession, clearStoredSession } from './sessionPersistence';

export class AuthService {
  /**
   * Initialize the authentication state
   */
  static async initialize(): Promise<{
    session: Session;
  }> {
    // Try to load stored session
    const storedSession = loadSession();
    let session: Session;

    if (storedSession && storedSession.authed && storedSession.username) {
      // Restore existing session
      session = {
        username: storedSession.username,
        authed: true,
        loading: false,
        backupCreated: storedSession.backupCreated,
        obsidianVaultPath: storedSession.obsidianVaultPath,
        obsidianVaultName: storedSession.obsidianVaultName
      };
    } else {
      // No stored session
      session = {
        username: '',
        authed: false,
        loading: false,
        backupCreated: null
      };
    }

    return { session };
  }

  /**
   * Login with a username using cryptographic authentication
   */
  static async login(username: string): Promise<{
    success: boolean;
    session?: Session;
    error?: string;
  }> {
    try {
      // Use cryptographic authentication
      const cryptoResult = await CryptoAuthService.login(username);

      if (cryptoResult.success && cryptoResult.session) {
        const session = cryptoResult.session;
        saveSession(session);
        return {
          success: true,
          session: cryptoResult.session
        };
      }

      return {
        success: false,
        error: cryptoResult.error || 'Failed to authenticate'
      };
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Register a new user with cryptographic authentication
   */
  static async register(username: string): Promise<{
    success: boolean;
    session?: Session;
    error?: string;
  }> {
    try {
      // Validate username format (basic check)
      if (!username || username.length < 3) {
        return {
          success: false,
          error: 'Username must be at least 3 characters'
        };
      }

      // Use cryptographic registration
      const cryptoResult = await CryptoAuthService.register(username);

      if (cryptoResult.success && cryptoResult.session) {
        const session = cryptoResult.session;
        saveSession(session);
        return {
          success: true,
          session: cryptoResult.session
        };
      }

      return {
        success: false,
        error: cryptoResult.error || 'Failed to create account'
      };
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Logout the current user
   */
  static async logout(): Promise<boolean> {
    try {
      // Clear stored session
      clearStoredSession();
      return true;
    } catch (error) {
      return false;
    }
  }
}
