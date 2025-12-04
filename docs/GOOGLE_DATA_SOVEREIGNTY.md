# Google Data Sovereignty: Local-First Secure Storage

This document outlines the architecture for securely importing, storing, and optionally sharing Google Workspace data (Gmail, Drive, Photos, Calendar) using a **local-first, data sovereign** approach.

## Overview

**Philosophy**: Your data should be yours. Import it locally, encrypt it client-side, and choose when/what to share.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      USER'S BROWSER (Data Sovereign Zone)               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌──────────────────────────────────────────────┐   │
│  │ Google APIs │───>│ Local Processing Layer                      │   │
│  │ (OAuth 2.0) │    │ ├── Fetch data                              │   │
│  └─────────────┘    │ ├── Encrypt with user's WebCrypto keys      │   │
│                     │ └── Store to IndexedDB                       │   │
│                     └────────────────────────┬─────────────────────┘   │
│                                              │                          │
│  ┌───────────────────────────────────────────┴───────────────────────┐ │
│  │ IndexedDB Encrypted Storage                                       │ │
│  │ ├── gmail_messages (encrypted blobs)                              │ │
│  │ ├── drive_documents (encrypted blobs)                             │ │
│  │ ├── photos_media (encrypted references)                           │ │
│  │ ├── calendar_events (encrypted data)                              │ │
│  │ └── encryption_metadata (key derivation info)                     │ │
│  └─────────────────────────────────────────────────────────────────── │
│                                              │                          │
│                     ┌────────────────────────┴───────────────────────┐ │
│                     │ Share Decision Layer (User Controlled)         │ │
│                     │ ├── Keep Private (local only)                  │ │
│                     │ ├── Share to Board (Automerge sync)            │ │
│                     │ └── Backup to R2 (encrypted cloud backup)      │ │
│                     └────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Browser Storage Capabilities & Limitations

### IndexedDB Storage

| Browser | Default Quota | Max Quota | Persistence |
|---------|--------------|-----------|-------------|
| Chrome/Edge | 60% of disk | Unlimited* | Persistent with permission |
| Firefox | 10% up to 10GB | 50% of disk | Persistent with permission |
| Safari | 1GB (lax) | ~1GB per origin | Non-persistent (7-day eviction) |

*Chrome "Unlimited" requires `navigator.storage.persist()` permission

### Storage API Persistence

```typescript
// Request persistent storage (prevents automatic eviction)
async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  }
  return false;
}

// Check current storage quota
async function checkStorageQuota(): Promise<{used: number, quota: number}> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { used: 0, quota: 0 };
}
```

### Safari's 7-Day Eviction Rule

**CRITICAL for Safari users**: Safari evicts IndexedDB data after 7 days of non-use.

**Mitigations**:
1. Use a Service Worker with periodic background sync to "touch" data
2. Prompt Safari users to add to Home Screen (PWA mode bypasses some restrictions)
3. Automatically sync important data to R2 backup
4. Show clear warnings about Safari limitations

```typescript
// Detect Safari's storage limitations
function hasSafariLimitations(): boolean {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isSafari || isIOS;
}

// Register touch activity to prevent eviction
async function touchLocalData(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('metadata', 'readwrite');
  tx.objectStore('metadata').put({
    key: 'last_accessed',
    timestamp: Date.now()
  });
}
```

## Data Types & Storage Strategies

### 1. Gmail Messages

```typescript
interface EncryptedEmailStore {
  id: string;                    // Gmail message ID
  threadId: string;              // Thread ID for grouping
  encryptedSubject: ArrayBuffer; // AES-GCM encrypted
  encryptedBody: ArrayBuffer;    // AES-GCM encrypted
  encryptedFrom: ArrayBuffer;    // Sender info
  encryptedTo: ArrayBuffer[];    // Recipients
  date: number;                  // Timestamp (unencrypted for sorting)
  labels: string[];              // Gmail labels (encrypted or not based on sensitivity)
  hasAttachments: boolean;       // Flag only, attachments stored separately
  snippet: ArrayBuffer;          // Encrypted preview

  // Metadata for search (encrypted bloom filter or encrypted index)
  searchIndex: ArrayBuffer;

  // Sync metadata
  syncedAt: number;
  localOnly: boolean;            // Not yet synced to any external storage
}

// Storage estimate per email:
// - Average email: ~20KB raw → ~25KB encrypted
// - With attachments: varies, but reference stored, not full attachment
// - 10,000 emails ≈ 250MB
```

