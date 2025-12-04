/**
 * Open Mapping - Collaborative Route Planning for Canvas
 *
 * A tldraw canvas integration providing advanced mapping and routing capabilities
 * beyond traditional mapping tools like Google Maps.
 *
 * Features:
 * - OpenStreetMap base layers with MapLibre GL JS
 * - Multi-path routing via OSRM/Valhalla
 * - Real-time collaborative route planning
 * - Layer management (custom overlays, POIs, routes)
 * - Calendar/scheduling integration
 * - Budget and cost tracking
 * - Offline capability via PWA
 */

// Components
export { MapCanvas } from './components/MapCanvas';
export { RouteLayer } from './components/RouteLayer';
export { WaypointMarker } from './components/WaypointMarker';
export { LayerPanel } from './components/LayerPanel';

// Hooks
export { useMapInstance } from './hooks/useMapInstance';
export { useRouting } from './hooks/useRouting';
export { useCollaboration } from './hooks/useCollaboration';
export { useLayers } from './hooks/useLayers';

// Services
export { RoutingService } from './services/RoutingService';
export { TileService } from './services/TileService';
export { OptimizationService } from './services/OptimizationService';

// Types
export type * from './types';
