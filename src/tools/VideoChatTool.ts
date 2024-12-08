import { BaseBoxShapeTool } from "tldraw"

export class VideoChatTool extends BaseBoxShapeTool {
  static override id = "VideoChat"
  shapeType = "VideoChat"
  override initial = "idle"
}
