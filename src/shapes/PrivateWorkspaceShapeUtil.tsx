import { useState, useEffect } from "react"
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, TLShapeId } from "tldraw"
import { usePinnedToView } from "../hooks/usePinnedToView"

export type IPrivateWorkspaceShape = TLBaseShape<
  "PrivateWorkspace",
  {
    w: number
    h: number
    pinnedToView: boolean
    isCollapsed: boolean
  }
>

// Storage key for persisting workspace position/size
const STORAGE_KEY = 'private-workspace-state'

interface WorkspaceState {
  x: number
  y: number
  w: number
  h: number
}

function saveWorkspaceState(state: WorkspaceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save workspace state:', e)
  }
}

function loadWorkspaceState(): WorkspaceState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('Failed to load workspace state:', e)
  }
  return null
}

export class PrivateWorkspaceShape extends BaseBoxShapeUtil<IPrivateWorkspaceShape> {
  static override type = "PrivateWorkspace" as const

  // Privacy zone color: Indigo
  static readonly PRIMARY_COLOR = "#6366f1"

  getDefaultProps(): IPrivateWorkspaceShape["props"] {
    const saved = loadWorkspaceState()
    return {
      w: saved?.w ?? 400,
      h: saved?.h ?? 500,
      pinnedToView: false,
      isCollapsed: false,
    }
  }

  override canResize() {
    return true
  }

  override canBind() {
    return false
  }

  indicator(shape: IPrivateWorkspaceShape) {
    return (
      <rect
        x={0}
        y={0}
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
        strokeDasharray="8 4"
      />
    )
  }

  component(shape: IPrivateWorkspaceShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Save position/size when shape changes
    useEffect(() => {
      const shapeData = this.editor.getShape(shape.id)
      if (shapeData) {
        saveWorkspaceState({
          x: shapeData.x,
          y: shapeData.y,
          w: shape.props.w,
          h: shape.props.h,
        })
      }
    }, [shape.props.w, shape.props.h, shape.id])

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IPrivateWorkspaceShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handleCollapse = () => {
      this.editor.updateShape<IPrivateWorkspaceShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isCollapsed: !shape.props.isCollapsed,
        },
      })
    }

    // Detect dark mode
    const isDarkMode = typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')

    const colors = isDarkMode ? {
      bg: 'rgba(99, 102, 241, 0.12)',
      headerBg: 'rgba(99, 102, 241, 0.25)',
      border: 'rgba(99, 102, 241, 0.4)',
      text: '#e4e4e7',
      textMuted: '#a1a1aa',
      btnHover: 'rgba(255, 255, 255, 0.1)',
    } : {
      bg: 'rgba(99, 102, 241, 0.06)',
      headerBg: 'rgba(99, 102, 241, 0.15)',
      border: 'rgba(99, 102, 241, 0.3)',
      text: '#3730a3',
      textMuted: '#6366f1',
      btnHover: 'rgba(99, 102, 241, 0.1)',
    }

    const collapsedHeight = 44

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.isCollapsed ? collapsedHeight : shape.props.h,
          pointerEvents: 'all',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: colors.bg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '12px',
            border: `2px dashed ${colors.border}`,
            boxShadow: isSelected
              ? `0 0 0 2px ${PrivateWorkspaceShape.PRIMARY_COLOR}, 0 8px 32px rgba(99, 102, 241, 0.15)`
              : '0 4px 24px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'box-shadow 0.2s ease, height 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: colors.headerBg,
              borderBottom: shape.props.isCollapsed ? 'none' : `1px solid ${colors.border}`,
              cursor: 'grab',
              userSelect: 'none',
            }}
            onPointerDown={(e) => {
              // Allow dragging from header
              e.stopPropagation()
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔒</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  letterSpacing: '-0.01em',
                }}
              >
                Private Workspace
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Pin button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePinToggle()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  borderRadius: '4px',
                  opacity: shape.props.pinnedToView ? 1 : 0.6,
                  transition: 'opacity 0.15s ease',
                }}
                title={shape.props.pinnedToView ? 'Unpin from viewport' : 'Pin to viewport'}
              >
                📌
              </button>

              {/* Collapse button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCollapse()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  borderRadius: '4px',
                  opacity: 0.6,
                  transition: 'opacity 0.15s ease',
                }}
                title={shape.props.isCollapsed ? 'Expand' : 'Collapse'}
              >
                {shape.props.isCollapsed ? '▼' : '▲'}
              </button>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleClose()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  borderRadius: '4px',
                  opacity: 0.6,
                  transition: 'opacity 0.15s ease',
                }}
                title="Close workspace"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content area */}
          {!shape.props.isCollapsed && (
            <div
              style={{
                flex: 1,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textMuted,
                fontSize: '13px',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: colors.headerBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}
              >
                🔐
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '500', color: colors.text }}>
                  Drop items here to keep them private
                </p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
                  Encrypted in your browser • Only you can see these
                </p>
              </div>
            </div>
          )}

          {/* Footer hint */}
          {!shape.props.isCollapsed && (
            <div
              style={{
                padding: '8px 14px',
                backgroundColor: colors.headerBg,
                borderTop: `1px solid ${colors.border}`,
                fontSize: '11px',
                color: colors.textMuted,
                textAlign: 'center',
              }}
            >
              Drag items outside to share with collaborators
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }
}

// Helper function to check if a shape is inside the private workspace
export function isShapeInPrivateWorkspace(
  editor: any,
  shapeId: TLShapeId,
  workspaceId: TLShapeId
): boolean {
  const shape = editor.getShape(shapeId)
  const workspace = editor.getShape(workspaceId)

  if (!shape || !workspace || workspace.type !== 'PrivateWorkspace') {
    return false
  }

  const shapeBounds = editor.getShapeGeometry(shape).bounds
  const workspaceBounds = editor.getShapeGeometry(workspace).bounds

  // Check if shape center is within workspace bounds
  const shapeCenterX = shape.x + shapeBounds.width / 2
  const shapeCenterY = shape.y + shapeBounds.height / 2

  return (
    shapeCenterX >= workspace.x &&
    shapeCenterX <= workspace.x + workspaceBounds.width &&
    shapeCenterY >= workspace.y &&
    shapeCenterY <= workspace.y + workspaceBounds.height
  )
}

// Helper to find the private workspace shape on the canvas
export function findPrivateWorkspace(editor: any): IPrivateWorkspaceShape | null {
  const shapes = editor.getCurrentPageShapes()
  return shapes.find((s: any) => s.type === 'PrivateWorkspace') || null
}
