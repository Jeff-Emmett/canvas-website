import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type IMycrozineTemplateShape = TLBaseShape<
  "MycrozineTemplate",
  {
    w: number
    h: number
    templateType: string
  }
>

export class MycrozineTemplateShape extends BaseBoxShapeUtil<IMycrozineTemplateShape> {
  static override type = "MycrozineTemplate"

  getDefaultProps(): IMycrozineTemplateShape["props"] {
    return {
      w: 400,
      h: 300,
      templateType: "default",
    }
  }

  indicator(_shape: IMycrozineTemplateShape) {
    return null // Simplified for worker
  }

  component(_shape: IMycrozineTemplateShape) {
    return null // No React components in worker
  }
}
