import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type ISlideShape = TLBaseShape<
  "Slide",
  {
    w: number
    h: number
    title: string
    content: string
  }
>

export class SlideShape extends BaseBoxShapeUtil<ISlideShape> {
  static override type = "Slide"

  getDefaultProps(): ISlideShape["props"] {
    return {
      w: 400,
      h: 300,
      title: "Slide Title",
      content: "Slide content...",
    }
  }

  indicator(_shape: ISlideShape) {
    return null // Simplified for worker
  }

  component(_shape: ISlideShape) {
    return null // No React components in worker
  }
}
