// Calendar Panel - Month/Week view with event list
// Used inside CalendarBrowserShape

import React, { useState, useMemo, useCallback } from "react"
import {
  useCalendarEvents,
  type DecryptedCalendarEvent,
} from "@/hooks/useCalendarEvents"

interface CalendarPanelProps {
  onClose?: () => void
  onEventSelect?: (event: DecryptedCalendarEvent) => void
  shapeMode?: boolean
  initialView?: "month" | "week"
  initialDate?: Date
}

type ViewMode = "month" | "week"

// Helper functions
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate()
}

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay()
  // Convert Sunday (0) to 7 for Monday-first week
  return day === 0 ? 6 : day - 1
}

const formatMonthYear = (date: Date) => {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

const isToday = (date: Date) => {
  return isSameDay(date, new Date())
}

export function CalendarPanel({
  onClose,
  onEventSelect,
  shapeMode = false,
  initialView = "month",
  initialDate,
}: CalendarPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView)
  const [currentDate, setCurrentDate] = useState(initialDate || new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Detect dark mode
  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  // Get calendar events for the visible range
  const startOfVisibleRange = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    // Start from previous month to show leading days
    return new Date(year, month - 1, 1)
  }, [currentDate])

  const endOfVisibleRange = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    // End at next month to show trailing days
    return new Date(year, month + 2, 0)
  }, [currentDate])

  const { events, loading, error, refresh, getEventsForDate, getUpcoming } =
    useCalendarEvents({
      startDate: startOfVisibleRange,
      endDate: endOfVisibleRange,
    })

  // Colors
  const colors = isDarkMode
    ? {
        bg: "#1a1a1a",
        cardBg: "#252525",
        headerBg: "#22c55e",
        text: "#e4e4e7",
        textMuted: "#a1a1aa",
        border: "#404040",
        todayBg: "#22c55e20",
        selectedBg: "#3b82f620",
        eventDot: "#3b82f6",
        buttonBg: "#374151",
        buttonHover: "#4b5563",
      }
    : {
        bg: "#ffffff",
        cardBg: "#f9fafb",
        headerBg: "#22c55e",
        text: "#1f2937",
        textMuted: "#6b7280",
        border: "#e5e7eb",
        todayBg: "#22c55e15",
        selectedBg: "#3b82f615",
        eventDot: "#3b82f6",
        buttonBg: "#f3f4f6",
        buttonHover: "#e5e7eb",
      }

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      )
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    }
  }

  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      )
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Generate month grid
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Previous month days
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(prevYear, prevMonth, daysInPrevMonth - i),
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      })
    }

    // Next month days to complete grid
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const remainingDays = 42 - days.length // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(nextYear, nextMonth, i),
        isCurrentMonth: false,
      })
    }

    return days
  }, [currentDate])

  // Format event time
  const formatEventTime = (event: DecryptedCalendarEvent) => {
    if (event.isAllDay) return "All day"
    return event.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  // Upcoming events for sidebar
  const upcomingEvents = useMemo(() => {
    return getUpcoming(10)
  }, [getUpcoming])

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return getEventsForDate(selectedDate)
  }, [selectedDate, getEventsForDate])

  // Day cell component
  const DayCell = ({
    date,
    isCurrentMonth,
  }: {
    date: Date
    isCurrentMonth: boolean
  }) => {
    const dayEvents = getEventsForDate(date)
    const isSelectedDate = selectedDate && isSameDay(date, selectedDate)
    const isTodayDate = isToday(date)

    return (
      <div
        onClick={() => setSelectedDate(date)}
        style={{
          padding: "4px",
          minHeight: "60px",
          cursor: "pointer",
          backgroundColor: isSelectedDate
            ? colors.selectedBg
            : isTodayDate
            ? colors.todayBg
            : "transparent",
          borderRadius: "4px",
          border: isTodayDate
            ? `2px solid ${colors.headerBg}`
            : "1px solid transparent",
          transition: "background-color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!isSelectedDate && !isTodayDate) {
            e.currentTarget.style.backgroundColor = colors.buttonBg
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelectedDate && !isTodayDate) {
            e.currentTarget.style.backgroundColor = "transparent"
          }
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: isTodayDate ? "700" : "500",
            color: isCurrentMonth ? colors.text : colors.textMuted,
            marginBottom: "4px",
          }}
        >
          {date.getDate()}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
          {dayEvents.slice(0, 3).map((event, i) => (
            <div
              key={event.id}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: colors.eventDot,
              }}
              title={event.summary}
            />
          ))}
          {dayEvents.length > 3 && (
            <div
              style={{
                fontSize: "9px",
                color: colors.textMuted,
              }}
            >
              +{dayEvents.length - 3}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Event list item
  const EventItem = ({ event }: { event: DecryptedCalendarEvent }) => (
    <div
      onClick={() => onEventSelect?.(event)}
      style={{
        padding: "10px 12px",
        backgroundColor: colors.cardBg,
        borderRadius: "8px",
        cursor: "pointer",
        borderLeft: `3px solid ${colors.eventDot}`,
        transition: "background-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.buttonBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.cardBg
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: colors.text,
          marginBottom: "4px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.summary}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: colors.textMuted,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>{formatEventTime(event)}</span>
        {event.location && (
          <>
            <span>|</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {event.location}
            </span>
          </>
        )}
      </div>
    </div>
  )

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: colors.textMuted,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>Loading...</div>
          <div style={{ fontSize: "12px" }}>Fetching calendar events</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: colors.textMuted,
        }}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>Error</div>
          <div style={{ fontSize: "12px", marginBottom: "16px" }}>{error}</div>
          <button
            onClick={refresh}
            style={{
              padding: "8px 16px",
              backgroundColor: colors.headerBg,
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No events state
  if (events.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: colors.textMuted,
        }}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
          <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
            No Calendar Events
          </div>
          <div style={{ fontSize: "12px", marginBottom: "16px" }}>
            Import your Google Calendar to see events here.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {/* Main Calendar Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: `1px solid ${colors.border}`,
        }}
      >
        {/* Navigation Header */}
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <button
            onClick={goToPrevious}
            style={{
              padding: "6px 12px",
              backgroundColor: colors.buttonBg,
              color: colors.text,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            &lt;
          </button>

          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            {formatMonthYear(currentDate)}
          </div>

          <button
            onClick={goToNext}
            style={{
              padding: "6px 12px",
              backgroundColor: colors.buttonBg,
              color: colors.text,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            &gt;
          </button>

          <button
            onClick={goToToday}
            style={{
              padding: "6px 12px",
              backgroundColor: colors.headerBg,
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Today
          </button>

          {/* View toggle */}
          <div
            style={{
              display: "flex",
              backgroundColor: colors.buttonBg,
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setViewMode("month")}
              style={{
                padding: "6px 12px",
                backgroundColor:
                  viewMode === "month" ? colors.headerBg : "transparent",
                color: viewMode === "month" ? "#fff" : colors.text,
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              style={{
                padding: "6px 12px",
                backgroundColor:
                  viewMode === "week" ? colors.headerBg : "transparent",
                color: viewMode === "week" ? "#fff" : colors.text,
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Week
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{ flex: 1, padding: "12px", overflow: "auto" }}>
          {/* Day headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
              marginBottom: "8px",
            }}
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: colors.textMuted,
                  padding: "4px",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
            }}
          >
            {monthGrid.map(({ date, isCurrentMonth }, i) => (
              <DayCell key={i} date={date} isCurrentMonth={isCurrentMonth} />
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar - Events */}
      <div
        style={{
          width: "280px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Selected Date Events or Upcoming */}
        <div
          style={{
            flex: 1,
            padding: "12px",
            overflow: "auto",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {selectedDate
              ? selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Upcoming Events"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(selectedDate ? selectedDateEvents : upcomingEvents).map(
              (event) => (
                <EventItem key={event.id} event={event} />
              )
            )}

            {(selectedDate ? selectedDateEvents : upcomingEvents).length ===
              0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: colors.textMuted,
                  fontSize: "12px",
                }}
              >
                {selectedDate
                  ? "No events on this day"
                  : "No upcoming events"}
              </div>
            )}
          </div>
        </div>

        {/* Click hint */}
        {onEventSelect && (
          <div
            style={{
              padding: "12px",
              borderTop: `1px solid ${colors.border}`,
              fontSize: "11px",
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            Click an event to add it to the canvas
          </div>
        )}
      </div>
    </div>
  )
}

export default CalendarPanel
