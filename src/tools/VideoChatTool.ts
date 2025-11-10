import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class VideoChatTool extends BaseBoxShapeTool {
  static override id = "VideoChat"
  shapeType = "VideoChat"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
