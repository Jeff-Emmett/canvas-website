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
import { HolonShapeTool } from "@/tools/HolonShapeTool"
import { HolonShape } from "@/shapes/HolonShapeUtil"
import { llm } from "@/utils/llmUtils"
import {
  lockElement,
  unlockElement,
  setInitialCameraFromUrl,
  initLockIndicators,
  watchForLockedShapes,
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
  HolonShape,
]
const customTools = [
  ChatBoxTool,
  VideoChatTool,
  EmbedTool,
  SlideShapeTool,
  MycrozineTemplateTool,
  MarkdownTool,
  PromptShapeTool,
  HolonShapeTool,
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
        }}
      />
    </div>
  )
}
