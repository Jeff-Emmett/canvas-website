import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class MultmuxTool extends BaseBoxShapeTool {
  static override id = "Multmux"
  shapeType = "Multmux"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
