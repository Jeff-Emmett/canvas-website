import { useState } from "react"
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, TLShapeId } from "tldraw"
import type { GoogleService } from "../lib/google"

// Visibility state for data sovereignty
export type ItemVisibility = 'local' | 'shared'

export type IGoogleItemShape = TLBaseShape<
  "GoogleItem",
  {
    w: number
    h: number
    // Item metadata
    itemId: string
    service: GoogleService
    title: string
    preview?: string
    date: number
    thumbnailUrl?: string
    // Visibility state
    visibility: ItemVisibility
    // Original encrypted reference
    encryptedRef?: string
  }
>

// Service icons
const SERVICE_ICONS: Record<GoogleService, string> = {
  gmail: '📧',
  drive: '📁',
  photos: '📷',
  calendar: '📅',
}

export class GoogleItemShape extends BaseBoxShapeUtil<IGoogleItemShape> {
  static override type = "GoogleItem" as const

  // Primary color for Google items
  static readonly LOCAL_COLOR = "#6366f1"   // Indigo for local/private
  static readonly SHARED_COLOR = "#22c55e"  // Green for shared

  getDefaultProps(): IGoogleItemShape["props"] {
    return {
      w: 200,
      h: 80,
      itemId: '',
      service: 'gmail',
      title: 'Untitled',
      preview: '',
      date: Date.now(),
      visibility: 'local', // Default to local/private
    }
  }

  override canResize() {
    return true
  }

  indicator(shape: IGoogleItemShape) {
    const isLocal = shape.props.visibility === 'local'
    return (
      <rect
        x={0}
        y={0}
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
        strokeDasharray={isLocal ? "6 3" : undefined}
      />
    )
  }

  component(shape: IGoogleItemShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const isLocal = shape.props.visibility === 'local'

    // Detect dark mode
    const isDarkMode = typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')

    const colors = isDarkMode ? {
      bg: isLocal ? 'rgba(99, 102, 241, 0.15)' : '#1f2937',
      border: isLocal ? 'rgba(99, 102, 241, 0.4)' : 'rgba(34, 197, 94, 0.4)',
      text: '#e4e4e7',
      textMuted: '#a1a1aa',
      badgeBg: isLocal ? '#4f46e5' : '#16a34a',
      overlay: isLocal ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
    } : {
      bg: isLocal ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
      border: isLocal ? 'rgba(99, 102, 241, 0.3)' : 'rgba(34, 197, 94, 0.4)',
      text: '#1f2937',
      textMuted: '#6b7280',
      badgeBg: isLocal ? '#6366f1' : '#22c55e',
      overlay: isLocal ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
    }

    // Format date
    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString()
    }

    const handleMakeShared = () => {
      // Dispatch event for Phase 5 permission flow
      window.dispatchEvent(new CustomEvent('request-visibility-change', {
        detail: {
          shapeId: shape.id,
          currentVisibility: shape.props.visibility,
          newVisibility: 'shared',
          title: shape.props.title,
        }
      }))
    }

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: colors.bg,
            borderRadius: '8px',
            border: isLocal
              ? `2px dashed ${colors.border}`
              : `2px solid ${colors.border}`,
            boxShadow: isSelected
              ? `0 0 0 2px ${isLocal ? GoogleItemShape.LOCAL_COLOR : GoogleItemShape.SHARED_COLOR}`
              : '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            transition: 'box-shadow 0.15s ease, border 0.15s ease',
          }}
        >
          {/* Privacy overlay for local items */}
          {isLocal && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.overlay,
                pointerEvents: 'none',
                borderRadius: '6px',
              }}
            />
          )}

          {/* Privacy badge */}
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '22px',
              height: '22px',
              borderRadius: '11px',
              backgroundColor: colors.badgeBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
              zIndex: 10,
              cursor: 'pointer',
            }}
            title={isLocal
              ? 'Private - Only you can see (click to share)'
              : 'Shared - Visible to collaborators'
            }
            onClick={(e) => {
              e.stopPropagation()
              if (isLocal) handleMakeShared()
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isLocal ? '🔒' : '🌐'}
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: '10px 12px',
              paddingRight: '34px', // Space for badge
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: 0,
            }}
          >
            {/* Service icon and title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '14px', flexShrink: 0 }}>
                {SERVICE_ICONS[shape.props.service]}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: colors.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {shape.props.title}
              </span>
            </div>

            {/* Preview text */}
            {shape.props.preview && (
              <div
                style={{
                  fontSize: '11px',
                  color: colors.textMuted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.4',
                }}
              >
                {shape.props.preview}
              </div>
            )}

            {/* Date */}
            <div
              style={{
                fontSize: '10px',
                color: colors.textMuted,
                marginTop: 'auto',
              }}
            >
              {formatDate(shape.props.date)}
            </div>
          </div>

          {/* Thumbnail (if available) */}
          {shape.props.thumbnailUrl && shape.props.h > 100 && (
            <div
              style={{
                height: '60px',
                backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6',
                borderTop: `1px solid ${colors.border}`,
                backgroundImage: `url(${shape.props.thumbnailUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}
        </div>
      </HTMLContainer>
    )
  }
}

// Helper to create a GoogleItemShape from a ShareableItem
export function createGoogleItemProps(
  item: {
    id: string
    service: GoogleService
    title: string
    preview?: string
    date: number
    thumbnailUrl?: string
  },
  visibility: ItemVisibility = 'local'
): Partial<IGoogleItemShape["props"]> {
  return {
    itemId: item.id,
    service: item.service,
    title: item.title,
    preview: item.preview,
    date: item.date,
    thumbnailUrl: item.thumbnailUrl,
    visibility,
    w: 220,
    h: item.thumbnailUrl ? 140 : 80,
  }
}

// Helper to update visibility
export function updateItemVisibility(
  editor: any,
  shapeId: TLShapeId,
  visibility: ItemVisibility
) {
  const shape = editor.getShape(shapeId)
  if (shape && shape.type === 'GoogleItem') {
    editor.updateShape({
      id: shapeId,
      type: 'GoogleItem',
      props: {
        ...shape.props,
        visibility,
      },
    })
  }
}
