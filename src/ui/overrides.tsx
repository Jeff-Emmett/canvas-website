import { TLUiOverrides } from "tldraw"
import {
  cameraHistory,
  copyLinkToCurrentView,
  lockCameraToFrame,
  revertCamera,
  zoomToSelection,
} from "./cameraUtils"
import { saveToPdf } from "../utils/pdfUtils"

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
      // Markdown: {
      //   id: "Markdown",
      //   icon: "markdown",
      //   label: "Markdown",
      //   kbd: "alt+m",
      //   readonlyOk: true,
      //   onSelect: () => editor.setCurrentTool("Markdown"),
      // },
    }
  },
  actions(editor, actions) {
    return {
      ...actions,
      zoomToSelection: {
        id: "zoom-to-selection",
        label: "Zoom to Selection",
        kbd: "z",
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
        kbd: "alt+c",
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
      saveToPdf: {
        id: "save-to-pdf",
        label: "Save Selection as PDF",
        kbd: "alt+p",
        onSelect: () => {
          if (editor.getSelectedShapeIds().length > 0) {
            saveToPdf(editor)
          }
        },
        readonlyOk: true,
      },
      // TODO: FIX THIS
      handleSelectedShapeDrag: {
        id: "handle-selected-shape-drag",
        label: "Drag Selected Shape",
        onSelect: (info: any) => {
          const shape = editor.getShapeAtPoint(info.point)
          if (shape && editor.getSelectedShapeIds().includes(shape.id)) {
            if (editor.isPointInShape(shape, info.point)) {
              editor.dispatch({
                type: "pointer",
                name: "pointer_down",
                point: info.point,
                button: info.button,
                shiftKey: info.shiftKey,
                altKey: info.altKey,
                ctrlKey: info.ctrlKey,
                metaKey: info.metaKey,
                accelKey: info.ctrlKey || info.metaKey,
                pointerId: info.pointerId,
                target: "shape",
                shape,
                isPen: false,
              })
            }
          }
        },
      },
      moveSelectedLeft: {
        id: "move-selected-left",
        label: "Move Left",
        kbd: "ArrowLeft",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                x: shape.x - 50,
                y: shape.y,
              })
            })
          }
        },
      },
      moveSelectedRight: {
        id: "move-selected-right",
        label: "Move Right",
        kbd: "ArrowRight",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                x: shape.x + 50,
                y: shape.y,
              })
            })
          }
        },
      },
      moveSelectedUp: {
        id: "move-selected-up",
        label: "Move Up",
        kbd: "ArrowUp",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                x: shape.x,
                y: shape.y - 50,
              })
            })
          }
        },
      },
      moveSelectedDown: {
        id: "move-selected-down",
        label: "Move Down",
        kbd: "ArrowDown",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                x: shape.x,
                y: shape.y + 50,
              })
            })
          }
        },
      },

      // TODO: FIX THIS
      resizeSelectedUp: {
        id: "resize-selected-up",
        label: "Resize Up",
        kbd: "ctrl+ArrowUp",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              const bounds = editor.getShapeGeometry(shape).bounds
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                //y: shape.y - 50,
                props: {
                  ...shape.props,
                  h: bounds.height + 50,
                },
              })
            })
          }
        },
      },
      resizeSelectedDown: {
        id: "resize-selected-down",
        label: "Resize Down",
        kbd: "ctrl+ArrowDown",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              const bounds = editor.getShapeGeometry(shape).bounds
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                props: {
                  ...shape.props,
                  h: bounds.height + 50,
                },
              })
            })
          }
        },
      },
      resizeSelectedLeft: {
        id: "resize-selected-left",
        label: "Resize Left",
        kbd: "ctrl+ArrowLeft",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              const bounds = editor.getShapeGeometry(shape).bounds
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                props: {
                  ...shape.props,
                  w: bounds.width + 50,
                },
              })
            })
          }
        },
      },
      resizeSelectedRight: {
        id: "resize-selected-right",
        label: "Resize Right",
        kbd: "ctrl+ArrowRight",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            selectedShapes.forEach((shape) => {
              const bounds = editor.getShapeGeometry(shape).bounds
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                props: {
                  ...shape.props,
                  w: bounds.width + 50,
                },
              })
            })
          }
        },
      },
      //TODO: MAKE THIS WORK, ADD USER PERMISSIONING TO JOIN BROADCAST?
      broadcastView: {
        id: "broadcast-view",
        label: "Broadcast View",
        kbd: "alt+b",
        readonlyOk: true,
        onSelect: () => {
          const collaborators = editor.getCollaborators()
          collaborators
            .filter((user) => user.id !== editor.user.getId())
            .forEach((user) => {
              editor.startFollowingUser(user.id)
            })
        },
      },
      stopBroadcast: {
        id: "stop-broadcast",
        label: "Stop Broadcasting",
        kbd: "alt+shift+b",
        readonlyOk: true,
        onSelect: () => {
          editor.stopFollowingUser()
        },
      },
    }
  },
}
