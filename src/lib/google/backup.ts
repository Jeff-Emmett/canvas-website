// R2 encrypted backup service
// Data is already encrypted in IndexedDB, uploaded as-is to R2

import type {
  GoogleService,
  EncryptedEmailStore,
  EncryptedDriveDocument,
  EncryptedPhotoReference,
  EncryptedCalendarEvent
} from './types';
import { exportAllData, clearServiceData } from './database';
import {
  encryptData,
  decryptData,
  deriveServiceKey,
  encryptMasterKeyWithPassword,
  decryptMasterKeyWithPassword,
  base64UrlEncode,
  base64UrlDecode
} from './encryption';

// Backup metadata stored with the backup
export interface BackupMetadata {
  id: string;
  createdAt: number;
  services: GoogleService[];
  itemCounts: {
    gmail: number;
    drive: number;
    photos: number;
    calendar: number;
  };
  sizeBytes: number;
  version: number;
}

// Backup manifest (encrypted, stored in R2)
interface BackupManifest {
  version: 1;
  createdAt: number;
  services: GoogleService[];
  itemCounts: {
    gmail: number;
    drive: number;
    photos: number;
    calendar: number;
  };
  checksum: string;
}

// R2 backup service
export class R2BackupService {
  private backupApiUrl: string;

  constructor(
    private masterKey: CryptoKey,
    backupApiUrl?: string
  ) {
    // Default to the canvas worker backup endpoint
    this.backupApiUrl = backupApiUrl || '/api/backup';
  }

  // Create a backup of all Google data
  async createBackup(
    options: {
      services?: GoogleService[];
      onProgress?: (progress: { stage: string; percent: number }) => void;
    } = {}
  ): Promise<BackupMetadata | null> {
    const services = options.services || ['gmail', 'drive', 'photos', 'calendar'];

    try {
      options.onProgress?.({ stage: 'Gathering data', percent: 0 });

      // Export all data from IndexedDB
      const data = await exportAllData();

      // Filter to requested services
      const filteredData = {
        gmail: services.includes('gmail') ? data.gmail : [],
        drive: services.includes('drive') ? data.drive : [],
        photos: services.includes('photos') ? data.photos : [],
        calendar: services.includes('calendar') ? data.calendar : [],
        syncMetadata: data.syncMetadata.filter(m =>
          services.includes(m.service as GoogleService)
        ),
        encryptionMeta: data.encryptionMeta
      };

      options.onProgress?.({ stage: 'Preparing backup', percent: 20 });

      // Create manifest
      const manifest: BackupManifest = {
        version: 1,
        createdAt: Date.now(),
        services,
        itemCounts: {
          gmail: filteredData.gmail.length,
          drive: filteredData.drive.length,
          photos: filteredData.photos.length,
          calendar: filteredData.calendar.length
        },
        checksum: await this.createChecksum(filteredData)
      };

      options.onProgress?.({ stage: 'Encrypting manifest', percent: 30 });

      // Encrypt manifest with backup key
      const backupKey = await deriveServiceKey(this.masterKey, 'backup');
      const encryptedManifest = await encryptData(
        JSON.stringify(manifest),
        backupKey
      );

      options.onProgress?.({ stage: 'Serializing data', percent: 40 });

      // Serialize data (already encrypted in IndexedDB)
      const serializedData = JSON.stringify(filteredData);
      const dataBlob = new Blob([serializedData], { type: 'application/json' });

      options.onProgress?.({ stage: 'Uploading backup', percent: 50 });

      // Upload to R2 via worker
      const backupId = crypto.randomUUID();
      const response = await fetch(this.backupApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Backup-Id': backupId,
          'X-Backup-Manifest': base64UrlEncode(
            new Uint8Array(encryptedManifest.encrypted)
          ),
          'X-Backup-Manifest-IV': base64UrlEncode(encryptedManifest.iv)
        },
        body: dataBlob
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Backup upload failed: ${error}`);
      }

      options.onProgress?.({ stage: 'Complete', percent: 100 });

      return {
        id: backupId,
        createdAt: manifest.createdAt,
        services,
        itemCounts: manifest.itemCounts,
        sizeBytes: dataBlob.size,
        version: manifest.version
      };

    } catch (error) {
      console.error('Backup creation failed:', error);
      return null;
    }
  }

  // List available backups
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const response = await fetch(`${this.backupApiUrl}/list`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to list backups');
      }

      const backups = await response.json() as BackupMetadata[];
      return backups;

    } catch (error) {
      console.error('List backups failed:', error);
      return [];
    }
  }

  // Restore a backup
  async restoreBackup(
    backupId: string,
    options: {
      services?: GoogleService[];
      clearExisting?: boolean;
      onProgress?: (progress: { stage: string; percent: number }) => void;
    } = {}
  ): Promise<boolean> {
    try {
      options.onProgress?.({ stage: 'Fetching backup', percent: 0 });

      // Fetch backup from R2
      const response = await fetch(`${this.backupApiUrl}/${backupId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Backup not found');
      }

      options.onProgress?.({ stage: 'Parsing backup', percent: 20 });

      // Get encrypted manifest from headers
      const manifestBase64 = response.headers.get('X-Backup-Manifest');
      const manifestIvBase64 = response.headers.get('X-Backup-Manifest-IV');

      if (!manifestBase64 || !manifestIvBase64) {
        throw new Error('Invalid backup: missing manifest');
      }

      // Decrypt manifest
      const backupKey = await deriveServiceKey(this.masterKey, 'backup');
      const manifestIv = base64UrlDecode(manifestIvBase64);
      const manifestEncrypted = base64UrlDecode(manifestBase64);
      const manifestData = await decryptData(
        {
          encrypted: manifestEncrypted.buffer as ArrayBuffer,
          iv: manifestIv
        },
        backupKey
      );
      const manifest: BackupManifest = JSON.parse(
        new TextDecoder().decode(manifestData)
      );

      options.onProgress?.({ stage: 'Verifying backup', percent: 30 });

      // Parse backup data
      interface BackupDataStructure {
        gmail?: EncryptedEmailStore[];
        drive?: EncryptedDriveDocument[];
        photos?: EncryptedPhotoReference[];
        calendar?: EncryptedCalendarEvent[];
      }
      const backupData = await response.json() as BackupDataStructure;

      // Verify checksum
      const checksum = await this.createChecksum(backupData);
      if (checksum !== manifest.checksum) {
        throw new Error('Backup verification failed: checksum mismatch');
      }

      options.onProgress?.({ stage: 'Restoring data', percent: 50 });

      // Clear existing data if requested
      const servicesToRestore = options.services || manifest.services;
      if (options.clearExisting) {
        for (const service of servicesToRestore) {
          await clearServiceData(service);
        }
      }

      // Restore data to IndexedDB
      // Note: Data is already encrypted, just need to write it
      const { gmailStore, driveStore, photosStore, calendarStore } = await import('./database');

      if (servicesToRestore.includes('gmail') && backupData.gmail?.length) {
        await gmailStore.putBatch(backupData.gmail);
      }
      if (servicesToRestore.includes('drive') && backupData.drive?.length) {
        await driveStore.putBatch(backupData.drive);
      }
      if (servicesToRestore.includes('photos') && backupData.photos?.length) {
        await photosStore.putBatch(backupData.photos);
      }
      if (servicesToRestore.includes('calendar') && backupData.calendar?.length) {
        await calendarStore.putBatch(backupData.calendar);
      }

      options.onProgress?.({ stage: 'Complete', percent: 100 });

      return true;

    } catch (error) {
      console.error('Backup restore failed:', error);
      return false;
    }
  }

