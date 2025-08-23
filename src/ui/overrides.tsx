import { Editor, useDefaultHelpers } from "tldraw"
import {
  shapeIdValidator,
  TLArrowShape,
  TLGeoShape,
  TLUiOverrides,
} from "tldraw"
import {
  cameraHistory,
  copyLinkToCurrentView,
  lockElement,
  revertCamera,
  unlockElement,
  zoomToSelection,
} from "./cameraUtils"
import { saveToPdf } from "../utils/pdfUtils"
import { searchText } from "../utils/searchUtils"
import { EmbedShape, IEmbedShape } from "@/shapes/EmbedShapeUtil"
import { moveToSlide } from "@/slides/useSlides"
import { ISlideShape } from "@/shapes/SlideShapeUtil"
import { getEdge } from "@/propagators/tlgraph"
import { llm } from "@/utils/llmUtils"

export const overrides: TLUiOverrides = {
  tools(editor, tools) {
    return {
      ...tools,
      select: {
        ...tools.select,
        onPointerDown: (info: any) => {
          const shape = editor.getShapeAtPoint(info.point)
          if (shape && editor.getSelectedShapeIds().includes(shape.id)) {
            // If clicking on a selected shape, initiate drag behavior
            editor.dispatch({
              type: "pointer",
              name: "pointer_down",
              point: info.point,
              button: info.button,
              shiftKey: info.shiftKey,
              altKey: info.altKey,
              ctrlKey: info.ctrlKey,
              metaKey: info.metaKey,
              pointerId: info.pointerId,
              target: "shape",
              shape,
              isPen: false,
              accelKey: info.ctrlKey || info.metaKey,
            })
            return
          }
          // Otherwise, use default select tool behavior
          ;(tools.select as any).onPointerDown?.(info)
        },

        //TODO: Fix double click to zoom on selector tool later...
        // onDoubleClick: (info: any) => {
        //   const shape = editor.getShapeAtPoint(info.point)
        //   if (shape?.type === "Embed") {
        //     // Let the Embed shape handle its own double-click behavior
        //     const util = editor.getShapeUtil(shape) as EmbedShape
        //     util?.onDoubleClick?.(shape as IEmbedShape)
        //     return true
        //   }

        //   // Handle all pointer types (mouse, touch, pen)
        //   const point = info.point || (info.touches && info.touches[0]) || info

        //   // Zoom in at the clicked/touched point
        //   editor.zoomIn(point, { animation: { duration: 200 } })

        //   // Prevent default text creation
        //   info.preventDefault?.()
        //   info.stopPropagation?.()
        //   return true
        // },
        // onDoubleClickCanvas: (info: any) => {
        //   // Handle all pointer types (mouse, touch, pen)
        //   const point = info.point || (info.touches && info.touches[0]) || info

        //   // Zoom in at the clicked/touched point
        //   editor.zoomIn(point, { animation: { duration: 200 } })

        //   // Prevent default text creation
        //   info.preventDefault?.()
        //   info.stopPropagation?.()
        //   return true
        // },
      },
      VideoChat: {
        id: "VideoChat",
        icon: "video",
        label: "Video Chat",
        kbd: "alt+v",
        readonlyOk: true,
        type: "VideoChat",
        onSelect: () => editor.setCurrentTool("VideoChat"),
      },
      ChatBox: {
        id: "ChatBox",
        icon: "chat",
        label: "Chat",
        kbd: "alt+c",
        readonlyOk: true,
        type: "ChatBox",
        onSelect: () => editor.setCurrentTool("ChatBox"),
      },
      Embed: {
        id: "Embed",
        icon: "embed",
        label: "Embed",
        kbd: "alt+e",
        readonlyOk: true,
        type: "Embed",
        onSelect: () => editor.setCurrentTool("Embed"),
      },
      SlideShape: {
        id: "Slide",
        icon: "slides",
        label: "Slide",
        kbd: "alt+s",
        type: "Slide",
        readonlyOk: true,
        onSelect: () => {
          editor.setCurrentTool("Slide")
        },
      },
      Markdown: {
        id: "Markdown",
        icon: "markdown",
        label: "Markdown",
        kbd: "alt+m",
        readonlyOk: true,
        type: "Markdown",
        onSelect: () => editor.setCurrentTool("Markdown"),
      },
      MycrozineTemplate: {
        id: "MycrozineTemplate",
        icon: "rectangle",
        label: "Mycrozine Template",
        type: "MycrozineTemplate",
        kbd: "alt+z",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("MycrozineTemplate"),
      },
      Prompt: {
        id: "Prompt",
        icon: "prompt",
        label: "Prompt",
        type: "Prompt",
        kbd: "alt+l",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("Prompt"),
      },
      SharedPiano: {
        id: "SharedPiano",
        icon: "music",
        label: "Shared Piano",
        type: "SharedPiano",
        kbd: "alt+p",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("SharedPiano"),
      },
      gesture: {
        id: "gesture",
        icon: "draw",
        label: "Gesture",
        kbd: "g",
        readonlyOk: true,
        type: "gesture",
        onSelect: () => editor.setCurrentTool("gesture"),
      },
      hand: {
        ...tools.hand,
        onDoubleClick: (info: any) => {
          editor.zoomIn(info.point, { animation: { duration: 200 } })
        },
      },
    }
  },
  actions(editor, actions) {
    const customActions = {
      "zoom-in": {
        ...actions["zoom-in"],
        kbd: "ctrl+up",
      },
      "zoom-out": {
        ...actions["zoom-out"],
        kbd: "ctrl+down",
      },
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
        onSelect: () => copyLinkToCurrentView(editor),
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
      lockElement: {
        id: "lock-element",
        label: "Lock Element",
        kbd: "shift+l",
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            lockElement(editor)
          }
        },
        readonlyOk: true,
      },
      unlockElement: {
        id: "unlock-element",
        label: "Unlock Element",
        onSelect: () => {
          if (editor.getSelectedShapeIds().length > 0) {
            unlockElement(editor, editor.getSelectedShapeIds()[0])
          }
        },
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
      searchShapes: {
        id: "search-shapes",
        label: "Search Shapes",
        kbd: "s",
        readonlyOk: true,
        onSelect: () => searchText(editor),
      },
      llm: {
        id: "llm",
        label: "Run LLM Prompt",
        kbd: "alt+g",
        readonlyOk: true,
        onSelect: () => {
          const selectedShapes = editor.getSelectedShapes()
          if (selectedShapes.length > 0) {
            const selectedShape = selectedShapes[0] as TLArrowShape
            if (selectedShape.type !== "arrow") {
              return
            }
            const edge = getEdge(selectedShape, editor)
            if (!edge) {
              return
            }
            const sourceShape = editor.getShape(edge.from)
            const sourceText =
              sourceShape && sourceShape.type === "geo"
                ? (sourceShape as TLGeoShape).props.text
                : ""
            llm(
              `Instruction: ${edge.text}
              ${sourceText ? `Context: ${sourceText}` : ""}`,
              localStorage.getItem("openai_api_key") || "",
              (partialResponse: string) => {
                editor.updateShape({
                  id: edge.to,
                  type: "geo",
                  props: {
                    ...(editor.getShape(edge.to) as TLGeoShape).props,
                    text: partialResponse,
                  },
                })
              },
            )
          }
        },
      },
      //TODO: FIX PREV & NEXT SLIDE KEYBOARD COMMANDS
      // "next-slide": {
      //   id: "next-slide",
      //   label: "Next slide",
      //   kbd: "right",
      //   onSelect() {
      //     const slides = editor
      //       .getCurrentPageShapes()
      //       .filter((shape) => shape.type === "Slide")
      //     if (slides.length === 0) return

      //     const currentSlide = editor
      //       .getSelectedShapes()
      //       .find((shape) => shape.type === "Slide")
      //     const currentIndex = currentSlide
      //       ? slides.findIndex((slide) => slide.id === currentSlide.id)
      //       : -1

      //     // Calculate next index with wraparound
      //     const nextIndex =
      //       currentIndex === -1
      //         ? 0
      //         : currentIndex >= slides.length - 1
      //         ? 0
      //         : currentIndex + 1

      //     const nextSlide = slides[nextIndex]

      //     editor.select(nextSlide.id)
      //     editor.stopCameraAnimation()
      //     moveToSlide(editor, nextSlide as ISlideShape)
      //   },
      // },
      // "previous-slide": {
      //   id: "previous-slide",
      //   label: "Previous slide",
      //   kbd: "left",
      //   onSelect() {
      //     const slides = editor
      //       .getCurrentPageShapes()
      //       .filter((shape) => shape.type === "Slide")
      //     if (slides.length === 0) return

      //     const currentSlide = editor
      //       .getSelectedShapes()
      //       .find((shape) => shape.type === "Slide")
      //     const currentIndex = currentSlide
      //       ? slides.findIndex((slide) => slide.id === currentSlide.id)
      //       : -1

      //     // Calculate previous index with wraparound
      //     const previousIndex =
      //       currentIndex <= 0 ? slides.length - 1 : currentIndex - 1

      //     const previousSlide = slides[previousIndex]

      //     editor.select(previousSlide.id)
      //     editor.stopCameraAnimation()
      //     moveToSlide(editor, previousSlide as ISlideShape)
      //   },
      // },
    }

    return {
      ...actions,
      ...customActions,
    }
  },
}

// Export actions for use in context menu
export const getCustomActions = (editor: Editor) => {
  const helpers = useDefaultHelpers()
  return overrides.actions?.(editor, {}, helpers) ?? {}
}
