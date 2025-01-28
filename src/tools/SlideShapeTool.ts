import { BaseBoxShapeTool } from 'tldraw'

export class SlideShapeTool extends BaseBoxShapeTool {
	static override id = 'Slide'
	static override initial = 'idle'
	override shapeType = 'Slide'

	constructor(editor: any) {
		super(editor)
		//console.log('SlideShapeTool constructed', { id: this.id, shapeType: this.shapeType })
	}
}