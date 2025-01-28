import {
  Editor,
  TldrawUiMenuActionItem,
  TldrawUiMenuItem,
  TldrawUiMenuSubmenu,
  TLShape,
} from "tldraw"
import { TldrawUiMenuGroup } from "tldraw"
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
import { TLFrameShape } from "tldraw"
import { searchText } from "../utils/searchUtils"

const getAllFrames = (editor: Editor) => {
  return editor
    .getCurrentPageShapes()
    .filter((shape): shape is TLFrameShape => shape.type === "frame")
    .map((frame) => ({
      id: frame.id,
      title: frame.props.name || "Untitled Frame",
    }))
}

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
          kbd="z"
          disabled={!hasSelection}
          onSelect={() => zoomToSelection(editor)}
        />
        <TldrawUiMenuItem
          id="copy-link-to-current-view"
          label="Copy Link to Current View"
          icon="link"
          kbd="alt+c"
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
          id="VideoChat"
          label="Create Video Chat"
          icon="video"
          kbd="alt+v"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("VideoChat")
          }}
        />
        <TldrawUiMenuItem
          id="ChatBox"
          label="Create Chat Box"
          icon="chat"
          kbd="alt+c"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("ChatBox")
          }}
        />
        <TldrawUiMenuItem
          id="Embed"
          label="Create Embed"
          icon="embed"
          kbd="alt+e"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("Embed")
          }}
        />
        <TldrawUiMenuItem
          id="Slide"
          label="Create Slide"
          icon="slides"
          kbd="alt+s"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("Slide")
          }}
        />
        <TldrawUiMenuItem
          id="MycrozineTemplate"
          label="Create Mycrozine Template"
          icon="rectangle"
          kbd="m"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("MycrozineTemplate")
          }}
        />
        <TldrawUiMenuItem
          id="Markdown"
          label="Create Markdown"
          icon="markdown"
          kbd="alt+m"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("Markdown")
          }}
        />
        <TldrawUiMenuItem
          id="Prompt"
          label="Create Prompt"
          icon="prompt"
          kbd="alt+p"
          disabled={hasSelection}
          onSelect={() => {
            editor.setCurrentTool("Prompt")
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

      <TldrawUiMenuGroup id="frames-list">
        <TldrawUiMenuSubmenu id="frames-dropdown" label="Shortcut to Frames">
          {getAllFrames(editor).map((frame) => (
            <TldrawUiMenuItem
              key={frame.id}
              id={`frame-${frame.id}`}
              label={frame.title}
              onSelect={() => {
                const shape = editor.getShape(frame.id)
                if (shape) {
                  editor.zoomToBounds(editor.getShapePageBounds(shape)!, {
                    animation: { duration: 400, easing: (t) => t * (2 - t) },
                  })
                  editor.select(frame.id)
                }
              }}
            />
          ))}
        </TldrawUiMenuSubmenu>
      </TldrawUiMenuGroup>

      <TldrawUiMenuGroup id="broadcast-controls">
        <TldrawUiMenuItem
          id="broadcast-view"
          label="Start Broadcasting View"
          icon="broadcast"
          kbd="alt+b"
          onSelect={() => {
            const otherUsers = Array.from(editor.store.allRecords()).filter(
              (record) =>
                record.typeName === "instance_presence" &&
                record.id !== editor.user.getId(),
            )
            otherUsers.forEach((user) => editor.startFollowingUser(user.id))
          }}
        />
        <TldrawUiMenuItem
          id="stop-broadcast"
          label="Stop Broadcasting View"
          icon="broadcast-off"
          kbd="alt+shift+b"
          onSelect={() => {
            const otherUsers = Array.from(editor.store.allRecords()).filter(
              (record) =>
                record.typeName === "instance_presence" &&
                record.id !== editor.user.getId(),
            )
            otherUsers.forEach((_user) => editor.stopFollowingUser())
          }}
        />
      </TldrawUiMenuGroup>

      <TldrawUiMenuGroup id="search-controls">
        <TldrawUiMenuItem
          id="search-text"
          label="Search Text"
          icon="search"
          kbd="s"
          onSelect={() => searchText(editor)}
        />
      </TldrawUiMenuGroup>
    </DefaultContextMenu>
  )
}
