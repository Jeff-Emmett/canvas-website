import React, { useState, ReactNode } from 'react'

export interface StandardizedToolWrapperProps {
  /** The title to display in the header */
  title: string
  /** The primary color for this tool (used for header and accents) */
  primaryColor: string
  /** The content to render inside the wrapper */
  children: ReactNode
  /** Whether the shape is currently selected */
  isSelected: boolean
  /** Width of the tool */
  width: number
  /** Height of the tool */
  height: number
  /** Callback when close button is clicked */
  onClose: () => void
  /** Callback when minimize button is clicked */
  onMinimize?: () => void
  /** Whether the tool is minimized */
  isMinimized?: boolean
  /** Optional custom header content */
  headerContent?: ReactNode
  /** Editor instance for shape selection */
  editor?: any
  /** Shape ID for selection handling */
  shapeId?: string
}

/**
 * Standardized wrapper component for all custom tools on the canvas.
 * Provides consistent header bar with close/minimize buttons, sizing, and color theming.
 */
export const StandardizedToolWrapper: React.FC<StandardizedToolWrapperProps> = ({
  title,
  primaryColor,
  children,
  isSelected,
  width,
  height,
  onClose,
  onMinimize,
  isMinimized = false,
  headerContent,
  editor,
  shapeId,
}) => {
  const [isHoveringHeader, setIsHoveringHeader] = useState(false)


  // Calculate header background color (lighter shade of primary color)
  const headerBgColor = isSelected 
    ? primaryColor 
    : isHoveringHeader 
    ? `${primaryColor}15` // 15% opacity
    : `${primaryColor}10` // 10% opacity

  const wrapperStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: isMinimized ? 40 : (typeof height === 'number' ? `${height}px` : height), // Minimized height is just the header
    backgroundColor: "white",
    border: isSelected ? `2px solid ${primaryColor}` : `1px solid ${primaryColor}40`,
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: isSelected 
      ? `0 0 0 2px ${primaryColor}40, 0 4px 8px rgba(0,0,0,0.15)` 
      : '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "Inter, sans-serif",
    position: 'relative',
    pointerEvents: 'auto',
    transition: 'height 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box',
  }

  const headerStyle: React.CSSProperties = {
    height: '40px',
    backgroundColor: headerBgColor,
    borderBottom: `1px solid ${primaryColor}30`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    cursor: 'move',
    userSelect: 'none',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
    pointerEvents: 'auto',
    transition: 'background-color 0.2s ease',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: isSelected ? 'white' : primaryColor,
    flex: 1,
    pointerEvents: 'none',
    transition: 'color 0.2s ease',
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  }

  const buttonBaseStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    transition: 'background-color 0.15s ease, color 0.15s ease',
    pointerEvents: 'auto',
    flexShrink: 0,
  }

  const minimizeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${primaryColor}20`,
    color: isSelected ? 'white' : primaryColor,
  }

  const closeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${primaryColor}20`,
    color: isSelected ? 'white' : primaryColor,
  }

  const contentStyle: React.CSSProperties = {
    width: '100%',
    height: isMinimized ? 0 : 'calc(100% - 40px)',
    overflow: 'auto',
    position: 'relative',
    pointerEvents: 'auto',
    transition: 'height 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
  }

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    // Check if this is an interactive element (button)
    const target = e.target as HTMLElement
    const isInteractive = 
      target.tagName === 'BUTTON' || 
      target.closest('button') ||
      target.closest('[role="button"]')
    
    if (isInteractive) {
      // Buttons handle their own behavior and stop propagation
      return
    }
    
    // Don't stop the event - let tldraw handle it naturally
    // The hand tool override will detect shapes and handle dragging
  }

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  const handleContentPointerDown = (e: React.PointerEvent) => {
    // Only stop propagation for interactive elements to allow tldraw to handle dragging on white space
    const target = e.target as HTMLElement
    const isInteractive = 
      target.tagName === 'BUTTON' || 
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[role="button"]') ||
      target.closest('a') ||
      target.closest('[data-interactive]') // Allow components to mark interactive areas
    
    if (isInteractive) {
      e.stopPropagation()
    }
    // Don't stop propagation for non-interactive elements - let tldraw handle dragging
  }

  return (
    <div style={wrapperStyle}>
      {/* Header Bar */}
      <div 
        style={headerStyle}
        onPointerDown={handleHeaderPointerDown}
        onMouseEnter={() => setIsHoveringHeader(true)}
        onMouseLeave={() => setIsHoveringHeader(false)}
        onMouseDown={(e) => {
          // Ensure selection happens on mouse down for immediate visual feedback
          if (editor && shapeId && !isSelected) {
            editor.setSelectedShapes([shapeId])
          }
        }}
        data-draggable="true"
      >
        <div style={titleStyle}>
          {headerContent || title}
        </div>
        <div style={buttonContainerStyle}>
          <button
            style={minimizeButtonStyle}
            onClick={(e) => {
              if (onMinimize) {
                handleButtonClick(e, onMinimize)
              } else {
                // Default minimize behavior if no handler provided
                console.warn('Minimize button clicked but no onMinimize handler provided')
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Minimize"
            aria-label="Minimize"
            disabled={!onMinimize}
          >
            _
          </button>
          <button
            style={closeButtonStyle}
            onClick={(e) => handleButtonClick(e, onClose)}
            onPointerDown={(e) => e.stopPropagation()}
            title="Close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      {!isMinimized && (
        <div 
          style={contentStyle}
          onPointerDown={handleContentPointerDown}
        >
          {children}
        </div>
      )}
    </div>
  )
}

