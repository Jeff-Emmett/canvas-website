import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class GoogleItemTool extends BaseBoxShapeTool {
  static override id = "GoogleItem"
  shapeType = "GoogleItem"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
