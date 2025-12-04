/**
 * WaypointMarker - Interactive waypoint markers
 */

import type { Waypoint } from '../types';

interface WaypointMarkerProps {
  waypoint: Waypoint;
  index?: number;
  isSelected?: boolean;
  isDraggable?: boolean;
  onSelect?: (waypointId: string) => void;
  onDragEnd?: (waypointId: string, newCoordinate: { lat: number; lng: number }) => void;
  onDelete?: (waypointId: string) => void;
}

export function WaypointMarker({ waypoint, isSelected = false }: WaypointMarkerProps) {
  // TODO: Implement marker rendering (Phase 1)
  return null;
}

export default WaypointMarker;
