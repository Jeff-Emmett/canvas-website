/**
 * Open Mapping Type Definitions
 */

// Core Geographic Types
export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Waypoint & Route Types
export interface Waypoint {
  id: string;
  coordinate: Coordinate;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  arrivalTime?: Date;
  departureTime?: Date;
  stayDuration?: number;
  budget?: WaypointBudget;
  metadata?: Record<string, unknown>;
}

export interface WaypointBudget {
  estimated: number;
  actual?: number;
  currency: string;
  category?: 'lodging' | 'food' | 'transport' | 'activity' | 'other';
  notes?: string;
}

export interface Route {
  id: string;
  waypoints: Waypoint[];
  geometry: GeoJSON.LineString;
  profile: RoutingProfile;
  summary: RouteSummary;
  legs: RouteLeg[];
  alternatives?: Route[];
  metadata?: RouteMetadata;
}

export interface RouteSummary {
  distance: number;
  duration: number;
  ascent?: number;
  descent?: number;
  cost?: RouteCost;
}

export interface RouteCost {
  fuel?: number;
  tolls?: number;
  total: number;
  currency: string;
}

export interface RouteLeg {
  startWaypoint: string;
  endWaypoint: string;
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  steps?: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  maneuver: RouteManeuver;
}

export interface RouteManeuver {
  type: ManeuverType;
  modifier?: string;
  bearingBefore: number;
  bearingAfter: number;
  location: Coordinate;
}

export type ManeuverType =
  | 'turn' | 'new name' | 'depart' | 'arrive'
  | 'merge' | 'on ramp' | 'off ramp' | 'fork'
  | 'end of road' | 'continue' | 'roundabout' | 'rotary'
  | 'roundabout turn' | 'notification' | 'exit roundabout';

export interface RouteMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  name?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  shareLink?: string;
}

// Routing Profiles & Options
export type RoutingProfile =
  | 'car' | 'truck' | 'motorcycle'
  | 'bicycle' | 'mountain_bike' | 'road_bike'
  | 'foot' | 'hiking'
  | 'wheelchair'
  | 'transit';

export interface RoutingOptions {
  profile: RoutingProfile;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  preferScenic?: boolean;
  alternatives?: number;
  departureTime?: Date;
  arrivalTime?: Date;
  optimize?: OptimizationType;
  constraints?: RoutingConstraints;
}

export type OptimizationType = 'fastest' | 'shortest' | 'balanced' | 'eco';

export interface RoutingConstraints {
  maxDistance?: number;
  maxDuration?: number;
  maxCost?: number;
  vehicleHeight?: number;
  vehicleWeight?: number;
  vehicleWidth?: number;
}

// Layer Management
export interface MapLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  zIndex: number;
  source: LayerSource;
  style?: LayerStyle;
  metadata?: Record<string, unknown>;
}

export type LayerType =
  | 'basemap' | 'satellite' | 'terrain'
  | 'route' | 'waypoint' | 'poi'
  | 'heatmap' | 'cluster'
  | 'geojson' | 'custom';

export interface LayerSource {
  type: 'vector' | 'raster' | 'geojson' | 'image';
  url?: string;
  data?: GeoJSON.FeatureCollection;
  tiles?: string[];
  attribution?: string;
}

export interface LayerStyle {
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  icon?: string;
  iconSize?: number;
}

// Collaboration Types
export interface CollaborationSession {
  id: string;
  name: string;
  participants: Participant[];
  routes: Route[];
  layers: MapLayer[];
  viewport: MapViewport;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  name: string;
  color: string;
  cursor?: Coordinate;
  isActive: boolean;
  lastSeen: Date;
  permissions: ParticipantPermissions;
}

export interface ParticipantPermissions {
  canEdit: boolean;
  canAddWaypoints: boolean;
  canDeleteWaypoints: boolean;
  canChangeRoute: boolean;
  canInvite: boolean;
}

export interface MapViewport {
  center: Coordinate;
  zoom: number;
  bearing: number;
  pitch: number;
}

// Calendar & Scheduling
export interface TripItinerary {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  routes: Route[];
  events: ItineraryEvent[];
  budget: TripBudget;
  participants: string[];
}

export interface ItineraryEvent {
  id: string;
  waypointId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  type: EventType;
  confirmed: boolean;
  cost?: number;
  bookingRef?: string;
  url?: string;
}

export type EventType =
  | 'travel' | 'lodging' | 'activity'
  | 'meal' | 'meeting' | 'rest' | 'other';

export interface TripBudget {
  total: number;
  spent: number;
  currency: string;
  categories: BudgetCategory[];
}

export interface BudgetCategory {
  name: string;
  allocated: number;
  spent: number;
  items: BudgetItem[];
}

export interface BudgetItem {
  description: string;
  amount: number;
  date?: Date;
  waypointId?: string;
  eventId?: string;
  receipt?: string;
}

// Service Configurations
export interface RoutingServiceConfig {
  provider: 'osrm' | 'valhalla' | 'graphhopper' | 'openrouteservice';
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface TileServiceConfig {
  provider: 'maplibre' | 'leaflet';
  styleUrl?: string;
  tileUrl?: string;
  maxZoom?: number;
  attribution?: string;
}

export interface OptimizationServiceConfig {
  provider: 'vroom' | 'graphhopper';
  baseUrl: string;
  apiKey?: string;
}
