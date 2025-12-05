import { useCallback, useEffect, useState } from 'react'
import { Editor, createShapeId, TLShapeId } from 'tldraw'
import { IPrivateWorkspaceShape, findPrivateWorkspace } from '../shapes/PrivateWorkspaceShapeUtil'
import { IGoogleItemShape } from '../shapes/GoogleItemShapeUtil'
import type { ShareableItem, GoogleService } from '../lib/google'

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
    const itemWidth = 220
    const itemHeight = 90
    const itemSpacingX = itemWidth + 10
    const itemSpacingY = itemHeight + 10
    const itemsPerRow = Math.max(1, Math.floor((workspace.props.w - 40) / itemSpacingX))

    // Create GoogleItem shapes for each item
    items.forEach((item, index) => {
      const itemId = createShapeId()
      const col = index % itemsPerRow
      const row = Math.floor(index / itemsPerRow)

      // Create GoogleItem shape with privacy badge
      editor.createShape<IGoogleItemShape>({
        id: itemId,
        type: 'GoogleItem',
        x: startX + col * itemSpacingX,
        y: startY + row * itemSpacingY,
        props: {
          w: itemWidth,
          h: item.thumbnailUrl ? 140 : itemHeight,
          itemId: item.id,
          service: item.service as GoogleService,
          title: item.title,
          preview: item.preview,
          date: item.date,
          thumbnailUrl: item.thumbnailUrl,
          visibility: 'local', // Always start as local/private
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
