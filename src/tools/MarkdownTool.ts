import { BaseBoxShapeTool } from "tldraw"

export class MarkdownTool extends BaseBoxShapeTool {
  static override id = "Markdown"
  shapeType = "Markdown"
  override initial = "idle"
}
