/**
 * RouteLayer - Renders route polylines on the map
 *
 * Displays computed routes with support for:
 * - Multiple alternative routes
 * - Turn-by-turn visualization
 * - Elevation profile overlay
 * - Interactive route editing
 */

import type { Route, RoutingProfile } from '../types';

interface RouteLayerProps {
  routes: Route[];
  selectedRouteId?: string;
  showAlternatives?: boolean;
  showElevation?: boolean;
  onRouteSelect?: (routeId: string) => void;
  onRouteEdit?: (routeId: string, geometry: GeoJSON.LineString) => void;
  profileColors?: Partial<Record<RoutingProfile, string>>;
}

const DEFAULT_PROFILE_COLORS: Record<RoutingProfile, string> = {
  car: '#3B82F6',        // blue
  truck: '#6366F1',      // indigo
  motorcycle: '#8B5CF6', // violet
  bicycle: '#10B981',    // emerald
  mountain_bike: '#059669', // green
  road_bike: '#14B8A6',  // teal
  foot: '#F59E0B',       // amber
  hiking: '#D97706',     // orange
  wheelchair: '#EC4899', // pink
  transit: '#6B7280',    // gray
};

export function RouteLayer({
  routes,
  selectedRouteId,
  showAlternatives = true,
  showElevation = false,
  onRouteSelect,
  onRouteEdit,
  profileColors = {},
}: RouteLayerProps) {
  const colors = { ...DEFAULT_PROFILE_COLORS, ...profileColors };

  // TODO: Implement route rendering with MapLibre GL JS
  // This will be implemented in Phase 2

  return null; // Routes are rendered directly on the map canvas
}

export default RouteLayer;
