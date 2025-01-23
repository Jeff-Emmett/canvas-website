import { useSync } from "@tldraw/sync"
import { useMemo } from "react"
import { Tldraw, Editor, useTools, useIsToolSelected, DefaultToolbar, TldrawUiMenuItem, DefaultToolbarContent, DefaultKeyboardShortcutsDialog, DefaultKeyboardShortcutsDialogContent, defaultTools } from "tldraw"
import { useParams } from "react-router-dom"
import { ChatBoxTool } from "@/tools/ChatBoxTool"
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatTool } from "@/tools/VideoChatTool"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { multiplayerAssetStore } from "../utils/multiplayerAssetStore"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { EmbedTool } from "@/tools/EmbedTool"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MarkdownTool } from "@/tools/MarkdownTool"
import { defaultShapeUtils, defaultBindingUtils } from "tldraw"
import { useState } from "react"
import { components } from "@/ui/components"
import { overrides } from "@/ui/overrides"
import { unfurlBookmarkUrl } from "../utils/unfurlBookmarkUrl"
import { handleInitialPageLoad } from "@/utils/handleInitialPageLoad"
import { MycrozineTemplateTool } from "@/tools/MycrozineTemplateTool"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { registerPropagators, ChangePropagator, TickPropagator, ClickPropagator } from "@/propagators/ScopedPropagators"
import { SlideShapeTool } from "@/tools/SlideShapeTool"
import { ISlideShape, SlideShapeUtil } from "@/shapes/SlideShapeUtil"
import { SlidesPanel } from "@/slides/SlidesPanel"
import { moveToSlide } from "@/slides/useSlides"

// Default to production URL if env var isn't available
export const WORKER_URL = "https://jeffemmett-canvas.jeffemmett.workers.dev"

const updatedComponents = {
  ...components,
  HelperButtons: SlidesPanel,
  Minimap: null,
	Toolbar: (props: any) => {
		const tools = useTools()
		const slideTool = tools['Slide']
		const isSlideSelected = slideTool ? useIsToolSelected(slideTool) : false
		return (
			<DefaultToolbar {...props}>
				{slideTool && <TldrawUiMenuItem {...slideTool} isSelected={isSlideSelected} />}
				<DefaultToolbarContent />
			</DefaultToolbar>
		)
	},
	KeyboardShortcutsDialog: (props: any) => {
		const tools = useTools()
		return (
			<DefaultKeyboardShortcutsDialog {...props}>
				<TldrawUiMenuItem {...tools['Slide']} />
				<DefaultKeyboardShortcutsDialogContent />
			</DefaultKeyboardShortcutsDialog>
		)
	},
}

const customShapeUtils = [
  ChatBoxShape, 
  VideoChatShape, 
  EmbedShape, 
  SlideShapeUtil,
  MycrozineTemplateShape, 
  MarkdownShape
]
const customTools = [
  ChatBoxTool, 
  VideoChatTool, 
  EmbedTool, 
  SlideShapeTool,
  MycrozineTemplateTool, 
  MarkdownTool
]

const updatedOverrides = {
  ...overrides,
  actions(editor: Editor, actions: any) {
    return {
      ...actions,
      'next-slide': {
        id: 'next-slide',
        label: 'Next slide',
        kbd: 'right',
        onSelect() {
          const slides = editor.getCurrentPageShapes().filter(shape => shape.type === 'Slide')
          if (slides.length === 0) return

          const currentSlide = editor.getSelectedShapes().find(shape => shape.type === 'Slide')
          const currentIndex = currentSlide 
            ? slides.findIndex(slide => slide.id === currentSlide.id)
            : -1

console.log('Current index:', currentIndex)
console.log('Current slide:', currentSlide)


          // Calculate next index with wraparound
          const nextIndex = currentIndex === -1
            ? 0
            : currentIndex >= slides.length - 1
              ? 0
              : currentIndex + 1

          const nextSlide = slides[nextIndex]
          
          editor.select(nextSlide.id)
          editor.stopCameraAnimation()
          moveToSlide(editor, nextSlide as ISlideShape)
        },
      },
      'previous-slide': {
        id: 'previous-slide',
        label: 'Previous slide',
        kbd: 'left',
        onSelect() {
          const slides = editor.getCurrentPageShapes().filter(shape => shape.type === 'Slide')
          if (slides.length === 0) return

          const currentSlide = editor.getSelectedShapes().find(shape => shape.type === 'Slide')
          const currentIndex = currentSlide 
            ? slides.findIndex(slide => slide.id === currentSlide.id)
            : -1

          // Calculate previous index with wraparound
          const previousIndex = currentIndex <= 0
            ? slides.length - 1
            : currentIndex - 1

          const previousSlide = slides[previousIndex]
          
          editor.select(previousSlide.id)
          editor.stopCameraAnimation()
          moveToSlide(editor, previousSlide as ISlideShape)
        },
      },
    }
  },
}

export function Board() {
  const { slug } = useParams<{ slug: string }>()
  const roomId = slug || "default-room"

  const storeConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: multiplayerAssetStore,
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: [...defaultBindingUtils],
    }),
    [roomId],
  )

  const store = useSync(storeConfig)
  const [editor, setEditor] = useState<Editor | null>(null)

  //console.log("store:", store)
  //console.log("store.store:",store.store)

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store.store}
        shapeUtils={customShapeUtils}
        tools={customTools}
        components={updatedComponents}
        overrides={updatedOverrides}
        cameraOptions={{
          zoomSteps: [
            0.001,  // Min zoom
            0.0025,
            0.005,
            0.01,
            0.025,
            0.05,
            0.1,
            0.25,
            0.5,
            1,
            2,
            4,
            8,
            16,
            32,
            64     // Max zoom
          ]
        }}
        onMount={(editor) => {
          setEditor(editor)
          editor.registerExternalAssetHandler("url", unfurlBookmarkUrl)
          editor.setCurrentTool("hand")
          handleInitialPageLoad(editor)
          registerPropagators(editor, [TickPropagator,ChangePropagator,ClickPropagator])
        }}
      />
    </div>
  )
}
