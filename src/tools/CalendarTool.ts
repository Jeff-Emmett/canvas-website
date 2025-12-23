/**
 * CalendarTool - Tool for placing Calendar shapes on the canvas
 * Uses BaseBoxShapeTool for reliable click-to-place behavior
 */

import { BaseBoxShapeTool } from 'tldraw';

export class CalendarTool extends BaseBoxShapeTool {
  static override id = 'calendar';
  static override initial = 'idle';
  override shapeType = 'Calendar';
}

export default CalendarTool;
