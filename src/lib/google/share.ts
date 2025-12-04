// Share encrypted data to the canvas board
// Decrypts items and creates tldraw shapes

import type {
  EncryptedEmailStore,
  EncryptedDriveDocument,
  EncryptedPhotoReference,
  EncryptedCalendarEvent,
  ShareableItem,
  GoogleService
} from './types';
import {
  decryptDataToString,
  deriveServiceKey
} from './encryption';
import {
  gmailStore,
  driveStore,
  photosStore,
  calendarStore
} from './database';
import type { TLShapeId } from 'tldraw';
import { createShapeId } from 'tldraw';

// Shape types for canvas
export interface EmailCardShape {
  id: TLShapeId;
  type: 'email-card';
  x: number;
  y: number;
  props: {
    subject: string;
    from: string;
    date: number;
    snippet: string;
    messageId: string;
    hasAttachments: boolean;
  };
}

export interface DocumentCardShape {
  id: TLShapeId;
  type: 'document-card';
  x: number;
  y: number;
  props: {
    name: string;
    mimeType: string;
    content: string | null;
    documentId: string;
    size: number;
    modifiedTime: number;
  };
}

export interface PhotoCardShape {
  id: TLShapeId;
  type: 'photo-card';
  x: number;
  y: number;
  props: {
    filename: string;
    description: string | null;
    thumbnailDataUrl: string | null;
    mediaItemId: string;
    mediaType: 'image' | 'video';
    width: number;
    height: number;
    creationTime: number;
  };
}

export interface EventCardShape {
  id: TLShapeId;
  type: 'event-card';
  x: number;
  y: number;
  props: {
    summary: string;
    description: string | null;
    location: string | null;
    startTime: number;
    endTime: number;
    isAllDay: boolean;
    eventId: string;
    calendarId: string;
    meetingLink: string | null;
  };
}

export type GoogleDataShape =
  | EmailCardShape
  | DocumentCardShape
  | PhotoCardShape
  | EventCardShape;

// Service to manage sharing to board
export class ShareService {
  private serviceKeys: Map<GoogleService, CryptoKey> = new Map();

  constructor(private masterKey: CryptoKey) {}

  // Initialize service keys for decryption
  private async getServiceKey(service: GoogleService): Promise<CryptoKey> {
    let key = this.serviceKeys.get(service);
    if (!key) {
      key = await deriveServiceKey(this.masterKey, service);
      this.serviceKeys.set(service, key);
    }
    return key;
  }

  // List items available for sharing (with decrypted previews)
  async listShareableItems(
    service: GoogleService,
    limit: number = 50
  ): Promise<ShareableItem[]> {
    const key = await this.getServiceKey(service);

    switch (service) {
      case 'gmail':
        return this.listShareableEmails(key, limit);
      case 'drive':
        return this.listShareableDocuments(key, limit);
      case 'photos':
        return this.listShareablePhotos(key, limit);
      case 'calendar':
        return this.listShareableEvents(key, limit);
      default:
        return [];
    }
  }

  // List shareable emails
  private async listShareableEmails(
    key: CryptoKey,
    limit: number
  ): Promise<ShareableItem[]> {
    const emails = await gmailStore.getAll();
    const items: ShareableItem[] = [];

    for (const email of emails.slice(0, limit)) {
      try {
        const subject = await decryptDataToString(email.encryptedSubject, key);
        const snippet = await decryptDataToString(email.encryptedSnippet, key);

        items.push({
          type: 'email',
          id: email.id,
          title: subject || '(No Subject)',
          preview: snippet,
          date: email.date
        });
      } catch (error) {
        console.warn(`Failed to decrypt email ${email.id}:`, error);
      }
    }

    return items.sort((a, b) => b.date - a.date);
  }

  // List shareable documents
  private async listShareableDocuments(
    key: CryptoKey,
    limit: number
  ): Promise<ShareableItem[]> {
    const docs = await driveStore.getRecent(limit);
    const items: ShareableItem[] = [];

    for (const doc of docs) {
      try {
        const name = await decryptDataToString(doc.encryptedName, key);

        items.push({
          type: 'document',
          id: doc.id,
          title: name || 'Untitled',
          date: doc.modifiedTime
        });
      } catch (error) {
        console.warn(`Failed to decrypt document ${doc.id}:`, error);
      }
    }

    return items;
  }

