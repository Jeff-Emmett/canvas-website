import { BaseBoxShapeTool } from "tldraw"

export class SharedPianoTool extends BaseBoxShapeTool {
  static override id = "SharedPiano"
  shapeType = "SharedPiano"
  override initial = "idle"
} 