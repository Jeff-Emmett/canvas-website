/** TODO: build this */

import { BaseBoxShapeUtil, TLBaseBoxShape, TLBaseShape } from "tldraw"

export type IMarkdownShape = TLBaseShape<
  "MarkdownTool",
  {
    content: string
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
      content: "",
      w: 100,
      h: 100,
    }
  }

  component(shape: IMarkdownShape) {
    return <div>{shape.props.content}</div>
  }
}
