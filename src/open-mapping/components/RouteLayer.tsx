/**
 * RouteLayer - Renders route polylines on the map
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
  car: '#3B82F6', truck: '#6366F1', motorcycle: '#8B5CF6',
  bicycle: '#10B981', mountain_bike: '#059669', road_bike: '#14B8A6',
  foot: '#F59E0B', hiking: '#D97706', wheelchair: '#EC4899', transit: '#6B7280',
};

export function RouteLayer({ routes, selectedRouteId, profileColors = {} }: RouteLayerProps) {
  // TODO: Implement route rendering (Phase 2)
  return null;
}

export default RouteLayer;
