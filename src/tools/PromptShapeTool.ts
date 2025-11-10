import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class PromptShapeTool extends BaseBoxShapeTool {
  static override id = 'Prompt'
  static override initial = 'idle'
  override shapeType = 'Prompt'

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.editor.setCurrentTool('select')
  }
}