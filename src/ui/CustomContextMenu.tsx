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
import { useState, useEffect } from "react"
import { saveToPdf } from "../utils/pdfUtils"

export function CustomContextMenu(props: TLUiContextMenuProps) {
  const editor = useEditor()
  const [selectedShapes, setSelectedShapes] = useState<TLShape[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Update selection state more frequently
  useEffect(() => {
    const updateSelection = () => {
      setSelectedShapes(editor.getSelectedShapes())
      setSelectedIds(editor.getSelectedShapeIds())
    }

    // Initial update
    updateSelection()

    // Subscribe to selection changes
    const unsubscribe = editor.addListener("change", updateSelection)

    return () => {
      if (typeof unsubscribe === "function") {
        ;(unsubscribe as () => void)()
      }
    }
  }, [editor])

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
        <TldrawUiMenuItem
          id="save-to-pdf"
          label="Save Selection as PDF"
          icon="file"
          kbd="alt+p"
          disabled={!hasSelection}
          onSelect={() => saveToPdf(editor)}
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
          label="Create Markdown"
          icon="markdown"
          kbd="alt+m"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("Markdown")
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
