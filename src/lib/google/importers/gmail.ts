// Gmail import with pagination and progress tracking
// All data is encrypted before storage

import type { EncryptedEmailStore, ImportProgress, EncryptedData } from '../types';
import { encryptData, deriveServiceKey } from '../encryption';
import { gmailStore, syncMetadataStore } from '../database';
import { getAccessToken } from '../oauth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Import options
export interface GmailImportOptions {
  maxMessages?: number;           // Limit total messages to import
  labelsFilter?: string[];        // Only import from these labels
  dateAfter?: Date;               // Only import messages after this date
  dateBefore?: Date;              // Only import messages before this date
  includeSpam?: boolean;          // Include spam folder
  includeTrash?: boolean;         // Include trash folder
  onProgress?: (progress: ImportProgress) => void;  // Progress callback
}

// Gmail message list response
interface GmailMessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// Gmail message response
interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: { name: string; value: string }[];
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
  };
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

// Extract header value from message
function getHeader(message: GmailMessageResponse, name: string): string {
  const header = message.payload?.headers?.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

// Decode base64url encoded content
function decodeBase64Url(data: string): string {
  try {
    // Replace URL-safe characters and add padding
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
    return atob(paddedBase64);
  } catch {
    return '';
  }
}

// Extract message body from parts
function extractBody(message: GmailMessageResponse): string {
  const payload = message.payload;
  if (!payload) return '';

  // Check direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Check parts for text/plain or text/html
  if (payload.parts) {
    return extractBodyFromParts(payload.parts);
  }

  return '';
}

function extractBodyFromParts(parts: GmailMessagePart[]): string {
  // Prefer text/plain, fall back to text/html
  let plainText = '';
  let htmlText = '';

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plainText = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      htmlText = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      // Recursively check nested parts
      const nested = extractBodyFromParts(part.parts);
      if (nested) return nested;
    }
  }

  return plainText || htmlText;
}

// Check if message has attachments
function hasAttachments(message: GmailMessageResponse): boolean {
  const parts = message.payload?.parts || [];
  return parts.some(part =>
    part.body?.size && part.body.size > 0 &&
    part.mimeType !== 'text/plain' && part.mimeType !== 'text/html'
  );
}

// Build query string from options
function buildQuery(options: GmailImportOptions): string {
  const queryParts: string[] = [];

  if (options.dateAfter) {
    queryParts.push(`after:${Math.floor(options.dateAfter.getTime() / 1000)}`);
  }
  if (options.dateBefore) {
    queryParts.push(`before:${Math.floor(options.dateBefore.getTime() / 1000)}`);
  }
  if (!options.includeSpam) {
    queryParts.push('-in:spam');
  }
  if (!options.includeTrash) {
    queryParts.push('-in:trash');
  }

  return queryParts.join(' ');
}

