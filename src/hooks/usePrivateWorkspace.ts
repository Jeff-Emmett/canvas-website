import { useCallback, useEffect, useState } from 'react'
import { Editor, createShapeId, TLShapeId } from 'tldraw'
import { IPrivateWorkspaceShape, findPrivateWorkspace } from '../shapes/PrivateWorkspaceShapeUtil'
import type { ShareableItem } from '../lib/google'

const WORKSPACE_STORAGE_KEY = 'private-workspace-visible'

export interface UsePrivateWorkspaceOptions {
  editor: Editor | null
}

export function usePrivateWorkspace({ editor }: UsePrivateWorkspaceOptions) {
  const [workspaceId, setWorkspaceId] = useState<TLShapeId | null>(null)
  const [isVisible, setIsVisible] = useState(() => {
    try {
      return localStorage.getItem(WORKSPACE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Find existing workspace on mount or when editor changes
  useEffect(() => {
    if (!editor) return

    const existing = findPrivateWorkspace(editor)
    if (existing) {
      setWorkspaceId(existing.id)
      setIsVisible(true)
    }
  }, [editor])

  // Create or show the private workspace
  const showWorkspace = useCallback(() => {
    if (!editor) return null

    // Check if workspace already exists
    const existing = findPrivateWorkspace(editor)
    if (existing) {
      setWorkspaceId(existing.id)
      setIsVisible(true)
      localStorage.setItem(WORKSPACE_STORAGE_KEY, 'true')
      return existing.id
    }

    // Get viewport center for placement
    const viewport = editor.getViewportScreenBounds()
    const center = editor.screenToPage({
      x: viewport.x + viewport.width * 0.15, // Position on left side
      y: viewport.y + viewport.height * 0.2,
    })

    // Create new workspace
    const id = createShapeId()
    editor.createShape<IPrivateWorkspaceShape>({
      id,
      type: 'PrivateWorkspace',
      x: center.x,
      y: center.y,
      props: {
        w: 350,
        h: 450,
        pinnedToView: false,
        isCollapsed: false,
      },
    })

    setWorkspaceId(id)
    setIsVisible(true)
    localStorage.setItem(WORKSPACE_STORAGE_KEY, 'true')
    return id
  }, [editor])

  // Hide/delete the workspace
  const hideWorkspace = useCallback(() => {
    if (!editor || !workspaceId) return

    const shape = editor.getShape(workspaceId)
    if (shape) {
      editor.deleteShape(workspaceId)
    }

    setWorkspaceId(null)
    setIsVisible(false)
    localStorage.setItem(WORKSPACE_STORAGE_KEY, 'false')
  }, [editor, workspaceId])

  // Toggle workspace visibility
  const toggleWorkspace = useCallback(() => {
    if (isVisible && workspaceId) {
      hideWorkspace()
    } else {
      showWorkspace()
    }
  }, [isVisible, workspaceId, showWorkspace, hideWorkspace])

  // Add items to the workspace (from GoogleExportBrowser)
  const addItemsToWorkspace = useCallback((
    items: ShareableItem[],
    _position?: { x: number; y: number }
  ) => {
    if (!editor) return

    // Ensure workspace exists
    let wsId = workspaceId
    if (!wsId) {
      wsId = showWorkspace()
    }
    if (!wsId) return

    const workspace = editor.getShape(wsId) as IPrivateWorkspaceShape | undefined
    if (!workspace) return

    // Calculate starting position inside workspace
    const startX = workspace.x + 20
    const startY = workspace.y + 60 // Below header
    const itemSpacing = 100

    // Create placeholder shapes for each item
    // In Phase 4, these will be proper PrivateItemShape with visibility tracking
    items.forEach((item, index) => {
      const itemId = createShapeId()
      const col = index % 3
      const row = Math.floor(index / 3)

      // For now, create text shapes as placeholders
      // Phase 4 will replace with proper GoogleItemShape
      editor.createShape({
        id: itemId,
        type: 'text',
        x: startX + col * itemSpacing,
        y: startY + row * itemSpacing,
        props: {
          text: `🔒 ${item.title}`,
          size: 's',
          font: 'sans',
          color: 'violet',
          autoSize: true,
        },
      })
    })

    // Focus on workspace
    editor.select(wsId)
    editor.zoomToSelection({ animation: { duration: 300 } })
  }, [editor, workspaceId, showWorkspace])

  // Listen for add-google-items-to-canvas events
  useEffect(() => {
    const handleAddItems = (event: CustomEvent<{
      items: ShareableItem[]
      position: { x: number; y: number }
    }>) => {
      const { items, position } = event.detail
      addItemsToWorkspace(items, position)
    }

    window.addEventListener('add-google-items-to-canvas', handleAddItems as EventListener)
    return () => {
      window.removeEventListener('add-google-items-to-canvas', handleAddItems as EventListener)
    }
  }, [addItemsToWorkspace])

  return {
    workspaceId,
    isVisible,
    showWorkspace,
    hideWorkspace,
    toggleWorkspace,
    addItemsToWorkspace,
  }
}
