// Type definitions for Google Data Sovereignty module
// All data is encrypted client-side before storage

// Base interface for encrypted data
export interface EncryptedData {
  encrypted: ArrayBuffer;
  iv: Uint8Array;
}

// Encrypted Email Storage
export interface EncryptedEmailStore {
  id: string;                     // Gmail message ID
  threadId: string;               // Thread ID for grouping
  encryptedSubject: EncryptedData;
  encryptedBody: EncryptedData;
  encryptedFrom: EncryptedData;
  encryptedTo: EncryptedData;
  date: number;                   // Timestamp (unencrypted for sorting)
  labels: string[];               // Gmail labels
  hasAttachments: boolean;
  encryptedSnippet: EncryptedData;
  syncedAt: number;
  localOnly: boolean;             // Not yet shared to board
}

// Encrypted Drive Document Storage
export interface EncryptedDriveDocument {
  id: string;                      // Drive file ID
  encryptedName: EncryptedData;
  encryptedMimeType: EncryptedData;
  encryptedContent: EncryptedData | null;  // For text-based docs
  encryptedPreview: EncryptedData | null;  // Thumbnail or preview
  contentStrategy: 'inline' | 'reference' | 'chunked';
  chunks?: string[];               // IDs of content chunks if chunked
  parentId: string | null;
  encryptedPath: EncryptedData;
  isShared: boolean;
  modifiedTime: number;
  size: number;                    // Unencrypted for quota management
  syncedAt: number;
}

// Encrypted Photo Reference Storage
export interface EncryptedPhotoReference {
  id: string;                       // Photos media item ID
  encryptedFilename: EncryptedData;
  encryptedDescription: EncryptedData | null;
  thumbnail: {
    width: number;
    height: number;
    encryptedData: EncryptedData;   // Base64 or blob
  } | null;
  fullResolution: {
    width: number;
    height: number;
  };
  mediaType: 'image' | 'video';
  creationTime: number;
  albumIds: string[];
  encryptedLocation: EncryptedData | null;  // Location data (highly sensitive)
  syncedAt: number;
}

// Encrypted Calendar Event Storage
export interface EncryptedCalendarEvent {
  id: string;                        // Calendar event ID
  calendarId: string;
  encryptedSummary: EncryptedData;
  encryptedDescription: EncryptedData | null;
  encryptedLocation: EncryptedData | null;
  startTime: number;                 // Unencrypted for query/sort
  endTime: number;
  isAllDay: boolean;
  timezone: string;
  isRecurring: boolean;
  encryptedRecurrence: EncryptedData | null;
  encryptedAttendees: EncryptedData | null;
  reminders: { method: string; minutes: number }[];
  encryptedMeetingLink: EncryptedData | null;
  syncedAt: number;
}

// Sync Metadata
export interface SyncMetadata {
  service: 'gmail' | 'drive' | 'photos' | 'calendar';
  lastSyncToken?: string;
  lastSyncTime: number;
  itemCount: number;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  progressCurrent?: number;
  progressTotal?: number;
}

// Encryption Metadata
export interface EncryptionMetadata {
  purpose: 'gmail' | 'drive' | 'photos' | 'calendar' | 'google_tokens' | 'master';
  salt: Uint8Array;
  createdAt: number;
}

// OAuth Token Storage (encrypted)
export interface EncryptedTokens {
  encryptedAccessToken: EncryptedData;
  encryptedRefreshToken: EncryptedData | null;
  expiresAt: number;
  scopes: string[];
}

// Import Progress
export interface ImportProgress {
  service: 'gmail' | 'drive' | 'photos' | 'calendar';
  total: number;
  imported: number;
  status: 'idle' | 'importing' | 'paused' | 'completed' | 'error';
  errorMessage?: string;
  startedAt?: number;
  completedAt?: number;
}

// Storage Quota Info
export interface StorageQuotaInfo {
  used: number;
  quota: number;
  isPersistent: boolean;
  byService: {
    gmail: number;
    drive: number;
    photos: number;
    calendar: number;
  };
}

// Share Item for Board
export interface ShareableItem {
  type: 'email' | 'document' | 'photo' | 'event';
  service: GoogleService;  // Source service
  id: string;
  title: string;        // Decrypted for display
  preview?: string;     // Decrypted snippet/preview
  date: number;
  thumbnailUrl?: string; // For photos/documents with previews
}

// Google Service Types
export type GoogleService = 'gmail' | 'drive' | 'photos' | 'calendar';

// OAuth Scopes
export const GOOGLE_SCOPES = {
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  photos: 'https://www.googleapis.com/auth/photoslibrary.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email'
} as const;

// Database Store Names
export const DB_STORES = {
  gmail: 'gmail',
  drive: 'drive',
  photos: 'photos',
  calendar: 'calendar',
  syncMetadata: 'syncMetadata',
  encryptionMeta: 'encryptionMeta',
  tokens: 'tokens'
} as const;
