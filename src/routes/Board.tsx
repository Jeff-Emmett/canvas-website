import { useAutomergeSync } from "@/automerge/useAutomergeSync"
import { AutomergeHandleProvider } from "@/context/AutomergeHandleContext"
import { useMemo, useEffect, useState, useRef } from "react"
import { Tldraw, Editor, TLShapeId, TLRecord, useTldrawUser, TLUserPreferences } from "tldraw"
import { useParams } from "react-router-dom"
import { ChatBoxTool } from "@/tools/ChatBoxTool"
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatTool } from "@/tools/VideoChatTool"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { multiplayerAssetStore } from "../utils/multiplayerAssetStore"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { EmbedTool } from "@/tools/EmbedTool"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MarkdownTool } from "@/tools/MarkdownTool"
import { defaultShapeUtils, defaultBindingUtils } from "tldraw"
import { components } from "@/ui/components"
import { overrides } from "@/ui/overrides"
import { unfurlBookmarkUrl } from "../utils/unfurlBookmarkUrl"
import { handleInitialPageLoad } from "@/utils/handleInitialPageLoad"
import { MycrozineTemplateTool } from "@/tools/MycrozineTemplateTool"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import {
  registerPropagators,
  ChangePropagator,
  TickPropagator,
  ClickPropagator,
} from "@/propagators/ScopedPropagators"
import { SlideShapeTool } from "@/tools/SlideShapeTool"
import { SlideShape } from "@/shapes/SlideShapeUtil"
import { makeRealSettings, applySettingsMigrations } from "@/lib/settings"
import { PromptShapeTool } from "@/tools/PromptShapeTool"
import { PromptShape } from "@/shapes/PromptShapeUtil"
import { ObsNoteTool } from "@/tools/ObsNoteTool"
import { ObsNoteShape } from "@/shapes/ObsNoteShapeUtil"
import { TranscriptionTool } from "@/tools/TranscriptionTool"
import { TranscriptionShape } from "@/shapes/TranscriptionShapeUtil"
import { HolonTool } from "@/tools/HolonTool"
import { HolonShape } from "@/shapes/HolonShapeUtil"
import { FathomMeetingsTool } from "@/tools/FathomMeetingsTool"
import { HolonBrowserShape } from "@/shapes/HolonBrowserShapeUtil"
import { ObsidianBrowserShape } from "@/shapes/ObsidianBrowserShapeUtil"
import { FathomMeetingsBrowserShape } from "@/shapes/FathomMeetingsBrowserShapeUtil"
import { ImageGenShape } from "@/shapes/ImageGenShapeUtil"
import { ImageGenTool } from "@/tools/ImageGenTool"
import { VideoGenShape } from "@/shapes/VideoGenShapeUtil"
import { VideoGenTool } from "@/tools/VideoGenTool"
import { MultmuxTool } from "@/tools/MultmuxTool"
import { MultmuxShape } from "@/shapes/MultmuxShapeUtil"
// MycelialIntelligence moved to permanent UI bar - shape kept for backwards compatibility
import { MycelialIntelligenceShape } from "@/shapes/MycelialIntelligenceShapeUtil"
import {
  lockElement,
  unlockElement,
  setInitialCameraFromUrl,
  initLockIndicators,
  watchForLockedShapes,
} from "@/ui/cameraUtils"
import { Collection, initializeGlobalCollections } from "@/collections"
import { GraphLayoutCollection } from "@/graph/GraphLayoutCollection"
import { GestureTool } from "@/GestureTool"
import { CmdK } from "@/CmdK"


import "react-cmdk/dist/cmdk.css"
import "@/css/style.css"
import "@/css/obsidian-browser.css"

const collections: Collection[] = [GraphLayoutCollection]
import { useAuth } from "../context/AuthContext"
import { updateLastVisited } from "../lib/starredBoards"
import { captureBoardScreenshot } from "../lib/screenshotService"

import { WORKER_URL } from "../constants/workerUrl"

const customShapeUtils = [
  ChatBoxShape,
  VideoChatShape,
  EmbedShape,
  SlideShape,
  MycrozineTemplateShape,
  MarkdownShape,
  PromptShape,
  ObsNoteShape,
  TranscriptionShape,
  HolonShape,
  HolonBrowserShape,
  ObsidianBrowserShape,
  FathomMeetingsBrowserShape,
  ImageGenShape,
  VideoGenShape,
  MultmuxShape,
  MycelialIntelligenceShape, // Deprecated - kept for backwards compatibility
]
const customTools = [
  ChatBoxTool,
  VideoChatTool,
  EmbedTool,
  SlideShapeTool,
  MycrozineTemplateTool,
  MarkdownTool,
  PromptShapeTool,
  GestureTool,
  ObsNoteTool,
  TranscriptionTool,
  HolonTool,
  FathomMeetingsTool,
  ImageGenTool,
  VideoGenTool,
  MultmuxTool,
]

