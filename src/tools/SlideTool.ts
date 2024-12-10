import { BaseBoxShapeTool } from "tldraw"

export class SlideTool extends BaseBoxShapeTool {
  static override id = "Slide"
  shapeType = "Slide"
  override initial = "idle"
}