  // List shareable photos
  private async listShareablePhotos(
    key: CryptoKey,
    limit: number
  ): Promise<ShareableItem[]> {
    const photos = await photosStore.getAll();
    const items: ShareableItem[] = [];

    for (const photo of photos.slice(0, limit)) {
      try {
        const filename = await decryptDataToString(photo.encryptedFilename, key);

        items.push({
          type: 'photo',
          id: photo.id,
          title: filename || 'Untitled',
          date: photo.creationTime
        });
      } catch (error) {
        console.warn(`Failed to decrypt photo ${photo.id}:`, error);
      }
    }

    return items.sort((a, b) => b.date - a.date);
  }

  // List shareable events
  private async listShareableEvents(
    key: CryptoKey,
    limit: number
  ): Promise<ShareableItem[]> {
    // Get all events, not just upcoming
    const events = await calendarStore.getAll();
    const items: ShareableItem[] = [];

    for (const event of events.slice(0, limit)) {
      try {
        const summary = await decryptDataToString(event.encryptedSummary, key);

        items.push({
          type: 'event',
          id: event.id,
          title: summary || 'Untitled Event',
          date: event.startTime
        });
      } catch (error) {
        console.warn(`Failed to decrypt event ${event.id}:`, error);
      }
    }

    return items;
  }

  // Create a shape from an item for the board
  async createShapeFromItem(
    itemId: string,
    itemType: ShareableItem['type'],
    position: { x: number; y: number }
  ): Promise<GoogleDataShape | null> {
    switch (itemType) {
      case 'email':
        return this.createEmailShape(itemId, position);
      case 'document':
        return this.createDocumentShape(itemId, position);
      case 'photo':
        return this.createPhotoShape(itemId, position);
      case 'event':
        return this.createEventShape(itemId, position);
      default:
        return null;
    }
  }

  // Create email shape
  private async createEmailShape(
    emailId: string,
    position: { x: number; y: number }
  ): Promise<EmailCardShape | null> {
    const email = await gmailStore.get(emailId);
    if (!email) return null;

    const key = await this.getServiceKey('gmail');

    try {
      const subject = await decryptDataToString(email.encryptedSubject, key);
      const from = await decryptDataToString(email.encryptedFrom, key);
      const snippet = await decryptDataToString(email.encryptedSnippet, key);

      return {
        id: createShapeId(),
        type: 'email-card',
        x: position.x,
        y: position.y,
        props: {
          subject: subject || '(No Subject)',
          from,
          date: email.date,
          snippet,
          messageId: email.id,
          hasAttachments: email.hasAttachments
        }
      };
    } catch (error) {
      console.error('Failed to create email shape:', error);
      return null;
    }
  }

  // Create document shape
  private async createDocumentShape(
    docId: string,
    position: { x: number; y: number }
  ): Promise<DocumentCardShape | null> {
    const doc = await driveStore.get(docId);
    if (!doc) return null;

    const key = await this.getServiceKey('drive');

    try {
      const name = await decryptDataToString(doc.encryptedName, key);
      const mimeType = await decryptDataToString(doc.encryptedMimeType, key);
      const content = doc.encryptedContent
        ? await decryptDataToString(doc.encryptedContent, key)
        : null;

      return {
        id: createShapeId(),
        type: 'document-card',
        x: position.x,
        y: position.y,
        props: {
          name: name || 'Untitled',
          mimeType,
          content,
          documentId: doc.id,
          size: doc.size,
          modifiedTime: doc.modifiedTime
        }
      };
    } catch (error) {
      console.error('Failed to create document shape:', error);
      return null;
    }
  }

  // Create photo shape
  private async createPhotoShape(
    photoId: string,
    position: { x: number; y: number }
  ): Promise<PhotoCardShape | null> {
    const photo = await photosStore.get(photoId);
    if (!photo) return null;

    const key = await this.getServiceKey('photos');

    try {
      const filename = await decryptDataToString(photo.encryptedFilename, key);
      const description = photo.encryptedDescription
        ? await decryptDataToString(photo.encryptedDescription, key)
        : null;

      // Convert thumbnail to data URL if available
      let thumbnailDataUrl: string | null = null;
      if (photo.thumbnail?.encryptedData) {
        const thumbBuffer = await (await this.getServiceKey('photos')).algorithm;
        // Decrypt thumbnail and convert to base64
        // Note: This is simplified - actual implementation would need proper blob handling
        thumbnailDataUrl = null;  // TODO: implement thumbnail decryption
      }

      return {
        id: createShapeId(),
        type: 'photo-card',
        x: position.x,
        y: position.y,
        props: {
          filename: filename || 'Untitled',
          description,
          thumbnailDataUrl,
          mediaItemId: photo.id,
          mediaType: photo.mediaType,
          width: photo.fullResolution.width,
          height: photo.fullResolution.height,
          creationTime: photo.creationTime
        }
      };
    } catch (error) {
      console.error('Failed to create photo shape:', error);
      return null;
    }
  }

