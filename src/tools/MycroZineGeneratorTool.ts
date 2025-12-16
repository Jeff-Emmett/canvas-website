import { BaseBoxShapeTool } from "tldraw"

export class MycroZineGeneratorTool extends BaseBoxShapeTool {
  static override id = "MycroZineGenerator"
  static override initial = "idle"
  override shapeType = "MycroZineGenerator"
}
