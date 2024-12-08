import { BaseBoxShapeUtil, TLBaseBoxShape, TLBaseShape } from "tldraw"
import ReactMarkdown from "react-markdown"
import { useCallback, useState, useEffect } from "react"

export type IMarkdownShape = TLBaseShape<
  "markdown",
  {
    content: string
    w: number
    h: number
    isEditing: boolean
    fill: string
    color: string
  }
>

export class MarkdownShape extends BaseBoxShapeUtil<
  IMarkdownShape & TLBaseBoxShape
> {
  static override type = "Markdown"
  static override props = {
    content: {
      type: "string",
      value: "# New Note",
      validate: (value: unknown) => typeof value === "string",
    },
    w: {
      type: "number",
      value: 400,
      validate: (value: unknown) => typeof value === "number",
    },
    h: {
      type: "number",
      value: 300,
      validate: (value: unknown) => typeof value === "number",
    },
    isEditing: {
      type: "boolean",
      value: false,
      validate: (value: unknown) => typeof value === "boolean",
    },
    fill: {
      type: "string",
      value: "white",
      validate: (value: unknown) => typeof value === "string",
    },
    color: {
      type: "string",
      value: "black",
      validate: (value: unknown) => typeof value === "string",
    },
  }

  override getDefaultProps(): IMarkdownShape["props"] &
    TLBaseBoxShape["props"] {
    return {
      w: 400,
      h: 300,
      content: "# New Note",
      isEditing: false,
      fill: "white",
      color: "black",
    }
  }

  getStyleProps(shape: IMarkdownShape) {
    return {
      fill: shape.props.fill,
      color: shape.props.color,
    }
  }

  override indicator(shape: IMarkdownShape & TLBaseBoxShape) {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.props.w,
      height: shape.props.h,
      rotation: shape.rotation,
    }
  }

  component(shape: IMarkdownShape & TLBaseBoxShape) {
    const [isEditing, setIsEditing] = useState(shape.props.isEditing)

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.editor?.updateShape({
          id: shape.id,
          type: "markdown",
          props: {
            ...shape.props,
            content: e.target.value,
          },
        })
      },
      [shape.id],
    )

    const toggleEdit = useCallback(() => {
      setIsEditing(!isEditing)
      this.editor?.updateShape({
        id: shape.id,
        type: "markdown",
        props: {
          ...shape.props,
          isEditing: !isEditing,
        },
      })
    }, [isEditing, shape.id, shape.props])

    useEffect(() => {
      return () => {
        if (isEditing) {
          this.editor?.updateShape({
            id: shape.id,
            type: "markdown",
            props: {
              ...shape.props,
              isEditing: false,
            },
          })
        }
      }
    }, [shape.id, isEditing])

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: "white",
          borderRadius: "4px",
          padding: "8px",
          overflow: "auto",
          cursor: "pointer",
        }}
        onDoubleClick={toggleEdit}
      >
        {isEditing ? (
          <textarea
            value={shape.props.content}
            onChange={handleChange}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              backgroundColor: "transparent",
            }}
            autoFocus
            onBlur={toggleEdit}
          />
        ) : (
          <ReactMarkdown>{shape.props.content}</ReactMarkdown>
        )}
      </div>
    )
  }
}