// Debug: Log tool and shape registration info
// Custom tools and shapes registered

export function Board() {
  const { slug } = useParams<{ slug: string }>()

  // Global error handler to suppress geometry errors from corrupted shapes
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('nearest point') ||
          event.error?.message?.includes('No nearest point') ||
          event.message?.includes('nearest point')) {
        console.warn('Suppressed geometry error from corrupted shape:', event.error?.message || event.message)
        event.preventDefault()
        event.stopPropagation()
        return true
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('nearest point') ||
          event.reason?.message?.includes('No nearest point')) {
        console.warn('Suppressed geometry promise rejection:', event.reason?.message)
        event.preventDefault()
        return true
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Global wheel event handler to ensure scrolling happens on the hovered scrollable element
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Use document.elementFromPoint to find the element under the mouse cursor
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement
      if (!elementUnderMouse) return
      
      // Walk up the DOM tree from the element under the mouse to find a scrollable element
      let element: HTMLElement | null = elementUnderMouse
      while (element && element !== document.body && element !== document.documentElement) {
        const style = window.getComputedStyle(element)
        const overflowY = style.overflowY
        const overflowX = style.overflowX
        const overflow = style.overflow
        const isScrollable = 
          (overflowY === 'auto' || overflowY === 'scroll' || 
           overflowX === 'auto' || overflowX === 'scroll' ||
           overflow === 'auto' || overflow === 'scroll')
        
        if (isScrollable) {
          // Check if the element can actually scroll in the direction of the wheel event
          const canScrollDown = e.deltaY > 0 && element.scrollTop < element.scrollHeight - element.clientHeight - 1
          const canScrollUp = e.deltaY < 0 && element.scrollTop > 0
          const canScrollRight = e.deltaX > 0 && element.scrollLeft < element.scrollWidth - element.clientWidth - 1
          const canScrollLeft = e.deltaX < 0 && element.scrollLeft > 0
          
          const canScroll = canScrollDown || canScrollUp || canScrollRight || canScrollLeft
          
          if (canScroll) {
            // Verify the mouse is actually over this element
            const rect = element.getBoundingClientRect()
            const isOverElement = 
              e.clientX >= rect.left && 
              e.clientX <= rect.right && 
              e.clientY >= rect.top && 
              e.clientY <= rect.bottom
            
            if (isOverElement) {
              // Stop propagation to prevent the scroll from affecting parent elements
              // but don't prevent default - let the browser handle the actual scrolling
              e.stopPropagation()
              return
            }
          }
        }
        
        element = element.parentElement
      }
    }
    
    // Use capture phase to catch events early, before they bubble
    document.addEventListener('wheel', handleWheel, { passive: true, capture: true })
    
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [])
  const roomId = slug || "mycofi33"
  const { session } = useAuth()

  // Store roomId in localStorage for VideoChatShapeUtil to access
  useEffect(() => {
    localStorage.setItem('currentRoomId', roomId)
    
    // One-time migration: clear old video chat storage entries
    const oldStorageKeys = [
      'videoChat_room_page_page',
      'videoChat_room_page:page', 
      'videoChat_room_board_page_page'
    ];
    
    oldStorageKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`Migrating: clearing old video chat storage entry: ${key}`);
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_token`);
      }
    });
  }, [roomId])

  // Generate a stable user ID that persists across sessions
  const uniqueUserId = useMemo(() => {
    if (!session.username) return undefined

    // Use localStorage to persist user ID across sessions
    const storageKey = `tldraw-user-id-${session.username}`
    let userId = localStorage.getItem(storageKey)

    if (!userId) {
      // Create a new user ID if one doesn't exist
      userId = `${session.username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(storageKey, userId)
    }

    return userId
  }, [session.username])

  // Generate a unique color for each user based on their userId
  const generateUserColor = (userId: string): string => {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = hash % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  // Get current dark mode state from DOM
  const getColorScheme = (): 'light' | 'dark' => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  }

  // Set up user preferences for TLDraw collaboration
  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>(() => ({
    id: uniqueUserId || 'anonymous',
    name: session.username || 'Anonymous',
    color: uniqueUserId ? generateUserColor(uniqueUserId) : '#000000',
    colorScheme: getColorScheme(),
  }))

  // Update user preferences when session changes
  useEffect(() => {
    if (uniqueUserId) {
      setUserPreferences({
        id: uniqueUserId,
        name: session.username || 'Anonymous',
        color: generateUserColor(uniqueUserId),
        colorScheme: getColorScheme(),
      })
    }
  }, [uniqueUserId, session.username])

  // Listen for dark mode changes and update tldraw color scheme
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const newColorScheme = getColorScheme()
          setUserPreferences(prev => ({
            ...prev,
            colorScheme: newColorScheme,
          }))
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  // Create the user object for TLDraw
  const user = useTldrawUser({ userPreferences, setUserPreferences })

  const storeConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: multiplayerAssetStore,
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: [...defaultBindingUtils],
      user: session.authed && uniqueUserId ? {
        id: uniqueUserId,
        name: session.username,  // Display name (can be duplicate)
      } : undefined,
    }),
    [roomId, session.authed, session.username, uniqueUserId],
  )

  // Use Automerge sync for all environments
  const storeWithHandle = useAutomergeSync(storeConfig)
  const store = { 
    store: storeWithHandle.store, 
    status: storeWithHandle.status,
    ...('connectionStatus' in storeWithHandle ? { connectionStatus: storeWithHandle.connectionStatus } : {}),
    error: storeWithHandle.error
  }
  const automergeHandle = (storeWithHandle as any).handle
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    const value = localStorage.getItem("makereal_settings_2")
    if (value) {
      const json = JSON.parse(value)
      const migratedSettings = applySettingsMigrations(json)
      localStorage.setItem(
        "makereal_settings_2",
        JSON.stringify(migratedSettings),
      )
      makeRealSettings.set(migratedSettings)
    }
  }, [])

  // Bring selected shapes to front when they become selected
  useEffect(() => {
    if (!editor) return

    let lastSelectedIds: string[] = []

    const handleSelectionChange = () => {
      const selectedShapeIds = editor.getSelectedShapeIds()
      
      // Only bring to front if selection actually changed
      const selectionChanged = 
        selectedShapeIds.length !== lastSelectedIds.length ||
        selectedShapeIds.some((id, index) => id !== lastSelectedIds[index])
      
      if (selectionChanged && selectedShapeIds.length > 0) {
        try {
          // Bring all selected shapes to the front by updating their index
          // Note: sendToFront doesn't exist in this version of tldraw
          const allShapes = editor.getCurrentPageShapes()
          let highestIndex = 'a0'
          for (const s of allShapes) {
            if (s.index && typeof s.index === 'string' && s.index > highestIndex) {
              highestIndex = s.index
            }
          }
          // Update each selected shape's index
          for (const id of selectedShapeIds) {
            const shape = editor.getShape(id)
            if (shape) {
              const match = highestIndex.match(/^([a-z])(\d+)$/)
              if (match) {
                const letter = match[1]
                const num = parseInt(match[2], 10)
                const newIndex = num < 100 ? `${letter}${num + 1}` : `${String.fromCharCode(letter.charCodeAt(0) + 1)}1`
                if (/^[a-z]\d+$/.test(newIndex)) {
                  editor.updateShape({ id, type: shape.type, index: newIndex as any })
                }
              }
            }
          }
          lastSelectedIds = [...selectedShapeIds]
        } catch (error) {
          // Silently fail if shapes don't exist or operation fails
          // This prevents console spam if shapes are deleted during selection
        }
      } else if (!selectionChanged) {
        // Update lastSelectedIds even if no action taken
        lastSelectedIds = [...selectedShapeIds]
      }
    }

    // Listen for selection changes (fires on any store change, but we filter for selection changes)
    const unsubscribe = editor.addListener('change', handleSelectionChange)

    return () => {
      if (typeof unsubscribe === 'function') {
        ;(unsubscribe as () => void)()
      }
    }
  }, [editor])

  // Remove the URL-based locking effect and replace with store-based initialization
  useEffect(() => {
    if (!editor || !store.store) return
    initLockIndicators(editor)
    watchForLockedShapes(editor)
    
    // Function to check and fix missing shapes
    const checkAndFixMissingShapes = () => {
      if (!editor || !store.store) return
      
      // Only check if store is synced - wait for proper sync like in dev
      if (store.status !== 'synced-remote') {
        return
      }
      
      const editorShapes = editor.getCurrentPageShapes()
      const currentPageId = editor.getCurrentPageId()
      
      // Get all shapes from store
      const storeShapes = store.store.allRecords().filter((r: any) => r.typeName === 'shape') || []
      
      // Get shapes on current page from store
      const storeShapesOnCurrentPage = storeShapes.filter((s: any) => s.parentId === currentPageId)
      
      // Debug: Log page information
      const allPages = store.store.allRecords().filter((r: any) => r.typeName === 'page')
      console.log(`📊 Board: Current page ID: ${currentPageId}`)
      console.log(`📊 Board: Available pages:`, allPages.map((p: any) => ({ id: p.id, name: p.name })))
      console.log(`📊 Board: Store has ${storeShapes.length} total shapes, ${storeShapesOnCurrentPage.length} on current page. Editor sees ${editorShapes.length} shapes on current page.`)
      
      // CRITICAL DEBUG: Check if shapes exist in editor but aren't returned by getCurrentPageShapes
      if (storeShapesOnCurrentPage.length > 0 && editorShapes.length === 0) {
        console.log(`🔍 DEBUG: Checking why ${storeShapesOnCurrentPage.length} shapes aren't visible...`)
        const sampleShape = storeShapesOnCurrentPage[0]
        const shapeInEditor = editor.getShape(sampleShape.id as TLShapeId)
        console.log(`🔍 DEBUG: Sample shape ${sampleShape.id} in editor:`, shapeInEditor ? 'EXISTS' : 'MISSING')
        if (shapeInEditor) {
          console.log(`🔍 DEBUG: Shape details:`, {
            id: shapeInEditor.id,
            type: shapeInEditor.type,
            parentId: shapeInEditor.parentId,
            pageId: editor.getCurrentPageId(),
            matches: shapeInEditor.parentId === editor.getCurrentPageId()
          })
        }
      }
      
      // Debug: Log shape parent IDs to see if there's a mismatch
      if (storeShapes.length > 0 && editorShapes.length === 0) {
        const parentIdCounts = new Map<string, number>()
        storeShapes.forEach((s: any) => {
          const pid = s.parentId || 'no-parent'
          parentIdCounts.set(pid, (parentIdCounts.get(pid) || 0) + 1)
        })
        console.log(`📊 Board: Shape parent ID distribution:`, Array.from(parentIdCounts.entries()))
      }
      
      // REMOVED: Aggressive force refresh that was causing coordinate loss
      // If shapes are in store but editor doesn't see them, it's likely a different issue
      // Forcing refresh by re-putting was resetting coordinates to 0,0
      if (storeShapes.length > 0 && editorShapes.length === 0 && storeShapesOnCurrentPage.length > 0) {
        console.warn(`⚠️ Board: ${storeShapes.length} shapes in store (${storeShapesOnCurrentPage.length} on current page) but editor sees 0. This may indicate a sync issue.`)
        // Don't force refresh - it was causing coordinate loss
      }
      
      // Check if there are shapes in store on current page that editor can't see
      if (storeShapesOnCurrentPage.length > editorShapes.length) {
        const editorShapeIds = new Set(editorShapes.map(s => s.id))
        const missingShapes = storeShapesOnCurrentPage.filter((s: any) => !editorShapeIds.has(s.id))
        
        if (missingShapes.length > 0) {
          console.warn(`📊 Board: ${missingShapes.length} shapes in store on current page but not visible to editor:`, missingShapes.map((s: any) => ({
            id: s.id,
            type: s.type,
            x: s.x,
            y: s.y,
            parentId: s.parentId
          })))
          
          // Try to get the shapes from the editor to see if they exist but aren't being returned
          const missingShapeIds = missingShapes.map((s: any) => s.id as TLShapeId)
          const shapesFromEditor = missingShapeIds
            .map((id: TLShapeId) => editor.getShape(id))
            .filter((s): s is NonNullable<typeof s> => s !== undefined)
          
          if (shapesFromEditor.length > 0) {
            console.log(`📊 Board: ${shapesFromEditor.length} missing shapes actually exist in editor but aren't in getCurrentPageShapes()`)
            // Try to select them to make them visible
            const shapeIds = shapesFromEditor.map((s: any) => s.id).filter((id: string): id is TLShapeId => id !== undefined)
            if (shapeIds.length > 0) {
              editor.setSelectedShapes(shapeIds)
            }
          } else {
            // Shapes don't exist in editor - might be a sync issue
            console.error(`📊 Board: ${missingShapes.length} shapes are in store but don't exist in editor - possible sync issue`)
            
            // REMOVED: Force refresh that was causing coordinate loss
            // Re-putting shapes was resetting coordinates to 0,0
            console.log(`📊 Board: ${missingShapes.length} shapes are in store but not visible in editor - this may indicate a sync issue`)
          }
          
          // Check if shapes are outside viewport
          const viewport = editor.getViewportPageBounds()
          const shapesOutsideViewport = missingShapes.filter((s: any) => {
            if (s.x === undefined || s.y === undefined) return true
            const shapeBounds = {
              x: s.x,
              y: s.y,
              w: (s.props as any)?.w || 100,
              h: (s.props as any)?.h || 100
            }
            return !(
              shapeBounds.x + shapeBounds.w >= viewport.x &&
              shapeBounds.x <= viewport.x + viewport.w &&
              shapeBounds.y + shapeBounds.h >= viewport.y &&
              shapeBounds.y <= viewport.y + viewport.h
            )
          })
          
          if (shapesOutsideViewport.length > 0) {
            console.log(`📊 Board: ${shapesOutsideViewport.length} missing shapes are outside viewport - focusing on them`)
            // Focus on the first missing shape
            const firstShape = shapesOutsideViewport[0] as any
            if (firstShape && firstShape.x !== undefined && firstShape.y !== undefined) {
              editor.setCamera({
                x: firstShape.x - viewport.w / 2,
                y: firstShape.y - viewport.h / 2,
                z: editor.getCamera().z
              }, { animation: { duration: 300 } })
            }
          }
        }
      }
      
      // Also check for shapes on other pages
      // CRITICAL: Only count shapes that are DIRECT children of other pages, not frame/group children
      const shapesOnOtherPages = storeShapes.filter((s: any) =>
        s.parentId &&
        s.parentId.startsWith('page:') && // Only page children
        s.parentId !== currentPageId
      )
      if (shapesOnOtherPages.length > 0) {
        console.log(`📊 Board: ${shapesOnOtherPages.length} shapes exist on other pages (not current page ${currentPageId})`)
        
        // Find which page has the most shapes
        // CRITICAL: Only count shapes that are DIRECT children of pages, not frame/group children
        const pageShapeCounts = new Map<string, number>()
        storeShapes.forEach((s: any) => {
          if (s.parentId && s.parentId.startsWith('page:')) {
            pageShapeCounts.set(s.parentId, (pageShapeCounts.get(s.parentId) || 0) + 1)
          }
        })
        
        // Also check for shapes with no parentId or invalid parentId
        // CRITICAL: Frame and group children have parentId like "frame:..." or "group:...", not page IDs
        // Only consider a parentId invalid if:
        // 1. It's missing/null/undefined
        // 2. It references a page that doesn't exist (starts with "page:" but page not found)
        // 3. It references a shape that doesn't exist (starts with "shape:" but shape not found)
        // DO NOT consider frame/group parentIds as invalid!
        const shapesWithInvalidParent = storeShapes.filter((s: any) => {
          if (!s.parentId) return true // Missing parentId

          // Check if it's a page reference
          if (s.parentId.startsWith('page:')) {
            // Only invalid if the page doesn't exist
            return !allPages.find((p: any) => p.id === s.parentId)
          }

          // Check if it's a shape reference (frame, group, etc.)
          if (s.parentId.startsWith('shape:')) {
            // Check if the parent shape exists in the store
            const parentShape = storeShapes.find((shape: any) => shape.id === s.parentId)
            return !parentShape // Invalid if parent shape doesn't exist
          }

          // Any other format is invalid
          return true
        })
        if (shapesWithInvalidParent.length > 0) {
          console.warn(`📊 Board: ${shapesWithInvalidParent.length} shapes have truly invalid or missing parentId. Fixing...`)
          // Fix shapes with invalid parentId by assigning them to current page
          // CRITICAL: Preserve x and y coordinates when fixing parentId
          // This prevents coordinates from being reset when patches come back from Automerge
          const fixedShapes = shapesWithInvalidParent.map((s: any): TLRecord => {
            // Get the shape from store to ensure we have all properties
            if (!store.store) {
              // Fallback if store not available
              const fallbackX = (s.x !== undefined && typeof s.x === 'number' && !isNaN(s.x)) ? s.x : 0
              const fallbackY = (s.y !== undefined && typeof s.y === 'number' && !isNaN(s.y)) ? s.y : 0
              return { ...s, parentId: currentPageId, x: fallbackX, y: fallbackY } as TLRecord
            }
            
            const shapeFromStore = store.store.get(s.id)
            if (shapeFromStore && shapeFromStore.typeName === 'shape') {
              // CRITICAL: Get coordinates from store's current state (most reliable)
              // This ensures we preserve coordinates even if the shape object has been modified
              const storeX = (shapeFromStore as any).x
              const storeY = (shapeFromStore as any).y
              const originalX = (typeof storeX === 'number' && !isNaN(storeX) && storeX !== null && storeX !== undefined) 
                ? storeX 
                : (s.x !== undefined && typeof s.x === 'number' && !isNaN(s.x) ? s.x : 0)
              const originalY = (typeof storeY === 'number' && !isNaN(storeY) && storeY !== null && storeY !== undefined)
                ? storeY
                : (s.y !== undefined && typeof s.y === 'number' && !isNaN(s.y) ? s.y : 0)
              
              // Create fixed shape with preserved coordinates
              const fixed: any = { ...shapeFromStore, parentId: currentPageId }
              // CRITICAL: Always preserve coordinates - never reset to 0,0 unless truly missing
              fixed.x = originalX
              fixed.y = originalY
              return fixed as TLRecord
            }
            // Fallback if shape not in store - preserve coordinates from s
            const fallbackX = (s.x !== undefined && typeof s.x === 'number' && !isNaN(s.x)) ? s.x : 0
            const fallbackY = (s.y !== undefined && typeof s.y === 'number' && !isNaN(s.y)) ? s.y : 0
            return { ...s, parentId: currentPageId, x: fallbackX, y: fallbackY } as TLRecord
          })
          try {
            // CRITICAL: Use mergeRemoteChanges to prevent feedback loop
            // This marks the changes as remote, preventing them from triggering another sync
            if (store.store) {
              store.store.mergeRemoteChanges(() => {
                if (store.store) {
                  store.store.put(fixedShapes)
                }
              })
            }
            console.log(`📊 Board: Fixed ${fixedShapes.length} shapes by assigning them to current page ${currentPageId} (coordinates preserved)`)
          } catch (error) {
            console.error(`📊 Board: Error fixing shapes with invalid parentId:`, error)
          }
        }
        
        // Find the page with the most shapes
        let maxShapes = 0
        let pageWithMostShapes: string | null = null
        pageShapeCounts.forEach((count, pageId) => {
          if (count > maxShapes) {
            maxShapes = count
            pageWithMostShapes = pageId
          }
        })
        
        // If current page has no shapes but another page does, switch to that page
        if (editorShapes.length === 0 && pageWithMostShapes && pageWithMostShapes !== currentPageId) {
          console.log(`📊 Board: Current page has no shapes. Switching to page ${pageWithMostShapes} which has ${maxShapes} shapes`)
          try {
            editor.setCurrentPage(pageWithMostShapes as any)
            // Focus camera on shapes after switching
            setTimeout(() => {
              const newPageShapes = editor.getCurrentPageShapes()
              console.log(`📊 Board: After page switch, editor sees ${newPageShapes.length} shapes on page ${pageWithMostShapes}`)
              if (newPageShapes.length > 0) {
                const bounds = editor.getShapePageBounds(newPageShapes[0])
                if (bounds) {
                  editor.setCamera({
                    x: bounds.x - editor.getViewportPageBounds().w / 2 + bounds.w / 2,
                    y: bounds.y - editor.getViewportPageBounds().h / 2 + bounds.h / 2,
                    z: editor.getCamera().z
                  }, { animation: { duration: 300 } })
                }
              } else {
                // Still no shapes after switching - might be a validation issue
                console.warn(`📊 Board: After switching to page ${pageWithMostShapes}, still no shapes visible. Checking store...`)
                const shapesOnNewPage = storeShapes.filter((s: any) => s.parentId === pageWithMostShapes)
                console.log(`📊 Board: Store has ${shapesOnNewPage.length} shapes on page ${pageWithMostShapes}`)
                if (shapesOnNewPage.length > 0) {
                  // Try to manually add shapes that might have validation issues
                  console.log(`📊 Board: Attempting to force visibility by selecting all shapes on page`)
                    const shapeIds = shapesOnNewPage.map((s: any) => s.id as TLShapeId).filter((id): id is TLShapeId => id !== undefined)
                    if (shapeIds.length > 0) {
                      // Try to get shapes from editor to see if they exist
                      const existingShapes = shapeIds
                        .map((id: TLShapeId) => editor.getShape(id))
                        .filter((s): s is NonNullable<typeof s> => s !== undefined)
                    console.log(`📊 Board: ${existingShapes.length} of ${shapeIds.length} shapes exist in editor`)
                      if (existingShapes.length > 0) {
                        editor.setSelectedShapes(existingShapes.map((s: any) => s.id))
                        editor.zoomToFit()
                      }
                  }
                }
              }
            }, 100)
          } catch (error) {
            console.error(`❌ Board: Error switching to page ${pageWithMostShapes}:`, error)
          }
        } else if (pageWithMostShapes) {
          console.log(`📊 Board: Page breakdown:`, Array.from(pageShapeCounts.entries()).map(([pageId, count]) => ({
            pageId,
            shapeCount: count,
            isCurrent: pageId === currentPageId
          })))
        }
      }
    }
    
    // REMOVED: Recurring checks that were causing coordinate resets
    // Only do initial check once after shapes are loaded
    // The recurring checks were triggering store.put operations that caused
    // coordinates to reset when patches came back from Automerge
    
    // Single check after shapes are loaded (give time for initial load)
    // This is the only time we'll fix missing shapes - no recurring checks
    const initialCheckTimeout = setTimeout(() => {
      checkAndFixMissingShapes()
    }, 3000) // Wait 3 seconds for initial load to complete
    
    return () => {
      clearTimeout(initialCheckTimeout)
    }
  }, [editor, store.store, store.status])

  // Update presence when session changes
  useEffect(() => {
    if (!editor || !session.authed || !session.username) return
    
    // The presence should automatically update through the useAutomergeSync configuration
    // when the session changes, but we can also try to force an update
  }, [editor, session.authed, session.username])

  // Update TLDraw user preferences when editor is available and user is authenticated
  useEffect(() => {
    if (!editor) return
    
    try {
      if (session.authed && session.username) {
        // Update the user preferences in TLDraw
        editor.user.updateUserPreferences({
          id: session.username,
          name: session.username,
        });
      } else {
        // Set default user preferences when not authenticated
        editor.user.updateUserPreferences({
          id: 'user-1',
          name: 'User 1',
        });
      }
    } catch (error) {
      console.error('Error updating TLDraw user preferences from Board component:', error);
    }

    // Cleanup function to reset preferences when user logs out
    return () => {
      if (editor) {
        try {
          editor.user.updateUserPreferences({
            id: 'user-1',
            name: 'User 1',
          });
        } catch (error) {
          console.error('Error resetting TLDraw user preferences:', error);
        }
      }
    };
  }, [editor, session.authed, session.username]);

  // Track board visit for starred boards
  useEffect(() => {
    if (session.authed && session.username && roomId) {
      updateLastVisited(session.username, roomId);
    }
  }, [session.authed, session.username, roomId]);

  // Capture screenshots when board content changes
  useEffect(() => {
    if (!editor || !roomId || !store.store) return;

    let lastContentHash = '';
    let timeoutId: NodeJS.Timeout;

    const captureScreenshot = async () => {
      const currentShapes = editor.getCurrentPageShapes();
      const currentContentHash = currentShapes.length > 0 
        ? currentShapes.map(shape => `${shape.id}-${shape.type}`).sort().join('|')
        : '';

      // Only capture if content actually changed
      if (currentContentHash !== lastContentHash) {
        lastContentHash = currentContentHash;
        await captureBoardScreenshot(editor, roomId);
      }
    };

    // Listen to store changes instead of using getSnapshot() in dependencies
    const unsubscribe = store.store.listen(() => {
      // Clear existing timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Set new timeout for debounced screenshot capture
      timeoutId = setTimeout(captureScreenshot, 3000);
    }, { source: "user", scope: "document" });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editor, roomId, store.store]);

  // TLDraw has built-in undo/redo that works with the store
  // No need for custom undo/redo manager - TLDraw handles it automatically

  // Handle keyboard shortcuts for undo (Ctrl+Z) and redo (Ctrl+Y)
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the event target or active element is an input field or textarea
      const target = event.target as HTMLElement;
      const activeElement = document.activeElement;
      const isInputFocused = (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target instanceof HTMLElement && target.isContentEditable)
      )) || (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ));

      // Handle Ctrl+Z (Undo) - use TLDraw's built-in undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        // If an input is focused, let it handle Ctrl+Z (don't prevent default)
        if (isInputFocused) {
          return;
        }

        if (editor) {
          event.preventDefault();
          event.stopPropagation();
          editor.undo();
        }
        return;
      }

      // Handle Ctrl+Y (Redo) or Ctrl+Shift+Z (Redo on some systems) - use TLDraw's built-in redo
      if (
        ((event.ctrlKey || event.metaKey) && event.key === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey)
      ) {
        // If an input is focused, let it handle Ctrl+Y (don't prevent default)
        if (isInputFocused) {
          return;
        }

        if (editor) {
          event.preventDefault();
          event.stopPropagation();
          editor.redo();
        }
        return;
      }

      // Handle Escape key to cancel active tool and return to hand tool
      // Also prevent Escape from deleting shapes, especially browser shapes
      if (event.key === 'Escape') {
        // If an input is focused, let it handle Escape (don't prevent default)
        if (isInputFocused) {
          return;
        }

        // Check if any selected shapes are browser shapes that should not be deleted
        const selectedShapes = editor.getSelectedShapes();
        const hasBrowserShape = selectedShapes.some(shape => 
          shape.type === 'ObsidianBrowser' || 
          shape.type === 'HolonBrowser' || 
          shape.type === 'FathomMeetingsBrowser'
        );

        // Prevent deletion of browser shapes with Escape
        if (hasBrowserShape) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        // Otherwise, prevent default to stop tldraw from deleting shapes
        // and switch to hand tool
        event.preventDefault();
        event.stopPropagation();
        
        const currentTool = editor.getCurrentToolId();
        // Only switch if we're not already on the hand tool
        if (currentTool !== 'hand') {
          editor.setCurrentTool('hand');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase to intercept early
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editor, automergeHandle]);

  // Only render Tldraw when store is ready and synced
  // Tldraw will automatically render shapes as they're added via patches (like in dev)
  const hasStore = !!store.store
  const isSynced = store.status === 'synced-remote'
  
  // Render as soon as store is synced - shapes will load via patches
  // This matches dev behavior where Tldraw mounts first, then shapes load
  const shouldRender = hasStore && isSynced
  
  if (!shouldRender) {
    return (
      <AutomergeHandleProvider handle={automergeHandle}>
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div>Loading canvas...</div>
        </div>
      </AutomergeHandleProvider>
    )
  }

  return (
    <AutomergeHandleProvider handle={automergeHandle}>
      <div style={{ position: "fixed", inset: 0 }}>
        <Tldraw
        store={store.store}
        user={user}
        shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
        tools={customTools}
        components={components}
        overrides={{
          ...overrides,
          actions: (editor, actions, helpers) => {
            const customActions = overrides.actions?.(editor, actions, helpers) ?? {}
            return {
              ...actions,
              ...customActions,
            }
          }
        }}
        cameraOptions={{
          zoomSteps: [
            0.001, // Min zoom
            0.0025,
            0.005,
            0.01,
            0.025,
            0.05,
            0.1,
            0.25,
            0.5,
            1,
            2,
            4,
            8,
            16,
            32,
            64, // Max zoom
          ],
        }}
 onMount={(editor) => {
          setEditor(editor)
          editor.registerExternalAssetHandler("url", unfurlBookmarkUrl)
          editor.setCurrentTool("hand")
          setInitialCameraFromUrl(editor)
          handleInitialPageLoad(editor)
          registerPropagators(editor, [
            TickPropagator,
            ChangePropagator,
            ClickPropagator,
          ])

          // Clean up corrupted shapes that cause "No nearest point found" errors
          // This typically happens with draw/line shapes that have no points
          try {
            const allShapes = editor.getCurrentPageShapes()
            const corruptedShapeIds: TLShapeId[] = []

            for (const shape of allShapes) {
              // Check draw and line shapes for missing/empty segments
              if (shape.type === 'draw' || shape.type === 'line') {
                const props = shape.props as any
                // Draw shapes need segments with points
                if (shape.type === 'draw') {
                  if (!props.segments || props.segments.length === 0) {
                    corruptedShapeIds.push(shape.id)
                    continue
                  }
                  // Check if all segments have no points
                  const hasPoints = props.segments.some((seg: any) => seg.points && seg.points.length > 0)
                  if (!hasPoints) {
                    corruptedShapeIds.push(shape.id)
                  }
                }
                // Line shapes need points
                if (shape.type === 'line') {
                  if (!props.points || Object.keys(props.points).length === 0) {
                    corruptedShapeIds.push(shape.id)
                  }
                }
              }
            }

            if (corruptedShapeIds.length > 0) {
              console.warn(`🧹 Removing ${corruptedShapeIds.length} corrupted shapes (draw/line with no points)`)
              editor.deleteShapes(corruptedShapeIds)
            }
          } catch (error) {
            console.error('Error cleaning up corrupted shapes:', error)
          }
          
          // Set user preferences immediately if user is authenticated
          if (session.authed && session.username) {
            try {
              editor.user.updateUserPreferences({
                id: session.username,
                name: session.username,
              });
            } catch (error) {
              console.error('Error setting initial TLDraw user preferences:', error);
            }
          } else {
            // Set default user preferences when not authenticated
            try {
              editor.user.updateUserPreferences({
                id: 'user-1',
                name: 'User 1',
              });
            } catch (error) {
              console.error('Error setting default TLDraw user preferences:', error);
            }
          }
          initializeGlobalCollections(editor, collections)
          // Note: User presence is configured through the useAutomergeSync hook above
          // The authenticated username should appear in the people section
          // MycelialIntelligence is now a permanent UI bar - no shape creation needed
        }}
        >
          <CmdK />
        </Tldraw>
      </div>
    </AutomergeHandleProvider>
  )
}