  // Delete a backup
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.backupApiUrl}/${backupId}`, {
        method: 'DELETE'
      });

      return response.ok;

    } catch (error) {
      console.error('Delete backup failed:', error);
      return false;
    }
  }

  // Create checksum for data verification
  private async createChecksum(data: unknown): Promise<string> {
    const serialized = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return base64UrlEncode(new Uint8Array(hashBuffer));
  }

  // Export master key encrypted with password (for backup recovery)
  async exportMasterKeyBackup(password: string): Promise<{
    encryptedKey: string;
    salt: string;
  }> {
    const { encryptedKey, salt } = await encryptMasterKeyWithPassword(
      this.masterKey,
      password
    );

    return {
      encryptedKey: base64UrlEncode(new Uint8Array(encryptedKey.encrypted)) +
                    '.' + base64UrlEncode(encryptedKey.iv),
      salt: base64UrlEncode(salt)
    };
  }

  // Import master key from password-protected backup
  static async importMasterKeyBackup(
    encryptedKeyString: string,
    salt: string,
    password: string
  ): Promise<CryptoKey> {
    const [keyBase64, ivBase64] = encryptedKeyString.split('.');

    const encryptedKey = {
      encrypted: base64UrlDecode(keyBase64).buffer as ArrayBuffer,
      iv: base64UrlDecode(ivBase64)
    };

    return decryptMasterKeyWithPassword(
      encryptedKey,
      password,
      base64UrlDecode(salt)
    );
  }
}

// Progress callback for backups
export interface BackupProgress {
  service: 'gmail' | 'drive' | 'photos' | 'calendar' | 'all';
  status: 'idle' | 'backing_up' | 'restoring' | 'completed' | 'error';
  progress: number;  // 0-100
  errorMessage?: string;
}

// Convenience function
export function createBackupService(
  masterKey: CryptoKey,
  backupApiUrl?: string
): R2BackupService {
  return new R2BackupService(masterKey, backupApiUrl);
}
