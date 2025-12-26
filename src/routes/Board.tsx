import { useAutomergeSync } from "@/automerge/useAutomergeSync"
import { AutomergeHandleProvider } from "@/context/AutomergeHandleContext"
import { useMemo, useEffect, useState, useRef } from "react"
import { Tldraw, Editor, TLShapeId, TLRecord, useTldrawUser, TLUserPreferences, IndexKey } from "tldraw"
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
import { defaultShapeUtils, defaultBindingUtils, defaultShapeTools } from "tldraw"
import { components } from "@/ui/components"
import { overrides } from "@/ui/overrides"
import { unfurlBookmarkUrl } from "../utils/unfurlBookmarkUrl"
import { handleInitialPageLoad } from "@/utils/handleInitialPageLoad"
import { MycrozineTemplateTool } from "@/tools/MycrozineTemplateTool"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { MycroZineGeneratorTool } from "@/tools/MycroZineGeneratorTool"
import { MycroZineGeneratorShape } from "@/shapes/MycroZineGeneratorShapeUtil"
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
import { FathomNoteShape } from "@/shapes/FathomNoteShapeUtil"
import { ImageGenShape } from "@/shapes/ImageGenShapeUtil"
import { ImageGenTool } from "@/tools/ImageGenTool"
import { VideoGenShape } from "@/shapes/VideoGenShapeUtil"
import { VideoGenTool } from "@/tools/VideoGenTool"
// Drawfast - dev only
import { DrawfastShape } from "@/shapes/DrawfastShapeUtil"
import { DrawfastTool } from "@/tools/DrawfastTool"

// Feature flags - disable experimental features in production
const IS_PRODUCTION = import.meta.env.PROD
const ENABLE_WORKFLOW = !IS_PRODUCTION // Workflow blocks - dev only
const ENABLE_CALENDAR = !IS_PRODUCTION // Calendar - dev only
const ENABLE_DRAWFAST = !IS_PRODUCTION // Drawfast - dev only
import { LiveImageProvider } from "@/hooks/useLiveImage"
import { MultmuxTool } from "@/tools/MultmuxTool"
import { MultmuxShape } from "@/shapes/MultmuxShapeUtil"
// MycelialIntelligence moved to permanent UI bar - shape kept for backwards compatibility
import { MycelialIntelligenceShape } from "@/shapes/MycelialIntelligenceShapeUtil"
// Private Workspace for Google Export data sovereignty
import { PrivateWorkspaceShape } from "@/shapes/PrivateWorkspaceShapeUtil"
import { PrivateWorkspaceTool } from "@/tools/PrivateWorkspaceTool"
import { PrivateWorkspaceManager } from "@/components/PrivateWorkspaceManager"
import { VisibilityChangeManager } from "@/components/VisibilityChangeManager"
import { GoogleItemShape } from "@/shapes/GoogleItemShapeUtil"
import { GoogleItemTool } from "@/tools/GoogleItemTool"
// Open Mapping - OSM map shape for geographic visualization
import { MapShape } from "@/shapes/MapShapeUtil"
import { MapTool } from "@/tools/MapTool"
// Workflow Builder - Flowy-like workflow blocks
import { WorkflowBlockShape } from "@/shapes/WorkflowBlockShapeUtil"
import { WorkflowBlockTool } from "@/tools/WorkflowBlockTool"
// Calendar - Unified calendar with view switching (browser, widget, year)
import { CalendarShape } from "@/shapes/CalendarShapeUtil"
import { CalendarTool } from "@/tools/CalendarTool"
import { CalendarEventShape } from "@/shapes/CalendarEventShapeUtil"
// Workflow propagator for real-time data flow
import { registerWorkflowPropagator } from "@/propagators/WorkflowPropagator"
import { setupBlockExecutionListener } from "@/lib/workflow/executor"
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
import { setupMultiPasteHandler } from "@/utils/multiPasteHandler"
import AnonymousViewerBanner from "@/components/auth/AnonymousViewerBanner"
import { ConnectionProvider } from "@/context/ConnectionContext"
import { PermissionLevel } from "@/lib/auth/types"
import "@/css/anonymous-banner.css"

