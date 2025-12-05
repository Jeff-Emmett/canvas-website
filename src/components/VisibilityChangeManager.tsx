import { useState, useEffect, useCallback } from 'react'
import { useEditor, TLShapeId } from 'tldraw'
import { VisibilityChangeModal, shouldSkipVisibilityPrompt, setSkipVisibilityPrompt } from './VisibilityChangeModal'
import { updateItemVisibility, ItemVisibility } from '../shapes/GoogleItemShapeUtil'
import { findPrivateWorkspace, isShapeInPrivateWorkspace } from '../shapes/PrivateWorkspaceShapeUtil'

interface PendingChange {
  shapeId: TLShapeId
  currentVisibility: ItemVisibility
  newVisibility: ItemVisibility
  title: string
}

export function VisibilityChangeManager() {
  const editor = useEditor()
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()

    // Watch for class changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  // Handle visibility change requests from GoogleItem shapes
  useEffect(() => {
    const handleVisibilityChangeRequest = (event: CustomEvent<{
      shapeId: TLShapeId
      currentVisibility: ItemVisibility
      newVisibility: ItemVisibility
      title: string
    }>) => {
      const { shapeId, currentVisibility, newVisibility, title } = event.detail

      // Check if user has opted to skip prompts
      if (shouldSkipVisibilityPrompt()) {
        // Apply change immediately
        updateItemVisibility(editor, shapeId, newVisibility)
        return
      }

      // Show confirmation modal
      setPendingChange({
        shapeId,
        currentVisibility,
        newVisibility,
        title,
      })
    }

    window.addEventListener('request-visibility-change', handleVisibilityChangeRequest as EventListener)
    return () => {
      window.removeEventListener('request-visibility-change', handleVisibilityChangeRequest as EventListener)
    }
  }, [editor])

  // Handle drag detection - check when items leave the Private Workspace
  // Track GoogleItem positions to detect when they move outside workspace
  useEffect(() => {
    if (!editor) return

    // Track which GoogleItems were inside workspace at start of drag
    const wasInWorkspace = new Map<TLShapeId, boolean>()
    let isDragging = false

    // Record initial positions when pointer goes down
    const handlePointerDown = () => {
      const workspace = findPrivateWorkspace(editor)
      if (!workspace) return

      const selectedIds = editor.getSelectedShapeIds()
      wasInWorkspace.clear()

      for (const id of selectedIds) {
        const shape = editor.getShape(id)
        if (shape && shape.type === 'GoogleItem') {
          const inWorkspace = isShapeInPrivateWorkspace(editor, id, workspace.id)
          wasInWorkspace.set(id, inWorkspace)
        }
      }
      isDragging = true
    }

    // Check for visibility changes when pointer goes up
    const handlePointerUp = () => {
      if (!isDragging || wasInWorkspace.size === 0) {
        isDragging = false
        return
      }

      const workspace = findPrivateWorkspace(editor)
      if (!workspace) {
        wasInWorkspace.clear()
        isDragging = false
        return
      }

      // Check each tracked shape
      wasInWorkspace.forEach((wasIn, id) => {
        const shape = editor.getShape(id)
        if (!shape || shape.type !== 'GoogleItem') return

        const isNowIn = isShapeInPrivateWorkspace(editor, id, workspace.id)

        // If shape was in workspace and is now outside, trigger visibility change
        if (wasIn && !isNowIn) {
          const itemShape = shape as any // GoogleItem shape
          if (itemShape.props.visibility === 'local') {
            // Trigger visibility change request
            window.dispatchEvent(new CustomEvent('request-visibility-change', {
              detail: {
                shapeId: id,
                currentVisibility: 'local',
                newVisibility: 'shared',
                title: itemShape.props.title || 'Untitled',
              }
            }))
          }
        }
      })

      wasInWorkspace.clear()
      isDragging = false
    }

    // Use DOM events for pointer tracking (more reliable with tldraw)
    const canvas = document.querySelector('.tl-canvas')
    if (canvas) {
      canvas.addEventListener('pointerdown', handlePointerDown)
      canvas.addEventListener('pointerup', handlePointerUp)
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('pointerdown', handlePointerDown)
        canvas.removeEventListener('pointerup', handlePointerUp)
      }
    }
  }, [editor])

  // Handle modal confirmation
  const handleConfirm = useCallback((dontAskAgain: boolean) => {
    if (!pendingChange) return

    // Update the shape visibility
    updateItemVisibility(editor, pendingChange.shapeId, pendingChange.newVisibility)

    // Save preference if requested
    if (dontAskAgain) {
      setSkipVisibilityPrompt(true)
    }

    setPendingChange(null)
  }, [editor, pendingChange])

  // Handle modal cancellation
  const handleCancel = useCallback(() => {
    if (!pendingChange) return

    // If this was triggered by drag, move the shape back inside the workspace
    const workspace = findPrivateWorkspace(editor)
    if (workspace) {
      const shape = editor.getShape(pendingChange.shapeId)
      if (shape) {
        // Move shape back inside workspace bounds
        editor.updateShape({
          id: pendingChange.shapeId,
          type: shape.type,
          x: workspace.x + 20,
          y: workspace.y + 60,
        })
      }
    }

    setPendingChange(null)
  }, [editor, pendingChange])

  return (
    <VisibilityChangeModal
      isOpen={pendingChange !== null}
      itemTitle={pendingChange?.title || ''}
      currentVisibility={pendingChange?.currentVisibility || 'local'}
      newVisibility={pendingChange?.newVisibility || 'shared'}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      isDarkMode={isDarkMode}
    />
  )
}
