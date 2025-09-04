import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type ISharedPianoShape = TLBaseShape<
  "SharedPiano",
  {
    w: number
    h: number
    isMinimized?: boolean
    interactionState?: {
      scrollPosition?: { x: number; y: number }
    }
  }
>

export class SharedPianoShape extends BaseBoxShapeUtil<ISharedPianoShape> {
  static override type = "SharedPiano"

  getDefaultProps(): ISharedPianoShape["props"] {
    return {
      w: 800,
      h: 600,
      isMinimized: false,
    }
  }

  indicator(_shape: ISharedPianoShape) {
    return null // Simplified for worker
  }

  component(_shape: ISharedPianoShape) {
    return null // No React components in worker
  }
}