### 2. Google Drive Documents

```typescript
interface EncryptedDriveDocument {
  id: string;                     // Drive file ID
  encryptedName: ArrayBuffer;
  encryptedMimeType: ArrayBuffer;
  encryptedContent: ArrayBuffer;  // For text-based docs
  encryptedPreview: ArrayBuffer;  // Thumbnail or preview

  // Large files: store reference, not content
  contentStrategy: 'inline' | 'reference' | 'chunked';
  chunks?: string[];              // IDs of content chunks if chunked

  // Hierarchy
  parentId: string | null;
  path: ArrayBuffer;              // Encrypted path string

  // Sharing & permissions (for UI display)
  isShared: boolean;

  modifiedTime: number;
  size: number;                   // Unencrypted for quota management

  syncedAt: number;
}

// Storage considerations:
// - Google Docs: Convert to markdown/HTML, typically 10-100KB
// - Spreadsheets: JSON export, 100KB-10MB depending on size
// - PDFs: Store reference only, load on demand
// - Images: Thumbnail locally, full resolution on demand
```

### 3. Google Photos

```typescript
interface EncryptedPhotoReference {
  id: string;                      // Photos media item ID
  encryptedFilename: ArrayBuffer;
  encryptedDescription: ArrayBuffer;

  // Thumbnails stored locally (encrypted)
  thumbnail: {
    width: number;
    height: number;
    encryptedData: ArrayBuffer;    // Base64 or blob
  };

  // Full resolution: reference only (fetch on demand)
  fullResolution: {
    width: number;
    height: number;
    // NOT storing full image - too large
    // Fetch via API when user requests
  };

  mediaType: 'image' | 'video';
  creationTime: number;

  // Album associations
  albumIds: string[];

  // Location data (highly sensitive - always encrypted)
  encryptedLocation?: ArrayBuffer;

  syncedAt: number;
}

// Storage strategy:
// - Thumbnails: ~50KB each, store locally
// - Full images: NOT stored locally (too large)
// - 1,000 photos thumbnails ≈ 50MB
// - Full resolution loaded via API on demand
```

### 4. Google Calendar Events

```typescript
interface EncryptedCalendarEvent {
  id: string;                       // Calendar event ID
  calendarId: string;

  encryptedSummary: ArrayBuffer;
  encryptedDescription: ArrayBuffer;
  encryptedLocation: ArrayBuffer;

  // Time data (unencrypted for query/sort performance)
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  timezone: string;

  // Recurrence
  isRecurring: boolean;
  encryptedRecurrence?: ArrayBuffer;

  // Attendees (encrypted)
  encryptedAttendees: ArrayBuffer;

  // Reminders
  reminders: { method: string; minutes: number }[];

  // Meeting links (encrypted - sensitive)
  encryptedMeetingLink?: ArrayBuffer;

  syncedAt: number;
}

// Storage estimate:
// - Average event: ~5KB encrypted
// - 2 years of events (~3000): ~15MB
```

## Encryption Strategy

### Key Derivation

Using the existing WebCrypto infrastructure, derive data encryption keys from the user's master key:

```typescript
// Derive a data-specific encryption key from master key
async function deriveDataEncryptionKey(
  masterKey: CryptoKey,
  purpose: 'gmail' | 'drive' | 'photos' | 'calendar'
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const purposeBytes = encoder.encode(`canvas-data-${purpose}`);

  // Import master key for HKDF
  const baseKey = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.exportKey('raw', masterKey),
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive purpose-specific key
  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: purposeBytes,
      info: new ArrayBuffer(0)
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

### Encryption/Decryption

```typescript
// Encrypt data before storing
async function encryptData(
  data: string | ArrayBuffer,
  key: CryptoKey
): Promise<{encrypted: ArrayBuffer, iv: Uint8Array}> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const dataBuffer = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );

  return { encrypted, iv };
}

