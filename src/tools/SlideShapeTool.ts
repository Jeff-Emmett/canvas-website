import { BaseBoxShapeTool, TLEventHandlers } from 'tldraw'

export class SlideShapeTool extends BaseBoxShapeTool {
	static override id = 'Slide'
	static override initial = 'idle'
	override shapeType = 'Slide'

	constructor(editor: any) {
		super(editor)
		//console.log('SlideShapeTool constructed', { id: this.id, shapeType: this.shapeType })
	}

	override onComplete: TLEventHandlers["onComplete"] = () => {
		this.editor.setCurrentTool('select')
	}
}