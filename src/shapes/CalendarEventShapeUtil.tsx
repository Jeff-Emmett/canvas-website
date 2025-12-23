// Calendar Event Shape - Individual event cards spawned on the canvas
// Similar to FathomNoteShape but for calendar events

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  createShapeId,
} from "tldraw"
import React from "react"
import type { DecryptedCalendarEvent } from "@/hooks/useCalendarEvents"

type ICalendarEventShape = TLBaseShape<
  "CalendarEvent",
  {
    w: number
    h: number
    // Event data
    eventId: string
    calendarId: string
    summary: string
    description: string | null
    location: string | null
    startTime: number // timestamp
    endTime: number // timestamp
    isAllDay: boolean
    timezone: string
    meetingLink: string | null
    // Visual
    primaryColor: string
    tags: string[]
  }
>

export class CalendarEventShape extends BaseBoxShapeUtil<ICalendarEventShape> {
  static override type = "CalendarEvent" as const

  // Calendar theme color: Green
  static readonly PRIMARY_COLOR = "#22c55e"

  getDefaultProps(): ICalendarEventShape["props"] {
    return {
      w: 350,
      h: 250,
      eventId: "",
      calendarId: "",
      summary: "Untitled Event",
      description: null,
      location: null,
      startTime: Date.now(),
      endTime: Date.now() + 3600000, // 1 hour later
      isAllDay: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      meetingLink: null,
      primaryColor: CalendarEventShape.PRIMARY_COLOR,
      tags: ["calendar", "event"],
    }
  }

  override canResize() {
    return true
  }

  // Factory method to create from DecryptedCalendarEvent
  static createFromEvent(
    event: DecryptedCalendarEvent,
    x: number,
    y: number,
    primaryColor: string = CalendarEventShape.PRIMARY_COLOR
  ) {
    return {
      id: createShapeId(`calendar-event-${event.id}`),
      type: "CalendarEvent" as const,
      x,
      y,
      props: {
        w: 350,
        h: 250,
        eventId: event.id,
        calendarId: event.calendarId,
        summary: event.summary,
        description: event.description,
        location: event.location,
        startTime: event.startTime.getTime(),
        endTime: event.endTime.getTime(),
        isAllDay: event.isAllDay,
        timezone: event.timezone,
        meetingLink: event.meetingLink,
        primaryColor,
        tags: ["calendar", "event"],
      },
    }
  }

  component(shape: ICalendarEventShape) {
    const { w, h, props } = shape
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Detect dark mode
    const isDarkMode =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")

    // Format date and time
    const formatDateTime = (timestamp: number, isAllDay: boolean) => {
      const date = new Date(timestamp)
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })

      if (isAllDay) {
        return dateStr
      }

      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })

      return `${dateStr} at ${timeStr}`
    }

    // Format time range
    const formatTimeRange = () => {
      if (props.isAllDay) {
        const startDate = new Date(props.startTime)
        const endDate = new Date(props.endTime)

        // Check if same day
        if (startDate.toDateString() === endDate.toDateString()) {
          return `All day - ${startDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}`
        }

        return `${startDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} - ${endDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      }

      const startDate = new Date(props.startTime)
      const endDate = new Date(props.endTime)

      const startTimeStr = startDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })

      const endTimeStr = endDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })

      const dateStr = startDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })

      return `${dateStr}\n${startTimeStr} - ${endTimeStr}`
    }

    // Calculate duration
    const getDuration = () => {
      const durationMs = props.endTime - props.startTime
      const hours = Math.floor(durationMs / (1000 * 60 * 60))
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

      if (hours === 0) {
        return `${minutes}m`
      }
      if (minutes === 0) {
        return `${hours}h`
      }
      return `${hours}h ${minutes}m`
    }

    const colors = isDarkMode
      ? {
          bg: "#1a1a1a",
          headerBg: props.primaryColor,
          text: "#e4e4e7",
          textMuted: "#a1a1aa",
          border: "#404040",
          linkBg: "#3b82f6",
        }
      : {
          bg: "#ffffff",
          headerBg: props.primaryColor,
          text: "#1f2937",
          textMuted: "#6b7280",
          border: "#e5e7eb",
          linkBg: "#3b82f6",
        }

    const handleMeetingLinkClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (props.meetingLink) {
        window.open(props.meetingLink, "_blank", "noopener,noreferrer")
      }
    }

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: colors.bg,
            borderRadius: "12px",
            border: `2px solid ${colors.border}`,
            boxShadow: isSelected
              ? `0 0 0 3px ${props.primaryColor}40`
              : "0 4px 12px rgba(0, 0, 0, 0.1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "box-shadow 0.15s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: colors.headerBg,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {props.isAllDay ? "📅" : "🕐"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {props.summary}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(255, 255, 255, 0.8)",
                  marginTop: "2px",
                }}
              >
                {props.isAllDay ? "All Day" : getDuration()}
              </div>
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Time */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "4px",
                }}
              >
                When
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: colors.text,
                  whiteSpace: "pre-line",
                }}
              >
                {formatTimeRange()}
              </div>
            </div>

            {/* Location */}
            {props.location && (
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "4px",
                  }}
                >
                  Location
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: colors.text,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📍</span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {props.location}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            {props.description && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "4px",
                  }}
                >
                  Description
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: colors.text,
                    lineHeight: "1.5",
                    overflow: "auto",
                    maxHeight: "80px",
                  }}
                >
                  {props.description}
                </div>
              </div>
            )}

            {/* Meeting Link */}
            {props.meetingLink && (
              <button
                onClick={handleMeetingLinkClick}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  marginTop: "auto",
                  padding: "10px 16px",
                  backgroundColor: colors.linkBg,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#2563eb"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.linkBg
                }}
              >
                <span>🔗</span>
                Join Meeting
              </button>
            )}
          </div>

          {/* Footer with tags */}
          <div
            style={{
              padding: "8px 16px",
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {props.tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: "10px",
                  padding: "3px 8px",
                  backgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
                  color: colors.textMuted,
                  borderRadius: "4px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: ICalendarEventShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
      />
    )
  }
}
