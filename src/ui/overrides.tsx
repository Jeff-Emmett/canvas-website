import { TLUiOverrides } from "tldraw"
import {
  cameraHistory,
  copyLinkToCurrentView,
  lockCameraToFrame,
  revertCamera,
  zoomToSelection,
} from "./cameraUtils"

export const overrides: TLUiOverrides = {
  tools(editor, tools) {
    return {
      ...tools,
      VideoChat: {
        id: "VideoChat",
        icon: "video",
        label: "Video Chat",
        kbd: "alt+v",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("VideoChat"),
      },
      ChatBox: {
        id: "ChatBox",
        icon: "chat",
        label: "Chat",
        kbd: "alt+c",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("ChatBox"),
      },
      Embed: {
        id: "Embed",
        icon: "embed",
        label: "Embed",
        kbd: "alt+e",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("Embed"),
      },
      Markdown: {
        id: "Markdown",
        icon: "markdown",
        label: "Markdown",
        kbd: "alt+m",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("Markdown"),
      },
    }
  },
  actions(editor, actions) {
    return {
      ...actions,
      zoomToSelection: {
        id: "zoom-to-selection",
        label: "Zoom to Selection",
        kbd: "alt+z",
        onSelect: () => {
          if (editor.getSelectedShapeIds().length > 0) {
            zoomToSelection(editor)
          }
        },
        readonlyOk: true,
      },
      copyLinkToCurrentView: {
        id: "copy-link-to-current-view",
        label: "Copy Link to Current View",
        kbd: "alt+s",
        onSelect: () => {
          copyLinkToCurrentView(editor)
        },
        readonlyOk: true,
      },
      revertCamera: {
        id: "revert-camera",
        label: "Revert Camera",
        kbd: "alt+b",
        onSelect: () => {
          if (cameraHistory.length > 0) {
            revertCamera(editor)
          }
        },
        readonlyOk: true,
      },
      lockToFrame: {
        id: "lock-to-frame",
        label: "Lock to Frame",
        kbd: "shift+l",
        onSelect: () => lockCameraToFrame(editor),
      },
    }
  },
}