  // Create event shape
  private async createEventShape(
    eventId: string,
    position: { x: number; y: number }
  ): Promise<EventCardShape | null> {
    const event = await calendarStore.get(eventId);
    if (!event) return null;

    const key = await this.getServiceKey('calendar');

    try {
      const summary = await decryptDataToString(event.encryptedSummary, key);
      const description = event.encryptedDescription
        ? await decryptDataToString(event.encryptedDescription, key)
        : null;
      const location = event.encryptedLocation
        ? await decryptDataToString(event.encryptedLocation, key)
        : null;
      const meetingLink = event.encryptedMeetingLink
        ? await decryptDataToString(event.encryptedMeetingLink, key)
        : null;

      return {
        id: createShapeId(),
        type: 'event-card',
        x: position.x,
        y: position.y,
        props: {
          summary: summary || 'Untitled Event',
          description,
          location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          eventId: event.id,
          calendarId: event.calendarId,
          meetingLink
        }
      };
    } catch (error) {
      console.error('Failed to create event shape:', error);
      return null;
    }
  }

  // Mark an item as shared (no longer local-only)
  async markAsShared(itemId: string, itemType: ShareableItem['type']): Promise<void> {
    switch (itemType) {
      case 'email': {
        const email = await gmailStore.get(itemId);
        if (email) {
          email.localOnly = false;
          await gmailStore.put(email);
        }
        break;
      }
      // Drive, Photos, Calendar don't have localOnly flag in current schema
      // Would need to add if sharing tracking is needed
    }
  }

  // Get full decrypted content for an item
  async getFullContent(
    itemId: string,
    itemType: ShareableItem['type']
  ): Promise<Record<string, unknown> | null> {
    switch (itemType) {
      case 'email':
        return this.getFullEmailContent(itemId);
      case 'document':
        return this.getFullDocumentContent(itemId);
      case 'event':
        return this.getFullEventContent(itemId);
      default:
        return null;
    }
  }

  // Get full email content
  private async getFullEmailContent(
    emailId: string
  ): Promise<Record<string, unknown> | null> {
    const email = await gmailStore.get(emailId);
    if (!email) return null;

    const key = await this.getServiceKey('gmail');

    try {
      return {
        id: email.id,
        threadId: email.threadId,
        subject: await decryptDataToString(email.encryptedSubject, key),
        body: await decryptDataToString(email.encryptedBody, key),
        from: await decryptDataToString(email.encryptedFrom, key),
        to: await decryptDataToString(email.encryptedTo, key),
        date: email.date,
        labels: email.labels,
        hasAttachments: email.hasAttachments
      };
    } catch (error) {
      console.error('Failed to get full email content:', error);
      return null;
    }
  }

  // Get full document content
  private async getFullDocumentContent(
    docId: string
  ): Promise<Record<string, unknown> | null> {
    const doc = await driveStore.get(docId);
    if (!doc) return null;

    const key = await this.getServiceKey('drive');

    try {
      return {
        id: doc.id,
        name: await decryptDataToString(doc.encryptedName, key),
        mimeType: await decryptDataToString(doc.encryptedMimeType, key),
        content: doc.encryptedContent
          ? await decryptDataToString(doc.encryptedContent, key)
          : null,
        size: doc.size,
        modifiedTime: doc.modifiedTime,
        isShared: doc.isShared
      };
    } catch (error) {
      console.error('Failed to get full document content:', error);
      return null;
    }
  }

  // Get full event content
  private async getFullEventContent(
    eventId: string
  ): Promise<Record<string, unknown> | null> {
    const event = await calendarStore.get(eventId);
    if (!event) return null;

    const key = await this.getServiceKey('calendar');

    try {
      return {
        id: event.id,
        calendarId: event.calendarId,
        summary: await decryptDataToString(event.encryptedSummary, key),
        description: event.encryptedDescription
          ? await decryptDataToString(event.encryptedDescription, key)
          : null,
        location: event.encryptedLocation
          ? await decryptDataToString(event.encryptedLocation, key)
          : null,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        timezone: event.timezone,
        isRecurring: event.isRecurring,
        attendees: event.encryptedAttendees
          ? JSON.parse(await decryptDataToString(event.encryptedAttendees, key))
          : [],
        reminders: event.reminders,
        meetingLink: event.encryptedMeetingLink
          ? await decryptDataToString(event.encryptedMeetingLink, key)
          : null
      };
    } catch (error) {
      console.error('Failed to get full event content:', error);
      return null;
    }
  }
}

// Convenience function
export function createShareService(masterKey: CryptoKey): ShareService {
  return new ShareService(masterKey);
}
