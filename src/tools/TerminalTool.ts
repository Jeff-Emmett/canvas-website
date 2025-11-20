import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class TerminalTool extends BaseBoxShapeTool {
  static override id = "Terminal"
  shapeType = "Terminal"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
