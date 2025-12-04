# Local File Upload: Multi-Item Encrypted Import

A simpler, more broadly compatible approach to importing local files into the canvas with the same privacy-first, encrypted storage model.

## Overview

Instead of maintaining persistent folder connections (which have browser compatibility issues), provide a **drag-and-drop / file picker** interface for batch importing files into encrypted local storage.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UPLOAD INTERFACE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │           📁 Drop files here or click to browse                │   │
│  │                                                                 │   │
│  │     Supports: Images, PDFs, Documents, Text, Audio, Video      │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Import Queue                                           [Upload] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ☑ photo_001.jpg (2.4 MB)          🔒 Encrypt  📤 Share         │  │
│  │ ☑ meeting_notes.pdf (450 KB)      🔒 Encrypt  ☐ Private        │  │
│  │ ☑ project_plan.md (12 KB)         🔒 Encrypt  ☐ Private        │  │
│  │ ☐ sensitive_doc.docx (1.2 MB)     🔒 Encrypt  ☐ Private        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Storage: 247 MB used / ~5 GB available                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Why Multi-Item Upload vs. Folder Connection

| Feature | Folder Connection | Multi-Item Upload |
|---------|------------------|-------------------|
| Browser Support | Chrome/Edge only | All browsers |
| Persistent Access | Yes (with permission) | No (one-time import) |
| Implementation | Complex | Simple |
| User Control | Less explicit | Very explicit |
| Privacy UX | Hidden | Clear per-file choices |

**Recommendation**: Multi-item upload is better for privacy-conscious users who want explicit control over what enters the system.

## Supported File Types

### Documents
| Type | Extension | Processing | Storage Strategy |
|------|-----------|-----------|------------------|
| Markdown | `.md` | Parse frontmatter, render | Full content |
| PDF | `.pdf` | Extract text, thumbnail | Text + thumbnail |
| Word | `.docx` | Convert to markdown | Converted content |
| Text | `.txt`, `.csv`, `.json` | Direct | Full content |
| Code | `.js`, `.ts`, `.py`, etc. | Syntax highlight | Full content |

### Images
| Type | Extension | Processing | Storage Strategy |
|------|-----------|-----------|------------------|
| Photos | `.jpg`, `.png`, `.webp` | Generate thumbnail | Thumbnail + full |
| Vector | `.svg` | Direct | Full content |
| GIF | `.gif` | First frame thumb | Thumbnail + full |

### Media
| Type | Extension | Processing | Storage Strategy |
|------|-----------|-----------|------------------|
| Audio | `.mp3`, `.wav`, `.m4a` | Waveform preview | Reference + metadata |
| Video | `.mp4`, `.webm` | Frame thumbnail | Reference + metadata |

### Archives (Future)
| Type | Extension | Processing |
|------|-----------|-----------|
| ZIP | `.zip` | List contents, selective extract |
| Obsidian Export | `.zip` | Vault structure import |

## Architecture

```typescript
interface UploadedFile {
  id: string;                      // Generated UUID
  originalName: string;            // User's filename
  mimeType: string;
  size: number;

  // Processing results
  processed: {
    thumbnail?: ArrayBuffer;       // For images/PDFs/videos
    extractedText?: string;        // For searchable docs
    metadata?: Record<string, any>; // EXIF, frontmatter, etc.
  };

  // Encryption
  encrypted: {
    content: ArrayBuffer;          // Encrypted file content
    iv: Uint8Array;
    keyId: string;                 // Reference to encryption key
  };

  // User choices
  sharing: {
    localOnly: boolean;            // Default true
    sharedToBoard?: string;        // Board ID if shared
    backedUpToR2?: boolean;
  };

  // Timestamps
  importedAt: number;
  lastAccessedAt: number;
}
```

## Implementation

### 1. File Input Component

