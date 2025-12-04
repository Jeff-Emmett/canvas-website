// Google Calendar import with event encryption
// All data is encrypted before storage

import type { EncryptedCalendarEvent, ImportProgress, EncryptedData } from '../types';
import { encryptData, deriveServiceKey } from '../encryption';
import { calendarStore, syncMetadataStore } from '../database';
import { getAccessToken } from '../oauth';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// Import options
export interface CalendarImportOptions {
  maxEvents?: number;              // Limit total events to import
  calendarIds?: string[];          // Specific calendars (null for primary)
  timeMin?: Date;                  // Only import events after this date
  timeMax?: Date;                  // Only import events before this date
  includeDeleted?: boolean;        // Include deleted events
  onProgress?: (progress: ImportProgress) => void;
}

// Calendar API response types
interface CalendarListResponse {
  items?: CalendarListEntry[];
  nextPageToken?: string;
}

interface CalendarListEntry {
  id: string;
  summary?: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
}

interface EventsListResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface CalendarEvent {
  id: string;
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  creator?: { email?: string; displayName?: string };
  organizer?: { email?: string; displayName?: string };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string; label?: string }[];
    conferenceSolution?: { name?: string };
  };
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: string; minutes: number }[];
  };
}

// Parse event time to timestamp
function parseEventTime(eventTime?: { date?: string; dateTime?: string }): number {
  if (!eventTime) return 0;

  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime).getTime();
  }
  if (eventTime.date) {
    return new Date(eventTime.date).getTime();
  }
  return 0;
}

// Check if event is all-day
function isAllDayEvent(event: CalendarEvent): boolean {
  return !!(event.start?.date && !event.start?.dateTime);
}

// Get meeting link from event
function getMeetingLink(event: CalendarEvent): string | null {
  // Check hangouts link
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  // Check conference data
  const videoEntry = event.conferenceData?.entryPoints?.find(
    e => e.entryPointType === 'video'
  );
  if (videoEntry?.uri) {
    return videoEntry.uri;
  }

  return null;
}

