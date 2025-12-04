// Google Photos import with thumbnail storage
// Full resolution images are NOT stored locally - fetch on demand
// All data is encrypted before storage

import type { EncryptedPhotoReference, ImportProgress, EncryptedData } from '../types';
import { encryptData, deriveServiceKey } from '../encryption';
import { photosStore, syncMetadataStore } from '../database';
import { getAccessToken } from '../oauth';

const PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1';

// Import options
export interface PhotosImportOptions {
  maxPhotos?: number;              // Limit total photos to import
  albumId?: string;                // Only import from specific album
  dateAfter?: Date;                // Only import photos after this date
  dateBefore?: Date;               // Only import photos before this date
  mediaTypes?: ('image' | 'video')[];  // Filter by media type
  thumbnailSize?: number;          // Thumbnail width (default 256)
  onProgress?: (progress: ImportProgress) => void;
}

// Photos API response types
interface PhotosListResponse {
  mediaItems?: PhotosMediaItem[];
  nextPageToken?: string;
}

interface PhotosMediaItem {
  id: string;
  productUrl?: string;
  baseUrl?: string;
  mimeType?: string;
  filename?: string;
  description?: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
      focalLength?: number;
      apertureFNumber?: number;
      isoEquivalent?: number;
    };
    video?: {
      fps?: number;
      status?: string;
    };
  };
  contributorInfo?: {
    profilePictureBaseUrl?: string;
    displayName?: string;
  };
}

interface PhotosAlbum {
  id: string;
  title?: string;
  productUrl?: string;
  mediaItemsCount?: string;
  coverPhotoBaseUrl?: string;
  coverPhotoMediaItemId?: string;
}