// Decrypt data when reading
async function decryptData(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
}
```

## IndexedDB Schema

```typescript
// Database schema for encrypted Google data
const GOOGLE_DATA_DB = 'canvas-google-data';
const DB_VERSION = 1;

interface GoogleDataSchema {
  gmail: {
    key: string;  // message ID
    indexes: ['threadId', 'date', 'syncedAt'];
  };
  drive: {
    key: string;  // file ID
    indexes: ['parentId', 'modifiedTime', 'mimeType'];
  };
  photos: {
    key: string;  // media item ID
    indexes: ['creationTime', 'mediaType'];
  };
  calendar: {
    key: string;  // event ID
    indexes: ['calendarId', 'startTime', 'endTime'];
  };
  syncMetadata: {
    key: string;  // 'gmail' | 'drive' | 'photos' | 'calendar'
    // Stores last sync token, sync progress, etc.
  };
  encryptionKeys: {
    key: string;  // purpose
    // Stores IV, salt for key derivation
  };
}

async function initGoogleDataDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(GOOGLE_DATA_DB, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Gmail store
      if (!db.objectStoreNames.contains('gmail')) {
        const gmailStore = db.createObjectStore('gmail', { keyPath: 'id' });
        gmailStore.createIndex('threadId', 'threadId', { unique: false });
        gmailStore.createIndex('date', 'date', { unique: false });
        gmailStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Drive store
      if (!db.objectStoreNames.contains('drive')) {
        const driveStore = db.createObjectStore('drive', { keyPath: 'id' });
        driveStore.createIndex('parentId', 'parentId', { unique: false });
        driveStore.createIndex('modifiedTime', 'modifiedTime', { unique: false });
      }

      // Photos store
      if (!db.objectStoreNames.contains('photos')) {
        const photosStore = db.createObjectStore('photos', { keyPath: 'id' });
        photosStore.createIndex('creationTime', 'creationTime', { unique: false });
        photosStore.createIndex('mediaType', 'mediaType', { unique: false });
      }

      // Calendar store
      if (!db.objectStoreNames.contains('calendar')) {
        const calendarStore = db.createObjectStore('calendar', { keyPath: 'id' });
        calendarStore.createIndex('calendarId', 'calendarId', { unique: false });
        calendarStore.createIndex('startTime', 'startTime', { unique: false });
      }

      // Sync metadata
      if (!db.objectStoreNames.contains('syncMetadata')) {
        db.createObjectStore('syncMetadata', { keyPath: 'service' });
      }

      // Encryption metadata
      if (!db.objectStoreNames.contains('encryptionMeta')) {
        db.createObjectStore('encryptionMeta', { keyPath: 'purpose' });
      }
    };
  });
}
```

## Google OAuth & API Integration

### OAuth 2.0 Scopes

```typescript
const GOOGLE_SCOPES = {
  // Read-only access (data sovereignty - we import, not modify)
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  photos: 'https://www.googleapis.com/auth/photoslibrary.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',

  // Profile for user identification
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email'
};

// Selective scope request - user chooses what to import
function getRequestedScopes(services: string[]): string {
  const scopes = [GOOGLE_SCOPES.profile, GOOGLE_SCOPES.email];

  services.forEach(service => {
    if (GOOGLE_SCOPES[service as keyof typeof GOOGLE_SCOPES]) {
      scopes.push(GOOGLE_SCOPES[service as keyof typeof GOOGLE_SCOPES]);
    }
  });

  return scopes.join(' ');
}
```

### OAuth Flow with PKCE

```typescript
interface GoogleAuthState {
  codeVerifier: string;
  redirectUri: string;
  state: string;
}

