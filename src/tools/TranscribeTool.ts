import { BaseBoxShapeTool } from "tldraw"

export class TranscribeTool extends BaseBoxShapeTool {
  static override id = "Transcribe"
  shapeType = "Transcribe"
  override initial = "idle"
}