```typescript
import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFileSize?: number;  // bytes
  maxFiles?: number;
  acceptedTypes?: string[];
}

export function FileUploadZone({
  onFilesSelected,
  maxFileSize = 100 * 1024 * 1024,  // 100MB default
  maxFiles = 50,
  acceptedTypes
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    validateAndProcess(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndProcess(files);
  }, []);

  const validateAndProcess = (files: File[]) => {
    const errors: string[] = [];
    const validFiles: File[] = [];

    for (const file of files.slice(0, maxFiles)) {
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: exceeds ${maxFileSize / 1024 / 1024}MB limit`);
        continue;
      }

      if (acceptedTypes && !acceptedTypes.some(t => file.type.match(t))) {
        errors.push(`${file.name}: unsupported file type`);
        continue;
      }

      validFiles.push(file);
    }

    if (files.length > maxFiles) {
      errors.push(`Only first ${maxFiles} files will be imported`);
    }

    setErrors(errors);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className={`upload-zone ${isDragging ? 'dragging' : ''}`}
    >
      <input
        type="file"
        multiple
        onChange={handleFileInput}
        accept={acceptedTypes?.join(',')}
        id="file-upload"
        hidden
      />
      <label htmlFor="file-upload">
        <span className="upload-icon">📁</span>
        <span>Drop files here or click to browse</span>
        <span className="upload-hint">
          Images, PDFs, Documents, Text files
        </span>
      </label>

      {errors.length > 0 && (
        <div className="upload-errors">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );
}
```

### 2. File Processing Pipeline

```typescript
interface ProcessedFile {
  file: File;
  thumbnail?: Blob;
  extractedText?: string;
  metadata?: Record<string, any>;
}

class FileProcessor {

  async process(file: File): Promise<ProcessedFile> {
    const result: ProcessedFile = { file };

    // Route based on MIME type
    if (file.type.startsWith('image/')) {
      return this.processImage(file, result);
    } else if (file.type === 'application/pdf') {
      return this.processPDF(file, result);
    } else if (file.type.startsWith('text/') || this.isTextFile(file)) {
      return this.processText(file, result);
    } else if (file.type.startsWith('video/')) {
      return this.processVideo(file, result);
    } else if (file.type.startsWith('audio/')) {
      return this.processAudio(file, result);
    }

    // Default: store as-is
    return result;
  }

  private async processImage(file: File, result: ProcessedFile): Promise<ProcessedFile> {
    // Generate thumbnail
    const img = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(200, 200);
    const ctx = canvas.getContext('2d')!;

    // Calculate aspect-ratio preserving dimensions
    const scale = Math.min(200 / img.width, 200 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;

    ctx.drawImage(img, (200 - w) / 2, (200 - h) / 2, w, h);
    result.thumbnail = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

    // Extract EXIF if available
    if (file.type === 'image/jpeg') {
      result.metadata = await this.extractExif(file);
    }

    return result;
  }

  private async processPDF(file: File, result: ProcessedFile): Promise<ProcessedFile> {
    // Use pdf.js for text extraction and thumbnail
    const pdfjsLib = await import('pdfjs-dist');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Get first page as thumbnail
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;
    result.thumbnail = await canvas.convertToBlob({ type: 'image/webp' });

    // Extract text from all pages
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    result.extractedText = text;

    result.metadata = { pageCount: pdf.numPages };

    return result;
  }

  private async processText(file: File, result: ProcessedFile): Promise<ProcessedFile> {
    result.extractedText = await file.text();

    // Parse markdown frontmatter if applicable
    if (file.name.endsWith('.md')) {
      const frontmatter = this.parseFrontmatter(result.extractedText);
      if (frontmatter) {
        result.metadata = frontmatter;
      }
    }

    return result;
  }

  private async processVideo(file: File, result: ProcessedFile): Promise<ProcessedFile> {
    // Generate thumbnail from first frame
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);

    await new Promise(resolve => video.addEventListener('loadedmetadata', resolve));
    video.currentTime = 1; // First second
    await new Promise(resolve => video.addEventListener('seeked', resolve));

    const canvas = new OffscreenCanvas(200, 200);
    const ctx = canvas.getContext('2d')!;
    const scale = Math.min(200 / video.videoWidth, 200 / video.videoHeight);
    ctx.drawImage(video, 0, 0, video.videoWidth * scale, video.videoHeight * scale);

    result.thumbnail = await canvas.convertToBlob({ type: 'image/webp' });
    result.metadata = {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight
    };

    URL.revokeObjectURL(video.src);
    return result;
  }

