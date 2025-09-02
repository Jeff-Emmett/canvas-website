import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type IPromptShape = TLBaseShape<
  "Prompt",
  {
    w: number
    h: number
    prompt: string
    response: string
  }
>

export class PromptShape extends BaseBoxShapeUtil<IPromptShape> {
  static override type = "Prompt"

  getDefaultProps(): IPromptShape["props"] {
    return {
      w: 300,
      h: 200,
      prompt: "",
      response: "",
    }
  }

  indicator(_shape: IPromptShape) {
    return null // Simplified for worker
  }

  component(_shape: IPromptShape) {
    return null // No React components in worker
  }
}
