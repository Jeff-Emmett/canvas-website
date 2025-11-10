import { BaseBoxShapeTool, TLEventHandlers } from "tldraw"

export class SharedPianoTool extends BaseBoxShapeTool {
  static override id = "SharedPiano"
  shapeType = "SharedPiano"
  override initial = "idle"

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
} 