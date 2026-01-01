import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class BlenderGenTool extends BaseBoxShapeTool {
  static override id = 'BlenderGen'
  static override initial = 'idle'
  override shapeType = 'BlenderGen'

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}
