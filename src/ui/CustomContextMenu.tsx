import { TldrawUiMenuItem } from "tldraw"

import { TldrawUiMenuGroup } from "tldraw"

import { DefaultContextMenuContent } from "tldraw"

import { DefaultContextMenu } from "tldraw"

import { TLUiContextMenuProps, useEditor } from "tldraw"
import {
  cameraHistory,
  copyLinkToCurrentView,
  revertCamera,
  zoomToSelection,
} from "./cameraUtils"

export function CustomContextMenu(props: TLUiContextMenuProps) {
  const editor = useEditor()
  const hasSelection = editor.getSelectedShapeIds().length > 0
  const hasCameraHistory = cameraHistory.length > 0
  const selectedShape = editor.getSelectedShapes()[0]
  const isFrame = selectedShape?.type === "frame"

  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />

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
          kbd="s"
          onSelect={() => copyLinkToCurrentView(editor)}
        />
        <TldrawUiMenuItem
          id="revert-camera"
          label="Revert Camera"
          icon="undo"
          kbd="b"
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
          kbd="v"
          onSelect={() => {
            editor.setCurrentTool("VideoChat")
          }}
        />
        <TldrawUiMenuItem
          id="chat-box"
          label="Create Chat Box"
          icon="chat"
          kbd="c"
          onSelect={() => {
            editor.setCurrentTool("ChatBox")
          }}
        />
        <TldrawUiMenuItem
          id="embed"
          label="Create Embed"
          icon="embed"
          kbd="e"
          onSelect={() => {
            editor.setCurrentTool("Embed")
          }}
        />
      </TldrawUiMenuGroup>

      {/* Frame Controls */}
      {isFrame && (
        <TldrawUiMenuGroup id="frame-controls">
          <TldrawUiMenuItem
            id="lock-to-frame"
            label="Lock to Frame"
            icon="lock"
            kbd="l"
            onSelect={() => {
              console.warn("lock to frame NOT IMPLEMENTED")
            }}
          />
        </TldrawUiMenuGroup>
      )}
    </DefaultContextMenu>
  )
}
