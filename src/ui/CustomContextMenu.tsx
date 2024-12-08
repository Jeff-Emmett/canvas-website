import { TldrawUiMenuItem, TLShape } from "tldraw"
import { TldrawUiMenuGroup } from "tldraw"
import { DefaultContextMenuContent } from "tldraw"
import { DefaultContextMenu } from "tldraw"
import { TLUiContextMenuProps, useEditor } from "tldraw"
import {
  cameraHistory,
  copyLinkToCurrentView,
  lockCameraToFrame,
  revertCamera,
  zoomToSelection,
} from "./cameraUtils"

export function CustomContextMenu(props: TLUiContextMenuProps) {
  const editor = useEditor()
  const selectedShapes = editor.getSelectedShapes()
  const selectedIds = editor.getSelectedShapeIds()

  // Add debug logs
  console.log(
    "Selected Shapes:",
    selectedShapes.map((shape) => ({
      id: shape.id,
      type: shape.type,
    })),
  )
  console.log(
    "Selected Frame:",
    selectedShapes.length === 1 && selectedShapes[0].type === "frame",
  )

  const hasSelection = selectedIds.length > 0
  const hasCameraHistory = cameraHistory.length > 0

  // Check if exactly one frame is selected
  const hasFrameSelected =
    selectedShapes.length === 1 && selectedShapes[0].type === "frame"

  return (
    <DefaultContextMenu {...props}>
      {/* Camera Controls Group */}
      <TldrawUiMenuGroup id="camera-controls">
        <TldrawUiMenuItem
          id="zoom-to-selection"
          label="Zoom to Selection"
          icon="zoom-in"
          kbd="alt +z"
          disabled={!hasSelection}
          onSelect={() => zoomToSelection(editor)}
        />
        <TldrawUiMenuItem
          id="copy-link-to-current-view"
          label="Copy Link to Current View"
          icon="link"
          kbd="alt+s"
          onSelect={() => copyLinkToCurrentView(editor)}
        />
        <TldrawUiMenuItem
          id="revert-camera"
          label="Revert Camera"
          icon="undo"
          kbd="alt+b"
          disabled={!hasCameraHistory}
          onSelect={() => revertCamera(editor)}
        />
      </TldrawUiMenuGroup>

      {/* Creation Tools Group */}
      <TldrawUiMenuGroup id="creation-tools">
        <TldrawUiMenuItem
          id="video-chat"
          label="Create Video Chat"
          icon="video"
          kbd="alt+v"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("VideoChat")
          }}
        />
        <TldrawUiMenuItem
          id="chat-box"
          label="Create Chat Box"
          icon="chat"
          kbd="alt+c"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("ChatBox")
          }}
        />
        <TldrawUiMenuItem
          id="embed"
          label="Create Embed"
          icon="embed"
          kbd="alt+e"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("Embed")
          }}
        />
        <TldrawUiMenuItem
          id="markdown"
          label="Create Markdown Box"
          icon="markdown"
          kbd="alt+m"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("markdown")
          }}
        />
      </TldrawUiMenuGroup>

      {/* Frame Controls */}
      <TldrawUiMenuGroup id="frame-controls">
        <TldrawUiMenuItem
          id="lock-to-frame"
          label="Lock to Frame"
          icon="lock"
          kbd="shift+l"
          disabled={!hasFrameSelected}
          onSelect={() => lockCameraToFrame(editor)}
        />
      </TldrawUiMenuGroup>
      <DefaultContextMenuContent />
    </DefaultContextMenu>
  )
}
