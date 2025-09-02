import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
// Worker-compatible version

export type IMarkdownShape = TLBaseShape<
  "Markdown",
  {
    w: number
    h: number
    text: string
  }
>

export class MarkdownShape extends BaseBoxShapeUtil<IMarkdownShape> {
  static override type = "Markdown"

  getDefaultProps(): IMarkdownShape["props"] {
    return {
      w: 300,
      h: 200,
      text: "# Markdown\n\nYour content here...",
    }
  }

  indicator(_shape: IMarkdownShape) {
    return null // Simplified for worker
  }

  component(_shape: IMarkdownShape) {
    return null // No React components in worker
  }
}
