import { BaseBoxShapeTool } from "tldraw";

export class VideoChatTool extends BaseBoxShapeTool {
	static override id = 'VideoChat'
	shapeType = 'VideoChat';
	override initial = 'idle';

	// Additional methods for handling video chat functionality can be added here
}