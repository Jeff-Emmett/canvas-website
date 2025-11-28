import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class IOChipTool extends BaseBoxShapeTool {
  static override id = 'IOChip'
  static override initial = 'idle'
  override shapeType = 'IOChip'

  override onComplete: TLEventHandlers["onComplete"] = () => {
    console.log('🔌 IOChipTool: IO Chip created')
    // Switch back to select tool after creating the chip
    this.editor.setCurrentTool('select')
  }
}
