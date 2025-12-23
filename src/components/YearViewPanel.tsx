// Year View Panel - KalNext-style 12-month yearly overview
// Shows all months in a 4x3 grid with event density indicators

import React, { useState, useMemo } from "react"
import { useCalendarEvents, type DecryptedCalendarEvent } from "@/hooks/useCalendarEvents"

interface YearViewPanelProps {
  onClose?: () => void
  onMonthSelect?: (year: number, month: number) => void
  shapeMode?: boolean
  initialYear?: number
}

// Helper functions
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate()
}

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday-first
}

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
]

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec"
]

export const YearViewPanel: React.FC<YearViewPanelProps> = ({
  onClose,
  onMonthSelect,
  shapeMode = false,
  initialYear,
}) => {
  const [currentYear, setCurrentYear] = useState(initialYear || new Date().getFullYear())

  // Detect dark mode
  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  // Fetch all events for the current year
  const yearStart = new Date(currentYear, 0, 1)
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59)

  const { events, loading, getEventsForDate } = useCalendarEvents({
    startDate: yearStart,
    endDate: yearEnd,
  })

  // Colors
  const colors = isDarkMode
    ? {
        bg: "#1f2937",
        text: "#e4e4e7",
        textMuted: "#a1a1aa",
        border: "#374151",
        monthBg: "#252525",
        todayBg: "#22c55e30",
        todayBorder: "#22c55e",
        eventDot1: "#3b82f620", // 1 event
        eventDot2: "#3b82f640", // 2 events
        eventDot3: "#3b82f680", // 3+ events
        eventDotMax: "#3b82f6", // 5+ events
        headerBg: "#22c55e",
      }
    : {
        bg: "#f9fafb",
        text: "#1f2937",
        textMuted: "#6b7280",
        border: "#e5e7eb",
        monthBg: "#ffffff",
        todayBg: "#22c55e20",
        todayBorder: "#22c55e",
        eventDot1: "#3b82f620",
        eventDot2: "#3b82f640",
        eventDot3: "#3b82f680",
        eventDotMax: "#3b82f6",
        headerBg: "#22c55e",
      }

  // Get event count for a specific date
  const getEventCount = (date: Date) => {
    return getEventsForDate(date).length
  }

  // Get background color based on event density
  const getEventDensityColor = (count: number) => {
    if (count === 0) return "transparent"
    if (count === 1) return colors.eventDot1
    if (count === 2) return colors.eventDot2
    if (count <= 4) return colors.eventDot3
    return colors.eventDotMax
  }

  // Navigation
  const goToPrevYear = () => setCurrentYear((y) => y - 1)
  const goToNextYear = () => setCurrentYear((y) => y + 1)
  const goToCurrentYear = () => setCurrentYear(new Date().getFullYear())

  const today = new Date()

  // Generate mini calendar for a month
  const renderMiniMonth = (month: number) => {
    const daysInMonth = getDaysInMonth(currentYear, month)
    const firstDay = getFirstDayOfMonth(currentYear, month)

    const days: { day: number | null; date: Date | null }[] = []

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null })
    }

    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, date: new Date(currentYear, month, i) })
    }

    // Trailing empty cells to complete grid (6 rows max)
    while (days.length < 42) {
      days.push({ day: null, date: null })
    }

    return (
      <div
        key={month}
        style={{
          backgroundColor: colors.monthBg,
          borderRadius: "8px",
          padding: "8px",
          border: `1px solid ${colors.border}`,
          cursor: onMonthSelect ? "pointer" : "default",
        }}
        onClick={() => onMonthSelect?.(currentYear, month)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Month name */}
        <div
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: colors.text,
            marginBottom: "6px",
            textAlign: "center",
          }}
        >
          {SHORT_MONTH_NAMES[month]}
        </div>

        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "1px",
            marginBottom: "2px",
          }}
        >
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: "7px",
                fontWeight: "500",
                color: colors.textMuted,
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "1px",
          }}
        >
          {days.slice(0, 42).map(({ day, date }, i) => {
            const isToday = date && isSameDay(date, today)
            const eventCount = date ? getEventCount(date) : 0
            const densityColor = getEventDensityColor(eventCount)

            return (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  fontSize: "8px",
                  padding: "2px 0",
                  borderRadius: "2px",
                  backgroundColor: isToday ? colors.todayBg : densityColor,
                  border: isToday ? `1px solid ${colors.todayBorder}` : "1px solid transparent",
                  color: day ? colors.text : "transparent",
                  fontWeight: isToday ? "700" : "400",
                  minHeight: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {day}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: colors.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header with year navigation */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.headerBg,
        }}
      >
        <button
          onClick={goToPrevYear}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            color: "#fff",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          &lt;
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: "#fff",
            }}
          >
            {currentYear}
          </span>
          {currentYear !== new Date().getFullYear() && (
            <button
              onClick={goToCurrentYear}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "500",
              }}
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={goToNextYear}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            color: "#fff",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          &gt;
        </button>
      </div>

      {/* 12-month grid (4x3 layout) */}
      <div
        style={{
          flex: 1,
          padding: "12px",
          overflow: "auto",
        }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: colors.textMuted,
              fontSize: "13px",
            }}
          >
            Loading calendar data...
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: "10px",
              height: "100%",
            }}
          >
            {Array.from({ length: 12 }, (_, month) => renderMiniMonth(month))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "2px",
              backgroundColor: colors.todayBg,
              border: `1px solid ${colors.todayBorder}`,
            }}
          />
          <span style={{ fontSize: "10px", color: colors.textMuted }}>Today</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "2px",
              backgroundColor: colors.eventDot1,
            }}
          />
          <span style={{ fontSize: "10px", color: colors.textMuted }}>1 event</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "2px",
              backgroundColor: colors.eventDot3,
            }}
          />
          <span style={{ fontSize: "10px", color: colors.textMuted }}>3+ events</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "2px",
              backgroundColor: colors.eventDotMax,
            }}
          />
          <span style={{ fontSize: "10px", color: colors.textMuted }}>5+ events</span>
        </div>
      </div>
    </div>
  )
}
