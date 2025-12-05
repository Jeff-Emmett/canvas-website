/**
 * WaypointMarker - Interactive waypoint markers on the map
 *
 * Features:
 * - Drag-and-drop repositioning
 * - Custom icons and colors
 * - Info popups with waypoint details
 * - Time/budget annotations
 */

import type { Waypoint } from '../types';

interface WaypointMarkerProps {
  waypoint: Waypoint;
  index?: number;
  isSelected?: boolean;
  isDraggable?: boolean;
  showLabel?: boolean;
  showTime?: boolean;
  showBudget?: boolean;
  onSelect?: (waypointId: string) => void;
  onDragEnd?: (waypointId: string, newCoordinate: { lat: number; lng: number }) => void;
  onDelete?: (waypointId: string) => void;
}

export function WaypointMarker(_props: WaypointMarkerProps) {
  // TODO: Implement marker rendering with MapLibre GL JS
  // Props will be used in Phase 1 implementation
  void _props;

  return null; // Markers are rendered directly on the map
}

export default WaypointMarker;
