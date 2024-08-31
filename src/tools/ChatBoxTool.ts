import { BaseBoxShapeTool } from "tldraw";

export class ChatBoxTool extends BaseBoxShapeTool {
	shapeType = 'chatBox'
    override initial = 'idle'
}