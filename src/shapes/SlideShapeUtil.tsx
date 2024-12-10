import { BaseBoxShapeUtil, TLBaseBoxShape, TLBaseShape } from "tldraw"

export type ISlideShape = TLBaseShape<
  "Slide",
  {
    w: number
    h: number
    currentSlide: number
  }
>

export class SlideShape extends BaseBoxShapeUtil<ISlideShape & TLBaseBoxShape> {
  static override type = "Slide"

  getDefaultProps(): ISlideShape["props"] {
    return {
      w: 720, // Standard slide width
      h: 405, // 16:9 aspect ratio
      currentSlide: 0,
    }
  }

  component(shape: ISlideShape) {
    return null // Slides don't need visual representation
  }

  indicator(shape: ISlideShape & TLBaseBoxShape) {
    return null
  }
}
