import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class ChatBoxTool extends BaseBoxShapeTool {
  static override id = "ChatBox"
  shapeType = "ChatBox"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
