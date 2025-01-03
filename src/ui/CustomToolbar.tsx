import { TldrawUiMenuItem } from "tldraw"
import { DefaultToolbar, DefaultToolbarContent } from "tldraw"
import { useTools } from "tldraw"
import { useEditor } from "tldraw"
import { useState, useEffect } from "react"

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (editor && tools) {
      setIsReady(true)
    }
  }, [editor, tools])

  if (!isReady) return null

  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      {tools["VideoChat"] && (
        <TldrawUiMenuItem
          {...tools["VideoChat"]}
          icon="video"
          label="Video Chat"
          isSelected={tools["VideoChat"].id === editor.getCurrentToolId()}
        />
      )}
      {tools["ChatBox"] && (
        <TldrawUiMenuItem
          {...tools["ChatBox"]}
          icon="chat"
          label="Chat"
          isSelected={tools["ChatBox"].id === editor.getCurrentToolId()}
        />
      )}
      {tools["Embed"] && (
        <TldrawUiMenuItem
          {...tools["Embed"]}
          icon="embed"
          label="Embed"
          isSelected={tools["Embed"].id === editor.getCurrentToolId()}
        />
      )}
      {/*
      {tools["Markdown"] && (
        <TldrawUiMenuItem
          {...tools["Markdown"]}
          icon="markdown"
          label="Markdown"
          isSelected={tools["Markdown"].id === editor.getCurrentToolId()}
        />
      )}
      */}
    </DefaultToolbar>
  )
}
