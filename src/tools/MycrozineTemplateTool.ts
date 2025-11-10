import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class MycrozineTemplateTool extends BaseBoxShapeTool {
  static override id = "MycrozineTemplate"
  shapeType = "MycrozineTemplate"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
} 