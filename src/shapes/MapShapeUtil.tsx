/**
 * MapShapeUtil - tldraw shape for embedding interactive OSM maps
 *
 * Renders a MapLibre GL JS map as a resizable shape on the canvas,
 * enabling geographic visualization alongside other canvas elements.
 */

import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, TLResizeInfo, resizeBox, T } from 'tldraw';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/open-mapping/hooks/useMapInstance';
import { useRouting } from '@/open-mapping/hooks/useRouting';
import { StandardizedToolWrapper } from '@/components/StandardizedToolWrapper';
import { usePinnedToView } from '@/hooks/usePinnedToView';
import type { MapViewport, Coordinate, Waypoint, Route, MapLayer, RoutingServiceConfig } from '@/open-mapping/types';
import type { LensType } from '@/open-mapping/lenses/types';

// Default OSRM routing configuration (public demo server - replace with self-hosted for production)
const DEFAULT_ROUTING_CONFIG: RoutingServiceConfig = {
  provider: 'osrm',
  baseUrl: 'https://router.project-osrm.org',
  timeout: 10000,
};

// =============================================================================
// Subsystem Configuration Types
// =============================================================================

/** Shared location entry for a collaborator */
export interface SharedLocation {
  userId: string;
  userName: string;
  color: string;
  coordinate: Coordinate;
  timestamp: number;
  privacyLevel: 'city' | 'neighborhood' | 'block' | 'precise';
}

/** Presence subsystem - privacy-preserving location sharing */
export interface MapPresenceConfig {
  enabled: boolean;
  isSharing: boolean;
  privacyLevel: 'city' | 'neighborhood' | 'block' | 'precise';
  /** Shared locations from all collaborators - keyed by oduserId for conflict-free updates */
  sharedLocations: Record<string, SharedLocation>;
}

/** Lens subsystem - alternative map projections */
export interface MapLensConfig {
  enabled: boolean;
  activeLens: LensType;
  blendTransition: boolean;
}

/** Display-friendly Discovery Anchor (simplified from full zkGPS type) */
export interface DiscoveryAnchorMarker {
  id: string;
  name: string;
  description?: string;
  type: 'physical' | 'nfc' | 'qr' | 'ble' | 'virtual' | 'temporal' | 'social';
  visibility: 'hidden' | 'hinted' | 'revealed' | 'public';
  coordinate: Coordinate;
  discovered?: boolean;
  createdAt: number;
}

/** Display-friendly Spore marker */
export interface SporeMarker {
  id: string;
  type: 'explorer' | 'connector' | 'nurturer' | 'guardian' | 'catalyst';
  coordinate: Coordinate;
  strength: number; // 0-100 vitality
  connections: string[]; // IDs of connected spores
  plantedAt: number;
  plantedBy?: string;
}

/** Display-friendly Hunt marker (treasure hunt waypoint) */
export interface HuntMarker {
  id: string;
  huntId: string;
  huntName: string;
  sequence: number; // Order in the hunt
  coordinate: Coordinate;
  found?: boolean;
  hint?: string;
}

/** Discovery subsystem - location games and treasure hunts */
export interface MapDiscoveryConfig {
  enabled: boolean;
  showAnchors: boolean;
  showSpores: boolean;
  showHunts: boolean;
  activeHuntId?: string;
  /** Synced anchor data for map visualization */
  anchors: DiscoveryAnchorMarker[];
  /** Synced spore data for mycelium network visualization */
  spores: SporeMarker[];
  /** Synced hunt waypoints for treasure hunt visualization */
  hunts: HuntMarker[];
}

/** Routing subsystem - waypoints and route visualization */
export interface MapRoutingConfig {
  enabled: boolean;
  waypoints: Waypoint[];
  routes: Route[];
  activeRouteId?: string;
  showAlternatives: boolean;
}

/** Conics subsystem - possibility cones visualization */
export interface MapConicsConfig {
  enabled: boolean;
  showCones: boolean;
  pipelineId?: string;
}

// =============================================================================
// Main MapShape Type
// =============================================================================

export type IMapShape = TLBaseShape<
  'Map',
  {
    // Core dimensions
    w: number;
    h: number;

    // Viewport state
    viewport: MapViewport;

    // Canvas integration
    pinnedToView: boolean;
    tags: string[];

    // Base map configuration
    styleUrl?: string;
    interactive: boolean;
    layers: MapLayer[];

    // Subsystem configurations
    presence: MapPresenceConfig;
    lenses: MapLensConfig;
    discovery: MapDiscoveryConfig;
    routing: MapRoutingConfig;
    conics: MapConicsConfig;
  }
>;

const DEFAULT_VIEWPORT: MapViewport = {
  center: { lat: 40.7128, lng: -74.006 }, // NYC
  zoom: 12,
  bearing: 0,
  pitch: 0,
};

// Default subsystem configurations
const DEFAULT_PRESENCE: MapPresenceConfig = {
  enabled: false,
  isSharing: false,
  privacyLevel: 'neighborhood',
  sharedLocations: {},
};

const DEFAULT_LENSES: MapLensConfig = {
  enabled: false,
  activeLens: 'geographic',
  blendTransition: true,
};

const DEFAULT_DISCOVERY: MapDiscoveryConfig = {
  enabled: false,
  showAnchors: true,
  showSpores: true,
  showHunts: true,
  anchors: [],
  spores: [],
  hunts: [],
};

const DEFAULT_ROUTING: MapRoutingConfig = {
  enabled: false,
  waypoints: [],
  routes: [],
  showAlternatives: false,
};

const DEFAULT_CONICS: MapConicsConfig = {
  enabled: false,
  showCones: true,
};

// Quick location presets for easy navigation
const LOCATION_PRESETS: { name: string; viewport: MapViewport }[] = [
  { name: 'New York', viewport: { center: { lat: 40.7128, lng: -74.006 }, zoom: 12, bearing: 0, pitch: 0 } },
  { name: 'London', viewport: { center: { lat: 51.5074, lng: -0.1278 }, zoom: 12, bearing: 0, pitch: 0 } },
  { name: 'Tokyo', viewport: { center: { lat: 35.6762, lng: 139.6503 }, zoom: 12, bearing: 0, pitch: 0 } },
  { name: 'San Francisco', viewport: { center: { lat: 37.7749, lng: -122.4194 }, zoom: 12, bearing: 0, pitch: 0 } },
  { name: 'Paris', viewport: { center: { lat: 48.8566, lng: 2.3522 }, zoom: 12, bearing: 0, pitch: 0 } },
];

