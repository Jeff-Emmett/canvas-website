import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class MermaidGenTool extends BaseBoxShapeTool {
  static override id = 'MermaidGen'
  static override initial = 'idle'
  override shapeType = 'MermaidGen'

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
