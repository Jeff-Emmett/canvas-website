import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class PrivateWorkspaceTool extends BaseBoxShapeTool {
  static override id = "PrivateWorkspace"
  shapeType = "PrivateWorkspace"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
