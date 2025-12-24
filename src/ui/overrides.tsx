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
  copyFocusLink,
  lockElement,
  revertCamera,
  unlockElement,
  unlockCameraFocus,
  zoomToSelection,
} from "./cameraUtils"
import { saveToPdf } from "../utils/pdfUtils"
import {
  searchText,
  searchSemantic,
  askCanvasAI,
  indexCanvasForSearch,
  explainViewport,
  findSimilarToSelection
} from "../utils/searchUtils"
import { EmbedShape, IEmbedShape } from "@/shapes/EmbedShapeUtil"
import { moveToSlide } from "@/slides/useSlides"
import { ISlideShape } from "@/shapes/SlideShapeUtil"
import { getEdge } from "@/propagators/tlgraph"
import { llm, getApiKey } from "@/utils/llmUtils"

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
        kbd: "ctrl+shift+v",
        readonlyOk: true,
        type: "VideoChat",
        onSelect: () => editor.setCurrentTool("VideoChat"),
      },
      ChatBox: {
        id: "ChatBox",
        icon: "chat",
        label: "Chat",
        kbd: "ctrl+shift+c",
        readonlyOk: true,
        type: "ChatBox",
        onSelect: () => editor.setCurrentTool("ChatBox"),
      },
      Embed: {
        id: "Embed",
        icon: "embed",
        label: "Embed",
        kbd: "ctrl+shift+e",
        readonlyOk: true,
        type: "Embed",
        onSelect: () => editor.setCurrentTool("Embed"),
      },
      SlideShape: {
        id: "Slide",
        icon: "slides",
        label: "Slide",
        kbd: "ctrl+shift+s",
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
        kbd: "ctrl+shift+m",
        readonlyOk: true,
        type: "Markdown",
        onSelect: () => editor.setCurrentTool("Markdown"),
      },
      MycroZineGenerator: {
        id: "MycroZineGenerator",
        icon: "zine",
        label: "MycroZine Generator",
        type: "MycroZineGenerator",
        kbd: "ctrl+shift+z",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("MycroZineGenerator"),
      },
      Prompt: {
        id: "Prompt",
        icon: "prompt",
        label: "LLM Prompt",
        type: "Prompt",
        kbd: "ctrl+shift+l",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("Prompt"),
      },
      gesture: {
        id: "gesture",
        icon: "draw",
        label: "Gesture",
        readonlyOk: true,
        type: "gesture",
        onSelect: () => editor.setCurrentTool("gesture"),
      },
      ObsidianNote: {
        id: "ObsidianNote",
        icon: "file-text",
        label: "Obsidian Note",
        kbd: "ctrl+shift+o",
        readonlyOk: true,
        type: "ObsNote",
        onSelect: () => editor.setCurrentTool("ObsidianNote"),
      },
      Transcription: {
        id: "Transcription",
        icon: "microphone",
        label: "Transcription",
        kbd: "ctrl+shift+t",
        readonlyOk: true,
        type: "Transcription",
        onSelect: () => editor.setCurrentTool("Transcription"),
      },
      Holon: {
        id: "Holon",
        icon: "circle",
        label: "Holon",
        kbd: "ctrl+shift+h",
        readonlyOk: true,
        type: "Holon",
        onSelect: () => editor.setCurrentTool("Holon"),
      },
      FathomMeetings: {
        id: "fathom-meetings",
        icon: "calendar",
        label: "Fathom Meetings",
        kbd: "ctrl+shift+f",
        readonlyOk: true,
        // Removed type property to prevent automatic shape creation
        // Shape creation is handled manually in FathomMeetingsTool.onPointerDown
        onSelect: () => editor.setCurrentTool("fathom-meetings"),
      },
      ImageGen: {
        id: "ImageGen",
        icon: "image",
        label: "Image Generation",
        kbd: "ctrl+shift+i",
        readonlyOk: true,
        type: "ImageGen",
        onSelect: () => editor.setCurrentTool("ImageGen"),
      },
      VideoGen: {
        id: "VideoGen",
        icon: "video",
        label: "Video Generation",
        kbd: "ctrl+shift+g",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("VideoGen"),
      },
      Drawfast: {
        id: "Drawfast",
        icon: "tool-pencil",
        label: "Drawfast (AI Sketch)",
        kbd: "ctrl+shift+d",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("Drawfast"),
      },
      Multmux: {
        id: "Multmux",
        icon: "terminal",
        label: "Terminal",
        kbd: "ctrl+shift+k",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("Multmux"),
      },
      Map: {
        id: "Map",
        icon: "geo-globe",
        label: "Map",
        kbd: "ctrl+shift+m",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("map"),
      },
      calendar: {
        id: "calendar",
        icon: "calendar",
        label: "Calendar",
        kbd: "ctrl+alt+k",
        readonlyOk: true,
        onSelect: () => editor.setCurrentTool("calendar"),
      },
      // MycelialIntelligence removed - now a permanent UI bar (MycelialIntelligenceBar.tsx)
      hand: {
        ...tools.hand,
        onDoubleClick: (info: any) => {
          editor.zoomIn(info.point, { animation: { duration: 200 } })
        },
        onPointerDown: (info: any) => {
          // Make hand tool drag shapes when clicking on them (without requiring selection)
          // Since tldraw already detects shapes on hover (cursor changes), getShapeAtPoint should work
          const shape = editor.getShapeAtPoint(info.point)
          
          if (shape) {
            // Drag the shape directly without selecting it first
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
            return // Don't let hand tool move camera
          }
          
          // If not clicking on a shape, use default hand tool behavior (move camera)
          ;(tools.hand as any).onPointerDown?.(info)
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
        kbd: "ctrl+alt+c",
        onSelect: () => copyLinkToCurrentView(editor),
        readonlyOk: true,
      },
      copyFocusLink: {
        id: "copy-focus-link",
        label: "Copy Focus Link (Locked View)",
        kbd: "ctrl+alt+f",
        onSelect: () => {
          if (editor.getSelectedShapeIds().length > 0) {
            copyFocusLink(editor)
          }
        },
        readonlyOk: true,
      },
      unlockCameraFocus: {
        id: "unlock-camera-focus",
        label: "Unlock Camera",
        kbd: "escape",
        onSelect: () => unlockCameraFocus(editor),
        readonlyOk: true,
      },
      revertCamera: {
        id: "revert-camera",
        label: "Revert Camera",
        kbd: "ctrl+alt+b",
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
        kbd: "ctrl+alt+p",
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
      semanticSearch: {
        id: "semantic-search",
        label: "Semantic Search (AI)",
        kbd: "shift+s",
        readonlyOk: true,
        onSelect: async () => {
          try {
            await searchSemantic(editor)
          } catch (error) {
            console.error("Semantic search error:", error)
          }
        },
      },
      askCanvasAI: {
        id: "ask-canvas-ai",
        label: "Ask AI About Canvas",
        kbd: "shift+a",
        readonlyOk: true,
        onSelect: async () => {
          try {
            // Create a simple modal/prompt for AI response
            const answer = await askCanvasAI(editor, undefined, (partial, done) => {
              // Log streaming response to console for now
              if (!done) {
              }
            })
            if (answer) {
              // Could display in a UI element - for now show alert with result
            }
          } catch (error) {
            console.error("Canvas AI error:", error)
          }
        },
      },
      indexCanvas: {
        id: "index-canvas",
        label: "Index Canvas for AI Search",
        kbd: "ctrl+shift+i",
        readonlyOk: true,
        onSelect: async () => {
          try {
            await indexCanvasForSearch(editor, (progress) => {
            })
          } catch (error) {
            console.error("Canvas indexing error:", error)
          }
        },
      },
      explainViewport: {
        id: "explain-viewport",
        label: "Explain Current View",
        kbd: "shift+e",
        readonlyOk: true,
        onSelect: async () => {
          try {
            await explainViewport(editor, (partial, done) => {
              if (!done) {
              }
            })
          } catch (error) {
            console.error("Viewport explanation error:", error)
          }
        },
      },
      findSimilar: {
        id: "find-similar",
        label: "Find Similar Shapes",
        kbd: "shift+f",
        readonlyOk: true,
        onSelect: async () => {
          if (editor.getSelectedShapeIds().length === 0) {
            return
          }
          try {
            const results = await findSimilarToSelection(editor)
          } catch (error) {
            console.error("Find similar error:", error)
          }
        },
      },
      llm: {
        id: "llm",
        label: "Run LLM Prompt",
        kbd: "ctrl+alt+r",
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
                ? (sourceShape.meta as any)?.text || ""
                : ""

            
            const prompt = `Instruction: ${edge.text}
              ${sourceText ? `Context: ${sourceText}` : ""}`;

            
            try {
              llm(prompt, (partialResponse: string) => {
                const targetShape = editor.getShape(edge.to) as TLGeoShape
                
                // Convert plain text to richText format for TLDraw
                // Split by newlines to create multiple paragraphs
                const paragraphs = partialResponse.split('\n').filter(line => line.trim() !== '')
                const richTextContent = paragraphs.length > 0 
                  ? paragraphs.map(paragraph => ({
                      type: 'paragraph' as const,
                      content: [
                        {
                          type: 'text' as const,
                          text: paragraph
                        }
                      ]
                    }))
                  : [
                      {
                        type: 'paragraph' as const,
                        content: [
                          {
                            type: 'text' as const,
                            text: partialResponse || ''
                          }
                        ]
                      }
                    ]
                
                const richText = {
                  content: richTextContent,
                  type: 'doc' as const
                }
                
                editor.updateShape({
                  id: edge.to,
                  type: "geo",
                  props: {
                    ...targetShape.props,
                    richText: richText, // Store text in richText format for display
                  },
                  meta: {
                    ...targetShape.meta,
                    // Keep text in meta for backwards compatibility if needed
                    text: partialResponse,
                  },
                })

              })
            } catch (error) {
              console.error("Error calling LLM:", error);
            }
          } else {
            
          }
        },
      },
      openObsidianBrowser: {
        id: "open-obsidian-browser",
        label: "Open Obsidian Browser",
        // Removed kbd: "alt+o" - Alt+O now selects the ObsidianNote tool instead
        readonlyOk: true,
        onSelect: () => {
          // Trigger the Obsidian browser to open
          // This will be handled by the ObsidianToolbarButton component
          const event = new CustomEvent('open-obsidian-browser')
          window.dispatchEvent(event)
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
