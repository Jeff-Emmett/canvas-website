import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class ImageGenTool extends BaseBoxShapeTool {
  static override id = 'ImageGen'
  static override initial = 'idle'
  override shapeType = 'ImageGen'

  override onComplete: TLEventHandlers["onComplete"] = () => {
    console.log('🎨 ImageGenTool: Shape creation completed')
    this.editor.setCurrentTool('select')
  }
}


