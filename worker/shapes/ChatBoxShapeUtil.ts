import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type IChatBoxShape = TLBaseShape<
  "ChatBox",
  {
    w: number
    h: number
    roomId: string
    userName: string
  }
>

export class ChatBoxShape extends BaseBoxShapeUtil<IChatBoxShape> {
  static override type = "ChatBox"

  getDefaultProps(): IChatBoxShape["props"] {
    return {
      roomId: "default-room",
      w: 100,
      h: 100,
      userName: "",
    }
  }

  indicator(_shape: IChatBoxShape) {
    return null // Simplified for worker
  }

  component(_shape: IChatBoxShape) {
    return null // No React components in worker
  }
}
