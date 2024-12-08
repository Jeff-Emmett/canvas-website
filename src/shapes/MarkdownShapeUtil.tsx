/** TODO: build this */

import { BaseBoxShapeUtil, TLBaseBoxShape, TLBaseShape } from "tldraw"
import MdEditor from "react-markdown-editor-lite"
import MarkdownIt from "markdown-it"
import "react-markdown-editor-lite/lib/index.css"

// Initialize markdown parser
const mdParser = new MarkdownIt()

export type IMarkdownShape = TLBaseShape<
  "MarkdownTool",
  {
    content: string
    html: string
  }
>

export class MarkdownShape extends BaseBoxShapeUtil<
  IMarkdownShape & TLBaseBoxShape
> {
  static override type = "MarkdownTool"

  indicator(_shape: IMarkdownShape) {
    return null
  }

  getDefaultProps(): IMarkdownShape["props"] & { w: number; h: number } {
    return {
      content: "# New Note",
      html: "<h1>New Note</h1>",
      w: 400,
      h: 300,
    }
  }

  component(shape: IMarkdownShape & TLBaseBoxShape) {
    const handleEditorChange = ({
      text,
      html,
    }: {
      text: string
      html: string
    }) => {
      // Update the shape's content
      this.editor?.updateShape({
        id: shape.id,
        type: "MarkdownTool",
        props: {
          ...shape.props,
          content: text,
          html: html,
        },
      })
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "white",
          borderRadius: "4px",
        }}
      >
        <MdEditor
          style={{ height: "100%" }}
          renderHTML={(text) => mdParser.render(text)}
          value={shape.props.content}
          onChange={handleEditorChange}
          view={{ menu: true, md: true, html: false }}
          canView={{
            menu: true,
            md: true,
            html: false,
            both: false,
            fullScreen: false,
            hideMenu: false,
          }}
        />
      </div>
    )
  }
}
