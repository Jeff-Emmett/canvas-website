// Hook for accessing decrypted calendar events from local encrypted storage
// Uses the existing Google Data Sovereignty infrastructure

import { useState, useEffect, useCallback, useMemo } from 'react'
import { calendarStore } from '@/lib/google/database'
import { deriveServiceKey, decryptDataToString, importMasterKey } from '@/lib/google/encryption'
import { getGoogleDataService } from '@/lib/google'
import type { EncryptedCalendarEvent } from '@/lib/google/types'

// Decrypted event type for display
export interface DecryptedCalendarEvent {
  id: string
  calendarId: string
  summary: string
  description: string | null
  location: string | null
  startTime: Date
  endTime: Date
  isAllDay: boolean
  timezone: string
  isRecurring: boolean
  meetingLink: string | null
  reminders: { method: string; minutes: number }[]
  syncedAt: number
}

// Hook options
export interface UseCalendarEventsOptions {
  startDate?: Date
  endDate?: Date
  limit?: number
  calendarId?: string
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
}

// Hook return type
export interface UseCalendarEventsResult {
  events: DecryptedCalendarEvent[]
  loading: boolean
  error: string | null
  initialized: boolean
  refresh: () => Promise<void>
  getEventsForDate: (date: Date) => DecryptedCalendarEvent[]
  getEventsForMonth: (year: number, month: number) => DecryptedCalendarEvent[]
  getEventsForWeek: (date: Date) => DecryptedCalendarEvent[]
  getUpcoming: (limit?: number) => DecryptedCalendarEvent[]
  eventCount: number
}

// Helper to get start of day
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to get end of day
function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

// Helper to get start of week (Monday)
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to get end of week (Sunday)
function endOfWeek(date: Date): Date {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

// Helper to get start of month
function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0)
}

// Helper to get end of month
function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

// Decrypt a single event
async function decryptEvent(
  event: EncryptedCalendarEvent,
  calendarKey: CryptoKey
): Promise<DecryptedCalendarEvent> {
  const [summary, description, location, meetingLink] = await Promise.all([
    decryptDataToString(event.encryptedSummary, calendarKey),
    event.encryptedDescription
      ? decryptDataToString(event.encryptedDescription, calendarKey)
      : Promise.resolve(null),
    event.encryptedLocation
      ? decryptDataToString(event.encryptedLocation, calendarKey)
      : Promise.resolve(null),
    event.encryptedMeetingLink
      ? decryptDataToString(event.encryptedMeetingLink, calendarKey)
      : Promise.resolve(null),
  ])

  return {
    id: event.id,
    calendarId: event.calendarId,
    summary,
    description,
    location,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
    isAllDay: event.isAllDay,
    timezone: event.timezone,
    isRecurring: event.isRecurring,
    meetingLink,
    reminders: event.reminders || [],
    syncedAt: event.syncedAt,
  }
}

