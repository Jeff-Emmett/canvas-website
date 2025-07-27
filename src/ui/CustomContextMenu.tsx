import {
  Editor,
  TldrawUiMenuActionItem,
  TldrawUiMenuItem,
  TldrawUiMenuSubmenu,
  TLGeoShape,
  TLShape,
  useDefaultHelpers,
} from "tldraw"
import { TldrawUiMenuGroup } from "tldraw"
import { DefaultContextMenu, DefaultContextMenuContent } from "tldraw"
import { TLUiContextMenuProps, useEditor } from "tldraw"
import {
  cameraHistory,
} from "./cameraUtils"
import { useState, useEffect } from "react"
import { saveToPdf } from "../utils/pdfUtils"
import { TLFrameShape } from "tldraw"
import { searchText } from "../utils/searchUtils"
import { llm } from "../utils/llmUtils"
import { getEdge } from "@/propagators/tlgraph"
import { getCustomActions } from './overrides'
import { overrides } from './overrides'

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
  const helpers = useDefaultHelpers()
  const tools = overrides.tools?.(editor, {}, helpers) ?? {}
  const customActions = getCustomActions(editor)
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

  //TO DO: Fix camera history for camera revert
  
  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
      
      {/* Frames List - Moved to top */}
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

      {/* Camera Controls Group */}
      <TldrawUiMenuGroup id="camera-controls">
        <TldrawUiMenuItem {...customActions.zoomToSelection} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.copyLinkToCurrentView} />
        <TldrawUiMenuItem {...customActions.revertCamera} disabled={!hasCameraHistory} />
        <TldrawUiMenuItem {...customActions.lockElement} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.unlockElement} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.saveToPdf} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.llm} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.createStripePayment} />
      </TldrawUiMenuGroup>

      {/* Creation Tools Group */}
      <TldrawUiMenuGroup id="creation-tools">
        <TldrawUiMenuItem {...tools.VideoChat} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.ChatBox} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.Embed} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.SlideShape} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.Markdown} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.MycrozineTemplate} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.Prompt} disabled={hasSelection} />
        <TldrawUiMenuItem {...tools.StripePayment} disabled={hasSelection} />
      </TldrawUiMenuGroup>

      
      {/* TODO: FIX & IMPLEMENT BROADCASTING*/}
      {/* <TldrawUiMenuGroup id="broadcast-controls">
        <TldrawUiMenuItem
          id="start-broadcast"
          label="Start Broadcasting"
          icon="broadcast"
          kbd="alt+b"
          onSelect={() => {
            editor.markHistoryStoppingPoint('start-broadcast')
            editor.updateInstanceState({ isBroadcasting: true })
            const url = new URL(window.location.href)
            url.searchParams.set("followId", editor.user.getId())
            window.history.replaceState(null, "", url.toString())
          }}
        />
        <TldrawUiMenuItem
          id="stop-broadcast"
          label="Stop Broadcasting"
          icon="broadcast-off"
          kbd="alt+shift+b"
          onSelect={() => {
            editor.markHistoryStoppingPoint('stop-broadcast')
            editor.updateInstanceState({ isBroadcasting: false }) 
            editor.stopFollowingUser()
            const url = new URL(window.location.href)
            url.searchParams.delete("followId")
            window.history.replaceState(null, "", url.toString())
          }}
        />
      </TldrawUiMenuGroup> */}

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