export class MapShape extends BaseBoxShapeUtil<IMapShape> {
  static override type = 'Map' as const;

  // All complex nested props use T.any for backwards compatibility
  static override props = {
    w: T.number,
    h: T.number,
    viewport: T.any,
    pinnedToView: T.boolean,
    tags: T.any,
    styleUrl: T.any,
    interactive: T.boolean,
    layers: T.any,
    presence: T.any,
    lenses: T.any,
    discovery: T.any,
    routing: T.any,
    conics: T.any,
  };

  // Map theme color: Green (nature/earth)
  static readonly PRIMARY_COLOR = '#22c55e';

  getDefaultProps(): IMapShape['props'] {
    return {
      // Core dimensions
      w: 600,
      h: 400,

      // Viewport
      viewport: DEFAULT_VIEWPORT,

      // Canvas integration
      pinnedToView: false,
      tags: ['map', 'geo'],

      // Base map
      styleUrl: 'https://demotiles.maplibre.org/style.json',
      interactive: true,
      layers: [],

      // Subsystems (all disabled by default for performance)
      presence: DEFAULT_PRESENCE,
      lenses: DEFAULT_LENSES,
      discovery: DEFAULT_DISCOVERY,
      routing: DEFAULT_ROUTING,
      conics: DEFAULT_CONICS,
    };
  }

  override canResize() {
    return true;
  }

  override canEdit() {
    return false;
  }

  override onResize(shape: IMapShape, info: TLResizeInfo<IMapShape>) {
    return resizeBox(shape, info);
  }

  indicator(shape: IMapShape) {
    return (
      <rect
        x={0}
        y={0}
        width={shape.props.w}
        height={shape.props.h}
        fill="none"
        rx={8}
      />
    );
  }

  component(shape: IMapShape) {
    return <MapShapeComponent shape={shape} editor={this.editor} />;
  }
}

