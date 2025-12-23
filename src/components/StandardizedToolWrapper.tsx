import React, { useState, ReactNode, useEffect, useRef, useMemo } from 'react'

// Hook to detect dark mode
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'))
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return isDark
}

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
  /** Callback when maximize button is clicked */
  onMaximize?: () => void
  /** Whether the tool is maximized (fullscreen) */
  isMaximized?: boolean
  /** Optional custom header content */
  headerContent?: ReactNode
  /** Editor instance for shape selection */
  editor?: any
  /** Shape ID for selection handling */
  shapeId?: string
  /** Whether the shape is pinned to view */
  isPinnedToView?: boolean
  /** Callback when pin button is clicked */
  onPinToggle?: () => void
  /** Tags to display at the bottom of the shape */
  tags?: string[]
  /** Callback when tags are updated */
  onTagsChange?: (tags: string[]) => void
  /** Whether tags can be edited */
  tagsEditable?: boolean
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
  onMaximize,
  isMaximized = false,
  headerContent,
  editor,
  shapeId,
  isPinnedToView = false,
  onPinToggle,
  tags = [],
  onTagsChange,
  tagsEditable = true,
}) => {
  const [isHoveringHeader, setIsHoveringHeader] = useState(false)
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [editingTagInput, setEditingTagInput] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)
  const isDarkMode = useIsDarkMode()

  // Handle Esc key to exit maximize mode
  useEffect(() => {
    if (!isMaximized || !onMaximize) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onMaximize()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isMaximized, onMaximize])

  // Dark mode aware colors
  const colors = useMemo(() => isDarkMode ? {
    contentBg: '#1a1a1a',
    tagsBg: '#252525',
    tagsBorder: '#404040',
    tagBg: '#4a5568',
    tagText: '#e4e4e4',
    addTagBg: '#4a5568',
    inputBg: '#333333',
    inputBorder: '#555555',
  } : {
    contentBg: 'white',
    tagsBg: '#f8f9fa',
    tagsBorder: '#e0e0e0',
    tagBg: '#6b7280',
    tagText: 'white',
    addTagBg: '#9ca3af',
    inputBg: 'white',
    inputBorder: '#9ca3af',
  }, [isDarkMode])

  // Bring selected shape to front when it becomes selected
  useEffect(() => {
    if (editor && shapeId && isSelected) {
      try {
        // Bring the shape to the front by updating its index
        // Note: sendToFront doesn't exist in this version of tldraw
        const allShapes = editor.getCurrentPageShapes()
        let highestIndex = 'a0'
        for (const s of allShapes) {
          if (s.index && typeof s.index === 'string' && s.index > highestIndex) {
            highestIndex = s.index
          }
        }
        const shape = editor.getShape(shapeId)
        if (shape) {
          const match = highestIndex.match(/^([a-z])(\d+)$/)
          if (match) {
            const letter = match[1]
            const num = parseInt(match[2], 10)
            const newIndex = num < 100 ? `${letter}${num + 1}` : `${String.fromCharCode(letter.charCodeAt(0) + 1)}1`
            if (/^[a-z]\d+$/.test(newIndex)) {
              editor.updateShape({ id: shapeId, type: shape.type, index: newIndex as any })
            }
          }
        }
      } catch (error) {
        // Silently fail if shape doesn't exist or operation fails
        // This prevents console spam if shape is deleted during selection
      }
    }
  }, [editor, shapeId, isSelected])

  // Calculate header background color (lighter shade of primary color)
  const headerBgColor = isSelected 
    ? primaryColor 
    : isHoveringHeader 
    ? `${primaryColor}15` // 15% opacity
    : `${primaryColor}10` // 10% opacity

  const wrapperStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: isMinimized ? 40 : (typeof height === 'number' ? `${height}px` : height), // Minimized height is just the header
    backgroundColor: colors.contentBg,
    border: isSelected ? `2px solid ${primaryColor}` : `1px solid ${primaryColor}40`,
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: isSelected
      ? `0 0 0 2px ${primaryColor}40, 0 4px 8px rgba(0,0,0,${isDarkMode ? '0.4' : '0.15'})`
      : `0 2px 4px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'})`,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "Inter, sans-serif",
    position: 'relative',
    pointerEvents: 'auto',
    transition: isPinnedToView ? 'box-shadow 0.2s ease' : 'height 0.2s ease, box-shadow 0.2s ease',
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
    width: '24px',
    height: '24px',
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
    touchAction: 'manipulation', // Prevent double-tap zoom, improve touch responsiveness
    padding: 0,
    margin: 0,
  }

  const minimizeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${primaryColor}20`,
    color: isSelected ? 'white' : primaryColor,
  }

  const pinButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isPinnedToView 
      ? (isSelected ? 'rgba(255,255,255,0.4)' : primaryColor)
      : (isSelected ? 'rgba(255,255,255,0.2)' : `${primaryColor}20`),
    color: isPinnedToView 
      ? (isSelected ? 'white' : 'white')
      : (isSelected ? 'white' : primaryColor),
  }

  const closeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${primaryColor}20`,
    color: isSelected ? 'white' : primaryColor,
  }

  const maximizeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isMaximized
      ? (isSelected ? 'rgba(255,255,255,0.4)' : primaryColor)
      : (isSelected ? 'rgba(255,255,255,0.2)' : `${primaryColor}20`),
    color: isMaximized
      ? (isSelected ? 'white' : 'white')
      : (isSelected ? 'white' : primaryColor),
  }

  const contentStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 0, // Allow flex shrinking
    overflow: 'auto',
    position: 'relative',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    flex: 1, // Take remaining space after header and tags
  }

  const tagsContainerStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderTop: `1px solid ${colors.tagsBorder}`,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
    minHeight: '32px',
    backgroundColor: colors.tagsBg,
    flexShrink: 0,
    touchAction: 'manipulation', // Improve touch responsiveness
  }

  const tagStyle: React.CSSProperties = {
    backgroundColor: colors.tagBg,
    color: colors.tagText,
    padding: '4px 8px', // Increased padding for better touch target
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    cursor: tagsEditable ? 'pointer' : 'default',
    touchAction: 'manipulation', // Improve touch responsiveness
    minHeight: '24px', // Ensure adequate touch target height
  }

  const tagInputStyle: React.CSSProperties = {
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: '12px',
    padding: '2px 6px',
    fontSize: '10px',
    outline: 'none',
    minWidth: '60px',
    flex: 1,
    backgroundColor: colors.inputBg,
    color: isDarkMode ? '#e4e4e4' : '#333',
  }

  const addTagButtonStyle: React.CSSProperties = {
    backgroundColor: colors.addTagBg,
    color: colors.tagText,
    border: 'none',
    borderRadius: '12px',
    padding: '4px 10px', // Increased padding for better touch target
    fontSize: '10px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    touchAction: 'manipulation', // Improve touch responsiveness
    minHeight: '24px', // Ensure adequate touch target height
  }

  const handleTagClick = (tag: string) => {
    if (tagsEditable && onTagsChange) {
      // Remove tag on click
      const newTags = tags.filter(t => t !== tag)
      onTagsChange(newTags)
    }
  }

  const handleAddTag = () => {
    if (editingTagInput.trim() && onTagsChange) {
      const newTag = editingTagInput.trim().replace('#', '')
      if (newTag && !tags.includes(newTag) && !tags.includes(`#${newTag}`)) {
        const tagToAdd = newTag.startsWith('#') ? newTag : newTag
        onTagsChange([...tags, tagToAdd])
      }
      setEditingTagInput('')
      setIsEditingTags(false)
    }
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      handleAddTag()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setIsEditingTags(false)
      setEditingTagInput('')
    } else if (e.key === 'Backspace' && editingTagInput === '' && tags.length > 0) {
      // Remove last tag if backspace on empty input
      e.stopPropagation()
      if (onTagsChange) {
        onTagsChange(tags.slice(0, -1))
      }
    }
  }

  useEffect(() => {
    if (isEditingTags && tagInputRef.current) {
      tagInputRef.current.focus()
    }
  }, [isEditingTags])

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

    // CRITICAL: Switch to select tool and select this shape when dragging header
    // This ensures dragging works regardless of which tool is currently active
    if (editor && shapeId) {
      const currentTool = editor.getCurrentToolId()
      if (currentTool !== 'select') {
        editor.setCurrentTool('select')
      }
      // Select this shape if not already selected
      if (!isSelected) {
        editor.setSelectedShapes([shapeId])
      }
    }

    // Don't stop the event - let tldraw handle the drag naturally
  }

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    e.preventDefault()
    action()
  }

  const handleButtonTouch = (e: React.TouchEvent, action: () => void) => {
    e.stopPropagation()
    e.preventDefault()
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
          // Don't select if clicking on a button - let the button handle the click
          const target = e.target as HTMLElement
          const isButton = 
            target.tagName === 'BUTTON' || 
            target.closest('button') ||
            target.closest('[role="button"]')
          
          if (isButton) {
            return
          }
          
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
          {onPinToggle && (
            <button
              style={pinButtonStyle}
              onClick={(e) => handleButtonClick(e, onPinToggle)}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => handleButtonTouch(e, onPinToggle)}
              onTouchEnd={(e) => e.stopPropagation()}
              title={isPinnedToView ? "Unpin from view" : "Pin to view"}
              aria-label={isPinnedToView ? "Unpin from view" : "Pin to view"}
            >
              📌
            </button>
          )}
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
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              if (onMinimize) {
                handleButtonTouch(e, onMinimize)
              }
            }}
            onTouchEnd={(e) => e.stopPropagation()}
            title="Minimize"
            aria-label="Minimize"
            disabled={!onMinimize}
          >
            _
          </button>
          {onMaximize && (
            <button
              style={maximizeButtonStyle}
              onClick={(e) => handleButtonClick(e, onMaximize)}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => handleButtonTouch(e, onMaximize)}
              onTouchEnd={(e) => e.stopPropagation()}
              title={isMaximized ? "Exit fullscreen (Esc)" : "Maximize"}
              aria-label={isMaximized ? "Exit fullscreen" : "Maximize"}
            >
              {isMaximized ? '⊡' : '⤢'}
            </button>
          )}
          <button
            style={closeButtonStyle}
            onClick={(e) => handleButtonClick(e, onClose)}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => handleButtonTouch(e, onClose)}
            onTouchEnd={(e) => e.stopPropagation()}
            title="Close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      {!isMinimized && (
        <>
          <div 
            style={contentStyle}
            onPointerDown={handleContentPointerDown}
          >
            {children}
          </div>
          
          {/* Tags at the bottom */}
          {(tags.length > 0 || (tagsEditable && isSelected)) && (
            <div
              style={tagsContainerStyle}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                if (tagsEditable && !isEditingTags && e.target === e.currentTarget) {
                  setIsEditingTags(true)
                }
              }}
            >
              {tags.slice(0, 5).map((tag, index) => (
                <span
                  key={index}
                  style={tagStyle}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTagClick(tag)
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleTagClick(tag)
                  }}
                  title={tagsEditable ? "Click to remove tag" : undefined}
                >
                  {tag.replace('#', '')}
                  {tagsEditable && <span style={{ fontSize: '8px' }}>×</span>}
                </span>
              ))}
              {tags.length > 5 && (
                <span style={tagStyle}>
                  +{tags.length - 5}
                </span>
              )}
              {isEditingTags && (
                <input
                  ref={tagInputRef}
                  type="text"
                  value={editingTagInput}
                  onChange={(e) => setEditingTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={() => {
                    handleAddTag()
                  }}
                  style={tagInputStyle}
                  placeholder="Add tag..."
                  onPointerDown={(e) => e.stopPropagation()}
                />
              )}
              {!isEditingTags && tagsEditable && isSelected && tags.length < 10 && (
                <button
                  style={addTagButtonStyle}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditingTags(true)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setIsEditingTags(true)
                  }}
                  onTouchEnd={(e) => e.stopPropagation()}
                  title="Add tag"
                >
                  + Add
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