export function useCalendarEvents(
  options: UseCalendarEventsOptions = {}
): UseCalendarEventsResult {
  const {
    startDate,
    endDate,
    limit,
    calendarId,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute default
  } = options

  const [events, setEvents] = useState<DecryptedCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Fetch and decrypt events
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const service = getGoogleDataService()

      // Check if service is initialized
      if (!service.isInitialized()) {
        // Try to initialize
        const success = await service.initialize()
        if (!success) {
          setEvents([])
          setInitialized(false)
          setLoading(false)
          return
        }
      }

      // Get the master key
      const masterKeyData = await service.exportKey()
      if (!masterKeyData) {
        setError('No encryption key available')
        setEvents([])
        setLoading(false)
        return
      }

      // Derive calendar-specific key
      const masterKey = await importMasterKey(masterKeyData)
      const calendarKey = await deriveServiceKey(masterKey, 'calendar')

      // Determine query range
      let encryptedEvents: EncryptedCalendarEvent[]

      if (startDate && endDate) {
        // Query by date range
        encryptedEvents = await calendarStore.getByDateRange(
          startDate.getTime(),
          endDate.getTime()
        )
      } else if (calendarId) {
        // Query by calendar ID
        encryptedEvents = await calendarStore.getByCalendar(calendarId)
      } else {
        // Get upcoming events (default: next 90 days)
        const now = Date.now()
        const ninetyDaysLater = now + 90 * 24 * 60 * 60 * 1000
        encryptedEvents = await calendarStore.getByDateRange(now, ninetyDaysLater)
      }

      // Apply limit if specified
      if (limit && encryptedEvents.length > limit) {
        encryptedEvents = encryptedEvents.slice(0, limit)
      }

      // Decrypt all events in parallel
      const decryptedEvents = await Promise.all(
        encryptedEvents.map(event => decryptEvent(event, calendarKey))
      )

      // Sort by start time
      decryptedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

      setEvents(decryptedEvents)
      setInitialized(true)
    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
      setError(err instanceof Error ? err.message : 'Failed to load calendar events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, limit, calendarId])

  // Initial fetch
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !initialized) return

    const intervalId = setInterval(fetchEvents, refreshInterval)
    return () => clearInterval(intervalId)
  }, [autoRefresh, refreshInterval, fetchEvents, initialized])

  // Get events for a specific date
  const getEventsForDate = useCallback(
    (date: Date): DecryptedCalendarEvent[] => {
      const dayStart = startOfDay(date).getTime()
      const dayEnd = endOfDay(date).getTime()

      return events.filter(event => {
        const eventStart = event.startTime.getTime()
        const eventEnd = event.endTime.getTime()

        // Event overlaps with this day
        return eventStart <= dayEnd && eventEnd >= dayStart
      })
    },
    [events]
  )

  // Get events for a specific month
  const getEventsForMonth = useCallback(
    (year: number, month: number): DecryptedCalendarEvent[] => {
      const monthStart = startOfMonth(year, month).getTime()
      const monthEnd = endOfMonth(year, month).getTime()

      return events.filter(event => {
        const eventStart = event.startTime.getTime()
        const eventEnd = event.endTime.getTime()

        // Event overlaps with this month
        return eventStart <= monthEnd && eventEnd >= monthStart
      })
    },
    [events]
  )

  // Get events for a specific week
  const getEventsForWeek = useCallback(
    (date: Date): DecryptedCalendarEvent[] => {
      const weekStart = startOfWeek(date).getTime()
      const weekEnd = endOfWeek(date).getTime()

      return events.filter(event => {
        const eventStart = event.startTime.getTime()
        const eventEnd = event.endTime.getTime()

        // Event overlaps with this week
        return eventStart <= weekEnd && eventEnd >= weekStart
      })
    },
    [events]
  )

  // Get upcoming events from now
  const getUpcoming = useCallback(
    (upcomingLimit: number = 10): DecryptedCalendarEvent[] => {
      const now = Date.now()
      return events
        .filter(event => event.startTime.getTime() >= now)
        .slice(0, upcomingLimit)
    },
    [events]
  )

  // Memoized event count
  const eventCount = useMemo(() => events.length, [events])

  return {
    events,
    loading,
    error,
    initialized,
    refresh: fetchEvents,
    getEventsForDate,
    getEventsForMonth,
    getEventsForWeek,
    getUpcoming,
    eventCount,
  }
}

// Hook for getting events for a specific year (useful for YearView)
export function useCalendarEventsForYear(year: number) {
  const startDate = useMemo(() => new Date(year, 0, 1), [year])
  const endDate = useMemo(() => new Date(year, 11, 31, 23, 59, 59, 999), [year])

  return useCalendarEvents({ startDate, endDate })
}

// Hook for getting events for current month
export function useCurrentMonthEvents() {
  const now = new Date()
  const startDate = useMemo(() => startOfMonth(now.getFullYear(), now.getMonth()), [])
  const endDate = useMemo(() => endOfMonth(now.getFullYear(), now.getMonth()), [])

  return useCalendarEvents({ startDate, endDate })
}

// Hook for getting upcoming events only
export function useUpcomingEvents(limit: number = 10) {
  const startDate = useMemo(() => new Date(), [])
  const endDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 90) // Next 90 days
    return d
  }, [])

  return useCalendarEvents({ startDate, endDate, limit })
}