async function initiateGoogleAuth(services: string[]): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  // Store state for verification
  sessionStorage.setItem('google_auth_state', JSON.stringify({
    codeVerifier,
    state,
    redirectUri: window.location.origin + '/oauth/google/callback'
  }));

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin + '/oauth/google/callback',
    response_type: 'code',
    scope: getRequestedScopes(services),
    access_type: 'offline',  // Get refresh token
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}
```

### Token Storage (Encrypted)

```typescript
interface EncryptedTokens {
  accessToken: ArrayBuffer;       // Encrypted
  refreshToken: ArrayBuffer;      // Encrypted
  accessTokenIv: Uint8Array;
  refreshTokenIv: Uint8Array;
  expiresAt: number;              // Unencrypted for refresh logic
  scopes: string[];               // Unencrypted for UI display
}

async function storeGoogleTokens(
  tokens: { access_token: string; refresh_token?: string; expires_in: number },
  encryptionKey: CryptoKey
): Promise<void> {
  const { encrypted: encAccessToken, iv: accessIv } = await encryptData(
    tokens.access_token,
    encryptionKey
  );

  const encryptedTokens: Partial<EncryptedTokens> = {
    accessToken: encAccessToken,
    accessTokenIv: accessIv,
    expiresAt: Date.now() + (tokens.expires_in * 1000)
  };

  if (tokens.refresh_token) {
    const { encrypted: encRefreshToken, iv: refreshIv } = await encryptData(
      tokens.refresh_token,
      encryptionKey
    );
    encryptedTokens.refreshToken = encRefreshToken;
    encryptedTokens.refreshTokenIv = refreshIv;
  }

  const db = await initGoogleDataDB();
  const tx = db.transaction('encryptionMeta', 'readwrite');
  tx.objectStore('encryptionMeta').put({
    purpose: 'google_tokens',
    ...encryptedTokens
  });
}
```

## Data Import Workflow

### Progressive Import with Background Sync

```typescript
interface ImportProgress {
  service: 'gmail' | 'drive' | 'photos' | 'calendar';
  total: number;
  imported: number;
  lastSyncToken?: string;
  status: 'idle' | 'importing' | 'paused' | 'error';
  errorMessage?: string;
}

class GoogleDataImporter {
  private encryptionKey: CryptoKey;
  private db: IDBDatabase;

  async importGmail(options: {
    maxMessages?: number;
    labelsFilter?: string[];
    dateAfter?: Date;
  }): Promise<void> {
    const accessToken = await this.getAccessToken();

    // Use pagination for large mailboxes
    let pageToken: string | undefined;
    let imported = 0;

    do {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
          maxResults: '100',
          ...(pageToken && { pageToken }),
          ...(options.labelsFilter && { labelIds: options.labelsFilter.join(',') }),
          ...(options.dateAfter && { q: `after:${Math.floor(options.dateAfter.getTime() / 1000)}` })
        })}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const data = await response.json();

      // Fetch and encrypt each message
      for (const msg of data.messages || []) {
        const fullMessage = await this.fetchGmailMessage(msg.id, accessToken);
        await this.storeEncryptedEmail(fullMessage);
        imported++;

        // Update progress
        this.updateProgress('gmail', imported);

        // Yield to UI periodically
        if (imported % 10 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken && (!options.maxMessages || imported < options.maxMessages));
  }

  private async storeEncryptedEmail(message: any): Promise<void> {
    const emailKey = await deriveDataEncryptionKey(this.encryptionKey, 'gmail');

    const encrypted: EncryptedEmailStore = {
      id: message.id,
      threadId: message.threadId,
      encryptedSubject: (await encryptData(
        this.extractHeader(message, 'Subject') || '',
        emailKey
      )).encrypted,
      encryptedBody: (await encryptData(
        this.extractBody(message),
        emailKey
      )).encrypted,
      // ... other fields
      date: parseInt(message.internalDate),
      syncedAt: Date.now(),
      localOnly: true
    };

    const tx = this.db.transaction('gmail', 'readwrite');
    tx.objectStore('gmail').put(encrypted);
  }
}
```

## Sharing to Canvas Board

### Selective Sharing Model

```typescript
interface ShareableItem {
  type: 'email' | 'document' | 'photo' | 'event';
  id: string;
  // Decrypted data for sharing
  decryptedData: any;
}

