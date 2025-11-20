import { useState } from "react"
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, useEditor } from "tldraw"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { TerminalContent } from "../components/TerminalContent"

export type ITerminalShape = TLBaseShape<
  "Terminal",
  {
    w: number
    h: number
    sessionId: string
    collaborationMode: boolean
    ownerId: string
    pinnedToView: boolean
    tags: string[]
    fontFamily: string
    fontSize: number
    terminalTheme: "dark" | "light"
  }
>

export class TerminalShape extends BaseBoxShapeUtil<ITerminalShape> {
  static override type = "Terminal"
  static readonly PRIMARY_COLOR = "#10b981" // Green for terminal

  getDefaultProps(): ITerminalShape["props"] {
    return {
      w: 800,
      h: 600,
      sessionId: "",
      collaborationMode: false,
      ownerId: "",
      pinnedToView: false,
      tags: ['terminal'],
      fontFamily: "Monaco, Menlo, 'Courier New', monospace",
      fontSize: 13,
      terminalTheme: "dark"
    }
  }

  indicator(shape: ITerminalShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }

  component(shape: ITerminalShape) {
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<ITerminalShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handleSessionChange = (newSessionId: string) => {
      this.editor.updateShape<ITerminalShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          sessionId: newSessionId,
        },
      })
    }

    const handleCollaborationToggle = () => {
      this.editor.updateShape<ITerminalShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          collaborationMode: !shape.props.collaborationMode,
        },
      })
    }

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="Terminal"
          primaryColor={TerminalShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<ITerminalShape>({
              id: shape.id,
              type: 'Terminal',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <TerminalContent
            sessionId={shape.props.sessionId}
            collaborationMode={shape.props.collaborationMode}
            ownerId={shape.props.ownerId}
            fontFamily={shape.props.fontFamily}
            fontSize={shape.props.fontSize}
            theme={shape.props.terminalTheme}
            isMinimized={isMinimized}
            width={shape.props.w}
            height={shape.props.h - 40}
            onSessionChange={handleSessionChange}
            onCollaborationToggle={handleCollaborationToggle}
          />
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }
}
