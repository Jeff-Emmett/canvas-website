import * as odd from '@oddjs/odd';
import type FileSystem from '@oddjs/odd/fs/index';
import { checkDataRoot, initializeFilesystem, isUsernameValid, isUsernameAvailable } from './account';
import { getBackupStatus } from './backup';
import { Session } from './types';

export class AuthService {
  /**
   * Initialize the authentication state
   */
  static async initialize(): Promise<{
    session: Session;
    fileSystem: FileSystem | null;
  }> {
    console.log('Initializing authentication...');
    try {
      // Call the ODD program function to get current auth state
      const program = await odd.program({
        namespace: { creator: 'mycrozine', name: 'app' }
      });
      
      let session: Session;
      let fileSystem: FileSystem | null = null;

      if (program.session) {
        // User is authenticated
        fileSystem = program.session.fs;
        const backupStatus = await getBackupStatus(fileSystem);
        session = {
          username: program.session.username,
          authed: true,
          loading: false,
          backupCreated: backupStatus.created
        };
      } else {
        // User is not authenticated
        session = {
          username: '',
          authed: false,
          loading: false,
          backupCreated: null
        };
      }

      return { session, fileSystem };
    } catch (error) {
      console.error('Authentication initialization error:', error);
      return {
        session: {
          username: '',
          authed: false,
          loading: false,
          backupCreated: null,
          error: String(error)
        },
        fileSystem: null
      };
    }
  }

  /**
   * Login with a username
   */
  static async login(username: string): Promise<{
    success: boolean;
    session?: Session;
    fileSystem?: FileSystem;
    error?: string;
  }> {
    try {
      // Attempt to load the account
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
      } else {
        return {
          success: false,
          error: 'Failed to authenticate'
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
   * Register a new user
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
      
      // Check availability
      const available = await isUsernameAvailable(username);
      if (!available) {
        return {
          success: false,
          error: 'Username is already taken'
        };
      }
      
      // Register the user
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
      } else {
        return {
          success: false,
          error: 'Failed to create account'
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
      await odd.session.destroy();
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }
} 