  private async processAudio(file: File, result: ProcessedFile): Promise<ProcessedFile> {
    // Extract duration and basic metadata
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(file);

    await new Promise(resolve => audio.addEventListener('loadedmetadata', resolve));

    result.metadata = {
      duration: audio.duration
    };

    URL.revokeObjectURL(audio.src);
    return result;
  }

  private isTextFile(file: File): boolean {
    const textExtensions = ['.md', '.txt', '.json', '.csv', '.yaml', '.yml', '.xml', '.html', '.css', '.js', '.ts', '.py', '.sh'];
    return textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  private parseFrontmatter(content: string): Record<string, any> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    try {
      // Simple YAML-like parsing (or use a proper YAML parser)
      const lines = match[1].split('\n');
      const result: Record<string, any> = {};
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          result[key.trim()] = valueParts.join(':').trim();
        }
      }
      return result;
    } catch {
      return null;
    }
  }

  private async extractExif(file: File): Promise<Record<string, any>> {
    // Would use exif-js or similar library
    return {};
  }
}
```

### 3. Encryption & Storage

```typescript
class LocalFileStore {
  private db: IDBDatabase;
  private encryptionKey: CryptoKey;

  async storeFile(processed: ProcessedFile, options: {
    shareToBoard?: boolean;
  } = {}): Promise<UploadedFile> {
    const fileId = crypto.randomUUID();

    // Read file content
    const content = await processed.file.arrayBuffer();

    // Encrypt content
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      content
    );

    // Encrypt thumbnail if present
    let encryptedThumbnail: ArrayBuffer | undefined;
    let thumbnailIv: Uint8Array | undefined;
    if (processed.thumbnail) {
      thumbnailIv = crypto.getRandomValues(new Uint8Array(12));
      const thumbBuffer = await processed.thumbnail.arrayBuffer();
      encryptedThumbnail = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: thumbnailIv },
        this.encryptionKey,
        thumbBuffer
      );
    }

    const uploadedFile: UploadedFile = {
      id: fileId,
      originalName: processed.file.name,
      mimeType: processed.file.type,
      size: processed.file.size,
      processed: {
        extractedText: processed.extractedText,
        metadata: processed.metadata
      },
      encrypted: {
        content: encryptedContent,
        iv,
        keyId: 'user-master-key'
      },
      sharing: {
        localOnly: !options.shareToBoard,
        sharedToBoard: options.shareToBoard ? getCurrentBoardId() : undefined
      },
      importedAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    // Store encrypted thumbnail separately (for faster listing)
    if (encryptedThumbnail && thumbnailIv) {
      await this.storeThumbnail(fileId, encryptedThumbnail, thumbnailIv);
    }

    // Store to IndexedDB
    const tx = this.db.transaction('files', 'readwrite');
    tx.objectStore('files').put(uploadedFile);

    return uploadedFile;
  }

  async getFile(fileId: string): Promise<{
    file: UploadedFile;
    decryptedContent: ArrayBuffer;
  } | null> {
    const tx = this.db.transaction('files', 'readonly');
    const file = await new Promise<UploadedFile | undefined>(resolve => {
      const req = tx.objectStore('files').get(fileId);
      req.onsuccess = () => resolve(req.result);
    });

    if (!file) return null;

    // Decrypt content
    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: file.encrypted.iv },
      this.encryptionKey,
      file.encrypted.content
    );

    return { file, decryptedContent };
  }

  async listFiles(options?: {
    mimeTypeFilter?: string;
    limit?: number;
    offset?: number;
  }): Promise<UploadedFile[]> {
    const tx = this.db.transaction('files', 'readonly');
    const store = tx.objectStore('files');

    return new Promise(resolve => {
      const files: UploadedFile[] = [];
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          const file = cursor.value as UploadedFile;

          // Filter by MIME type if specified
          if (!options?.mimeTypeFilter || file.mimeType.startsWith(options.mimeTypeFilter)) {
            files.push(file);
          }

          cursor.continue();
        } else {
          resolve(files);
        }
      };
    });
  }
}
```

### 4. IndexedDB Schema

```typescript
const LOCAL_FILES_DB = 'canvas-local-files';
const DB_VERSION = 1;

