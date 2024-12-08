import { useSync } from "@tldraw/sync"
import { useMemo } from "react"
import { Tldraw, Editor } from "tldraw"
import { useParams } from "react-router-dom"
import { ChatBoxTool } from "@/tools/ChatBoxTool"
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatTool } from "@/tools/VideoChatTool"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { multiplayerAssetStore } from "../utils/multiplayerAssetStore"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { EmbedTool } from "@/tools/EmbedTool"
import { defaultShapeUtils, defaultBindingUtils } from "tldraw"
import { useState } from "react"
import { components } from "@/ui/components"
import { overrides } from "@/ui/overrides"
import { unfurlBookmarkUrl } from "../utils/unfurlBookmarkUrl"

// Default to production URL if env var isn't available
export const WORKER_URL = "https://jeffemmett-canvas.jeffemmett.workers.dev"

const shapeUtils = [ChatBoxShape, VideoChatShape, EmbedShape]
const tools = [ChatBoxTool, VideoChatTool, EmbedTool] // Array of tools

export function Board() {
  const { slug } = useParams<{ slug: string }>()
  const roomId = slug || "default-room"

  const storeConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: multiplayerAssetStore,
      shapeUtils: [...shapeUtils, ...defaultShapeUtils],
      bindingUtils: [...defaultBindingUtils],
    }),
    [roomId],
  )

  const store = useSync(storeConfig)
  const [editor, setEditor] = useState<Editor | null>(null)

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store.store}
        shapeUtils={shapeUtils}
        tools={tools}
        components={components}
        overrides={overrides}
        onMount={(editor) => {
          setEditor(editor)
          editor.registerExternalAssetHandler("url", unfurlBookmarkUrl)
          editor.setCurrentTool("hand")
        }}
      />
    </div>
  )
}