// Main Gmail import class
export class GmailImporter {
  private accessToken: string | null = null;
  private encryptionKey: CryptoKey | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private masterKey: CryptoKey
  ) {}

  // Initialize importer (get token and derive key)
  async initialize(): Promise<boolean> {
    this.accessToken = await getAccessToken(this.masterKey);
    if (!this.accessToken) {
      console.error('No access token available for Gmail');
      return false;
    }

    this.encryptionKey = await deriveServiceKey(this.masterKey, 'gmail');
    return true;
  }

  // Abort current import
  abort(): void {
    this.abortController?.abort();
  }

  // Import Gmail messages
  async import(options: GmailImportOptions = {}): Promise<ImportProgress> {
    const progress: ImportProgress = {
      service: 'gmail',
      total: 0,
      imported: 0,
      status: 'importing'
    };

    if (!await this.initialize()) {
      progress.status = 'error';
      progress.errorMessage = 'Failed to initialize Gmail importer';
      return progress;
    }

    this.abortController = new AbortController();
    progress.startedAt = Date.now();

    try {
      // First, get total count
      const countResponse = await this.fetchApi('/messages', {
        maxResults: '1',
        q: buildQuery(options)
      });

      progress.total = countResponse.resultSizeEstimate || 0;
      if (options.maxMessages) {
        progress.total = Math.min(progress.total, options.maxMessages);
      }

      options.onProgress?.(progress);

      // Fetch messages with pagination
      let pageToken: string | undefined;
      const batchSize = 100;
      const messageBatch: EncryptedEmailStore[] = [];

      do {
        // Check for abort
        if (this.abortController.signal.aborted) {
          progress.status = 'paused';
          break;
        }

        // Fetch message list
        const listParams: Record<string, string> = {
          maxResults: String(batchSize),
          q: buildQuery(options)
        };
        if (pageToken) {
          listParams.pageToken = pageToken;
        }
        if (options.labelsFilter?.length) {
          listParams.labelIds = options.labelsFilter.join(',');
        }

        const listResponse: GmailMessageListResponse = await this.fetchApi('/messages', listParams);

        if (!listResponse.messages?.length) {
          break;
        }

        // Fetch full message details in parallel (batches of 10)
        const messages = listResponse.messages;
        for (let i = 0; i < messages.length; i += 10) {
          if (this.abortController.signal.aborted) break;

          const batch = messages.slice(i, i + 10);
          const fullMessages = await Promise.all(
            batch.map(msg => this.fetchMessage(msg.id))
          );

          // Encrypt and store each message
          for (const message of fullMessages) {
            if (message) {
              const encrypted = await this.encryptMessage(message);
              messageBatch.push(encrypted);
              progress.imported++;

              // Save batch every 50 messages
              if (messageBatch.length >= 50) {
                await gmailStore.putBatch(messageBatch);
                messageBatch.length = 0;
              }

              options.onProgress?.(progress);

              // Check max messages limit
              if (options.maxMessages && progress.imported >= options.maxMessages) {
                break;
              }
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 50));
        }

        pageToken = listResponse.nextPageToken;

        // Check max messages limit
        if (options.maxMessages && progress.imported >= options.maxMessages) {
          break;
        }

      } while (pageToken);

      // Save remaining messages
      if (messageBatch.length > 0) {
        await gmailStore.putBatch(messageBatch);
      }

      // Update sync metadata
      progress.status = 'completed';
      progress.completedAt = Date.now();
      await syncMetadataStore.markComplete('gmail', progress.imported);

    } catch (error) {
      console.error('Gmail import error:', error);
      progress.status = 'error';
      progress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncMetadataStore.markError('gmail', progress.errorMessage);
    }

    options.onProgress?.(progress);
    return progress;
  }

  // Fetch from Gmail API
  private async fetchApi(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<GmailMessageListResponse> {
    const url = new URL(`${GMAIL_API_BASE}${endpoint}`);
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
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Fetch a single message with full content
  private async fetchMessage(messageId: string): Promise<GmailMessageResponse | null> {
    try {
      const response = await fetch(
        `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          },
          signal: this.abortController?.signal
        }
      );

      if (!response.ok) {
        console.warn(`Failed to fetch message ${messageId}`);
        return null;
      }

      return response.json();
    } catch (error) {
      console.warn(`Error fetching message ${messageId}:`, error);
      return null;
    }
  }

  // Encrypt a message for storage
  private async encryptMessage(message: GmailMessageResponse): Promise<EncryptedEmailStore> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const subject = getHeader(message, 'Subject');
    const from = getHeader(message, 'From');
    const to = getHeader(message, 'To');
    const body = extractBody(message);
    const snippet = message.snippet || '';

    // Helper to encrypt with null handling
    const encrypt = async (data: string): Promise<EncryptedData> => {
      return encryptData(data, this.encryptionKey!);
    };

    return {
      id: message.id,
      threadId: message.threadId,
      encryptedSubject: await encrypt(subject),
      encryptedBody: await encrypt(body),
      encryptedFrom: await encrypt(from),
      encryptedTo: await encrypt(to),
      date: parseInt(message.internalDate || '0'),
      labels: message.labelIds || [],
      hasAttachments: hasAttachments(message),
      encryptedSnippet: await encrypt(snippet),
      syncedAt: Date.now(),
      localOnly: true
    };
  }

  // Get Gmail labels
  async getLabels(): Promise<{ id: string; name: string; type: string }[]> {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const response = await fetch(`${GMAIL_API_BASE}/labels`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { labels?: { id: string; name: string; type: string }[] };
      return data.labels || [];
    } catch (error) {
      console.error('Get labels error:', error);
      return [];
    }
  }
}

// Convenience function to create and run importer
export async function importGmail(
  masterKey: CryptoKey,
  options: GmailImportOptions = {}
): Promise<ImportProgress> {
  const importer = new GmailImporter(masterKey);
  return importer.import(options);
}
