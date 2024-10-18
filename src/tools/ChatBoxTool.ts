import { BaseBoxShapeTool } from "tldraw";

export class ChatBoxTool extends BaseBoxShapeTool {
    static override id = 'chatBox'
    shapeType = 'chatBox';
    override initial = 'idle';
}