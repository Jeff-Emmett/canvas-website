import {
  Editor,
  TldrawUiMenuActionItem,
  TldrawUiMenuItem,
  TldrawUiMenuSubmenu,
  TLGeoShape,
  TLShape,
  useDefaultHelpers,
  useActions,
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
import { useGlobalCollection } from "@/collections"

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
  const actions = useActions()
  const tools = overrides.tools?.(editor, {}, helpers) ?? {}
  const customActions = getCustomActions(editor) as any
  const [selectedShapes, setSelectedShapes] = useState<TLShape[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Collection functionality using the global collection manager
  const { collection, size } = useGlobalCollection('graph')

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

  // Collection handlers
  const handleAddToCollection = () => {
    if (collection) {
      collection.add(editor.getSelectedShapes())
      editor.selectNone()
    }
  }

  const handleRemoveFromCollection = () => {
    if (collection) {
      collection.remove(editor.getSelectedShapes())
      editor.selectNone()
    }
  }

  const handleHighlightCollection = () => {
    if (collection) {
      editor.setHintingShapes([...collection.getShapes().values()])
    }
  }



  // Check if selected shapes are already in collection
  const selectedShapesInCollection = collection ? 
    selectedShapes.filter(shape => collection.getShapes().has(shape.id)) : []
  const hasSelectedShapesInCollection = selectedShapesInCollection.length > 0
  const allSelectedShapesInCollection = selectedShapes.length > 0 && selectedShapesInCollection.length === selectedShapes.length

  // Check if collection functionality is available
  const hasCollectionContext = collection !== null

  // Keyboard shortcut for adding to collection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'c' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        if (hasSelection && collection && !allSelectedShapesInCollection) {
          handleAddToCollection()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasSelection, collection, allSelectedShapesInCollection])

  //TO DO: Fix camera history for camera revert
  
  return (
    <DefaultContextMenu {...props}>
      {/* Creation Tools Group - Top priority */}
      <TldrawUiMenuGroup id="creation-tools">
        <TldrawUiMenuSubmenu id="tools-dropdown" label="Create Tool">
          <TldrawUiMenuItem {...tools.Prompt} />
          <TldrawUiMenuItem {...tools.ChatBox} />
          <TldrawUiMenuItem {...tools.ImageGen} />
          <TldrawUiMenuItem {...tools.VideoGen} />
          <TldrawUiMenuItem {...tools.Drawfast} />
          <TldrawUiMenuItem {...tools.Markdown} />
          <TldrawUiMenuItem {...tools.ObsidianNote} />
          <TldrawUiMenuItem {...tools.Transcription} />
          <TldrawUiMenuItem {...tools.Embed} />
          <TldrawUiMenuItem {...tools.Holon} />
          <TldrawUiMenuItem {...tools.Multmux} />
          <TldrawUiMenuItem {...tools.Map} />
          <TldrawUiMenuItem {...tools.calendar} />
          <TldrawUiMenuItem {...tools.SlideShape} />
          <TldrawUiMenuItem {...tools.VideoChat} />
          <TldrawUiMenuItem {...tools.FathomMeetings} />
          <TldrawUiMenuItem {...tools.MycroZineGenerator} />
        </TldrawUiMenuSubmenu>
      </TldrawUiMenuGroup>

      {/* Frames List - Second priority */}
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

      {/* Essential non-edit commands from default context menu */}
      <TldrawUiMenuGroup id="default-actions">
        <TldrawUiMenuItem
          id="select-all"
          label="Select All"
          icon="select-all"
          kbd="ctrl+a"
          onSelect={() => actions['select-all'].onSelect("context-menu")}
        />
        <TldrawUiMenuItem
          id="undo"
          label="Undo"
          icon="undo"
          kbd="ctrl+z"
          onSelect={() => actions.undo.onSelect("context-menu")}
        />
        <TldrawUiMenuItem
          id="redo"
          label="Redo"
          icon="redo"
          kbd="ctrl+y"
          onSelect={() => actions.redo.onSelect("context-menu")}
        />
      </TldrawUiMenuGroup>

      {/* Camera Controls Group */}
      <TldrawUiMenuGroup id="camera-controls">
        <TldrawUiMenuItem {...customActions.zoomToSelection} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.copyLinkToCurrentView} />
        <TldrawUiMenuItem {...customActions.copyFocusLink} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.revertCamera} disabled={!hasCameraHistory} />
        <TldrawUiMenuItem {...customActions.lockElement} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.unlockElement} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.saveToPdf} disabled={!hasSelection} />
        <TldrawUiMenuItem {...customActions.llm} disabled={!hasSelection} />
      </TldrawUiMenuGroup>

      {/* Edit Actions Group */}
      <TldrawUiMenuGroup id="edit-actions">
        <TldrawUiMenuSubmenu id="edit-dropdown" label="Edit">
          <TldrawUiMenuItem
            id="cut"
            label="Cut"
            icon="scissors"
            kbd="ctrl+x"
            disabled={!hasSelection}
            onSelect={() => actions.cut.onSelect("context-menu")}
          />
          <TldrawUiMenuItem
            id="copy"
            label="Copy"
            icon="copy"
            kbd="ctrl+c"
            disabled={!hasSelection}
            onSelect={() => actions.copy.onSelect("context-menu")}
          />
          <TldrawUiMenuItem
            id="paste"
            label="Paste"
            icon="clipboard"
            kbd="ctrl+v"
            onSelect={() => actions.paste.onSelect("context-menu")}
          />
          <TldrawUiMenuItem
            id="duplicate"
            label="Duplicate"
            icon="duplicate"
            kbd="ctrl+d"
            disabled={!hasSelection}
            onSelect={() => actions.duplicate.onSelect("context-menu")}
          />
          <TldrawUiMenuItem
            id="delete"
            label="Delete"
            icon="trash"
            kbd="⌫"
            disabled={!hasSelection}
            onSelect={() => actions.delete.onSelect("context-menu")}
          />
        </TldrawUiMenuSubmenu>
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
