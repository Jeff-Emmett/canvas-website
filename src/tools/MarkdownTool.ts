import { BaseBoxShapeTool } from "tldraw"

export class MarkdownTool extends BaseBoxShapeTool {
  static override id = "MarkdownTool"
  shapeType = "MarkdownTool"
  override initial = "idle"
}
