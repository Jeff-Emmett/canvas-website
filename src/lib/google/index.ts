// Google Data Sovereignty Module
// Local-first, encrypted storage for Google Workspace data

// Types
export type {
  EncryptedData,
  EncryptedEmailStore,
  EncryptedDriveDocument,
  EncryptedPhotoReference,
  EncryptedCalendarEvent,
  SyncMetadata,
  EncryptionMetadata,
  EncryptedTokens,
  ImportProgress,
  StorageQuotaInfo,
  ShareableItem,
  GoogleService
} from './types';

export { GOOGLE_SCOPES, DB_STORES } from './types';

// Encryption utilities
export {
  hasWebCrypto,
  generateMasterKey,
  exportMasterKey,
  importMasterKey,
  deriveServiceKey,
  encryptData,
  decryptData,
  decryptDataToString,
  generateCodeVerifier,
  generateCodeChallenge,
  generateSalt,
  encryptMasterKeyWithPassword,
  decryptMasterKeyWithPassword
} from './encryption';

// Database operations
export {
  openDatabase,
  closeDatabase,
  deleteDatabase,
  gmailStore,
  driveStore,
  photosStore,
  calendarStore,
  syncMetadataStore,
  encryptionMetaStore,
  tokensStore,
  requestPersistentStorage,
  checkStorageQuota,
  hasSafariLimitations,
  touchLocalData,
  clearServiceData,
  exportAllData
} from './database';

// OAuth
export {
  initiateGoogleAuth,
  handleGoogleCallback,
  getAccessToken,
  isGoogleAuthenticated,
  getGrantedScopes,
  isServiceAuthorized,
  revokeGoogleAccess,
  getGoogleUserInfo,
  parseCallbackParams
} from './oauth';

// Importers
export {
  GmailImporter,
  importGmail,
  DriveImporter,
  importDrive,
  PhotosImporter,
  importPhotos,
  CalendarImporter,
  importCalendar
} from './importers';

export type {
  GmailImportOptions,
  DriveImportOptions,
  PhotosImportOptions,
  CalendarImportOptions
} from './importers';

// Share to board
export {
  ShareService,
  createShareService
} from './share';

export type {
  EmailCardShape,
  DocumentCardShape,
  PhotoCardShape,
  EventCardShape,
  GoogleDataShape
} from './share';

// R2 Backup
export {
  R2BackupService,
  createBackupService
} from './backup';

export type {
  BackupMetadata,
  BackupProgress
} from './backup';

// Main service class that ties everything together
import { generateMasterKey, importMasterKey, exportMasterKey } from './encryption';
import { openDatabase, checkStorageQuota, touchLocalData, hasSafariLimitations, requestPersistentStorage } from './database';
import { isGoogleAuthenticated, getGoogleUserInfo, initiateGoogleAuth, revokeGoogleAccess } from './oauth';
import { importGmail, importDrive, importPhotos, importCalendar } from './importers';
import type { GmailImportOptions, DriveImportOptions, PhotosImportOptions, CalendarImportOptions } from './importers';
import { createShareService, ShareService } from './share';
import { createBackupService, R2BackupService } from './backup';
import type { GoogleService, ImportProgress } from './types';

export class GoogleDataService {
  private masterKey: CryptoKey | null = null;
  private shareService: ShareService | null = null;
  private backupService: R2BackupService | null = null;
  private initialized = false;

  // Initialize the service with an existing master key or generate new one
  async initialize(existingKeyData?: ArrayBuffer): Promise<boolean> {
    try {
      // Open database
      await openDatabase();

      // Set up master key
      if (existingKeyData) {
        this.masterKey = await importMasterKey(existingKeyData);
      } else {
        this.masterKey = await generateMasterKey();
      }

      // Request persistent storage (especially important for Safari)
      if (hasSafariLimitations()) {
        console.warn('Safari detected: Data may be evicted after 7 days of non-use');
        await requestPersistentStorage();
        // Schedule periodic touch to prevent eviction
        this.scheduleTouchInterval();
      }

      // Initialize sub-services
      this.shareService = createShareService(this.masterKey);
      this.backupService = createBackupService(this.masterKey);

      this.initialized = true;
      return true;

    } catch (error) {
      console.error('Failed to initialize GoogleDataService:', error);
      return false;
    }
  }

  // Check if initialized
  isInitialized(): boolean {
    return this.initialized && this.masterKey !== null;
  }

  // Export master key for backup
  async exportKey(): Promise<ArrayBuffer | null> {
    if (!this.masterKey) return null;
    return await exportMasterKey(this.masterKey);
  }

  // Check Google authentication status
  async isAuthenticated(): Promise<boolean> {
    return await isGoogleAuthenticated();
  }

  // Get Google user info
  async getUserInfo(): Promise<{ email: string; name: string; picture: string } | null> {
    if (!this.masterKey) return null;
    return await getGoogleUserInfo(this.masterKey);
  }

  // Start Google OAuth flow
  async authenticate(services: GoogleService[]): Promise<void> {
    await initiateGoogleAuth(services);
  }

  // Revoke Google access
  async signOut(): Promise<boolean> {
    if (!this.masterKey) return false;
    return await revokeGoogleAccess(this.masterKey);
  }

  // Import data from Google services
  async importData(
    service: GoogleService,
    options: {
      gmail?: GmailImportOptions;
      drive?: DriveImportOptions;
      photos?: PhotosImportOptions;
      calendar?: CalendarImportOptions;
    } = {}
  ): Promise<ImportProgress> {
    if (!this.masterKey) {
      return {
        service,
        total: 0,
        imported: 0,
        status: 'error',
        errorMessage: 'Service not initialized'
      };
    }

    switch (service) {
      case 'gmail':
        return await importGmail(this.masterKey, options.gmail || {});
      case 'drive':
        return await importDrive(this.masterKey, options.drive || {});
      case 'photos':
        return await importPhotos(this.masterKey, options.photos || {});
      case 'calendar':
        return await importCalendar(this.masterKey, options.calendar || {});
      default:
        return {
          service,
          total: 0,
          imported: 0,
          status: 'error',
          errorMessage: 'Unknown service'
        };
    }
  }

  // Get share service for board integration
  getShareService(): ShareService | null {
    return this.shareService;
  }

  // Get backup service for R2 operations
  getBackupService(): R2BackupService | null {
    return this.backupService;
  }

  // Get storage quota info
  async getStorageInfo(): Promise<{
    used: number;
    quota: number;
    isPersistent: boolean;
    byService: { gmail: number; drive: number; photos: number; calendar: number };
  }> {
    return await checkStorageQuota();
  }

  // Schedule periodic touch for Safari
  private scheduleTouchInterval(): void {
    // Touch data every 6 hours to prevent 7-day eviction
    const TOUCH_INTERVAL = 6 * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        await touchLocalData();
        console.log('Touched local data to prevent Safari eviction');
      } catch (error) {
        console.warn('Failed to touch local data:', error);
      }
    }, TOUCH_INTERVAL);
  }
}

// Singleton instance
let serviceInstance: GoogleDataService | null = null;

export function getGoogleDataService(): GoogleDataService {
  if (!serviceInstance) {
    serviceInstance = new GoogleDataService();
  }
  return serviceInstance;
}

export function resetGoogleDataService(): void {
  serviceInstance = null;
}
