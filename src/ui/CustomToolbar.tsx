import { TldrawUiMenuItem } from "tldraw"
import { DefaultToolbar, DefaultToolbarContent } from "tldraw"
import { useTools } from "tldraw"
import { useEditor } from "tldraw"

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()

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
    </DefaultToolbar>
  )
}
