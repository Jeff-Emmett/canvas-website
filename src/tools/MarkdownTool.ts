import { BaseBoxShapeTool } from "tldraw"

export class MarkdownTool extends BaseBoxShapeTool {
  static override id = "markdown"
  shapeType = "markdown"
  override initial = "idle"
}