// Main Calendar import class
export class CalendarImporter {
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
      console.error('No access token available for Calendar');
      return false;
    }

    this.encryptionKey = await deriveServiceKey(this.masterKey, 'calendar');
    return true;
  }

  // Abort current import
  abort(): void {
    this.abortController?.abort();
  }

  // Import calendar events
  async import(options: CalendarImportOptions = {}): Promise<ImportProgress> {
    const progress: ImportProgress = {
      service: 'calendar',
      total: 0,
      imported: 0,
      status: 'importing'
    };

    if (!await this.initialize()) {
      progress.status = 'error';
      progress.errorMessage = 'Failed to initialize Calendar importer';
      return progress;
    }

    this.abortController = new AbortController();
    progress.startedAt = Date.now();

    try {
      // Get calendars to import from
      const calendarIds = options.calendarIds?.length
        ? options.calendarIds
        : ['primary'];

      // Default time range: 2 years back, 1 year forward
      const timeMin = options.timeMin || new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      const timeMax = options.timeMax || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const eventBatch: EncryptedCalendarEvent[] = [];

      for (const calendarId of calendarIds) {
        if (this.abortController.signal.aborted) {
          progress.status = 'paused';
          break;
        }

        let pageToken: string | undefined;

        do {
          if (this.abortController.signal.aborted) break;

          const params: Record<string, string> = {
            maxResults: '250',
            singleEvents: 'true',  // Expand recurring events
            orderBy: 'startTime',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString()
          };
          if (pageToken) {
            params.pageToken = pageToken;
          }
          if (options.includeDeleted) {
            params.showDeleted = 'true';
          }

          const response = await this.fetchEvents(calendarId, params);

          if (!response.items?.length) {
            break;
          }

          // Update total
          progress.total += response.items.length;

          // Process events
          for (const event of response.items) {
            if (this.abortController.signal.aborted) break;

            // Skip cancelled events unless including deleted
            if (event.status === 'cancelled' && !options.includeDeleted) {
              continue;
            }

            const encrypted = await this.processEvent(event, calendarId);
            if (encrypted) {
              eventBatch.push(encrypted);
              progress.imported++;

              // Save batch every 50 events
              if (eventBatch.length >= 50) {
                await calendarStore.putBatch(eventBatch);
                eventBatch.length = 0;
              }

              options.onProgress?.(progress);
            }

            // Check limit
            if (options.maxEvents && progress.imported >= options.maxEvents) {
              break;
            }
          }

          pageToken = response.nextPageToken;

          // Check limit
          if (options.maxEvents && progress.imported >= options.maxEvents) {
            break;
          }

        } while (pageToken);

        // Check limit
        if (options.maxEvents && progress.imported >= options.maxEvents) {
          break;
        }
      }

      // Save remaining events
      if (eventBatch.length > 0) {
        await calendarStore.putBatch(eventBatch);
      }

      progress.status = 'completed';
      progress.completedAt = Date.now();
      await syncMetadataStore.markComplete('calendar', progress.imported);

    } catch (error) {
      console.error('Calendar import error:', error);
      progress.status = 'error';
      progress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncMetadataStore.markError('calendar', progress.errorMessage);
    }

    options.onProgress?.(progress);
    return progress;
  }

  // Fetch events from Calendar API
  private async fetchEvents(
    calendarId: string,
    params: Record<string, string>
  ): Promise<EventsListResponse> {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
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
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Process a single event
  private async processEvent(
    event: CalendarEvent,
    calendarId: string
  ): Promise<EncryptedCalendarEvent | null> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Helper to encrypt
    const encrypt = async (data: string): Promise<EncryptedData> => {
      return encryptData(data, this.encryptionKey!);
    };

    const startTime = parseEventTime(event.start);
    const endTime = parseEventTime(event.end);
    const timezone = event.start?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const meetingLink = getMeetingLink(event);

    // Serialize attendees for encryption
    const attendeesData = event.attendees
      ? JSON.stringify(event.attendees)
      : null;

    // Serialize recurrence for encryption
    const recurrenceData = event.recurrence
      ? JSON.stringify(event.recurrence)
      : null;

    // Get reminders
    const reminders: { method: string; minutes: number }[] = [];
    if (event.reminders?.overrides) {
      reminders.push(...event.reminders.overrides);
    } else if (event.reminders?.useDefault) {
      // Default reminders are typically 10 and 30 minutes
      reminders.push({ method: 'popup', minutes: 10 });
    }

    return {
      id: event.id,
      calendarId,
      encryptedSummary: await encrypt(event.summary || ''),
      encryptedDescription: event.description ? await encrypt(event.description) : null,
      encryptedLocation: event.location ? await encrypt(event.location) : null,
      startTime,
      endTime,
      isAllDay: isAllDayEvent(event),
      timezone,
      isRecurring: !!event.recurringEventId || !!event.recurrence?.length,
      encryptedRecurrence: recurrenceData ? await encrypt(recurrenceData) : null,
      encryptedAttendees: attendeesData ? await encrypt(attendeesData) : null,
      reminders,
      encryptedMeetingLink: meetingLink ? await encrypt(meetingLink) : null,
      syncedAt: Date.now()
    };
  }

  // List available calendars
  async listCalendars(): Promise<{
    id: string;
    name: string;
    primary: boolean;
    accessRole: string;
  }[]> {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const calendars: CalendarListEntry[] = [];
      let pageToken: string | undefined;

      do {
        const url = new URL(`${CALENDAR_API_BASE}/users/me/calendarList`);
        url.searchParams.set('maxResults', '100');
        if (pageToken) {
          url.searchParams.set('pageToken', pageToken);
        }

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) break;

        const data: CalendarListResponse = await response.json();
        if (data.items) {
          calendars.push(...data.items);
        }
        pageToken = data.nextPageToken;

      } while (pageToken);

      return calendars.map(c => ({
        id: c.id,
        name: c.summary || 'Untitled',
        primary: c.primary || false,
        accessRole: c.accessRole || 'reader'
      }));

    } catch (error) {
      console.error('List calendars error:', error);
      return [];
    }
  }

  // Get upcoming events (decrypted, for quick display)
  async getUpcomingEvents(limit: number = 10): Promise<CalendarEvent[]> {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const params: Record<string, string> = {
        maxResults: String(limit),
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: new Date().toISOString()
      };

      const response = await this.fetchEvents('primary', params);
      return response.items || [];

    } catch (error) {
      console.error('Get upcoming events error:', error);
      return [];
    }
  }
}

// Convenience function
export async function importCalendar(
  masterKey: CryptoKey,
  options: CalendarImportOptions = {}
): Promise<ImportProgress> {
  const importer = new CalendarImporter(masterKey);
  return importer.import(options);
}