import "react-cmdk/dist/cmdk.css"
import "@/css/style.css"
import "@/css/obsidian-browser.css"
// import "@/css/workflow.css" // TODO: Fix TypeScript errors in workflow files before re-enabling

// Helper to validate and fix tldraw IndexKey format
// tldraw uses fractional indexing where the first letter encodes integer part length:
// - 'a' = 1-digit integer (a0-a9), 'b' = 2-digit (b10-b99), 'c' = 3-digit (c100-c999), etc.
// - Optional fractional part can follow (a1V, a1V4rr, etc.)
// Common invalid formats from old data: "b1" (b expects 2 digits but has 1)
function sanitizeIndex(index: any): IndexKey {
  if (!index || typeof index !== 'string' || index.length === 0) {
    return 'a1' as IndexKey
  }

  // Must start with a letter
  if (!/^[a-zA-Z]/.test(index)) {
    return 'a1' as IndexKey
  }

  // Check fractional indexing rules for lowercase prefixes
  const prefix = index[0]
  const rest = index.slice(1)

  if (prefix >= 'a' && prefix <= 'z') {
    // Calculate expected minimum digit count: a=1, b=2, c=3, etc.
    const expectedDigits = prefix.charCodeAt(0) - 'a'.charCodeAt(0) + 1

    // Extract the integer part (leading digits)
    const integerMatch = rest.match(/^(\d+)/)
    if (!integerMatch) {
      // No digits at all - invalid
      return 'a1' as IndexKey
    }

    const integerPart = integerMatch[1]

    // Check if integer part has correct number of digits for the prefix
    if (integerPart.length < expectedDigits) {
      // Invalid: "b1" has b (expects 2 digits) but only has 1 digit
      // Convert to safe format
      return 'a1' as IndexKey
    }
  }

  // Check overall format: letter followed by alphanumeric
  if (/^[a-zA-Z][a-zA-Z0-9]+$/.test(index)) {
    return index as IndexKey
  }

  return 'a1' as IndexKey
}

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
  MycroZineGeneratorShape,
  MarkdownShape,
  PromptShape,
  ObsNoteShape,
  TranscriptionShape,
  HolonShape,
  HolonBrowserShape,
  ObsidianBrowserShape,
  FathomMeetingsBrowserShape,
  FathomNoteShape, // Individual Fathom meeting notes created from FathomMeetingsBrowser
  ImageGenShape,
  VideoGenShape,
  ...(ENABLE_DRAWFAST ? [DrawfastShape] : []), // Drawfast - dev only
  MultmuxShape,
  MycelialIntelligenceShape, // AI-powered collaborative intelligence shape
  PrivateWorkspaceShape, // Private zone for Google Export data sovereignty
  GoogleItemShape, // Individual items from Google Export with privacy badges
  MapShape, // Open Mapping - OSM map shape
  // Conditionally included based on feature flags:
  ...(ENABLE_WORKFLOW ? [WorkflowBlockShape] : []), // Workflow Builder - dev only
  ...(ENABLE_CALENDAR ? [CalendarShape, CalendarEventShape] : []), // Calendar - dev only
]
const customTools = [
  ChatBoxTool,
  VideoChatTool,
  EmbedTool,
  SlideShapeTool,
  MycrozineTemplateTool,
  MycroZineGeneratorTool,
  MarkdownTool,
  PromptShapeTool,
  GestureTool,
  ObsNoteTool,
  TranscriptionTool,
  HolonTool,
  FathomMeetingsTool,
  ImageGenTool,
  VideoGenTool,
  ...(ENABLE_DRAWFAST ? [DrawfastTool] : []), // Drawfast - dev only
  MultmuxTool,
  PrivateWorkspaceTool,
  GoogleItemTool,
  MapTool, // Open Mapping - OSM map tool
  // Conditionally included based on feature flags:
  ...(ENABLE_WORKFLOW ? [WorkflowBlockTool] : []), // Workflow Builder - dev only
  ...(ENABLE_CALENDAR ? [CalendarTool] : []), // Calendar - dev only
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
  const { session, fetchBoardPermission, canEdit } = useAuth()

  // Permission state
  const [permission, setPermission] = useState<PermissionLevel | null>(null)
  const [permissionLoading, setPermissionLoading] = useState(true)
  const [showEditPrompt, setShowEditPrompt] = useState(false)

  // Track previous auth state to detect transitions (fixes React timing issue)
  // Effects run AFTER render, but we need to know if auth JUST changed during this render
  const prevAuthRef = useRef(session.authed)
  const authJustChanged = prevAuthRef.current !== session.authed

  // Counter to force Tldraw remount on every auth change
  // This guarantees a fresh tldraw instance with correct read-only state
  const [authChangeCount, setAuthChangeCount] = useState(0)

  // Reset permission state when auth changes (ensures fresh fetch on login/logout)
  useEffect(() => {
    // Update the ref after render
    prevAuthRef.current = session.authed
    // Increment counter to force tldraw remount
    setAuthChangeCount(c => c + 1)
    // When auth state changes, reset permission to trigger fresh fetch
    setPermission(null)
    setPermissionLoading(true)
  }, [session.authed])

  // Fetch permission when board loads or auth changes
  useEffect(() => {
    let mounted = true

    const loadPermission = async () => {
      setPermissionLoading(true)
      try {
        const perm = await fetchBoardPermission(roomId)
        if (mounted) {
          setPermission(perm)
        }
      } catch (error) {
        console.error('Failed to fetch permission:', error)
        // NEW: Default to 'edit' for everyone (open by default)
        if (mounted) {
          setPermission('edit')
        }
      } finally {
        if (mounted) {
          setPermissionLoading(false)
        }
      }
    }

    loadPermission()

    return () => {
      mounted = false
    }
  }, [roomId, fetchBoardPermission, session.authed])

  // Check if user can edit
  // NEW PERMISSION MODEL (Dec 2024):
  // - Everyone (including anonymous) can EDIT by default
  // - Only protected boards restrict editing to listed editors
  // - Permission 'view' means the board is protected and user is not an editor
  //
  // CRITICAL: Don't restrict in these cases:
  // 1. Auth/permission is loading
  // 2. Auth just changed (React effects haven't run yet, permission state is stale)
  // This prevents users from briefly seeing read-only mode which hides
  // default tools (only tools with readonlyOk: true show in read-only mode)
  const isReadOnly = (
    session.loading ||
    authJustChanged ||  // Auth just changed, permission is stale
    permissionLoading
  )
    ? false  // Don't restrict while loading/transitioning - assume can edit
    : permission === 'view'  // Only restrict if explicitly view (protected board)

  // Handler for when user tries to edit in read-only mode
  const handleEditAttempt = () => {
    if (isReadOnly) {
      setShowEditPrompt(true)
    }
  }

  // Handler for successful authentication from banner
  // NOTE: We don't call fetchBoardPermission here because:
  // 1. This callback captures the OLD fetchBoardPermission from before re-render
  // 2. The useEffect watching session.authed already handles re-fetching
  // 3. That useEffect will run AFTER React re-renders with the new (cache-cleared) callback
  const handleAuthenticated = () => {
    setShowEditPrompt(false)
    // Force permission state reset - the useEffect will fetch fresh permissions
    setPermission(null)
    setPermissionLoading(true)
  }

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
  // Color is based on session.username (CryptID) for consistency across sessions
  // uniqueUserId is used for tldraw's presence system (allows multiple tabs)
  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>(() => ({
    id: uniqueUserId || 'anonymous',
    name: session.username || 'Anonymous',
    // Use session.username for color (not uniqueUserId) so color is consistent across all browser sessions
    color: session.username ? generateUserColor(session.username) : (uniqueUserId ? generateUserColor(uniqueUserId) : '#000000'),
    colorScheme: getColorScheme(),
  }))

  // Update user preferences when session changes (handles both login and logout)
  useEffect(() => {
    if (session.authed && uniqueUserId) {
      // Authenticated user - use their unique ID and username
      setUserPreferences({
        id: uniqueUserId,
        name: session.username || 'Anonymous',
        color: session.username ? generateUserColor(session.username) : generateUserColor(uniqueUserId),
        colorScheme: getColorScheme(),
      })
    } else {
      // Not authenticated - reset to anonymous with fresh ID
      const anonymousId = `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      setUserPreferences({
        id: anonymousId,
        name: 'Anonymous',
        color: '#6b7280', // Gray for anonymous
        colorScheme: getColorScheme(),
      })
    }
  }, [uniqueUserId, session.username, session.authed])

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
    error: storeWithHandle.error
  }
  const automergeHandle = (storeWithHandle as any).handle
  const { connectionState, isNetworkOnline } = storeWithHandle
  const [editor, setEditor] = useState<Editor | null>(null)

  // Update read-only state when permission changes after editor is mounted
  useEffect(() => {
    if (!editor) return

    if (isReadOnly) {
      editor.updateInstanceState({ isReadonly: true })
    } else {
      editor.updateInstanceState({ isReadonly: false })
    }
  }, [editor, isReadOnly])

  // Listen for session-logged-in event to immediately enable editing
  // This handles the case where the React state update might be delayed
  useEffect(() => {
    if (!editor) return

    const handleSessionLoggedIn = (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;

      // Immediately enable editing - user just logged in
      editor.updateInstanceState({ isReadonly: false });

      // Switch to select tool to ensure tools are available
      editor.setCurrentTool('select');

    };

    window.addEventListener('session-logged-in', handleSessionLoggedIn);
    return () => window.removeEventListener('session-logged-in', handleSessionLoggedIn);
  }, [editor])

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
              // CRITICAL: Sanitize index to prevent validation errors
              return { ...s, parentId: currentPageId, x: fallbackX, y: fallbackY, index: sanitizeIndex(s.index) } as TLRecord
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

              // Create fixed shape with preserved coordinates and sanitized index
              const fixed: any = { ...shapeFromStore, parentId: currentPageId }
              // CRITICAL: Always preserve coordinates - never reset to 0,0 unless truly missing
              fixed.x = originalX
              fixed.y = originalY
              // CRITICAL: Sanitize index to prevent "Expected an index key" validation errors
              fixed.index = sanitizeIndex(fixed.index)
              return fixed as TLRecord
            }
            // Fallback if shape not in store - preserve coordinates from s
            const fallbackX = (s.x !== undefined && typeof s.x === 'number' && !isNaN(s.x)) ? s.x : 0
            const fallbackY = (s.y !== undefined && typeof s.y === 'number' && !isNaN(s.y)) ? s.y : 0
            // CRITICAL: Sanitize index to prevent validation errors
            return { ...s, parentId: currentPageId, x: fallbackX, y: fallbackY, index: sanitizeIndex(s.index) } as TLRecord
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
          try {
            editor.setCurrentPage(pageWithMostShapes as any)
            // Focus camera on shapes after switching
            setTimeout(() => {
              const newPageShapes = editor.getCurrentPageShapes()
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
                if (shapesOnNewPage.length > 0) {
                  // Try to manually add shapes that might have validation issues
                    const shapeIds = shapesOnNewPage.map((s: any) => s.id as TLShapeId).filter((id): id is TLShapeId => id !== undefined)
                    if (shapeIds.length > 0) {
                      // Try to get shapes from editor to see if they exist
                      const existingShapes = shapeIds
                        .map((id: TLShapeId) => editor.getShape(id))
                        .filter((s): s is NonNullable<typeof s> => s !== undefined)
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

  // Update presence when session changes and clean up stale presences
  useEffect(() => {
    if (!editor) return

    const cleanupStalePresences = (forceCleanAll = false) => {
      try {
        const allRecords = editor.store.allRecords()
        const presenceRecords = allRecords.filter((r: any) =>
          r.typeName === 'instance_presence' ||
          r.id?.startsWith('instance_presence:')
        )

        if (presenceRecords.length > 0) {
          if (forceCleanAll) {
            // On logout/auth change, remove ALL presence records except our current one
            // This prevents double-registration issues
            const currentUserId = uniqueUserId || userPreferences.id
            const presencesToRemove = presenceRecords.filter((r: any) => {
              // Remove presences that don't match our current identity
              const presenceUserId = r.userId || r.id?.split(':')[1]
              return presenceUserId !== currentUserId
            })

            if (presencesToRemove.length > 0) {
              editor.store.remove(presencesToRemove.map((r: any) => r.id))
            }
          } else {
            // Filter out stale presences (older than 30 seconds)
            const now = Date.now()
            const staleThreshold = 30 * 1000 // 30 seconds
            const stalePresences = presenceRecords.filter((r: any) =>
              r.lastActivityTimestamp && (now - r.lastActivityTimestamp > staleThreshold)
            )

            if (stalePresences.length > 0) {
              editor.store.remove(stalePresences.map((r: any) => r.id))
            }
          }
        }
      } catch (error) {
        console.error('Error cleaning up stale presences:', error)
      }
    }

    // Clean up ALL non-current presences on auth change to prevent double-registration
    cleanupStalePresences(true)

    // Also run periodic cleanup every 15 seconds (only stale ones)
    const cleanupInterval = setInterval(() => cleanupStalePresences(false), 15000)

    // Listen for session-cleared event to clean up ONLY the current user's presence
    // We keep the same tldraw user ID across login/logout, so we only need to remove
    // this user's presence when they log out (they'll get a fresh one on login)
    const handleSessionCleared = (event: Event) => {
      const customEvent = event as CustomEvent<{ previousUsername: string }>;
      const previousUsername = customEvent.detail?.previousUsername;

      if (!previousUsername) {
        return
      }

      try {
        // Get the tldraw user ID for the user who just logged out
        const storageKey = `tldraw-user-id-${previousUsername}`;
        const previousUserId = localStorage.getItem(storageKey);

        if (!previousUserId) {
          return
        }

        const allRecords = editor.store.allRecords()
        const presenceRecords = allRecords.filter((r: any) =>
          r.typeName === 'instance_presence' ||
          r.id?.startsWith('instance_presence:')
        )

        // Only remove presence records that belong to the user who just logged out
        const userPresences = presenceRecords.filter((r: any) => {
          const presenceUserId = r.userId || r.id?.split(':')[1]
          return presenceUserId === previousUserId || r.userName === previousUsername
        })

        if (userPresences.length > 0) {
          editor.store.remove(userPresences.map((r: any) => r.id))
        }
      } catch (error) {
        console.error('Error cleaning presences on session clear:', error)
      }
    }

    window.addEventListener('session-cleared', handleSessionCleared)

    return () => {
      clearInterval(cleanupInterval)
      window.removeEventListener('session-cleared', handleSessionCleared)
    }
  }, [editor, session.authed, session.username, uniqueUserId, userPreferences.id])

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
    let idleCallbackId: number | null = null;

    const captureScreenshot = async () => {
      // Don't capture if user is actively drawing (pointer is down)
      // This prevents interrupting continuous drawing operations
      const inputs = editor.inputs;
      if (inputs.isPointing || inputs.isDragging) {
        // Reschedule for later when user stops drawing
        timeoutId = setTimeout(captureScreenshot, 2000);
        return;
      }

      const currentShapes = editor.getCurrentPageShapes();
      const currentContentHash = currentShapes.length > 0
        ? currentShapes.map(shape => `${shape.id}-${shape.type}`).sort().join('|')
        : '';

      // Only capture if content actually changed
      if (currentContentHash !== lastContentHash) {
        lastContentHash = currentContentHash;

        // Use requestIdleCallback to run during browser idle time
        // This prevents blocking the main thread during user interactions
        const doCapture = () => {
          captureBoardScreenshot(editor, roomId);
        };

        if ('requestIdleCallback' in window) {
          idleCallbackId = requestIdleCallback(doCapture, { timeout: 5000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(doCapture, 100);
        }
      }
    };

    // Listen to store changes instead of using getSnapshot() in dependencies
    const unsubscribe = store.store.listen(() => {
      // Clear existing timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Set new timeout for debounced screenshot capture (5 seconds instead of 3)
      // Longer debounce gives users more time for continuous operations
      timeoutId = setTimeout(captureScreenshot, 5000);
    }, { source: "user", scope: "document" });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
      if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
        cancelIdleCallback(idleCallbackId);
      }
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

  // Set up multi-paste handler to support pasting multiple images/URLs at once
  useEffect(() => {
    if (!editor) return;

    const cleanup = setupMultiPasteHandler(editor);
    return cleanup;
  }, [editor]);

  // Only render Tldraw when store is ready and synced
  // Tldraw will automatically render shapes as they're added via patches (like in dev)
  const hasStore = !!store.store
  const isSynced = store.status === 'synced-remote'

  // OFFLINE SUPPORT: Also render when we have local data but no network
  // This allows users to view their board even when offline
  const isOfflineWithLocalData = !isNetworkOnline && hasStore && store.status !== 'error'

  // Render as soon as store is synced OR we're offline with local data
  // This matches dev behavior where Tldraw mounts first, then shapes load
  const shouldRender = hasStore && (isSynced || isOfflineWithLocalData)

  if (!shouldRender) {
    return (
      <AutomergeHandleProvider handle={automergeHandle}>
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div>{!isNetworkOnline ? 'Loading offline data...' : 'Loading canvas...'}</div>
        </div>
      </AutomergeHandleProvider>
    )
  }

  return (
    <AutomergeHandleProvider handle={automergeHandle}>
      <ConnectionProvider connectionState={connectionState} isNetworkOnline={isNetworkOnline}>
        <LiveImageProvider>
        <div style={{ position: "fixed", inset: 0 }}>
          <Tldraw
          key={`tldraw-${authChangeCount}-${session.authed ? 'authed' : 'anon'}-${session.username || 'guest'}`}
          store={store.store}
          user={user}
          shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
          tools={[...defaultShapeTools, ...customTools]}
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

            // Register workflow propagator for real-time data flow
            const cleanupWorkflowPropagator = registerWorkflowPropagator(editor)
            const cleanupBlockExecution = setupBlockExecutionListener(editor)

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

            // Set read-only mode based on auth state
            // IMPORTANT: Check localStorage directly to avoid stale closure issues
            // The React state (session.authed) might be stale in this callback due to
            // the complex timing of remounts triggered by auth changes
            const checkAuthFromStorage = (): boolean => {
              try {
                const stored = localStorage.getItem('canvas_auth_session');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  return parsed.authed === true && !!parsed.username;
                }
              } catch {
                // Ignore parse errors
              }
              return false;
            };

            const isAuthenticated = checkAuthFromStorage();
            const initialReadOnly = !isAuthenticated;
            editor.updateInstanceState({ isReadonly: initialReadOnly })

            // Also ensure the current tool is appropriate for the mode
            if (!initialReadOnly) {
              // If editable, make sure we can use tools - set to select tool which is always available
              editor.setCurrentTool('select')
            }
          }}
          >
            <CmdK />
            <PrivateWorkspaceManager />
            <VisibilityChangeManager />
          </Tldraw>
          {/* Anonymous viewer banner - REMOVED: Anonymous users can now edit freely
          {!session.loading && (!session.authed || showEditPrompt) && (
            <AnonymousViewerBanner
              onAuthenticated={handleAuthenticated}
              triggeredByEdit={showEditPrompt}
            />
          )}
          */}
        </div>
        </LiveImageProvider>
      </ConnectionProvider>
    </AutomergeHandleProvider>
  )
}