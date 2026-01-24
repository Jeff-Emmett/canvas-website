/**
 * IndexedDB store for Obsidian note content
 *
 * Stores full note content locally in IndexedDB to avoid:
 * 1. Automerge capacity overflow (WASM limits)
 * 2. localStorage quota exceeded (~5MB limit)
 * 3. Syncing private note content to other users
 *
 * Only metadata (id, title, tags, links) is synced via Automerge.
 * Full content stays local and is loaded on-demand.
 */

const DB_NAME = 'canvas-obsidian-content';
const DB_VERSION = 1;
const STORE_NAME = 'note_content';
const VAULT_META_STORE = 'vault_metadata';

let dbInstance: IDBDatabase | null = null;

export interface StoredNoteContent {
  id: string;           // Note ID (matches ObsidianObsNote.id)
  vaultName: string;    // Vault this note belongs to
  content: string;      // Full markdown content
  storedAt: Date;       // When this was stored
}

export interface StoredVaultMeta {
  vaultName: string;
  noteCount: number;
  totalSize: number;    // Approximate size in bytes
  storedAt: Date;
}

/**
 * Open or create the IndexedDB database
 */
export async function openNoteContentDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open note content database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle connection closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Note content store - keyed by note ID
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('vaultName', 'vaultName', { unique: false });
        store.createIndex('storedAt', 'storedAt', { unique: false });
      }

      // Vault metadata store
      if (!db.objectStoreNames.contains(VAULT_META_STORE)) {
        db.createObjectStore(VAULT_META_STORE, { keyPath: 'vaultName' });
      }
    };
  });
}

/**
 * Close the database connection
 */
export function closeNoteContentDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Save a single note's content to IndexedDB
 */
export async function saveNoteContent(
  noteId: string,
  vaultName: string,
  content: string
): Promise<void> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredNoteContent = {
      id: noteId,
      vaultName,
      content,
      storedAt: new Date()
    };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save all note contents for a vault in a batch operation
 */
export async function saveVaultNoteContents(
  vaultName: string,
  notes: Array<{ id: string; content: string }>
): Promise<void> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, VAULT_META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(VAULT_META_STORE);

    let totalSize = 0;
    const now = new Date();

    // Save each note's content
    for (const note of notes) {
      const record: StoredNoteContent = {
        id: note.id,
        vaultName,
        content: note.content,
        storedAt: now
      };
      store.put(record);
      totalSize += note.content.length;
    }

    // Save vault metadata
    const meta: StoredVaultMeta = {
      vaultName,
      noteCount: notes.length,
      totalSize,
      storedAt: now
    };
    metaStore.put(meta);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a single note's content from IndexedDB
 */
export async function getNoteContent(noteId: string): Promise<string | null> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(noteId);

    request.onsuccess = () => {
      const record = request.result as StoredNoteContent | undefined;
      resolve(record?.content ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all note contents for a vault
 */
export async function getVaultNoteContents(
  vaultName: string
): Promise<Map<string, string>> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('vaultName');
    const request = index.getAll(vaultName);

    request.onsuccess = () => {
      const records = request.result as StoredNoteContent[];
      const contentMap = new Map<string, string>();
      for (const record of records) {
        contentMap.set(record.id, record.content);
      }
      resolve(contentMap);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all note contents for a vault
 */
export async function deleteVaultNoteContents(vaultName: string): Promise<void> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, VAULT_META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(VAULT_META_STORE);
    const index = store.index('vaultName');

    // Get all note IDs for this vault
    const request = index.getAllKeys(vaultName);

    request.onsuccess = () => {
      const keys = request.result;
      for (const key of keys) {
        store.delete(key);
      }
      metaStore.delete(vaultName);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get vault metadata (note count, size)
 */
export async function getVaultMeta(vaultName: string): Promise<StoredVaultMeta | null> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readonly');
    const store = tx.objectStore(VAULT_META_STORE);
    const request = store.get(vaultName);

    request.onsuccess = () => {
      resolve(request.result as StoredVaultMeta | null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all vaults stored in IndexedDB
 */
export async function listStoredVaults(): Promise<StoredVaultMeta[]> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readonly');
    const store = tx.objectStore(VAULT_META_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as StoredVaultMeta[]);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all stored content (for debugging/reset)
 */
export async function clearAllNoteContent(): Promise<void> {
  const db = await openNoteContentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, VAULT_META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(VAULT_META_STORE).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
