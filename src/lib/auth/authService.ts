import * as odd from '@oddjs/odd';
import type FileSystem from '@oddjs/odd/fs/index';
import { checkDataRoot, initializeFilesystem, isUsernameValid, isUsernameAvailable } from './account';
import { getBackupStatus } from './backup';
import { Session } from './types';
import { CryptoAuthService } from './cryptoAuthService';
import { loadSession, saveSession, clearStoredSession, getStoredUsername } from './sessionPersistence';

export class AuthService {
  /**
   * Initialize the authentication state
   */
  static async initialize(): Promise<{
    session: Session;
    fileSystem: FileSystem | null;
  }> {
    console.log('Initializing authentication...');
    
    // First try to load stored session
    const storedSession = loadSession();
    let session: Session;
    let fileSystem: FileSystem | null = null;

    if (storedSession && storedSession.authed && storedSession.username) {
      console.log('Found stored session for:', storedSession.username);
      
      // Try to restore ODD session with stored username
      try {
        const program = await odd.program({
          namespace: { creator: 'mycrozine', name: 'app' },
          username: storedSession.username
        });
        
        if (program.session) {
          // ODD session restored successfully
          fileSystem = program.session.fs;
          const backupStatus = await getBackupStatus(fileSystem);
          session = {
            username: storedSession.username,
            authed: true,
            loading: false,
            backupCreated: backupStatus.created
          };
          console.log('ODD session restored successfully');
        } else {
          // ODD session not available, but we have crypto auth
          session = {
            username: storedSession.username,
            authed: true,
            loading: false,
            backupCreated: storedSession.backupCreated
          };
          console.log('Using stored session without ODD');
        }
      } catch (oddError) {
        console.warn('ODD session restoration failed, using stored session:', oddError);
        session = {
          username: storedSession.username,
          authed: true,
          loading: false,
          backupCreated: storedSession.backupCreated
        };
      }
    } else {
      // No stored session, try ODD initialization
      try {
        const program = await odd.program({
          namespace: { creator: 'mycrozine', name: 'app' }
        });
        
        if (program.session) {
          fileSystem = program.session.fs;
          const backupStatus = await getBackupStatus(fileSystem);
          session = {
            username: program.session.username,
            authed: true,
            loading: false,
            backupCreated: backupStatus.created
          };
        } else {
          session = {
            username: '',
            authed: false,
            loading: false,
            backupCreated: null
          };
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
        session = {
          username: '',
          authed: false,
          loading: false,
          backupCreated: null,
          error: String(error)
        };
      }
    }

    return { session, fileSystem };
  }

  /**
   * Login with a username using cryptographic authentication
   */
  static async login(username: string): Promise<{
    success: boolean;
    session?: Session;
    fileSystem?: FileSystem;
    error?: string;
  }> {
    try {
      // First try cryptographic authentication
      const cryptoResult = await CryptoAuthService.login(username);
      
      if (cryptoResult.success && cryptoResult.session) {
        // If crypto auth succeeds, also try to load ODD session
        try {
          const program = await odd.program({
            namespace: { creator: 'mycrozine', name: 'app' },
            username
          });
          
          if (program.session) {
            const fs = program.session.fs;
            const backupStatus = await getBackupStatus(fs);
            
            return {
              success: true,
              session: {
                username,
                authed: true,
                loading: false,
                backupCreated: backupStatus.created
              },
              fileSystem: fs
            };
          }
        } catch (oddError) {
          console.warn('ODD session not available, using crypto auth only:', oddError);
        }
        
        // Return crypto auth result if ODD is not available
        const session = cryptoResult.session;
        if (session) {
          saveSession(session);
        }
        return {
          success: true,
          session: cryptoResult.session,
          fileSystem: undefined
        };
      }
      
      // Fallback to ODD authentication
      const program = await odd.program({
        namespace: { creator: 'mycrozine', name: 'app' },
        username
      });
      
              if (program.session) {
          const fs = program.session.fs;
          const backupStatus = await getBackupStatus(fs);
          
          const session = {
            username,
            authed: true,
            loading: false,
            backupCreated: backupStatus.created
          };
          saveSession(session);
          
          return {
            success: true,
            session,
            fileSystem: fs
          };
      } else {
        return {
          success: false,
          error: cryptoResult.error || 'Failed to authenticate'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
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
    fileSystem?: FileSystem;
    error?: string;
  }> {
    try {
      // Validate username
      const valid = await isUsernameValid(username);
      if (!valid) {
        return {
          success: false,
          error: 'Invalid username format'
        };
      }
      
      // First try cryptographic registration
      const cryptoResult = await CryptoAuthService.register(username);
      
      if (cryptoResult.success && cryptoResult.session) {
        // If crypto registration succeeds, also try to create ODD session
        try {
          const program = await odd.program({
            namespace: { creator: 'mycrozine', name: 'app' },
            username
          });
          
          if (program.session) {
            const fs = program.session.fs;
            
            // Initialize filesystem with required directories
            await initializeFilesystem(fs);
            
            // Check backup status
            const backupStatus = await getBackupStatus(fs);
            
            return {
              success: true,
              session: {
                username,
                authed: true,
                loading: false,
                backupCreated: backupStatus.created
              },
              fileSystem: fs
            };
          }
        } catch (oddError) {
          console.warn('ODD session creation failed, using crypto auth only:', oddError);
        }
        
        // Return crypto registration result if ODD is not available
        const session = cryptoResult.session;
        if (session) {
          saveSession(session);
        }
        return {
          success: true,
          session: cryptoResult.session,
          fileSystem: undefined
        };
      }
      
      // Fallback to ODD-only registration
      const program = await odd.program({
        namespace: { creator: 'mycrozine', name: 'app' },
        username
      });
      
      if (program.session) {
        const fs = program.session.fs;
        
        // Initialize filesystem with required directories
        await initializeFilesystem(fs);
        
        // Check backup status
        const backupStatus = await getBackupStatus(fs);
        
        const session = {
          username,
          authed: true,
          loading: false,
          backupCreated: backupStatus.created
        };
        saveSession(session);
        return {
          success: true,
          session,
          fileSystem: fs
        };
      } else {
        return {
          success: false,
          error: cryptoResult.error || 'Failed to create account'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
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
      
      // Try to destroy ODD session
      try {
        await odd.session.destroy();
      } catch (oddError) {
        console.warn('ODD session destroy failed:', oddError);
      }
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }
} 