import { BaseBoxShapeTool } from "tldraw"

export class EmbedTool extends BaseBoxShapeTool {
  static override id = "Embed"
  shapeType = "Embed"
  override initial = "idle"
}
