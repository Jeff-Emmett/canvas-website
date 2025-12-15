import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class DrawfastTool extends BaseBoxShapeTool {
  static override id = "Drawfast"
  shapeType = "Drawfast"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