// Separate component for hooks
function MapShapeComponent({
  shape,
  editor,
}: {
  shape: IMapShape;
  editor: MapShape['editor'];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showSubsystemPanel, setShowSubsystemPanel] = useState(false);
  const [showLensMenu, setShowLensMenu] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const collaboratorMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const anchorMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const sporeMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const huntMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const sporeConnectionsLayerId = useRef<string | null>(null);
  const isSelected = editor.getSelectedShapeIds().includes(shape.id);

  // Provide safe defaults for all props (backwards compatibility)
  const props = useMemo(() => ({
    ...shape.props,
    viewport: shape.props.viewport || DEFAULT_VIEWPORT,
    tags: shape.props.tags || ['map', 'geo'],
    layers: shape.props.layers || [],
    presence: shape.props.presence || DEFAULT_PRESENCE,
    lenses: shape.props.lenses || DEFAULT_LENSES,
    discovery: shape.props.discovery || DEFAULT_DISCOVERY,
    routing: shape.props.routing || DEFAULT_ROUTING,
    conics: shape.props.conics || DEFAULT_CONICS,
  }), [shape.props]);

  // Get current user info for presence
  const currentUser = useMemo(() => {
    const prefs = editor.user.getUserPreferences();
    return {
      userId: prefs.id || 'anonymous',
      userName: prefs.name || 'Anonymous',
      color: prefs.color || '#3b82f6',
    };
  }, [editor]);

  // Use pinned to view hook
  usePinnedToView(editor, shape.id, shape.props.pinnedToView);

  // Routing hook
  const {
    calculateRoute,
    isCalculating: routingIsCalculating,
    error: routingError,
  } = useRouting({
    config: DEFAULT_ROUTING_CONFIG,
    onRouteCalculated: (route) => {
      // Update shape with calculated route
      editor.updateShape<IMapShape>({
        id: shape.id,
        type: 'Map',
        props: {
          ...shape.props,
          routing: {
            ...shape.props.routing,
            routes: [...shape.props.routing.routes, route],
            activeRouteId: route.id,
          },
        },
      });
      setIsCalculatingRoute(false);
    },
    onError: (err) => {
      console.error('Routing error:', err);
      setIsCalculatingRoute(false);
    },
  });

  // Initialize map
  const { isLoaded, error, viewport, setViewport, flyTo, resize, getMap } = useMapInstance({
    container: containerRef.current,
    config: {
      provider: 'maplibre',
      styleUrl: shape.props.styleUrl,
      maxZoom: 19,
    },
    initialViewport: shape.props.viewport,
    interactive: shape.props.interactive,
    onViewportChange: (newViewport) => {
      // Debounce updates to the shape to avoid too many syncs
      // Only update if significantly changed
      const current = shape.props.viewport;
      const centerChanged =
        Math.abs(current.center.lat - newViewport.center.lat) > 0.001 ||
        Math.abs(current.center.lng - newViewport.center.lng) > 0.001;
      const zoomChanged = Math.abs(current.zoom - newViewport.zoom) > 0.1;

      if (centerChanged || zoomChanged) {
        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: {
            ...shape.props,
            viewport: newViewport,
          },
        });
      }
    },
    onClick: (coord) => {
      // Add waypoint when routing is enabled
      if (shape.props.routing.enabled) {
        const newWaypoint: Waypoint = {
          id: `wp-${Date.now()}`,
          coordinate: coord,
          name: `Waypoint ${shape.props.routing.waypoints.length + 1}`,
          color: '#3b82f6',
        };

        const updatedWaypoints = [...shape.props.routing.waypoints, newWaypoint];

        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: {
            ...shape.props,
            routing: {
              ...shape.props.routing,
              waypoints: updatedWaypoints,
            },
          },
        });

        // Auto-calculate route when we have 2+ waypoints
        if (updatedWaypoints.length >= 2) {
          setIsCalculatingRoute(true);
          calculateRoute(updatedWaypoints);
        }
      }
    },
  });

  // Resize map when shape dimensions change
  useEffect(() => {
    resize();
  }, [shape.props.w, shape.props.h, resize]);

  // ==========================================================================
  // Routing Layer Management - Waypoint Markers
  // ==========================================================================

  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded) return;

    // Get current waypoint IDs
    const currentWaypointIds = new Set(shape.props.routing.waypoints.map((w) => w.id));

    // Remove markers that are no longer in waypoints
    markersRef.current.forEach((marker, id) => {
      if (!currentWaypointIds.has(id) || !shape.props.routing.enabled) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers for current waypoints
    if (shape.props.routing.enabled) {
      shape.props.routing.waypoints.forEach((waypoint, index) => {
        let marker = markersRef.current.get(waypoint.id);

        if (!marker) {
          // Create marker element
          const el = document.createElement('div');
          el.className = 'waypoint-marker';
          el.style.cssText = `
            width: 32px;
            height: 32px;
            background: ${waypoint.color || '#3b82f6'};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            cursor: grab;
            transition: transform 0.15s ease;
          `;
          el.textContent = String(index + 1);
          el.title = waypoint.name || `Waypoint ${index + 1}`;

          // Hover effect
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.15)';
          });
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
          });

          // Create MapLibre marker
          marker = new maplibregl.Marker({
            element: el,
            draggable: true,
            anchor: 'center',
          })
            .setLngLat([waypoint.coordinate.lng, waypoint.coordinate.lat])
            .addTo(map);

          // Handle drag end - update waypoint position
          marker.on('dragend', () => {
            const lngLat = marker!.getLngLat();
            const updatedWaypoints = shape.props.routing.waypoints.map((wp) =>
              wp.id === waypoint.id
                ? { ...wp, coordinate: { lat: lngLat.lat, lng: lngLat.lng } }
                : wp
            );

            editor.updateShape<IMapShape>({
              id: shape.id,
              type: 'Map',
              props: {
                ...shape.props,
                routing: {
                  ...shape.props.routing,
                  waypoints: updatedWaypoints,
                },
              },
            });

            // Recalculate route after drag
            if (updatedWaypoints.length >= 2) {
              setIsCalculatingRoute(true);
              calculateRoute(updatedWaypoints);
            }
          });

          markersRef.current.set(waypoint.id, marker);
        } else {
          // Update existing marker position
          marker.setLngLat([waypoint.coordinate.lng, waypoint.coordinate.lat]);
          // Update marker content (index may have changed)
          const el = marker.getElement();
          if (el) {
            el.textContent = String(index + 1);
            el.title = waypoint.name || `Waypoint ${index + 1}`;
          }
        }
      });
    }

    // Cleanup on unmount
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
    };
  }, [shape.props.routing.enabled, shape.props.routing.waypoints, isLoaded, getMap, shape.id, editor, shape.props, calculateRoute]);

  // Add route polylines to the map
  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded) return;

    const sourceId = `route-source-${shape.id}`;
    const layerId = `route-layer-${shape.id}`;

    // Clean up existing route layers
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    // Add routes if routing is enabled and we have routes
    if (shape.props.routing.enabled && shape.props.routing.routes.length > 0) {
      const activeRoute = shape.props.routing.activeRouteId
        ? shape.props.routing.routes.find((r) => r.id === shape.props.routing.activeRouteId)
        : shape.props.routing.routes[0];

      if (activeRoute?.geometry) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: activeRoute.geometry,
          },
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': MapShape.PRIMARY_COLOR,
            'line-width': 5,
            'line-opacity': 0.8,
          },
        });
      }
    }

    return () => {
      // Cleanup on unmount
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [shape.props.routing.enabled, shape.props.routing.routes, shape.props.routing.activeRouteId, isLoaded, getMap, shape.id]);

  // ==========================================================================
  // Discovery Layer Management - Anchors, Spores, Hunts
  // ==========================================================================

  // Get discovery config with safe defaults
  const discoveryConfig = useMemo(() => ({
    ...DEFAULT_DISCOVERY,
    ...shape.props.discovery,
    anchors: shape.props.discovery?.anchors || [],
    spores: shape.props.discovery?.spores || [],
    hunts: shape.props.discovery?.hunts || [],
  }), [shape.props.discovery]);

  // Anchor marker styling based on type and visibility
  const getAnchorMarkerStyle = useCallback((anchor: DiscoveryAnchorMarker) => {
    const baseColors: Record<string, string> = {
      physical: '#22c55e',    // Green
      nfc: '#3b82f6',         // Blue
      qr: '#8b5cf6',          // Purple
      ble: '#06b6d4',         // Cyan
      virtual: '#f59e0b',     // Amber
      temporal: '#ec4899',    // Pink
      social: '#10b981',      // Emerald
    };
    const color = baseColors[anchor.type] || '#6b7280';
    const opacity = anchor.visibility === 'hidden' ? 0.4 : anchor.visibility === 'hinted' ? 0.7 : 1;
    const icon = anchor.discovered ? '✓' : anchor.type === 'nfc' ? '📡' : anchor.type === 'qr' ? '📱' : '📍';
    return { color, opacity, icon };
  }, []);

  // Spore marker styling based on type and strength
  const getSporeMarkerStyle = useCallback((spore: SporeMarker) => {
    const sporeColors: Record<string, string> = {
      explorer: '#22c55e',    // Green - explores new areas
      connector: '#3b82f6',   // Blue - connects networks
      nurturer: '#f59e0b',    // Amber - strengthens network
      guardian: '#ef4444',    // Red - protects territory
      catalyst: '#8b5cf6',    // Purple - triggers events
    };
    const color = sporeColors[spore.type] || '#6b7280';
    const size = 16 + (spore.strength / 100) * 12; // 16-28px based on strength
    return { color, size };
  }, []);

  // Manage anchor markers
  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded) return;

    const anchors = discoveryConfig.anchors;
    const showAnchors = discoveryConfig.enabled && discoveryConfig.showAnchors;
    const currentAnchorIds = new Set(anchors.map(a => a.id));

    // Remove markers that are no longer in anchors or if anchors are hidden
    anchorMarkersRef.current.forEach((marker, id) => {
      if (!currentAnchorIds.has(id) || !showAnchors) {
        marker.remove();
        anchorMarkersRef.current.delete(id);
      }
    });

    // Add/update anchor markers
    if (showAnchors) {
      anchors.forEach((anchor) => {
        // Skip hidden anchors unless discovered
        if (anchor.visibility === 'hidden' && !anchor.discovered) return;

        let marker = anchorMarkersRef.current.get(anchor.id);
        const style = getAnchorMarkerStyle(anchor);

        if (!marker) {
          const el = document.createElement('div');
          el.className = 'anchor-marker';
          el.style.cssText = `
            width: 36px;
            height: 36px;
            background: ${style.color};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            cursor: pointer;
            opacity: ${style.opacity};
            transition: transform 0.15s ease, opacity 0.2s ease;
          `;
          el.textContent = style.icon;
          el.title = anchor.visibility === 'hidden' ? '???' : anchor.name;

          // Hover effect
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.2)';
          });
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
          });

          marker = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat([anchor.coordinate.lng, anchor.coordinate.lat])
            .addTo(map);

          anchorMarkersRef.current.set(anchor.id, marker);
        } else {
          // Update position if changed
          marker.setLngLat([anchor.coordinate.lng, anchor.coordinate.lat]);
        }
      });
    }

    return () => {
      anchorMarkersRef.current.forEach((marker) => marker.remove());
      anchorMarkersRef.current.clear();
    };
  }, [discoveryConfig, isLoaded, getMap, getAnchorMarkerStyle]);

  // Manage spore markers and mycelium network connections
  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded) return;

    const spores = discoveryConfig.spores;
    const showSpores = discoveryConfig.enabled && discoveryConfig.showSpores;
    const currentSporeIds = new Set(spores.map(s => s.id));

    // Remove markers for spores that no longer exist
    sporeMarkersRef.current.forEach((marker, id) => {
      if (!currentSporeIds.has(id) || !showSpores) {
        marker.remove();
        sporeMarkersRef.current.delete(id);
      }
    });

    // Remove network layer if not showing
    const networkLayerId = `spore-network-${shape.id}`;
    const networkSourceId = `spore-network-source-${shape.id}`;
    if (!showSpores && map.getLayer(networkLayerId)) {
      map.removeLayer(networkLayerId);
      map.removeSource(networkSourceId);
      sporeConnectionsLayerId.current = null;
    }

    if (showSpores && spores.length > 0) {
      // Add/update spore markers
      spores.forEach((spore) => {
        let marker = sporeMarkersRef.current.get(spore.id);
        const style = getSporeMarkerStyle(spore);

        if (!marker) {
          const el = document.createElement('div');
          el.className = 'spore-marker';
          el.style.cssText = `
            width: ${style.size}px;
            height: ${style.size}px;
            background: radial-gradient(circle at 30% 30%, ${style.color}, ${style.color}88);
            border: 2px solid ${style.color};
            border-radius: 50%;
            box-shadow: 0 0 ${spore.strength / 10}px ${style.color}88;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            animation: spore-pulse 3s ease-in-out infinite;
          `;
          el.title = `${spore.type} spore (${spore.strength}% strength)`;

          // Add pulsing animation
          const keyframes = `
            @keyframes spore-pulse {
              0%, 100% { transform: scale(1); opacity: 0.9; }
              50% { transform: scale(1.1); opacity: 1; }
            }
          `;
          if (!document.getElementById('spore-pulse-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spore-pulse-keyframes';
            style.textContent = keyframes;
            document.head.appendChild(style);
          }

          // Hover effect
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.3)';
            el.style.boxShadow = `0 0 ${spore.strength / 5}px ${style.color}`;
          });
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
            el.style.boxShadow = `0 0 ${spore.strength / 10}px ${style.color}88`;
          });

          marker = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat([spore.coordinate.lng, spore.coordinate.lat])
            .addTo(map);

          sporeMarkersRef.current.set(spore.id, marker);
        } else {
          marker.setLngLat([spore.coordinate.lng, spore.coordinate.lat]);
        }
      });

      // Draw mycelium connections between spores
      const connections: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      spores.forEach((spore) => {
        spore.connections.forEach((connectedId) => {
          const connectedSpore = spores.find(s => s.id === connectedId);
          if (connectedSpore) {
            connections.push({
              type: 'Feature',
              properties: { strength: (spore.strength + connectedSpore.strength) / 2 },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [spore.coordinate.lng, spore.coordinate.lat],
                  [connectedSpore.coordinate.lng, connectedSpore.coordinate.lat],
                ],
              },
            });
          }
        });
      });

      if (connections.length > 0) {
        // Update or add network layer
        if (map.getSource(networkSourceId)) {
          (map.getSource(networkSourceId) as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: connections,
          });
        } else {
          map.addSource(networkSourceId, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: connections,
            },
          });

          map.addLayer({
            id: networkLayerId,
            type: 'line',
            source: networkSourceId,
            paint: {
              'line-color': '#22c55e',
              'line-width': 2,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2],
            },
          });
          sporeConnectionsLayerId.current = networkLayerId;
        }
      }
    }

    return () => {
      sporeMarkersRef.current.forEach((marker) => marker.remove());
      sporeMarkersRef.current.clear();
      if (map.getLayer(networkLayerId)) {
        map.removeLayer(networkLayerId);
      }
      if (map.getSource(networkSourceId)) {
        map.removeSource(networkSourceId);
      }
    };
  }, [discoveryConfig, isLoaded, getMap, shape.id, getSporeMarkerStyle]);

  // Manage treasure hunt markers
  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded) return;

    const hunts = discoveryConfig.hunts;
    const showHunts = discoveryConfig.enabled && discoveryConfig.showHunts;
    const activeHuntId = discoveryConfig.activeHuntId;
    const currentHuntMarkerIds = new Set(hunts.map(h => h.id));

    // Remove markers that no longer exist
    huntMarkersRef.current.forEach((marker, id) => {
      if (!currentHuntMarkerIds.has(id) || !showHunts) {
        marker.remove();
        huntMarkersRef.current.delete(id);
      }
    });

    if (showHunts) {
      // Filter by active hunt if set
      const visibleHunts = activeHuntId
        ? hunts.filter(h => h.huntId === activeHuntId)
        : hunts;

      visibleHunts.forEach((hunt) => {
        let marker = huntMarkersRef.current.get(hunt.id);

        if (!marker) {
          const el = document.createElement('div');
          el.className = 'hunt-marker';
          const isFound = hunt.found;
          el.style.cssText = `
            width: 40px;
            height: 40px;
            background: ${isFound ? '#22c55e' : '#f59e0b'};
            border: 3px solid white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
            color: white;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            cursor: pointer;
            transition: transform 0.15s ease;
          `;
          el.textContent = isFound ? '✓' : String(hunt.sequence);
          el.title = isFound
            ? `${hunt.huntName} #${hunt.sequence} (Found!)`
            : `${hunt.huntName} #${hunt.sequence}${hunt.hint ? `: ${hunt.hint}` : ''}`;

          // Hover effect
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.15)';
          });
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
          });

          marker = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat([hunt.coordinate.lng, hunt.coordinate.lat])
            .addTo(map);

          huntMarkersRef.current.set(hunt.id, marker);
        } else {
          marker.setLngLat([hunt.coordinate.lng, hunt.coordinate.lat]);
        }
      });
    }

    return () => {
      huntMarkersRef.current.forEach((marker) => marker.remove());
      huntMarkersRef.current.clear();
    };
  }, [discoveryConfig, isLoaded, getMap]);

  // ==========================================================================
  // Presence System - Location Tracking
  // ==========================================================================

  useEffect(() => {
    // Start/stop location watching based on presence sharing state
    if (shape.props.presence.enabled && shape.props.presence.isSharing) {
      if (!navigator.geolocation) {
        setLocationError('Geolocation not supported');
        return;
      }

      // Start watching position
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coord: Coordinate = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude ?? undefined,
          };
          setUserLocation(coord);
          setLocationError(null);
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError('Location permission denied');
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError('Location unavailable');
              break;
            case error.TIMEOUT:
              setLocationError('Location request timeout');
              break;
            default:
              setLocationError('Unknown location error');
          }
        },
        {
          enableHighAccuracy: shape.props.presence.privacyLevel === 'precise',
          timeout: 10000,
          maximumAge: shape.props.presence.privacyLevel === 'precise' ? 0 : 30000,
        }
      );

      watchIdRef.current = watchId;

      return () => {
        navigator.geolocation.clearWatch(watchId);
        watchIdRef.current = null;
      };
    } else {
      // Clear watch when not sharing
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setUserLocation(null);
    }
  }, [shape.props.presence.enabled, shape.props.presence.isSharing, shape.props.presence.privacyLevel]);

  // User location marker on map
  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded) return;

    // Remove marker if not sharing or no location
    if (!shape.props.presence.enabled || !shape.props.presence.isSharing || !userLocation) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      return;
    }

    // Create or update user location marker
    if (!userLocationMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 4px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 2px 8px rgba(0,0,0,0.3);
        animation: pulse 2s ease-in-out infinite;
      `;

      // Add pulse animation style if not exists
      if (!document.getElementById('presence-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'presence-marker-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 2px 8px rgba(0,0,0,0.3); }
            50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0,0,0,0.3); }
          }
        `;
        document.head.appendChild(style);
      }

      userLocationMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userLocationMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }

    return () => {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
    };
  }, [shape.props.presence.enabled, shape.props.presence.isSharing, userLocation, isLoaded, getMap]);

  // ==========================================================================
  // Collaborative Presence - Sync location to sharedLocations (Automerge)
  // ==========================================================================

  // Update sharedLocations when user's location changes
  useEffect(() => {
    if (!shape.props.presence.enabled || !shape.props.presence.isSharing || !userLocation) {
      // Remove user's entry from sharedLocations when not sharing
      if (shape.props.presence.sharedLocations[currentUser.userId]) {
        const updatedLocations = { ...shape.props.presence.sharedLocations };
        delete updatedLocations[currentUser.userId];
        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: {
            ...shape.props,
            presence: {
              ...shape.props.presence,
              sharedLocations: updatedLocations,
            },
          },
        });
      }
      return;
    }

    // Debounce location updates to avoid excessive syncs
    const existingEntry = shape.props.presence.sharedLocations[currentUser.userId];
    const shouldUpdate = !existingEntry ||
      Math.abs(existingEntry.coordinate.lat - userLocation.lat) > 0.0001 ||
      Math.abs(existingEntry.coordinate.lng - userLocation.lng) > 0.0001 ||
      Date.now() - existingEntry.timestamp > 30000; // Update at least every 30s

    if (shouldUpdate) {
      const newEntry: SharedLocation = {
        userId: currentUser.userId,
        userName: currentUser.userName,
        color: currentUser.color,
        coordinate: userLocation,
        timestamp: Date.now(),
        privacyLevel: shape.props.presence.privacyLevel,
      };

      editor.updateShape<IMapShape>({
        id: shape.id,
        type: 'Map',
        props: {
          ...shape.props,
          presence: {
            ...shape.props.presence,
            sharedLocations: {
              ...shape.props.presence.sharedLocations,
              [currentUser.userId]: newEntry,
            },
          },
        },
      });
    }
  }, [
    shape.props.presence.enabled,
    shape.props.presence.isSharing,
    userLocation,
    currentUser,
    shape.id,
    editor,
    shape.props,
  ]);

  // Render markers for other collaborators' shared locations
  useEffect(() => {
    const map = getMap();
    if (!map || !isLoaded || !shape.props.presence.enabled) {
      // Clear all collaborator markers when not in presence mode
      collaboratorMarkersRef.current.forEach((marker) => marker.remove());
      collaboratorMarkersRef.current.clear();
      return;
    }

    const sharedLocations = shape.props.presence.sharedLocations || {};
    const currentLocationIds = new Set(Object.keys(sharedLocations));

    // Remove markers for users who stopped sharing
    collaboratorMarkersRef.current.forEach((marker, oduserId) => {
      if (!currentLocationIds.has(oduserId) || oduserId === currentUser.userId) {
        marker.remove();
        collaboratorMarkersRef.current.delete(oduserId);
      }
    });

    // Add/update markers for other collaborators
    Object.entries(sharedLocations).forEach(([oduserId, location]) => {
      // Skip our own location (we render that separately with pulsing animation)
      if (oduserId === currentUser.userId) return;

      // Skip stale locations (older than 5 minutes)
      if (Date.now() - location.timestamp > 5 * 60 * 1000) return;

      let marker = collaboratorMarkersRef.current.get(oduserId);

      if (!marker) {
        // Create marker element for collaborator
        const el = document.createElement('div');
        el.className = 'collaborator-location-marker';
        el.style.cssText = `
          width: 28px;
          height: 28px;
          background: ${location.color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
          cursor: pointer;
        `;
        // Show first letter of username
        el.textContent = location.userName.charAt(0).toUpperCase();
        el.title = `${location.userName} (${location.privacyLevel})`;

        marker = new maplibregl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([location.coordinate.lng, location.coordinate.lat])
          .addTo(map);

        collaboratorMarkersRef.current.set(oduserId, marker);
      } else {
        // Update existing marker position
        marker.setLngLat([location.coordinate.lng, location.coordinate.lat]);
        // Update tooltip
        const el = marker.getElement();
        if (el) {
          el.title = `${location.userName} (${location.privacyLevel})`;
        }
      }
    });

    return () => {
      // Cleanup on unmount
      collaboratorMarkersRef.current.forEach((marker) => marker.remove());
      collaboratorMarkersRef.current.clear();
    };
  }, [shape.props.presence.enabled, shape.props.presence.sharedLocations, isLoaded, getMap, currentUser.userId]);

  const handleClose = useCallback(() => {
    editor.deleteShape(shape.id);
  }, [editor, shape.id]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  const handlePinToggle = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: {
        ...shape.props,
        pinnedToView: !shape.props.pinnedToView,
      },
    });
  }, [editor, shape.id, shape.props]);

  const handleInteractiveToggle = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: {
        ...shape.props,
        interactive: !shape.props.interactive,
      },
    });
  }, [editor, shape.id, shape.props]);

  const handlePresetSelect = useCallback(
    (preset: (typeof LOCATION_PRESETS)[0]) => {
      flyTo(preset.viewport.center, preset.viewport.zoom);
      setShowPresets(false);
    },
    [flyTo]
  );

  // ==========================================================================
  // Subsystem Toggle Handlers
  // ==========================================================================

  const toggleSubsystem = useCallback(
    (subsystem: 'presence' | 'lenses' | 'discovery' | 'routing' | 'conics') => {
      const config = shape.props[subsystem];
      editor.updateShape<IMapShape>({
        id: shape.id,
        type: 'Map',
        props: {
          ...shape.props,
          [subsystem]: {
            ...config,
            enabled: !config.enabled,
          },
        },
      });
    },
    [editor, shape.id, shape.props]
  );

  const togglePresenceSharing = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: {
        ...shape.props,
        presence: {
          ...shape.props.presence,
          isSharing: !shape.props.presence.isSharing,
        },
      },
    });
  }, [editor, shape.id, shape.props]);

  const setActiveLens = useCallback(
    (lens: LensType) => {
      editor.updateShape<IMapShape>({
        id: shape.id,
        type: 'Map',
        props: {
          ...shape.props,
          lenses: {
            ...shape.props.lenses,
            activeLens: lens,
          },
        },
      });
    },
    [editor, shape.id, shape.props]
  );

  // Computed state for UI
  const activeSubsystems = useMemo(() => {
    const active: string[] = [];
    if (shape.props.presence.enabled) active.push('presence');
    if (shape.props.lenses.enabled) active.push('lenses');
    if (shape.props.discovery.enabled) active.push('discovery');
    if (shape.props.routing.enabled) active.push('routing');
    if (shape.props.conics.enabled) active.push('conics');
    return active;
  }, [shape.props]);

  // Subsystem button style helper
  const getSubsystemButtonStyle = useCallback(
    (enabled: boolean) => ({
      padding: '3px 6px',
      fontSize: '10px',
      background: enabled ? MapShape.PRIMARY_COLOR : '#555',
      color: 'white',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
      opacity: enabled ? 1 : 0.7,
    }),
    []
  );

  // Available lens types for dropdown
  const LENS_OPTIONS: { type: LensType; label: string; icon: string }[] = [
    { type: 'geographic', label: 'Geographic', icon: '🗺️' },
    { type: 'temporal', label: 'Temporal', icon: '⏱️' },
    { type: 'attention', label: 'Attention', icon: '👁️' },
    { type: 'incentive', label: 'Incentive', icon: '💰' },
    { type: 'relational', label: 'Relational', icon: '🔗' },
    { type: 'possibility', label: 'Possibility', icon: '🌀' },
  ];

  // Header content with coordinates display and toolbar buttons
  const headerContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden' }}>
      {/* Primary row: coords + basic controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
        <span style={{ fontSize: '14px' }}>🗺️</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '11px',
            fontFamily: 'monospace',
            flex: 1,
            color: '#ccc',
          }}
        >
          {isLoaded
            ? `${viewport.center.lat.toFixed(4)}, ${viewport.center.lng.toFixed(4)} z${viewport.zoom.toFixed(1)}`
            : 'Loading...'}
        </span>

        {/* Active subsystem indicators */}
        {activeSubsystems.length > 0 && (
          <div style={{ display: 'flex', gap: '2px' }}>
            {shape.props.presence.enabled && <span title="Presence active">👥</span>}
            {shape.props.lenses.enabled && <span title={`Lens: ${shape.props.lenses.activeLens}`}>🔮</span>}
            {shape.props.discovery.enabled && <span title="Discovery active">🎮</span>}
            {shape.props.routing.enabled && <span title="Routing active">🛣️</span>}
            {shape.props.conics.enabled && <span title="Conics active">📐</span>}
          </div>
        )}

        {/* Interactive toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); handleInteractiveToggle(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            background: shape.props.interactive ? MapShape.PRIMARY_COLOR : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
          title={shape.props.interactive ? 'Lock map' : 'Unlock map'}
        >
          {shape.props.interactive ? '🔓' : '🔒'}
        </button>

        {/* Subsystem panel toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSubsystemPanel(!showSubsystemPanel); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            background: showSubsystemPanel ? MapShape.PRIMARY_COLOR : '#444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
          title="Toggle subsystem controls"
        >
          ⚙️
        </button>

        {/* Location presets */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPresets(!showPresets); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              background: '#444',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
            title="Quick locations"
          >
            📍
          </button>
          {showPresets && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: '#333',
                borderRadius: '6px',
                padding: '4px',
                zIndex: 1000,
                minWidth: '120px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {LOCATION_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={(e) => { e.stopPropagation(); handlePresetSelect(preset); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '12px',
                    background: 'transparent',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#555'; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subsystem controls panel (expandable) */}
      {showSubsystemPanel && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '4px 0',
            borderTop: '1px solid #444',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Presence toggle + share button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSubsystem('presence'); }}
            style={getSubsystemButtonStyle(shape.props.presence.enabled)}
            title="Toggle presence system (location sharing)"
          >
            👥 Presence
          </button>
          {shape.props.presence.enabled && (
            <button
              onClick={(e) => { e.stopPropagation(); togglePresenceSharing(); }}
              style={{
                ...getSubsystemButtonStyle(shape.props.presence.isSharing),
                background: shape.props.presence.isSharing ? '#ef4444' : '#3b82f6',
              }}
              title={shape.props.presence.isSharing ? 'Stop sharing location' : 'Share my location'}
            >
              {shape.props.presence.isSharing ? '📍 Sharing' : '📍 Share'}
            </button>
          )}

          {/* Lenses toggle + lens selector */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSubsystem('lenses'); }}
            style={getSubsystemButtonStyle(shape.props.lenses.enabled)}
            title="Toggle lens system (alternative map views)"
          >
            🔮 Lenses
          </button>
          {shape.props.lenses.enabled && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowLensMenu(!showLensMenu); }}
                style={{
                  ...getSubsystemButtonStyle(true),
                  background: '#8b5cf6',
                }}
                title="Select map lens"
              >
                {LENS_OPTIONS.find((l) => l.type === shape.props.lenses.activeLens)?.icon || '🔮'}{' '}
                {shape.props.lenses.activeLens}
              </button>
              {showLensMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#333',
                    borderRadius: '6px',
                    padding: '4px',
                    zIndex: 1001,
                    minWidth: '140px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  {LENS_OPTIONS.map((lens) => (
                    <button
                      key={lens.type}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLens(lens.type);
                        setShowLensMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '12px',
                        background: shape.props.lenses.activeLens === lens.type ? '#8b5cf6' : 'transparent',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>{lens.icon}</span>
                      <span>{lens.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Discovery toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSubsystem('discovery'); }}
            style={getSubsystemButtonStyle(shape.props.discovery.enabled)}
            title="Toggle discovery system (games, treasure hunts)"
          >
            🎮 Discovery
          </button>

          {/* Routing toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSubsystem('routing'); }}
            style={getSubsystemButtonStyle(shape.props.routing.enabled)}
            title="Toggle routing system (waypoints, routes)"
          >
            🛣️ Routing
          </button>

          {/* Conics toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSubsystem('conics'); }}
            style={getSubsystemButtonStyle(shape.props.conics.enabled)}
            title="Toggle possibility cones visualization"
          >
            📐 Conics
          </button>
        </div>
      )}
    </div>
  );

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
      <StandardizedToolWrapper
        title="Map"
        headerContent={headerContent}
        primaryColor={MapShape.PRIMARY_COLOR}
        isSelected={isSelected}
        width={shape.props.w}
        height={shape.props.h}
        onClose={handleClose}
        onMinimize={handleMinimize}
        isMinimized={isMinimized}
        editor={editor}
        shapeId={shape.id}
        isPinnedToView={shape.props.pinnedToView}
        onPinToggle={handlePinToggle}
        tags={shape.props.tags}
        onTagsChange={(newTags) => {
          editor.updateShape<IMapShape>({
            id: shape.id,
            type: 'Map',
            props: {
              ...shape.props,
              tags: newTags,
            },
          });
        }}
        tagsEditable={true}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '0 0 8px 8px',
          }}
          // Prevent canvas events when interacting with map
          onPointerDown={(e) => {
            if (shape.props.interactive) {
              e.stopPropagation();
            }
          }}
          onWheel={(e) => {
            if (shape.props.interactive) {
              e.stopPropagation();
            }
          }}
        >
          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1a1a1a',
                color: '#ef4444',
                fontSize: '14px',
              }}
            >
              Failed to load map: {error.message}
            </div>
          )}
          {!isLoaded && !error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1a1a1a',
                color: '#888',
                fontSize: '14px',
              }}
            >
              Loading map...
            </div>
          )}

          {/* Routing Panel - Shows when routing is enabled */}
          {isLoaded && shape.props.routing.enabled && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: 'rgba(30, 30, 30, 0.95)',
                borderRadius: '8px',
                padding: '10px 14px',
                minWidth: '180px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontSize: '12px',
                color: 'white',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛣️</span>
                <span>Route Planning</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Waypoints:</span>
                  <span>{shape.props.routing.waypoints.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Routes:</span>
                  <span>{isCalculatingRoute ? '...' : shape.props.routing.routes.length}</span>
                </div>
                {shape.props.routing.routes.length > 0 && shape.props.routing.routes[0]?.summary && (
                  <>
                    <div style={{ borderTop: '1px solid #444', margin: '4px 0', paddingTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#999' }}>Distance:</span>
                        <span>{(shape.props.routing.routes[0].summary.distance / 1000).toFixed(1)} km</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#999' }}>Duration:</span>
                        <span>{Math.round(shape.props.routing.routes[0].summary.duration / 60)} min</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Route calculation status */}
              {isCalculatingRoute && (
                <div style={{ marginTop: '8px', padding: '6px', background: '#333', borderRadius: '4px', textAlign: 'center' }}>
                  <span style={{ color: '#22c55e' }}>⏳ Calculating route...</span>
                </div>
              )}

              {/* Clear route button */}
              {shape.props.routing.waypoints.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    editor.updateShape<IMapShape>({
                      id: shape.id,
                      type: 'Map',
                      props: {
                        ...shape.props,
                        routing: {
                          ...shape.props.routing,
                          waypoints: [],
                          routes: [],
                          activeRouteId: undefined,
                        },
                      },
                    });
                  }}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '6px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}
                >
                  🗑️ Clear Route
                </button>
              )}

              <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                Click map to add waypoints • Drag to reorder
              </div>
            </div>
          )}

          {/* Presence Panel - Shows when presence is enabled */}
          {isLoaded && shape.props.presence.enabled && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                background: 'rgba(30, 30, 30, 0.95)',
                borderRadius: '8px',
                padding: '10px 14px',
                minWidth: '180px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontSize: '12px',
                color: 'white',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>👥</span>
                <span>Location Presence</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Status:</span>
                  <span style={{ color: shape.props.presence.isSharing ? '#22c55e' : '#666' }}>
                    {shape.props.presence.isSharing ? '● Sharing' : '○ Not sharing'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Privacy:</span>
                  <span style={{ textTransform: 'capitalize' }}>{shape.props.presence.privacyLevel}</span>
                </div>

                {/* Show collaborator count */}
                {(() => {
                  const collaboratorCount = Object.keys(shape.props.presence.sharedLocations || {})
                    .filter(id => id !== currentUser.userId && Date.now() - (shape.props.presence.sharedLocations[id]?.timestamp || 0) < 5 * 60 * 1000)
                    .length;
                  return collaboratorCount > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#999' }}>Online:</span>
                      <span style={{ color: '#22c55e' }}>{collaboratorCount} collaborator{collaboratorCount !== 1 ? 's' : ''}</span>
                    </div>
                  ) : null;
                })()}

                {/* Show location when sharing */}
                {shape.props.presence.isSharing && userLocation && (
                  <div style={{ borderTop: '1px solid #444', margin: '4px 0', paddingTop: '4px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#888' }}>
                      {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                    </div>
                  </div>
                )}

                {/* Show error if any */}
                {locationError && (
                  <div style={{ padding: '4px 8px', background: '#ef4444', borderRadius: '4px', fontSize: '10px' }}>
                    ⚠️ {locationError}
                  </div>
                )}

                {/* Share/Stop button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePresenceSharing();
                  }}
                  style={{
                    marginTop: '4px',
                    padding: '6px 12px',
                    background: shape.props.presence.isSharing ? '#ef4444' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}
                >
                  {shape.props.presence.isSharing ? '⏹ Stop Sharing' : '📍 Share Location'}
                </button>

                {/* Go to my location button */}
                {userLocation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      flyTo(userLocation, 15);
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  >
                    🎯 Go to My Location
                  </button>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                zkGPS privacy-preserving
              </div>
            </div>
          )}

          {/* Discovery Panel - Shows when discovery is enabled */}
          {isLoaded && shape.props.discovery.enabled && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(30, 30, 30, 0.95)',
                borderRadius: '8px',
                padding: '10px 14px',
                minWidth: '140px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontSize: '12px',
                color: 'white',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🎮</span>
                <span>Discovery</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shape.props.discovery.showAnchors}
                    onChange={() => {
                      editor.updateShape<IMapShape>({
                        id: shape.id,
                        type: 'Map',
                        props: {
                          ...shape.props,
                          discovery: { ...shape.props.discovery, showAnchors: !shape.props.discovery.showAnchors },
                        },
                      });
                    }}
                    style={{ accentColor: MapShape.PRIMARY_COLOR }}
                  />
                  <span>Show Anchors</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shape.props.discovery.showSpores}
                    onChange={() => {
                      editor.updateShape<IMapShape>({
                        id: shape.id,
                        type: 'Map',
                        props: {
                          ...shape.props,
                          discovery: { ...shape.props.discovery, showSpores: !shape.props.discovery.showSpores },
                        },
                      });
                    }}
                    style={{ accentColor: MapShape.PRIMARY_COLOR }}
                  />
                  <span>Show Spores</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shape.props.discovery.showHunts}
                    onChange={() => {
                      editor.updateShape<IMapShape>({
                        id: shape.id,
                        type: 'Map',
                        props: {
                          ...shape.props,
                          discovery: { ...shape.props.discovery, showHunts: !shape.props.discovery.showHunts },
                        },
                      });
                    }}
                    style={{ accentColor: MapShape.PRIMARY_COLOR }}
                  />
                  <span>Show Hunts</span>
                </label>
              </div>

              {/* Stats display */}
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#888', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span>📍 {discoveryConfig.anchors.length}</span>
                <span>🍄 {discoveryConfig.spores.length}</span>
                <span>🏆 {discoveryConfig.hunts.length}</span>
              </div>

              {/* Demo buttons */}
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add demo anchor at current map center
                    const center = shape.props.viewport.center;
                    const offset = (Math.random() - 0.5) * 0.02;
                    const newAnchor: DiscoveryAnchorMarker = {
                      id: `anchor-${Date.now()}`,
                      name: `Discovery Point ${discoveryConfig.anchors.length + 1}`,
                      type: ['physical', 'nfc', 'qr', 'virtual'][Math.floor(Math.random() * 4)] as any,
                      visibility: 'revealed',
                      coordinate: { lat: center.lat + offset, lng: center.lng + offset },
                      discovered: false,
                      createdAt: Date.now(),
                    };
                    editor.updateShape<IMapShape>({
                      id: shape.id,
                      type: 'Map',
                      props: {
                        ...shape.props,
                        discovery: {
                          ...shape.props.discovery,
                          anchors: [...(shape.props.discovery.anchors || []), newAnchor],
                        },
                      },
                    });
                  }}
                  style={{
                    padding: '5px 10px',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  + Add Anchor
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add demo spore at current map center
                    const center = shape.props.viewport.center;
                    const offset = (Math.random() - 0.5) * 0.02;
                    const existingSpores = shape.props.discovery.spores || [];
                    const newSpore: SporeMarker = {
                      id: `spore-${Date.now()}`,
                      type: ['explorer', 'connector', 'nurturer', 'guardian', 'catalyst'][Math.floor(Math.random() * 5)] as any,
                      coordinate: { lat: center.lat + offset, lng: center.lng + offset },
                      strength: Math.floor(Math.random() * 60) + 40,
                      connections: existingSpores.length > 0
                        ? [existingSpores[Math.floor(Math.random() * existingSpores.length)].id]
                        : [],
                      plantedAt: Date.now(),
                    };
                    editor.updateShape<IMapShape>({
                      id: shape.id,
                      type: 'Map',
                      props: {
                        ...shape.props,
                        discovery: {
                          ...shape.props.discovery,
                          spores: [...existingSpores, newSpore],
                        },
                      },
                    });
                  }}
                  style={{
                    padding: '5px 10px',
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  + Add Spore
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add demo hunt waypoint at current map center
                    const center = shape.props.viewport.center;
                    const offset = (Math.random() - 0.5) * 0.02;
                    const existingHunts = shape.props.discovery.hunts || [];
                    const huntId = existingHunts.length > 0 ? existingHunts[0].huntId : `hunt-${Date.now()}`;
                    const huntName = existingHunts.length > 0 ? existingHunts[0].huntName : 'Demo Treasure Hunt';
                    const newHunt: HuntMarker = {
                      id: `hunt-wp-${Date.now()}`,
                      huntId,
                      huntName,
                      sequence: existingHunts.filter(h => h.huntId === huntId).length + 1,
                      coordinate: { lat: center.lat + offset, lng: center.lng + offset },
                      found: false,
                      hint: 'Look near the landmark...',
                    };
                    editor.updateShape<IMapShape>({
                      id: shape.id,
                      type: 'Map',
                      props: {
                        ...shape.props,
                        discovery: {
                          ...shape.props.discovery,
                          hunts: [...existingHunts, newHunt],
                        },
                      },
                    });
                  }}
                  style={{
                    padding: '5px 10px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  + Add Hunt Point
                </button>

                {/* Clear all button */}
                {(discoveryConfig.anchors.length > 0 || discoveryConfig.spores.length > 0 || discoveryConfig.hunts.length > 0) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.updateShape<IMapShape>({
                        id: shape.id,
                        type: 'Map',
                        props: {
                          ...shape.props,
                          discovery: {
                            ...shape.props.discovery,
                            anchors: [],
                            spores: [],
                            hunts: [],
                          },
                        },
                      });
                    }}
                    style={{
                      marginTop: '4px',
                      padding: '5px 10px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: 'bold',
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lens Indicator - Shows active lens when not geographic */}
          {isLoaded && shape.props.lenses.enabled && shape.props.lenses.activeLens !== 'geographic' && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(139, 92, 246, 0.9)',
                borderRadius: '16px',
                padding: '6px 12px',
                fontSize: '11px',
                color: 'white',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
              }}
            >
              <span>🔮</span>
              <span style={{ textTransform: 'capitalize' }}>{shape.props.lenses.activeLens} Lens</span>
            </div>
          )}
        </div>
      </StandardizedToolWrapper>
    </HTMLContainer>
  );
}

export default MapShape;
