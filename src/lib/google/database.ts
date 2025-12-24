// IndexedDB database for encrypted Google data storage
// All data stored here is already encrypted client-side

import type {
  EncryptedEmailStore,
  EncryptedDriveDocument,
  EncryptedPhotoReference,
  EncryptedCalendarEvent,
  SyncMetadata,
  EncryptionMetadata,
  EncryptedTokens,
  GoogleService,
  StorageQuotaInfo
} from './types';
import { DB_STORES } from './types';

const DB_NAME = 'canvas-google-data';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

// Open or create the database
export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open Google data database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createStores(db);
    };
  });
}

// Create all object stores
function createStores(db: IDBDatabase): void {
  // Gmail messages store
  if (!db.objectStoreNames.contains(DB_STORES.gmail)) {
    const gmailStore = db.createObjectStore(DB_STORES.gmail, { keyPath: 'id' });
    gmailStore.createIndex('threadId', 'threadId', { unique: false });
    gmailStore.createIndex('date', 'date', { unique: false });
    gmailStore.createIndex('syncedAt', 'syncedAt', { unique: false });
    gmailStore.createIndex('localOnly', 'localOnly', { unique: false });
  }

  // Drive documents store
  if (!db.objectStoreNames.contains(DB_STORES.drive)) {
    const driveStore = db.createObjectStore(DB_STORES.drive, { keyPath: 'id' });
    driveStore.createIndex('parentId', 'parentId', { unique: false });
    driveStore.createIndex('modifiedTime', 'modifiedTime', { unique: false });
    driveStore.createIndex('syncedAt', 'syncedAt', { unique: false });
  }

  // Photos store
  if (!db.objectStoreNames.contains(DB_STORES.photos)) {
    const photosStore = db.createObjectStore(DB_STORES.photos, { keyPath: 'id' });
    photosStore.createIndex('creationTime', 'creationTime', { unique: false });
    photosStore.createIndex('mediaType', 'mediaType', { unique: false });
    photosStore.createIndex('syncedAt', 'syncedAt', { unique: false });
  }

  // Calendar events store
  if (!db.objectStoreNames.contains(DB_STORES.calendar)) {
    const calendarStore = db.createObjectStore(DB_STORES.calendar, { keyPath: 'id' });
    calendarStore.createIndex('calendarId', 'calendarId', { unique: false });
    calendarStore.createIndex('startTime', 'startTime', { unique: false });
    calendarStore.createIndex('endTime', 'endTime', { unique: false });
    calendarStore.createIndex('syncedAt', 'syncedAt', { unique: false });
  }

  // Sync metadata store
  if (!db.objectStoreNames.contains(DB_STORES.syncMetadata)) {
    db.createObjectStore(DB_STORES.syncMetadata, { keyPath: 'service' });
  }

  // Encryption metadata store
  if (!db.objectStoreNames.contains(DB_STORES.encryptionMeta)) {
    db.createObjectStore(DB_STORES.encryptionMeta, { keyPath: 'purpose' });
  }

  // Tokens store
  if (!db.objectStoreNames.contains(DB_STORES.tokens)) {
    db.createObjectStore(DB_STORES.tokens, { keyPath: 'id' });
  }
}

// Close the database connection
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Delete the entire database (for user data wipe)
export async function deleteDatabase(): Promise<void> {
  closeDatabase();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Generic put operation
async function putItem<T>(storeName: string, item: T): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Generic get operation
async function getItem<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Generic delete operation
async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Generic getAll operation
async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Generic count operation
async function countItems(storeName: string): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get items by index with optional range
async function getItemsByIndex<T>(
  storeName: string,
  indexName: string,
  query?: IDBKeyRange | IDBValidKey
): Promise<T[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = query ? index.getAll(query) : index.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Gmail operations
export const gmailStore = {
  put: (email: EncryptedEmailStore) => putItem(DB_STORES.gmail, email),
  get: (id: string) => getItem<EncryptedEmailStore>(DB_STORES.gmail, id),
  delete: (id: string) => deleteItem(DB_STORES.gmail, id),
  getAll: () => getAllItems<EncryptedEmailStore>(DB_STORES.gmail),
  count: () => countItems(DB_STORES.gmail),

  getByThread: (threadId: string) =>
    getItemsByIndex<EncryptedEmailStore>(DB_STORES.gmail, 'threadId', threadId),

  getByDateRange: (startDate: number, endDate: number) =>
    getItemsByIndex<EncryptedEmailStore>(
      DB_STORES.gmail,
      'date',
      IDBKeyRange.bound(startDate, endDate)
    ),

  getLocalOnly: async () => {
    const all = await getAllItems<EncryptedEmailStore>(DB_STORES.gmail);
    return all.filter(email => email.localOnly === true);
  },

  async putBatch(emails: EncryptedEmailStore[]): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORES.gmail, 'readwrite');
      const store = tx.objectStore(DB_STORES.gmail);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const email of emails) {
        store.put(email);
      }
    });
  }
};

