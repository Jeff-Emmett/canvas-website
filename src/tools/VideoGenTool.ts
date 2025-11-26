import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class VideoGenTool extends BaseBoxShapeTool {
  static override id = 'VideoGen'
  static override initial = 'idle'
  override shapeType = 'VideoGen'

  override onComplete: TLEventHandlers["onComplete"] = () => {
    console.log('🎬 VideoGenTool: Shape creation completed')
    this.editor.setCurrentTool('select')
  }
}
