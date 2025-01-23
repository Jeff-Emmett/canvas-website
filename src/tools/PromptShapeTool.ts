import { BaseBoxShapeTool } from 'tldraw'

export class PromptShapeTool extends BaseBoxShapeTool {
  static override id = 'prompt'
  static override initial = 'idle'
  override shapeType = 'prompt'

}