// Drive operations
export const driveStore = {
  put: (doc: EncryptedDriveDocument) => putItem(DB_STORES.drive, doc),
  get: (id: string) => getItem<EncryptedDriveDocument>(DB_STORES.drive, id),
  delete: (id: string) => deleteItem(DB_STORES.drive, id),
  getAll: () => getAllItems<EncryptedDriveDocument>(DB_STORES.drive),
  count: () => countItems(DB_STORES.drive),

  getByParent: (parentId: string | null) =>
    getItemsByIndex<EncryptedDriveDocument>(
      DB_STORES.drive,
      'parentId',
      parentId ?? ''
    ),

  getRecent: (limit: number = 50) =>
    getItemsByIndex<EncryptedDriveDocument>(DB_STORES.drive, 'modifiedTime')
      .then(items => items.sort((a, b) => b.modifiedTime - a.modifiedTime).slice(0, limit)),

  async putBatch(docs: EncryptedDriveDocument[]): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORES.drive, 'readwrite');
      const store = tx.objectStore(DB_STORES.drive);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const doc of docs) {
        store.put(doc);
      }
    });
  }
};

// Photos operations
export const photosStore = {
  put: (photo: EncryptedPhotoReference) => putItem(DB_STORES.photos, photo),
  get: (id: string) => getItem<EncryptedPhotoReference>(DB_STORES.photos, id),
  delete: (id: string) => deleteItem(DB_STORES.photos, id),
  getAll: () => getAllItems<EncryptedPhotoReference>(DB_STORES.photos),
  count: () => countItems(DB_STORES.photos),

  getByMediaType: (mediaType: 'image' | 'video') =>
    getItemsByIndex<EncryptedPhotoReference>(DB_STORES.photos, 'mediaType', mediaType),

  getByDateRange: (startDate: number, endDate: number) =>
    getItemsByIndex<EncryptedPhotoReference>(
      DB_STORES.photos,
      'creationTime',
      IDBKeyRange.bound(startDate, endDate)
    ),

  async putBatch(photos: EncryptedPhotoReference[]): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORES.photos, 'readwrite');
      const store = tx.objectStore(DB_STORES.photos);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const photo of photos) {
        store.put(photo);
      }
    });
  }
};

// Calendar operations
export const calendarStore = {
  put: (event: EncryptedCalendarEvent) => putItem(DB_STORES.calendar, event),
  get: (id: string) => getItem<EncryptedCalendarEvent>(DB_STORES.calendar, id),
  delete: (id: string) => deleteItem(DB_STORES.calendar, id),
  getAll: () => getAllItems<EncryptedCalendarEvent>(DB_STORES.calendar),
  count: () => countItems(DB_STORES.calendar),

  getByCalendar: (calendarId: string) =>
    getItemsByIndex<EncryptedCalendarEvent>(DB_STORES.calendar, 'calendarId', calendarId),

  getByDateRange: (startTime: number, endTime: number) =>
    getItemsByIndex<EncryptedCalendarEvent>(
      DB_STORES.calendar,
      'startTime',
      IDBKeyRange.bound(startTime, endTime)
    ),

  getUpcoming: (fromTime: number = Date.now(), limit: number = 50) =>
    getItemsByIndex<EncryptedCalendarEvent>(
      DB_STORES.calendar,
      'startTime',
      IDBKeyRange.lowerBound(fromTime)
    ).then(items => items.slice(0, limit)),

  async putBatch(events: EncryptedCalendarEvent[]): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORES.calendar, 'readwrite');
      const store = tx.objectStore(DB_STORES.calendar);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const event of events) {
        store.put(event);
      }
    });
  }
};

// Sync metadata operations
export const syncMetadataStore = {
  put: (metadata: SyncMetadata) => putItem(DB_STORES.syncMetadata, metadata),
  get: (service: GoogleService) => getItem<SyncMetadata>(DB_STORES.syncMetadata, service),
  getAll: () => getAllItems<SyncMetadata>(DB_STORES.syncMetadata),

  async updateProgress(
    service: GoogleService,
    current: number,
    total: number
  ): Promise<void> {
    const existing = await this.get(service);
    await this.put({
      ...existing,
      service,
      status: 'syncing',
      progressCurrent: current,
      progressTotal: total,
      lastSyncTime: existing?.lastSyncTime ?? Date.now()
    } as SyncMetadata);
  },

  async markComplete(service: GoogleService, itemCount: number): Promise<void> {
    const existing = await this.get(service);
    await this.put({
      ...existing,
      service,
      status: 'idle',
      itemCount,
      lastSyncTime: Date.now(),
      progressCurrent: undefined,
      progressTotal: undefined
    } as SyncMetadata);
  },

  async markError(service: GoogleService, errorMessage: string): Promise<void> {
    const existing = await this.get(service);
    await this.put({
      ...existing,
      service,
      status: 'error',
      errorMessage,
      lastSyncTime: existing?.lastSyncTime ?? Date.now()
    } as SyncMetadata);
  }
};

