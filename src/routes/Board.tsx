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
import { llm } from "@/utils/llmUtils"
import {
  lockElement,
  unlockElement,
  //setInitialCameraFromUrl,
  initLockIndicators,
  watchForLockedShapes,
  zoomToSelection,
} from "@/ui/cameraUtils"

// Default to production URL if env var isn't available
export const WORKER_URL = "https://jeffemmett-canvas.jeffemmett.workers.dev"

const customShapeUtils = [
  ChatBoxShape,
  VideoChatShape,
  EmbedShape,
  SlideShape,
  MycrozineTemplateShape,
  MarkdownShape,
  PromptShape,
]
const customTools = [
  ChatBoxTool,
  VideoChatTool,
  EmbedTool,
  SlideShapeTool,
  MycrozineTemplateTool,
  MarkdownTool,
  PromptShapeTool,
]

export function Board() {
  const { slug } = useParams<{ slug: string }>()
  const roomId = slug || "default-room"

  const storeConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: multiplayerAssetStore,
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: [...defaultBindingUtils],
    }),
    [roomId],
  )

  const store = useSync(storeConfig)
  const [editor, setEditor] = useState<Editor | null>(null)

  const [isCameraLocked, setIsCameraLocked] = useState(false)

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

  useEffect(() => {
    if (!editor) return
    
    // First set the camera position
    const url = new URL(window.location.href)
    const x = url.searchParams.get("x")
    const y = url.searchParams.get("y")
    const zoom = url.searchParams.get("zoom")
    const shapeId = url.searchParams.get("shapeId")
    const frameId = url.searchParams.get("frameId")
    const isLocked = url.searchParams.get("isLocked") === "true"
    
    const initializeCamera = async () => {
      // Start with camera unlocked
      setIsCameraLocked(false)
      
      if (x && y && zoom) {
        editor.stopCameraAnimation()
        
        // Set camera position immediately when editor is available
        editor.setCamera(
          {
            x: parseFloat(parseFloat(x).toFixed(2)),
            y: parseFloat(parseFloat(y).toFixed(2)),
            z: parseFloat(parseFloat(zoom).toFixed(2))
          },
          { animation: { duration: 0 } }
        )
        
        // Ensure camera update is applied
        editor.updateInstanceState({ ...editor.getInstanceState() })
      }

      // Handle shape/frame selection after camera position is set
      if (shapeId) {
        editor.select(shapeId as TLShapeId)
        const bounds = editor.getSelectionPageBounds()
        if (bounds && !x && !y && !zoom) {
          zoomToSelection(editor)
        }
      } else if (frameId) {
        editor.select(frameId as TLShapeId)
        const frame = editor.getShape(frameId as TLShapeId)
        if (frame && !x && !y && !zoom) {
          const bounds = editor.getShapePageBounds(frame)
          if (bounds) {
            editor.zoomToBounds(bounds, {
              targetZoom: 1,
              animation: { duration: 0 },
            })
          }
        }
      }

      // Lock camera after all initialization is complete
      if (isLocked) {
          requestAnimationFrame(() => {
            setIsCameraLocked(true)
          })
      }
    }

    initializeCamera()
  }, [editor])

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
          isLocked: isCameraLocked,
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
          
          registerPropagators(editor, [
            TickPropagator,
            ChangePropagator,
            ClickPropagator,
          ])
        }}
      />
    </div>
  )
}
