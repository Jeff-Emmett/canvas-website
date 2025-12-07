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

export function WaypointMarker({
  waypoint: _waypoint,
  index: _index,
  isSelected: _isSelected = false,
  isDraggable: _isDraggable = true,
  showLabel: _showLabel = true,
  showTime: _showTime = false,
  showBudget: _showBudget = false,
  onSelect: _onSelect,
  onDragEnd: _onDragEnd,
  onDelete: _onDelete,
}: WaypointMarkerProps) {
  // TODO: Implement marker rendering with MapLibre GL JS
  // This will be implemented in Phase 1

  return null; // Markers are rendered directly on the map
}

export default WaypointMarker;