// Encryption metadata operations
export const encryptionMetaStore = {
  put: (metadata: EncryptionMetadata) => putItem(DB_STORES.encryptionMeta, metadata),
  get: (purpose: string) => getItem<EncryptionMetadata>(DB_STORES.encryptionMeta, purpose),
  getAll: () => getAllItems<EncryptionMetadata>(DB_STORES.encryptionMeta)
};

// Token operations
export const tokensStore = {
  async put(tokens: EncryptedTokens): Promise<void> {
    await putItem(DB_STORES.tokens, { id: 'google', ...tokens });
  },

  async get(): Promise<EncryptedTokens | null> {
    const result = await getItem<EncryptedTokens & { id: string }>(DB_STORES.tokens, 'google');
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...tokens } = result;
      return tokens;
    }
    return null;
  },

  async delete(): Promise<void> {
    await deleteItem(DB_STORES.tokens, 'google');
  },

  async isExpired(): Promise<boolean> {
    const tokens = await this.get();
    if (!tokens) return true;
    // Add 5 minute buffer
    return tokens.expiresAt <= Date.now() + 5 * 60 * 1000;
  }
};

// Storage quota utilities
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  }
  return false;
}

export async function checkStorageQuota(): Promise<StorageQuotaInfo> {
  const defaultQuota: StorageQuotaInfo = {
    used: 0,
    quota: 0,
    isPersistent: false,
    byService: { gmail: 0, drive: 0, photos: 0, calendar: 0 }
  };

  if (!navigator.storage || !navigator.storage.estimate) {
    return defaultQuota;
  }

  const estimate = await navigator.storage.estimate();
  const isPersistent = navigator.storage.persisted
    ? await navigator.storage.persisted()
    : false;

  // Estimate per-service usage based on item counts
  // (rough approximation - actual size would require iterating all items)
  const [gmailCount, driveCount, photosCount, calendarCount] = await Promise.all([
    gmailStore.count(),
    driveStore.count(),
    photosStore.count(),
    calendarStore.count()
  ]);

  // Rough size estimates per item (in bytes)
  const AVG_EMAIL_SIZE = 25000;    // 25KB
  const AVG_DOC_SIZE = 50000;      // 50KB
  const AVG_PHOTO_SIZE = 50000;    // 50KB (thumbnail only)
  const AVG_EVENT_SIZE = 5000;     // 5KB

  return {
    used: estimate.usage || 0,
    quota: estimate.quota || 0,
    isPersistent,
    byService: {
      gmail: gmailCount * AVG_EMAIL_SIZE,
      drive: driveCount * AVG_DOC_SIZE,
      photos: photosCount * AVG_PHOTO_SIZE,
      calendar: calendarCount * AVG_EVENT_SIZE
    }
  };
}

// Safari-specific handling
export function hasSafariLimitations(): boolean {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isSafari || isIOS;
}

// Touch data to prevent Safari 7-day eviction
export async function touchLocalData(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORES.encryptionMeta, 'readwrite');
    const store = tx.objectStore(DB_STORES.encryptionMeta);

    // Just update a timestamp in encryption metadata
    store.put({
      purpose: 'master',
      salt: new Uint8Array(0),
      createdAt: Date.now()
    } as EncryptionMetadata);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Clear all data for a specific service
export async function clearServiceData(service: GoogleService): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(service, 'readwrite');
    const store = tx.objectStore(service);
    const request = store.clear();

    request.onsuccess = async () => {
      // Also clear sync metadata for this service
      await syncMetadataStore.put({
        service,
        lastSyncTime: Date.now(),
        itemCount: 0,
        status: 'idle'
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// Export all data for backup
export async function exportAllData(): Promise<{
  gmail: EncryptedEmailStore[];
  drive: EncryptedDriveDocument[];
  photos: EncryptedPhotoReference[];
  calendar: EncryptedCalendarEvent[];
  syncMetadata: SyncMetadata[];
  encryptionMeta: EncryptionMetadata[];
}> {
  const [gmail, drive, photos, calendar, syncMetadata, encryptionMeta] = await Promise.all([
    gmailStore.getAll(),
    driveStore.getAll(),
    photosStore.getAll(),
    calendarStore.getAll(),
    syncMetadataStore.getAll(),
    encryptionMetaStore.getAll()
  ]);

  return { gmail, drive, photos, calendar, syncMetadata, encryptionMeta };
}
