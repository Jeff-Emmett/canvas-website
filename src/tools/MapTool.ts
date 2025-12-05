/**
 * MapTool - Tool for placing Map shapes on the canvas
 */

import { BaseBoxShapeTool } from 'tldraw';

export class MapTool extends BaseBoxShapeTool {
  static override id = 'map';
  static override initial = 'idle';
  override shapeType = 'Map';
}

export default MapTool;
