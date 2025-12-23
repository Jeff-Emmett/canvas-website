// Unified Calendar Shape - Combines Browser, Widget, and Year views
// User can switch between views using tabs in the header

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  Box,
} from "tldraw"
import React, { useState } from "react"
import { CalendarPanel } from "@/components/CalendarPanel"
import { YearViewPanel } from "@/components/YearViewPanel"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"
import { CalendarEventShape } from "./CalendarEventShapeUtil"
import { useUpcomingEvents, type DecryptedCalendarEvent } from "@/hooks/useCalendarEvents"

type CalendarView = "browser" | "widget" | "year"

type ICalendar = TLBaseShape<
  "Calendar",
  {
    w: number
    h: number
    pinnedToView: boolean
    tags: string[]
    currentView: CalendarView
    calendarView: "month" | "week" // For browser view
    currentDate: number // timestamp
  }
>

// View size presets
const VIEW_SIZES: Record<CalendarView, { w: number; h: number }> = {
  browser: { w: 900, h: 650 },
  widget: { w: 320, h: 420 },
  year: { w: 900, h: 650 },
}

export class CalendarShape extends BaseBoxShapeUtil<ICalendar> {
  static override type = "Calendar" as const

  // Calendar theme color: Green
  static readonly PRIMARY_COLOR = "#22c55e"

  getDefaultProps(): ICalendar["props"] {
    return {
      w: 900,
      h: 650,
      pinnedToView: false,
      tags: ["calendar"],
      currentView: "browser",
      calendarView: "month",
      currentDate: Date.now(),
    }
  }

  override canResize() {
    return true
  }

  component(shape: ICalendar) {
    const { w, h } = shape.props
    const [isOpen, setIsOpen] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: w,
      currentH: h,
      shapeType: "Calendar",
    })

    const handleClose = () => {
      setIsOpen(false)
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<ICalendar>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    // Handle view change with size adjustment
    const handleViewChange = (newView: CalendarView) => {
      const newSize = VIEW_SIZES[newView]
      this.editor.updateShape<ICalendar>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          currentView: newView,
          w: newSize.w,
          h: newSize.h,
        },
      })
    }

    // Handle event selection - spawn event card on canvas
    const handleEventSelect = (event: DecryptedCalendarEvent) => {
      try {
        const shapeBounds = this.editor.getShapePageBounds(shape.id)
        let startX: number
        let startY: number

        if (!shapeBounds) {
          const viewport = this.editor.getViewportPageBounds()
          startX = viewport.x + viewport.w / 2
          startY = viewport.y + viewport.h / 2
        } else {
          const spacing = 30
          startX = shapeBounds.x + shapeBounds.w + spacing
          startY = shapeBounds.y
        }

        // Check for existing event shape
        const allShapes = this.editor.getCurrentPageShapes()
        const existingEventShape = allShapes.find(
          (s) =>
            s.type === "CalendarEvent" &&
            (s as any).props?.eventId === event.id
        )

        if (existingEventShape) {
          this.editor.setSelectedShapes([existingEventShape.id])
          const bounds = this.editor.getShapePageBounds(existingEventShape.id)
          if (bounds) {
            this.editor.zoomToBounds(bounds, {
              inset: 50,
              animation: { duration: 300, easing: (t) => t * (2 - t) },
            })
          }
          return
        }

        // Stack new events vertically
        const existingCalendarEvents = allShapes.filter(
          (s) => s.type === "CalendarEvent"
        )
        if (existingCalendarEvents.length > 0 && shapeBounds) {
          let maxY = startY
          existingCalendarEvents.forEach((s) => {
            const bounds = this.editor.getShapePageBounds(s.id)
            if (bounds && bounds.x >= shapeBounds.x + shapeBounds.w) {
              const shapeBottom = bounds.y + bounds.h
              if (shapeBottom > maxY) {
                maxY = shapeBottom + 20
              }
            }
          })
          startY = maxY === startY ? startY : maxY
        }

        const eventShape = CalendarEventShape.createFromEvent(
          event,
          startX,
          startY,
          CalendarShape.PRIMARY_COLOR
        )

        this.editor.createShapes([eventShape])

        setTimeout(() => {
          const newShapeBounds = this.editor.getShapePageBounds(eventShape.id as any)
          if (newShapeBounds && shapeBounds) {
            const combinedBounds = Box.Common([shapeBounds, newShapeBounds])
            this.editor.zoomToBounds(combinedBounds, {
              inset: 50,
              animation: { duration: 400, easing: (t) => t * (2 - t) },
            })
          }
          this.editor.setSelectedShapes([eventShape.id as any])
          this.editor.setCurrentTool("select")
        }, 50)
      } catch (error) {
        console.error("Error creating calendar event shape:", error)
      }
    }

    // Handle month selection from year view
    const handleMonthSelect = (year: number, month: number) => {
      this.editor.updateShape<ICalendar>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          currentView: "browser",
          calendarView: "month",
          currentDate: new Date(year, month, 1).getTime(),
          w: VIEW_SIZES.browser.w,
          h: VIEW_SIZES.browser.h,
        },
      })
    }

    if (!isOpen) {
      return null
    }

    // Render based on current view
    const renderContent = () => {
      switch (shape.props.currentView) {
        case "widget":
          return (
            <CalendarWidgetContent
              onEventSelect={handleEventSelect}
              primaryColor={CalendarShape.PRIMARY_COLOR}
            />
          )
        case "year":
          return (
            <YearViewPanel
              onClose={handleClose}
              onMonthSelect={handleMonthSelect}
              shapeMode={true}
              initialYear={new Date(shape.props.currentDate).getFullYear()}
            />
          )
        case "browser":
        default:
          return (
            <CalendarPanel
              onClose={handleClose}
              onEventSelect={handleEventSelect}
              shapeMode={true}
              initialView={shape.props.calendarView}
              initialDate={new Date(shape.props.currentDate)}
            />
          )
      }
    }

    // View tabs component
    const ViewTabs = () => {
      const isDarkMode =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")

      const tabs: { id: CalendarView; label: string; icon: string }[] = [
        { id: "browser", label: "Calendar", icon: "📅" },
        { id: "widget", label: "Widget", icon: "📋" },
        { id: "year", label: "Year", icon: "📆" },
      ]

      return (
        <div
          style={{
            display: "flex",
            gap: "4px",
            padding: "8px 12px",
            borderBottom: `1px solid ${isDarkMode ? "#404040" : "#e5e7eb"}`,
            backgroundColor: isDarkMode ? "#1a1a1a" : "#f9fafb",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleViewChange(tab.id)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: shape.props.currentView === tab.id ? "600" : "400",
                cursor: "pointer",
                backgroundColor:
                  shape.props.currentView === tab.id
                    ? CalendarShape.PRIMARY_COLOR
                    : isDarkMode
                    ? "#374151"
                    : "#e5e7eb",
                color:
                  shape.props.currentView === tab.id
                    ? "#ffffff"
                    : isDarkMode
                    ? "#e4e4e7"
                    : "#374151",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )
    }

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Calendar"
          primaryColor={CalendarShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<ICalendar>({
              id: shape.id,
              type: "Calendar",
              props: {
                ...shape.props,
                tags: newTags,
              },
            })
          }}
          tagsEditable={true}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
            }}
          >
            <ViewTabs />
            <div style={{ flex: 1, overflow: "hidden" }}>{renderContent()}</div>
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: ICalendar) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}

