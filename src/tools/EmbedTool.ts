import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class EmbedTool extends BaseBoxShapeTool {
  static override id = "Embed"
  shapeType = "Embed"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
