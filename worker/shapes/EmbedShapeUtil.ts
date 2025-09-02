import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type IEmbedShape = TLBaseShape<
  "Embed",
  {
    w: number
    h: number
    url: string
    title: string
    description: string
    image: string
  }
>

export class EmbedShape extends BaseBoxShapeUtil<IEmbedShape> {
  static override type = "Embed"

  getDefaultProps(): IEmbedShape["props"] {
    return {
      w: 300,
      h: 200,
      url: "",
      title: "",
      description: "",
      image: "",
    }
  }

  indicator(_shape: IEmbedShape) {
    return null // Simplified for worker
  }

  component(_shape: IEmbedShape) {
    return null // No React components in worker
  }
}