// Compact widget content component (extracted from CalendarWidgetShapeUtil)
const CalendarWidgetContent: React.FC<{
  onEventSelect: (event: DecryptedCalendarEvent) => void
  primaryColor: string
}> = ({ onEventSelect, primaryColor }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { events: upcomingEvents, loading, getEventsForDate } = useUpcomingEvents(5)

  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  const colors = isDarkMode
    ? {
        bg: "#1f2937",
        text: "#e4e4e7",
        textMuted: "#a1a1aa",
        border: "#404040",
        todayBg: "#22c55e30",
        eventDot: "#3b82f6",
        cardBg: "#252525",
      }
    : {
        bg: "#f9fafb",
        text: "#1f2937",
        textMuted: "#6b7280",
        border: "#e5e7eb",
        todayBg: "#22c55e20",
        eventDot: "#3b82f6",
        cardBg: "#f9fafb",
      }

  // Generate mini calendar
  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate()

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1
  }

  const isSameDay = (date1: Date, date2: Date) =>
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()

  const days: { day: number | null; date: Date | null }[] = []
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: null, date: null })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, date: new Date(year, month, i) })
  }

  const goToPrevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1))
  const goToNextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1))

  const formatEventTime = (event: DecryptedCalendarEvent) => {
    if (event.isAllDay) return "All day"
    return event.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatEventDate = (event: DecryptedCalendarEvent) => {
    if (isSameDay(today, event.startTime)) return "Today"
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (isSameDay(tomorrow, event.startTime)) return "Tomorrow"
    return event.startTime.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.bg,
        overflow: "hidden",
      }}
    >
      {/* Mini Calendar Header */}
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <button
          onClick={goToPrevMonth}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: isDarkMode ? "#374151" : "#e5e7eb",
            border: "none",
            color: colors.text,
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          &lt;
        </button>
        <span style={{ fontSize: "13px", fontWeight: "600", color: colors.text }}>
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button
          onClick={goToNextMonth}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: isDarkMode ? "#374151" : "#e5e7eb",
            border: "none",
            color: colors.text,
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          &gt;
        </button>
      </div>

      {/* Mini Calendar Grid */}
      <div style={{ padding: "8px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
            marginBottom: "4px",
          }}
        >
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: "10px",
                fontWeight: "600",
                color: colors.textMuted,
                padding: "2px 0",
              }}
            >
              {day}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
          }}
        >
          {days.map(({ day, date }, i) => {
            const isToday = date && isSameDay(date, today)
            const hasEvents = date && getEventsForDate(date).length > 0

            return (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  padding: "4px 2px",
                  borderRadius: "4px",
                  backgroundColor: isToday ? colors.todayBg : "transparent",
                  border: isToday ? `1px solid ${primaryColor}` : "1px solid transparent",
                  color: day ? colors.text : "transparent",
                  fontWeight: isToday ? "700" : "400",
                  position: "relative",
                }}
              >
                {day}
                {hasEvents && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "1px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: colors.eventDot,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div style={{ flex: 1, padding: "8px", overflow: "auto" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: "600",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
          }}
        >
          Upcoming
        </div>
        {loading ? (
          <div style={{ textAlign: "center", color: colors.textMuted, fontSize: "11px", padding: "12px 0" }}>
            Loading...
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div style={{ textAlign: "center", color: colors.textMuted, fontSize: "11px", padding: "12px 0" }}>
            No upcoming events
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventSelect(event)}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  padding: "6px 8px",
                  backgroundColor: colors.cardBg,
                  borderRadius: "6px",
                  borderLeft: `3px solid ${colors.eventDot}`,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: colors.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {event.summary}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: colors.textMuted,
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <span>{formatEventDate(event)}</span>
                  <span>|</span>
                  <span>{formatEventTime(event)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