class DataSharingService {
  /**
   * Share a specific item to the current board
   * This decrypts the item and adds it to the Automerge document
   */
  async shareToBoard(
    item: ShareableItem,
    boardHandle: DocumentHandle<CanvasDoc>,
    userKey: CryptoKey
  ): Promise<void> {
    // 1. Decrypt the item
    const decrypted = await this.decryptItem(item, userKey);

    // 2. Create a canvas shape representation
    const shape = this.createShapeFromItem(decrypted, item.type);

    // 3. Add to Automerge document (syncs to other board users)
    boardHandle.change(doc => {
      doc.shapes[shape.id] = shape;
    });

    // 4. Mark item as shared (no longer localOnly)
    await this.markAsShared(item.id, item.type);
  }

  /**
   * Create a visual shape from data
   */
  private createShapeFromItem(data: any, type: string): TLShape {
    switch (type) {
      case 'email':
        return {
          id: createShapeId(),
          type: 'email-card',
          props: {
            subject: data.subject,
            from: data.from,
            date: data.date,
            snippet: data.snippet
          }
        };
      case 'event':
        return {
          id: createShapeId(),
          type: 'calendar-event',
          props: {
            title: data.summary,
            startTime: data.startTime,
            endTime: data.endTime,
            location: data.location
          }
        };
      // ... other types
    }
  }
}
```

## R2 Encrypted Backup

### Backup Architecture

```
User Browser                      Cloudflare Worker                    R2 Storage
     │                                   │                                  │
     │  1. Encrypt data locally          │                                  │
     │  (already encrypted in IndexedDB) │                                  │
     │                                   │                                  │
     │  2. Generate backup key           │                                  │
     │  (derived from master key)        │                                  │
     │                                   │                                  │
     │  3. POST encrypted blob ──────────>  4. Validate user               │
     │                                   │     (CryptID auth)               │
     │                                   │                                  │
     │                                   │  5. Store blob ─────────────────> │
     │                                   │     (already encrypted,          │
     │                                   │      worker can't read)          │
     │                                   │                                  │
     │  <────────────────────────────────  6. Return backup ID              │
```

### Backup Implementation

```typescript
interface BackupMetadata {
  id: string;
  createdAt: number;
  services: ('gmail' | 'drive' | 'photos' | 'calendar')[];
  itemCount: number;
  sizeBytes: number;
  // Encrypted with user's key - only they can read
  encryptedManifest: ArrayBuffer;
}

class R2BackupService {
  private workerUrl = '/api/backup';

  async createBackup(
    services: string[],
    encryptionKey: CryptoKey
  ): Promise<BackupMetadata> {
    // 1. Gather all encrypted data from IndexedDB
    const dataToBackup = await this.gatherData(services);

    // 2. Create a manifest (encrypted)
    const manifest = {
      version: 1,
      createdAt: Date.now(),
      services,
      itemCounts: dataToBackup.counts
    };
    const { encrypted: encManifest } = await encryptData(
      JSON.stringify(manifest),
      encryptionKey
    );

    // 3. Serialize and chunk if large
    const blob = await this.serializeForBackup(dataToBackup);

    // 4. Upload to R2 via worker
    const response = await fetch(this.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Backup-Manifest': base64Encode(encManifest)
      },
      body: blob
    });

    const { backupId } = await response.json();

    return {
      id: backupId,
      createdAt: Date.now(),
      services: services as any,
      itemCount: Object.values(dataToBackup.counts).reduce((a, b) => a + b, 0),
      sizeBytes: blob.size,
      encryptedManifest: encManifest
    };
  }

  async restoreBackup(
    backupId: string,
    encryptionKey: CryptoKey
  ): Promise<void> {
    // 1. Fetch encrypted blob from R2
    const response = await fetch(`${this.workerUrl}/${backupId}`);
    const encryptedBlob = await response.arrayBuffer();

    // 2. Data is already encrypted with user's key
    // Just write directly to IndexedDB
    await this.writeToIndexedDB(encryptedBlob);
  }
}
```

## Privacy & Security Guarantees

### What Never Leaves the Browser (Unencrypted)

1. **Email content** - body, subject, attachments
2. **Document content** - file contents, names
3. **Photo data** - images, location metadata
4. **Calendar details** - event descriptions, attendee info
5. **OAuth tokens** - access/refresh tokens

### What the Server Never Sees

1. **Encryption keys** - derived locally, never transmitted
2. **Plaintext data** - all API calls are client-side
3. **User's Google account data** - we use read-only scopes

### Data Flow Summary

```
                        ┌─────────────────────┐
                        │   Google APIs       │
                        │   (authenticated)   │
                        └──────────┬──────────┘
                                   │
                         ┌─────────▼─────────┐
                         │  Browser Fetch    │
                         │  (client-side)    │
                         └─────────┬─────────┘
                                   │
                         ┌─────────▼─────────┐
                         │  Encrypt with     │
                         │  WebCrypto        │
                         │  (AES-256-GCM)    │
                         └─────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐ ┌───────▼────────┐ ┌────────▼───────┐
    │  IndexedDB        │ │  Share to      │ │  R2 Backup     │
    │  (local only)     │ │  Board         │ │  (encrypted)   │
    │                   │ │  (Automerge)   │ │                │
    └───────────────────┘ └────────────────┘ └────────────────┘
           │                      │                    │
           ▼                      ▼                    ▼
    Only you can read      Board members      Only you can
    (your keys)            see shared items   decrypt backup
