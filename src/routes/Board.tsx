import { useSync } from "@tldraw/sync"
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
import {
  lockElement,
  unlockElement,
  setInitialCameraFromUrl,
  initLockIndicators,
  watchForLockedShapes,
} from "@/ui/cameraUtils"
import { Collection, initializeGlobalCollections } from "@/collections"
import { GraphLayoutCollection } from "@/graph/GraphLayoutCollection"
import { CmdK } from "@/CmdK"


import "react-cmdk/dist/cmdk.css"
import "@/css/style.css"

const collections: Collection[] = [GraphLayoutCollection]
import { useAuth } from "../context/AuthContext"
import { updateLastVisited } from "../lib/starredBoards"
import { captureBoardScreenshot } from "../lib/screenshotService"

// Automatically switch between production and local dev based on environment
export const WORKER_URL = import.meta.env.DEV 
  ? "http://localhost:5172" 
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
]

export function Board() {
  const { slug } = useParams<{ slug: string }>()
  const roomId = slug || "default-room"
  const { session } = useAuth()

  const storeConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: multiplayerAssetStore,
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: [...defaultBindingUtils],
      // Add user information to the presence system
      user: session.authed ? {
        id: session.username,
        name: session.username,
      } : undefined,
    }),
    [roomId, session.authed, session.username],
  )

  // Using TLdraw sync - fixed version compatibility issue
  const store = useSync(storeConfig)
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
  }, [editor])

  // Update presence when session changes
  useEffect(() => {
    if (!editor || !session.authed || !session.username) return
    
    // The presence should automatically update through the useSync configuration
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
        shapeUtils={customShapeUtils}
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
          // Note: User presence is configured through the useSync hook above
          // The authenticated username should appear in the people section
        }}
      >
        <CmdK />
      </Tldraw>
    </div>
  )
}