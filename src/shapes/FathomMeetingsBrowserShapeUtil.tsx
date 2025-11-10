import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState } from "react"
import { FathomMeetingsPanel } from "../components/FathomMeetingsPanel"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"

type IFathomMeetingsBrowser = TLBaseShape<
  "FathomMeetingsBrowser",
  {
    w: number
    h: number
  }
>

export class FathomMeetingsBrowserShape extends BaseBoxShapeUtil<IFathomMeetingsBrowser> {
  static override type = "FathomMeetingsBrowser" as const

  getDefaultProps(): IFathomMeetingsBrowser["props"] {
    return {
      w: 800,
      h: 600,
    }
  }

  // Fathom theme color: Blue (Rainbow)
  static readonly PRIMARY_COLOR = "#3b82f6"

  component(shape: IFathomMeetingsBrowser) {
    const { w, h } = shape.props
    const [isOpen, setIsOpen] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    const handleClose = () => {
      setIsOpen(false)
      // Delete the browser shape after a short delay
      setTimeout(() => {
        this.editor.deleteShape(shape.id)
      }, 100)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    if (!isOpen) {
      return null
    }

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Fathom Meetings"
          primaryColor={FathomMeetingsBrowserShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
        >
          <FathomMeetingsPanel
            onClose={handleClose}
            shapeMode={true}
          />
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IFathomMeetingsBrowser) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
