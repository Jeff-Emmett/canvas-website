import { useAutomergeSync } from "@/automerge/useAutomergeSync"
import { useMemo, useEffect, useState } from "react"
import { Tldraw, Editor, TLShapeId } from "tldraw"
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
import { SharedPianoTool } from "@/tools/SharedPianoTool"
import { SharedPianoShape } from "@/shapes/SharedPianoShapeUtil"
import { ObsNoteTool } from "@/tools/ObsNoteTool"
import { ObsNoteShape } from "@/shapes/ObsNoteShapeUtil"
import { TranscriptionTool } from "@/tools/TranscriptionTool"
import { TranscriptionShape } from "@/shapes/TranscriptionShapeUtil"
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

// Automatically switch between production and local dev based on environment
// In development, use the same host as the client to support network access
export const WORKER_URL = import.meta.env.DEV 
  ? `http://${window.location.hostname}:5172` 
  : "https://jeffemmett-canvas.jeffemmett.workers.dev"

const customShapeUtils = [
  ChatBoxShape,
  VideoChatShape,
  EmbedShape,
  SlideShape,
  MycrozineTemplateShape,
  MarkdownShape,
  PromptShape,
  SharedPianoShape,
  ObsNoteShape,
  TranscriptionShape,
]
const customTools = [
  ChatBoxTool,
  VideoChatTool,
  EmbedTool,
  SlideShapeTool,
  MycrozineTemplateTool,
  MarkdownTool,
  PromptShapeTool,
  SharedPianoTool,
  GestureTool,
  ObsNoteTool,
  TranscriptionTool,
]

export function Board() {
  const { slug } = useParams<{ slug: string }>()
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

  const storeConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: multiplayerAssetStore,
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: [...defaultBindingUtils],
      user: session.authed ? {
        id: session.username,
        name: session.username,
      } : undefined,
    }),
    [roomId, session.authed, session.username],
  )

  // Use Automerge sync for all environments
  const store = useAutomergeSync(storeConfig)
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

  // Remove the URL-based locking effect and replace with store-based initialization
  useEffect(() => {
    if (!editor) return
    initLockIndicators(editor)
    watchForLockedShapes(editor)
    
    
    
    // Debug: Check what shapes the editor can see
    // Temporarily commented out to fix linting errors
    /*
    if (editor) {
      const editorShapes = editor.getRenderingShapes()
      console.log(`📊 Board: Editor can see ${editorShapes.length} shapes for rendering`)
      
      // Debug: Check all shapes in the store vs what editor can see
      const storeShapes = store.store?.allRecords().filter(r => r.typeName === 'shape') || []
      console.log(`📊 Board: Store has ${storeShapes.length} shapes, editor sees ${editorShapes.length}`)
      
      if (editorShapes.length > 0 && editor) {
        const shape = editor.getShape(editorShapes[0].id)
        console.log("📊 Board: Sample editor shape:", {
          id: editorShapes[0].id,
          type: shape?.type,
          x: shape?.x,
          y: shape?.y
        })
      }
    }
    */
    
    // Debug: Check if there are shapes in store that editor can't see
    // Temporarily commented out to fix linting errors
    /*
    if (storeShapes.length > editorShapes.length) {
      const editorShapeIds = new Set(editorShapes.map(s => s.id))
      const missingShapes = storeShapes.filter(s => !editorShapeIds.has(s.id))
      console.warn(`📊 Board: ${missingShapes.length} shapes in store but not visible to editor:`, missingShapes.map(s => ({
        id: s.id,
        type: s.type,
        x: s.x,
        y: s.y,
        parentId: s.parentId
      })))
      
      // Debug: Check current page and page IDs
      const currentPageId = editor.getCurrentPageId()
      console.log(`📊 Board: Current page ID: ${currentPageId}`)
      
      const pageRecords = store.store?.allRecords().filter(r => r.typeName === 'page') || []
      console.log(`📊 Board: Available pages:`, pageRecords.map(p => ({
        id: p.id,
        name: (p as any).name
      })))
      
      // Check if missing shapes are on a different page
      const shapesOnCurrentPage = missingShapes.filter(s => s.parentId === currentPageId)
      const shapesOnOtherPages = missingShapes.filter(s => s.parentId !== currentPageId)
      console.log(`📊 Board: Missing shapes on current page: ${shapesOnCurrentPage.length}, on other pages: ${shapesOnOtherPages.length}`)
      
      if (shapesOnOtherPages.length > 0) {
        console.log(`📊 Board: Shapes on other pages:`, shapesOnOtherPages.map(s => ({
          id: s.id,
          parentId: s.parentId
        })))
        
        // Fix: Move shapes to the current page
        console.log(`📊 Board: Moving ${shapesOnOtherPages.length} shapes to current page ${currentPageId}`)
        const shapesToMove = shapesOnOtherPages.map(s => ({
          id: s.id,
          type: s.type,
          parentId: currentPageId
        }))
        
        try {
          editor.updateShapes(shapesToMove)
          console.log(`📊 Board: Successfully moved ${shapesToMove.length} shapes to current page`)
        } catch (error) {
          console.error(`📊 Board: Error moving shapes to current page:`, error)
        }
      }
    }
    */
  }, [editor])

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

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store.store}
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
        }}
      >
        <CmdK />
      </Tldraw>
    </div>
  )
}