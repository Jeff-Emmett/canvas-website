import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type ISharedPianoShape = TLBaseShape<
  "SharedPiano",
  {
    w: number
    h: number
    isPlaying: boolean
  }
>

export class SharedPianoShape extends BaseBoxShapeUtil<ISharedPianoShape> {
  static override type = "SharedPiano"

  getDefaultProps(): ISharedPianoShape["props"] {
    return {
      w: 400,
      h: 200,
      isPlaying: false,
    }
  }

  indicator(_shape: ISharedPianoShape) {
    return null // Simplified for worker
  }

  component(_shape: ISharedPianoShape) {
    return null // No React components in worker
  }
}
