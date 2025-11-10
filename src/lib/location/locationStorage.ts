import type FileSystem from '@oddjs/odd/fs/index';
import * as odd from '@oddjs/odd';
import type { PrecisionLevel } from './types';

/**
 * Location data stored in the filesystem
 */
export interface LocationData {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  expiresAt: number | null;
  precision: PrecisionLevel;
}

/**
 * Location share metadata
 */
export interface LocationShare {
  id: string;
  locationId: string;
  shareToken: string;
  createdAt: number;
  expiresAt: number | null;
  maxViews: number | null;
  viewCount: number;
  precision: PrecisionLevel;
}

/**
 * Location storage service
 * Handles storing and retrieving locations from the ODD.js filesystem
 */
export class LocationStorageService {
  private fs: FileSystem;
  private locationsPath: string[];
  private sharesPath: string[];
  private publicSharesPath: string[];

  constructor(fs: FileSystem) {
    this.fs = fs;
    // Private storage paths
    this.locationsPath = ['private', 'locations'];
    this.sharesPath = ['private', 'location-shares'];
    // Public reference path for share validation
    this.publicSharesPath = ['public', 'location-shares'];
  }

  /**
   * Initialize directories
   */
  async initialize(): Promise<void> {
    // Ensure private directories exist
    await this.ensureDirectory(this.locationsPath);
    await this.ensureDirectory(this.sharesPath);
    // Ensure public directory for share references
    await this.ensureDirectory(this.publicSharesPath);
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDirectory(path: string[]): Promise<void> {
    try {
      const dirPath = odd.path.directory(...path);
      const exists = await this.fs.exists(dirPath as any);
      if (!exists) {
        await this.fs.mkdir(dirPath as any);
      }
    } catch (error) {
      console.error('Error ensuring directory:', error);
      throw error;
    }
  }

  /**
   * Save a location to the filesystem
   */
  async saveLocation(location: LocationData): Promise<void> {
    try {
      const filePath = odd.path.file(...this.locationsPath, `${location.id}.json`);
      const content = new TextEncoder().encode(JSON.stringify(location, null, 2));
      await this.fs.write(filePath as any, content as any);
      await this.fs.publish();
    } catch (error) {
      console.error('Error saving location:', error);
      throw error;
    }
  }

  /**
   * Get a location by ID
   */
  async getLocation(locationId: string): Promise<LocationData | null> {
    try {
      const filePath = odd.path.file(...this.locationsPath, `${locationId}.json`);
      const exists = await this.fs.exists(filePath as any);
      if (!exists) {
        return null;
      }
      const content = await this.fs.read(filePath as any);
      const text = new TextDecoder().decode(content as Uint8Array);
      return JSON.parse(text) as LocationData;
    } catch (error) {
      console.error('Error reading location:', error);
      return null;
    }
  }

  /**
   * Create a location share
   */
  async createShare(share: LocationShare): Promise<void> {
    try {
      // Save share metadata in private directory
      const sharePath = odd.path.file(...this.sharesPath, `${share.id}.json`);
      const shareContent = new TextEncoder().encode(JSON.stringify(share, null, 2));
      await this.fs.write(sharePath as any, shareContent as any);

      // Create public reference file for share validation (only token, not full data)
      const publicSharePath = odd.path.file(...this.publicSharesPath, `${share.shareToken}.json`);
      const publicShareRef = {
        shareToken: share.shareToken,
        shareId: share.id,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      };
      const publicContent = new TextEncoder().encode(JSON.stringify(publicShareRef, null, 2));
      await this.fs.write(publicSharePath as any, publicContent as any);

      await this.fs.publish();
    } catch (error) {
      console.error('Error creating share:', error);
      throw error;
    }
  }

  /**
   * Get a share by token
   */
  async getShareByToken(shareToken: string): Promise<LocationShare | null> {
    try {
      // First check public reference
      const publicSharePath = odd.path.file(...this.publicSharesPath, `${shareToken}.json`);
      const publicExists = await this.fs.exists(publicSharePath as any);
      if (!publicExists) {
        return null;
      }

      const publicContent = await this.fs.read(publicSharePath as any);
      const publicText = new TextDecoder().decode(publicContent as Uint8Array);
      const publicRef = JSON.parse(publicText);

      // Now get full share from private directory
      const sharePath = odd.path.file(...this.sharesPath, `${publicRef.shareId}.json`);
      const shareExists = await this.fs.exists(sharePath as any);
      if (!shareExists) {
        return null;
      }

      const shareContent = await this.fs.read(sharePath as any);
      const shareText = new TextDecoder().decode(shareContent as Uint8Array);
      return JSON.parse(shareText) as LocationShare;
    } catch (error) {
      console.error('Error reading share:', error);
      return null;
    }
  }

  /**
   * Get all shares for the current user
   */
  async getAllShares(): Promise<LocationShare[]> {
    try {
      const dirPath = odd.path.directory(...this.sharesPath);
      const exists = await this.fs.exists(dirPath as any);
      if (!exists) {
        return [];
      }

      const files = await this.fs.ls(dirPath as any);
      const shares: LocationShare[] = [];

      for (const fileName of Object.keys(files)) {
        if (fileName.endsWith('.json')) {
          const shareId = fileName.replace('.json', '');
          const share = await this.getShareById(shareId);
          if (share) {
            shares.push(share);
          }
        }
      }

      return shares;
    } catch (error) {
      console.error('Error listing shares:', error);
      return [];
    }
  }

  /**
   * Get a share by ID
   */
  private async getShareById(shareId: string): Promise<LocationShare | null> {
    try {
      const sharePath = odd.path.file(...this.sharesPath, `${shareId}.json`);
      const exists = await this.fs.exists(sharePath as any);
      if (!exists) {
        return null;
      }
      const content = await this.fs.read(sharePath as any);
      const text = new TextDecoder().decode(content as Uint8Array);
      return JSON.parse(text) as LocationShare;
    } catch (error) {
      console.error('Error reading share:', error);
      return null;
    }
  }

  /**
   * Increment view count for a share
   */
  async incrementShareViews(shareId: string): Promise<void> {
    try {
      const share = await this.getShareById(shareId);
      if (!share) {
        throw new Error('Share not found');
      }

      share.viewCount += 1;
      await this.createShare(share); // Re-save the share
    } catch (error) {
      console.error('Error incrementing share views:', error);
      throw error;
    }
  }
}

/**
 * Obfuscate location based on precision level
 */
export function obfuscateLocation(
  lat: number,
  lng: number,
  precision: PrecisionLevel
): { lat: number; lng: number; radius: number } {
  let radius = 0;

  switch (precision) {
    case 'exact':
      radius = 0;
      break;
    case 'street':
      radius = 100; // ~100m radius
      break;
    case 'neighborhood':
      radius = 1000; // ~1km radius
      break;
    case 'city':
      radius = 10000; // ~10km radius
      break;
  }

  if (radius === 0) {
    return { lat, lng, radius: 0 };
  }

  // Add random offset within the radius
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radius;
  
  // Convert distance to degrees (rough approximation: 1 degree ≈ 111km)
  const latOffset = (distance / 111000) * Math.cos(angle);
  const lngOffset = (distance / (111000 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);

  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
    radius,
  };
}

/**
 * Generate a secure share token
 */
export function generateShareToken(): string {
  // Generate a cryptographically secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

