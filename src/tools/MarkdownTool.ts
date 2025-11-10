import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class MarkdownTool extends BaseBoxShapeTool {
  static override id = "Markdown"
  shapeType = "Markdown"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
