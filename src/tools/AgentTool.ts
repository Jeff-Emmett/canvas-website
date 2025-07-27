import { BaseBoxShapeTool } from "tldraw"

export class AgentTool extends BaseBoxShapeTool {
  static override id = "Agent"
  shapeType = "Agent"
  override initial = "idle"
}