async function initLocalFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_FILES_DB, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Main files store
      if (!db.objectStoreNames.contains('files')) {
        const store = db.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('mimeType', 'mimeType', { unique: false });
        store.createIndex('importedAt', 'importedAt', { unique: false });
        store.createIndex('originalName', 'originalName', { unique: false });
        store.createIndex('sharedToBoard', 'sharing.sharedToBoard', { unique: false });
      }

      // Thumbnails store (separate for faster listing)
      if (!db.objectStoreNames.contains('thumbnails')) {
        db.createObjectStore('thumbnails', { keyPath: 'fileId' });
      }

      // Search index (encrypted full-text search)
      if (!db.objectStoreNames.contains('searchIndex')) {
        const searchStore = db.createObjectStore('searchIndex', { keyPath: 'fileId' });
        searchStore.createIndex('tokens', 'tokens', { unique: false, multiEntry: true });
      }
    };
  });
}
```

## UI Components

### Import Dialog

```tsx
function ImportFilesDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedFiles, setSelectedFiles] = useState<ProcessedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileStore = useLocalFileStore();

  const handleFilesSelected = async (files: File[]) => {
    const processor = new FileProcessor();
    const processed: ProcessedFile[] = [];

    for (const file of files) {
      processed.push(await processor.process(file));
    }

    setSelectedFiles(prev => [...prev, ...processed]);
  };

  const handleImport = async () => {
    setImporting(true);

    for (let i = 0; i < selectedFiles.length; i++) {
      await fileStore.storeFile(selectedFiles[i]);
      setProgress((i + 1) / selectedFiles.length * 100);
    }

    setImporting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Import Files</DialogTitle>

      <FileUploadZone onFilesSelected={handleFilesSelected} />

      {selectedFiles.length > 0 && (
        <div className="file-list">
          {selectedFiles.map((pf, i) => (
            <FilePreviewRow
              key={i}
              file={pf}
              onRemove={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}

      {importing && (
        <progress value={progress} max={100} />
      )}

      <DialogActions>
        <button onClick={onClose}>Cancel</button>
        <button
          onClick={handleImport}
          disabled={selectedFiles.length === 0 || importing}
        >
          Import {selectedFiles.length} files
        </button>
      </DialogActions>
    </Dialog>
  );
}
```

### File Browser Panel

```tsx
function LocalFilesBrowser() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const fileStore = useLocalFileStore();

  useEffect(() => {
    loadFiles();
  }, [filter]);

  const loadFiles = async () => {
    const mimeFilter = filter === 'all' ? undefined : filter;
    setFiles(await fileStore.listFiles({ mimeTypeFilter: mimeFilter }));
  };

  const handleDragToCanvas = (file: UploadedFile) => {
    // Create a shape from the file and add to canvas
  };

  return (
    <div className="local-files-browser">
      <div className="filter-bar">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('image/')}>Images</button>
        <button onClick={() => setFilter('application/pdf')}>PDFs</button>
        <button onClick={() => setFilter('text/')}>Documents</button>
      </div>

      <div className="files-grid">
        {files.map(file => (
          <FileCard
            key={file.id}
            file={file}
            onDragStart={() => handleDragToCanvas(file)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Canvas Integration

### Drag Files to Canvas

```typescript
// When user drags a local file onto the canvas
async function createShapeFromLocalFile(
  file: UploadedFile,
  position: { x: number; y: number },
  editor: Editor
): Promise<TLShapeId> {
  const fileStore = getLocalFileStore();
  const { decryptedContent } = await fileStore.getFile(file.id);

  if (file.mimeType.startsWith('image/')) {
    // Create image shape
    const blob = new Blob([decryptedContent], { type: file.mimeType });
    const assetId = AssetRecordType.createId();

    await editor.createAssets([{
      id: assetId,
      type: 'image',
      typeName: 'asset',
      props: {
        name: file.originalName,
        src: URL.createObjectURL(blob),
        w: 400,
        h: 300,
        mimeType: file.mimeType,
        isAnimated: file.mimeType === 'image/gif'
      }
    }]);

    return editor.createShape({
      type: 'image',
      x: position.x,
      y: position.y,
      props: { assetId, w: 400, h: 300 }
    }).id;

  } else if (file.mimeType === 'application/pdf') {
    // Create PDF embed or preview shape
    return editor.createShape({
      type: 'pdf-preview',
      x: position.x,
      y: position.y,
      props: {
        fileId: file.id,
        name: file.originalName,
        pageCount: file.processed.metadata?.pageCount
      }
    }).id;

  } else if (file.mimeType.startsWith('text/') || file.originalName.endsWith('.md')) {
    // Create note shape with content
    const text = new TextDecoder().decode(decryptedContent);
    return editor.createShape({
      type: 'note',
      x: position.x,
      y: position.y,
      props: {
        text: text.slice(0, 1000),  // Truncate for display
        fileId: file.id,
        fullContentAvailable: text.length > 1000
      }
    }).id;
  }

  // Default: generic file card
  return editor.createShape({
    type: 'file-card',
    x: position.x,
    y: position.y,
    props: {
      fileId: file.id,
      name: file.originalName,
      size: file.size,
      mimeType: file.mimeType
    }
  }).id;
}
```

## Storage Considerations

### Size Limits & Recommendations

| File Type | Max Recommended | Notes |
|-----------|----------------|-------|
| Images | 20MB each | Larger images get resized |
| PDFs | 50MB each | Text extracted for search |
| Videos | 100MB each | Store reference, thumbnail only |
| Audio | 50MB each | Store with waveform preview |
| Documents | 10MB each | Full content stored |

### Total Storage Budget

```typescript
const STORAGE_CONFIG = {
  // Soft warning at 500MB
  warningThreshold: 500 * 1024 * 1024,

  // Hard limit at 2GB (leaves room for other data)
  maxStorage: 2 * 1024 * 1024 * 1024,

  // Auto-cleanup: remove thumbnails for files not accessed in 30 days
  thumbnailRetentionDays: 30
};

async function checkStorageQuota(): Promise<{
  used: number;
  available: number;
  warning: boolean;
}> {
  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || 0;
  const quota = estimate.quota || 0;

  return {
    used,
    available: Math.min(quota - used, STORAGE_CONFIG.maxStorage - used),
    warning: used > STORAGE_CONFIG.warningThreshold
  };
}
```

## Privacy Features

### Per-File Privacy Controls

```typescript
interface FilePrivacySettings {
  // Encryption is always on - this is about sharing
  localOnly: boolean;           // Never leaves browser
  shareableToBoard: boolean;    // Can be added to shared board
  includeInR2Backup: boolean;   // Include in cloud backup

  // Metadata privacy
  stripExif: boolean;           // Remove location/camera data from images
  anonymizeFilename: boolean;   // Use generated name instead of original
}

const DEFAULT_PRIVACY: FilePrivacySettings = {
  localOnly: true,
  shareableToBoard: false,
  includeInR2Backup: true,
  stripExif: true,
  anonymizeFilename: false
};
```

### Sharing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User drags local file onto shared board                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️  Share "meeting_notes.pdf" to this board?                  │
│                                                                 │
│  This file is currently private. Sharing it will:               │
│  • Make it visible to all board members                         │
│  • Upload an encrypted copy to sync storage                     │
│  • Keep the original encrypted on your device                   │
│                                                                 │
│  [Keep Private]  [Share to Board]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

### Phase 1: Core Upload
- [ ] File drop zone component
- [ ] File type detection
- [ ] Image thumbnail generation
- [ ] PDF text extraction & thumbnail
- [ ] Encryption before storage
- [ ] IndexedDB schema & storage

### Phase 2: File Management
- [ ] File browser panel
- [ ] Filter by type
- [ ] Search within files
- [ ] Delete files
- [ ] Storage quota display

### Phase 3: Canvas Integration
- [ ] Drag files to canvas
- [ ] Image shape from file
- [ ] PDF preview shape
- [ ] Document/note shape
- [ ] Generic file card shape

### Phase 4: Sharing & Backup
- [ ] Share confirmation dialog
- [ ] Upload to Automerge sync
- [ ] Include in R2 backup
- [ ] Privacy settings per file

## Related Documents

- [Google Data Sovereignty](./GOOGLE_DATA_SOVEREIGNTY.md) - Same encryption model for Google imports
- [Offline Storage Feasibility](../OFFLINE_STORAGE_FEASIBILITY.md) - IndexedDB + Automerge foundation