```

## Implementation Phases

### Phase 1: Foundation
- [ ] IndexedDB schema for encrypted data
- [ ] Key derivation from existing WebCrypto keys
- [ ] Encrypt/decrypt utility functions
- [ ] Storage quota monitoring

### Phase 2: Google OAuth
- [ ] OAuth 2.0 with PKCE flow
- [ ] Token encryption and storage
- [ ] Token refresh logic
- [ ] Scope selection UI

### Phase 3: Data Import
- [ ] Gmail import with pagination
- [ ] Drive document import
- [ ] Photos thumbnail import
- [ ] Calendar event import
- [ ] Progress tracking UI

### Phase 4: Canvas Integration
- [ ] Email card shape
- [ ] Document preview shape
- [ ] Photo thumbnail shape
- [ ] Calendar event shape
- [ ] Share to board functionality

### Phase 5: R2 Backup
- [ ] Encrypted backup creation
- [ ] Backup restore
- [ ] Backup management UI
- [ ] Automatic backup scheduling

### Phase 6: Polish
- [ ] Safari storage warnings
- [ ] Offline data access
- [ ] Search within encrypted data
- [ ] Data export (Google Takeout style)

## Security Checklist

- [ ] All data encrypted before storage
- [ ] Keys never leave browser unencrypted
- [ ] OAuth tokens encrypted at rest
- [ ] PKCE used for OAuth flow
- [ ] Read-only Google API scopes
- [ ] Safari 7-day eviction handled
- [ ] Storage quota warnings
- [ ] Secure context required (HTTPS)
- [ ] CSP headers configured
- [ ] No sensitive data in console logs

## Related Documents

- [Local File Upload](./LOCAL_FILE_UPLOAD.md) - Multi-item upload with same encryption model
- [Offline Storage Feasibility](../OFFLINE_STORAGE_FEASIBILITY.md) - IndexedDB + Automerge foundation

## References

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API](https://developers.google.com/gmail/api)
- [Drive API](https://developers.google.com/drive/api)
- [Photos Library API](https://developers.google.com/photos/library/reference/rest)
- [Calendar API](https://developers.google.com/calendar/api)