// Main Photos import class
export class PhotosImporter {
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
      console.error('No access token available for Photos');
      return false;
    }

    this.encryptionKey = await deriveServiceKey(this.masterKey, 'photos');
    return true;
  }

  // Abort current import
  abort(): void {
    this.abortController?.abort();
  }

  // Import photos
  async import(options: PhotosImportOptions = {}): Promise<ImportProgress> {
    const progress: ImportProgress = {
      service: 'photos',
      total: 0,
      imported: 0,
      status: 'importing'
    };

    if (!await this.initialize()) {
      progress.status = 'error';
      progress.errorMessage = 'Failed to initialize Photos importer';
      return progress;
    }

    this.abortController = new AbortController();
    progress.startedAt = Date.now();

    const thumbnailSize = options.thumbnailSize || 256;

    try {
      let pageToken: string | undefined;
      const batchSize = 100;
      const photoBatch: EncryptedPhotoReference[] = [];

      do {
        if (this.abortController.signal.aborted) {
          progress.status = 'paused';
          break;
        }

        // Fetch media items
        const listResponse = await this.fetchMediaItems(options, pageToken, batchSize);

        if (!listResponse.mediaItems?.length) {
          break;
        }

        // Update total on first page
        if (progress.total === 0) {
          progress.total = listResponse.mediaItems.length;
        }

        // Process media items
        for (const item of listResponse.mediaItems) {
          if (this.abortController.signal.aborted) break;

          // Filter by media type if specified
          const isVideo = !!item.mediaMetadata?.video;
          const mediaType = isVideo ? 'video' : 'image';

          if (options.mediaTypes?.length && !options.mediaTypes.includes(mediaType)) {
            continue;
          }

          // Filter by date if specified
          const creationTime = item.mediaMetadata?.creationTime
            ? new Date(item.mediaMetadata.creationTime).getTime()
            : 0;

          if (options.dateAfter && creationTime < options.dateAfter.getTime()) {
            continue;
          }
          if (options.dateBefore && creationTime > options.dateBefore.getTime()) {
            continue;
          }

          const encrypted = await this.processMediaItem(item, thumbnailSize);
          if (encrypted) {
            photoBatch.push(encrypted);
            progress.imported++;

            // Save batch every 25 items
            if (photoBatch.length >= 25) {
              await photosStore.putBatch(photoBatch);
              photoBatch.length = 0;
            }

            options.onProgress?.(progress);
          }

          // Check limit
          if (options.maxPhotos && progress.imported >= options.maxPhotos) {
            break;
          }

          // Small delay for rate limiting
          await new Promise(r => setTimeout(r, 20));
        }

        pageToken = listResponse.nextPageToken;

        // Check limit
        if (options.maxPhotos && progress.imported >= options.maxPhotos) {
          break;
        }

      } while (pageToken);

      // Save remaining photos
      if (photoBatch.length > 0) {
        await photosStore.putBatch(photoBatch);
      }

      progress.status = 'completed';
      progress.completedAt = Date.now();
      await syncMetadataStore.markComplete('photos', progress.imported);

    } catch (error) {
      console.error('Photos import error:', error);
      progress.status = 'error';
      progress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncMetadataStore.markError('photos', progress.errorMessage);
    }

    options.onProgress?.(progress);
    return progress;
  }

  // Fetch media items from API
  private async fetchMediaItems(
    options: PhotosImportOptions,
    pageToken: string | undefined,
    pageSize: number
  ): Promise<PhotosListResponse> {
    // If album specified, use album search
    if (options.albumId) {
      return this.searchByAlbum(options.albumId, pageToken, pageSize);
    }

    // Otherwise use list all
    const url = new URL(`${PHOTOS_API_BASE}/mediaItems`);
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`Photos API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Search by album
  private async searchByAlbum(
    albumId: string,
    pageToken: string | undefined,
    pageSize: number
  ): Promise<PhotosListResponse> {
    const body: Record<string, unknown> = {
      albumId,
      pageSize
    };
    if (pageToken) {
      body.pageToken = pageToken;
    }

    const response = await fetch(`${PHOTOS_API_BASE}/mediaItems:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`Photos search error: ${response.status}`);
    }

    return response.json();
  }

  // Process a single media item
  private async processMediaItem(
    item: PhotosMediaItem,
    thumbnailSize: number
  ): Promise<EncryptedPhotoReference | null> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const isVideo = !!item.mediaMetadata?.video;
    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';

    // Fetch thumbnail
    let thumbnailData: EncryptedData | null = null;
    if (item.baseUrl) {
      try {
        const thumbnailUrl = isVideo
          ? `${item.baseUrl}=w${thumbnailSize}-h${thumbnailSize}`  // Video thumbnail
          : `${item.baseUrl}=w${thumbnailSize}-h${thumbnailSize}-c`;  // Image thumbnail (cropped)

        const thumbResponse = await fetch(thumbnailUrl, {
          signal: this.abortController?.signal
        });

        if (thumbResponse.ok) {
          const thumbBuffer = await thumbResponse.arrayBuffer();
          thumbnailData = await encryptData(thumbBuffer, this.encryptionKey);
        }
      } catch (error) {
        console.warn(`Failed to fetch thumbnail for ${item.id}:`, error);
      }
    }

    // Helper to encrypt
    const encrypt = async (data: string): Promise<EncryptedData> => {
      return encryptData(data, this.encryptionKey!);
    };

    const width = parseInt(item.mediaMetadata?.width || '0');
    const height = parseInt(item.mediaMetadata?.height || '0');
    const creationTime = item.mediaMetadata?.creationTime
      ? new Date(item.mediaMetadata.creationTime).getTime()
      : Date.now();

    return {
      id: item.id,
      encryptedFilename: await encrypt(item.filename || ''),
      encryptedDescription: item.description ? await encrypt(item.description) : null,
      thumbnail: thumbnailData ? {
        width: Math.min(thumbnailSize, width),
        height: Math.min(thumbnailSize, height),
        encryptedData: thumbnailData
      } : null,
      fullResolution: {
        width,
        height
      },
      mediaType,
      creationTime,
      albumIds: [],  // Would need separate album lookup
      encryptedLocation: null,  // Location data not available in basic API
      syncedAt: Date.now()
    };
  }

  // List albums
  async listAlbums(): Promise<{ id: string; title: string; count: number }[]> {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const albums: PhotosAlbum[] = [];
      let pageToken: string | undefined;

      do {
        const url = new URL(`${PHOTOS_API_BASE}/albums`);
        url.searchParams.set('pageSize', '50');
        if (pageToken) {
          url.searchParams.set('pageToken', pageToken);
        }

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) break;

        const data = await response.json() as { albums?: PhotosAlbum[]; nextPageToken?: string };
        if (data.albums) {
          albums.push(...data.albums);
        }
        pageToken = data.nextPageToken;

      } while (pageToken);

      return albums.map(a => ({
        id: a.id,
        title: a.title || 'Untitled',
        count: parseInt(a.mediaItemsCount || '0')
      }));

    } catch (error) {
      console.error('List albums error:', error);
      return [];
    }
  }

  // Get full resolution URL for a photo (requires fresh baseUrl)
  async getFullResolutionUrl(mediaItemId: string): Promise<string | null> {
    if (!await this.initialize()) {
      return null;
    }

    try {
      const response = await fetch(`${PHOTOS_API_BASE}/mediaItems/${mediaItemId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) return null;

      const item: PhotosMediaItem = await response.json();

      if (!item.baseUrl) return null;

      // Full resolution URL with download parameter
      const isVideo = !!item.mediaMetadata?.video;
      return isVideo
        ? `${item.baseUrl}=dv`  // Download video
        : `${item.baseUrl}=d`;   // Download image
    } catch (error) {
      console.error('Get full resolution error:', error);
      return null;
    }
  }
}

// Convenience function
export async function importPhotos(
  masterKey: CryptoKey,
  options: PhotosImportOptions = {}
): Promise<ImportProgress> {
  const importer = new PhotosImporter(masterKey);
  return importer.import(options);
}
