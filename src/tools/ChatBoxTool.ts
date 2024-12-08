import { BaseBoxShapeTool } from "tldraw"

export class ChatBoxTool extends BaseBoxShapeTool {
  static override id = "ChatBox"
  shapeType = "ChatBox"
  override initial = "idle"
}
