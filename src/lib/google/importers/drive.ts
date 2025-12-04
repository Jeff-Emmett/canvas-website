// Google Drive import with folder navigation and progress tracking
// All data is encrypted before storage

import type { EncryptedDriveDocument, ImportProgress, EncryptedData } from '../types';
import { encryptData, deriveServiceKey } from '../encryption';
import { driveStore, syncMetadataStore } from '../database';
import { getAccessToken } from '../oauth';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Import options
export interface DriveImportOptions {
  maxFiles?: number;              // Limit total files to import
  folderId?: string;              // Start from specific folder (null for root)
  mimeTypesFilter?: string[];     // Only import these MIME types
  includeShared?: boolean;        // Include shared files
  includeTrashed?: boolean;       // Include trashed files
  exportFormats?: Record<string, string>;  // Google Docs export formats
  onProgress?: (progress: ImportProgress) => void;
}

// Drive file list response
interface DriveFileListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

// Drive file metadata
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  shared?: boolean;
  trashed?: boolean;
  webViewLink?: string;
  thumbnailLink?: string;
}

// Default export formats for Google Docs
const DEFAULT_EXPORT_FORMATS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/markdown',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'application/pdf',
  'application/vnd.google-apps.drawing': 'image/png'
};

// Determine content strategy based on file size and type
function getContentStrategy(file: DriveFile): 'inline' | 'reference' | 'chunked' {
  const size = parseInt(file.size || '0');

  // Google Docs don't have a size, always inline
  if (file.mimeType.startsWith('application/vnd.google-apps.')) {
    return 'inline';
  }

  // Small files (< 1MB) inline
  if (size < 1024 * 1024) {
    return 'inline';
  }

  // Medium files (1-10MB) chunked
  if (size < 10 * 1024 * 1024) {
    return 'chunked';
  }

  // Large files just store reference
  return 'reference';
}

// Check if file is a Google Workspace file
function isGoogleWorkspaceFile(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.');
}

