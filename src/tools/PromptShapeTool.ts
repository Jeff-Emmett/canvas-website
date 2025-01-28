import { BaseBoxShapeTool } from 'tldraw'

export class PromptShapeTool extends BaseBoxShapeTool {
  static override id = 'Prompt'
  static override initial = 'idle'
  override shapeType = 'Prompt'

}