// Main Drive import class
export class DriveImporter {
  private accessToken: string | null = null;
  private encryptionKey: CryptoKey | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private masterKey: CryptoKey
  ) {}

  // Initialize importer
  async initialize(): Promise<boolean> {
    this.accessToken = await getAccessToken(this.masterKey);
    if (!this.accessToken) {
      console.error('No access token available for Drive');
      return false;
    }

    this.encryptionKey = await deriveServiceKey(this.masterKey, 'drive');
    return true;
  }

  // Abort current import
  abort(): void {
    this.abortController?.abort();
  }

  // Import Drive files
  async import(options: DriveImportOptions = {}): Promise<ImportProgress> {
    const progress: ImportProgress = {
      service: 'drive',
      total: 0,
      imported: 0,
      status: 'importing'
    };

    if (!await this.initialize()) {
      progress.status = 'error';
      progress.errorMessage = 'Failed to initialize Drive importer';
      return progress;
    }

    this.abortController = new AbortController();
    progress.startedAt = Date.now();

    const exportFormats = options.exportFormats || DEFAULT_EXPORT_FORMATS;

    try {
      // Build query
      const queryParts: string[] = [];
      if (options.folderId) {
        queryParts.push(`'${options.folderId}' in parents`);
      }
      if (options.mimeTypesFilter?.length) {
        const mimeQuery = options.mimeTypesFilter
          .map(m => `mimeType='${m}'`)
          .join(' or ');
        queryParts.push(`(${mimeQuery})`);
      }
      if (!options.includeTrashed) {
        queryParts.push('trashed=false');
      }

      // Get file list
      let pageToken: string | undefined;
      const batchSize = 100;
      const fileBatch: EncryptedDriveDocument[] = [];

      do {
        if (this.abortController.signal.aborted) {
          progress.status = 'paused';
          break;
        }

        const params: Record<string, string> = {
          pageSize: String(batchSize),
          fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,shared,trashed,thumbnailLink)',
          q: queryParts.join(' and ') || 'trashed=false'
        };
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const listResponse = await this.fetchApi('/files', params);

        if (!listResponse.files?.length) {
          break;
        }

        // Update total on first page
        if (progress.total === 0) {
          progress.total = listResponse.files.length;
        }

        // Process files
        for (const file of listResponse.files) {
          if (this.abortController.signal.aborted) break;

          // Skip shared files if not requested
          if (file.shared && !options.includeShared) {
            continue;
          }

          const encrypted = await this.processFile(file, exportFormats);
          if (encrypted) {
            fileBatch.push(encrypted);
            progress.imported++;

            // Save batch every 25 files
            if (fileBatch.length >= 25) {
              await driveStore.putBatch(fileBatch);
              fileBatch.length = 0;
            }

            options.onProgress?.(progress);
          }

          // Check limit
          if (options.maxFiles && progress.imported >= options.maxFiles) {
            break;
          }
        }

        pageToken = listResponse.nextPageToken;

        // Check limit
        if (options.maxFiles && progress.imported >= options.maxFiles) {
          break;
        }

      } while (pageToken);

      // Save remaining files
      if (fileBatch.length > 0) {
        await driveStore.putBatch(fileBatch);
      }

      progress.status = 'completed';
      progress.completedAt = Date.now();
      await syncMetadataStore.markComplete('drive', progress.imported);

    } catch (error) {
      console.error('Drive import error:', error);
      progress.status = 'error';
      progress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncMetadataStore.markError('drive', progress.errorMessage);
    }

    options.onProgress?.(progress);
    return progress;
  }

  // Fetch from Drive API
  private async fetchApi(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<DriveFileListResponse> {
    const url = new URL(`${DRIVE_API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Process a single file
  private async processFile(
    file: DriveFile,
    exportFormats: Record<string, string>
  ): Promise<EncryptedDriveDocument | null> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const strategy = getContentStrategy(file);
    let content: string | null = null;
    let preview: ArrayBuffer | null = null;

    try {
      // Get content based on strategy
      if (strategy === 'inline' || strategy === 'chunked') {
        if (isGoogleWorkspaceFile(file.mimeType)) {
          // Export Google Workspace file
          const exportFormat = exportFormats[file.mimeType];
          if (exportFormat) {
            content = await this.exportFile(file.id, exportFormat);
          }
        } else {
          // Download regular file
          content = await this.downloadFile(file.id);
        }
      }

      // Get thumbnail if available
      if (file.thumbnailLink) {
        try {
          preview = await this.fetchThumbnail(file.thumbnailLink);
        } catch {
          // Thumbnail fetch failed, continue without it
        }
      }

    } catch (error) {
      console.warn(`Failed to get content for file ${file.name}:`, error);
      // Continue with reference-only storage
    }

    // Helper to encrypt
    const encrypt = async (data: string): Promise<EncryptedData> => {
      return encryptData(data, this.encryptionKey!);
    };

    return {
      id: file.id,
      encryptedName: await encrypt(file.name),
      encryptedMimeType: await encrypt(file.mimeType),
      encryptedContent: content ? await encrypt(content) : null,
      encryptedPreview: preview ? await encryptData(preview, this.encryptionKey) : null,
      contentStrategy: strategy,
      parentId: file.parents?.[0] || null,
      encryptedPath: await encrypt(file.name),  // TODO: build full path
      isShared: file.shared || false,
      modifiedTime: new Date(file.modifiedTime || 0).getTime(),
      size: parseInt(file.size || '0'),
      syncedAt: Date.now()
    };
  }

  // Export a Google Workspace file
  private async exportFile(fileId: string, mimeType: string): Promise<string> {
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        },
        signal: this.abortController?.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    return response.text();
  }

  // Download a regular file
  private async downloadFile(fileId: string): Promise<string> {
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        },
        signal: this.abortController?.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.text();
  }

  // Fetch thumbnail
  private async fetchThumbnail(thumbnailLink: string): Promise<ArrayBuffer> {
    const response = await fetch(thumbnailLink, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`Thumbnail fetch failed: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  // List folders for navigation
  async listFolders(parentId?: string): Promise<{ id: string; name: string }[]> {
    if (!await this.initialize()) {
      return [];
    }

    const query = [
      "mimeType='application/vnd.google-apps.folder'",
      'trashed=false',
      parentId ? `'${parentId}' in parents` : "'root' in parents"
    ].join(' and ');

    try {
      const response = await this.fetchApi('/files', {
        q: query,
        fields: 'files(id,name)',
        pageSize: '100'
      });

      return response.files?.map(f => ({ id: f.id, name: f.name })) || [];
    } catch (error) {
      console.error('List folders error:', error);
      return [];
    }
  }
}

// Convenience function
export async function importDrive(
  masterKey: CryptoKey,
  options: DriveImportOptions = {}
): Promise<ImportProgress> {
  const importer = new DriveImporter(masterKey);
  return importer.import(options);
}
