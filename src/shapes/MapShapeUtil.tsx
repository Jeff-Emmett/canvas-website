/**
 * MapShapeUtil - Mapus-inspired collaborative map shape for tldraw
 *
 * Inspired by https://github.com/alyssaxuu/mapus
 *
 * Features:
 * - Real-time collaboration with user cursors/presence
 * - Find Nearby places (restaurants, hotels, etc.)
 * - Drawing tools (markers, lines, areas)
 * - Annotations list with visibility toggle
 * - Color picker for annotations
 * - Search and routing (Nominatim + OSRM)
 * - GPS location sharing
 * - "Observe" mode to follow other users
 */

import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, TLResizeInfo, resizeBox, T } from 'tldraw';
import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper';
import { usePinnedToView } from '../hooks/usePinnedToView';
import { useMaximize } from '../hooks/useMaximize';

// =============================================================================
// Types
// =============================================================================

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface MapViewport {
  center: Coordinate;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface Annotation {
  id: string;
  type: 'marker' | 'line' | 'area';
  name: string;
  color: string;
  visible: boolean;
  coordinates: Coordinate[]; // Single for marker, multiple for line/area
  createdBy?: string;
  createdAt: number;
}

export interface RouteInfo {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
}

export interface CollaboratorPresence {
  id: string;
  name: string;
  color: string;
  cursor?: Coordinate;
  location?: Coordinate;
  isObserving?: string; // ID of user being observed
  lastSeen: number;
}

export type IMapShape = TLBaseShape<
  'Map',
  {
    w: number;
    h: number;
    viewport: MapViewport;
    styleKey: string;
    title: string;
    description: string;
    annotations: Annotation[];
    route: RouteInfo | null;
    waypoints: Coordinate[];
    collaborators: CollaboratorPresence[];
    showSidebar: boolean;
    pinnedToView: boolean;
    tags: string[];
    isMinimized: boolean;
    // Legacy compatibility properties
    interactive: boolean;
    showGPS: boolean;
    showSearch: boolean;
    showDirections: boolean;
    sharingLocation: boolean;
    gpsUsers: CollaboratorPresence[];
  }
>;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_VIEWPORT: MapViewport = {
  center: { lat: 40.7128, lng: -74.006 },
  zoom: 12,
  bearing: 0,
  pitch: 0,
};

const OSRM_BASE_URL = 'https://routing.jeffemmett.com';

// =============================================================================
// Geo Calculation Helpers
// =============================================================================

// Haversine distance calculation (returns meters)
function calculateDistance(coords: Coordinate[]): number {
  if (coords.length < 2) return 0;

  const R = 6371000; // Earth's radius in meters
  let total = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = coords[i].lat * Math.PI / 180;
    const lat2 = coords[i + 1].lat * Math.PI / 180;
    const dLat = (coords[i + 1].lat - coords[i].lat) * Math.PI / 180;
    const dLng = (coords[i + 1].lng - coords[i].lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    total += R * c;
  }

  return total;
}

// Shoelace formula for polygon area (returns square meters)
function calculateArea(coords: Coordinate[]): number {
  if (coords.length < 3) return 0;

  // Convert to projected coordinates (approximate for small areas)
  const centerLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

  const projected = coords.map(c => ({
    x: c.lng * metersPerDegreeLng,
    y: c.lat * metersPerDegreeLat,
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i].x * projected[j].y;
    area -= projected[j].x * projected[i].y;
  }

  return Math.abs(area / 2);
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

// Format area for display
function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${Math.round(sqMeters)} m²`;
  } else if (sqMeters < 1000000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${(sqMeters / 1000000).toFixed(2)} km²`;
}

// Mapus color palette
const COLORS = [
  '#E15F59', // Red
  '#F29F51', // Orange
  '#F9D458', // Yellow
  '#5EBE86', // Green
  '#4890E8', // Blue
  '#634FF1', // Purple
  '#A564D2', // Violet
  '#222222', // Black
];

// Find Nearby categories (inspired by Mapus)
const NEARBY_CATEGORIES = [
  { key: 'restaurant', label: 'Food', icon: '🍽️', color: '#4890E8', types: 'restaurant,cafe,fast_food,food_court' },
  { key: 'bar', label: 'Drinks', icon: '🍺', color: '#F9D458', types: 'bar,pub,cafe,wine_bar' },
  { key: 'supermarket', label: 'Groceries', icon: '🛒', color: '#5EBE86', types: 'supermarket,convenience,grocery' },
  { key: 'hotel', label: 'Hotels', icon: '🏨', color: '#AC6C48', types: 'hotel,hostel,motel,guest_house' },
  { key: 'hospital', label: 'Health', icon: '🏥', color: '#E15F59', types: 'hospital,pharmacy,clinic,doctors' },
  { key: 'bank', label: 'Services', icon: '🏦', color: '#634FF1', types: 'bank,atm,post_office' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', color: '#A564D2', types: 'mall,department_store,clothes' },
  { key: 'transport', label: 'Transport', icon: '🚉', color: '#718390', types: 'bus_station,train_station,subway' },
];

// Map styles
const MAP_STYLES = {
  voyager: {
    name: 'Voyager',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    icon: '🗺️',
  },
  positron: {
    name: 'Light',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    icon: '☀️',
  },
  darkMatter: {
    name: 'Dark',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    icon: '🌙',
  },
  satellite: {
    name: 'Satellite',
    url: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; Esri',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'esri-satellite' }],
    } as maplibregl.StyleSpecification,
    icon: '🛰️',
  },
} as const;

type StyleKey = keyof typeof MAP_STYLES;

// =============================================================================
// Shape Definition
// =============================================================================

export class MapShape extends BaseBoxShapeUtil<IMapShape> {
  static override type = 'Map' as const;

  // Map theme color: Blue (consistent with mapping/navigation)
  static readonly PRIMARY_COLOR = '#4890E8';

  static override props = {
    w: T.number,
    h: T.number,
    viewport: T.any,
    styleKey: T.string,
    title: T.string,
    description: T.string,
    annotations: T.any,
    route: T.any,
    waypoints: T.any,
    collaborators: T.any,
    showSidebar: T.boolean,
    pinnedToView: T.boolean,
    tags: T.any,
    isMinimized: T.boolean,
    // Legacy compatibility properties
    interactive: T.boolean,
    showGPS: T.boolean,
    showSearch: T.boolean,
    showDirections: T.boolean,
    sharingLocation: T.boolean,
    gpsUsers: T.any,
  };

  getDefaultProps(): IMapShape['props'] {
    return {
      w: 800,
      h: 550,
      viewport: DEFAULT_VIEWPORT,
      styleKey: 'voyager',
      title: 'Collaborative Map',
      description: 'Click to explore together',
      annotations: [],
      route: null,
      waypoints: [],
      collaborators: [],
      showSidebar: true,
      pinnedToView: false,
      tags: ['map'],
      isMinimized: false,
      // Legacy compatibility defaults
      interactive: true,
      showGPS: false,
      showSearch: false,
      showDirections: false,
      sharingLocation: false,
      gpsUsers: [],
    };
  }

  override canResize() { return true; }
  override canEdit() { return false; }

  override onResize(shape: IMapShape, info: TLResizeInfo<IMapShape>) {
    return resizeBox(shape, info);
  }

  indicator(shape: IMapShape) {
    const height = shape.props.isMinimized ? 40 : shape.props.h + 40;
    return <rect x={0} y={0} width={shape.props.w} height={height} fill="none" rx={8} />;
  }

  component(shape: IMapShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id);
    return <MapComponent shape={shape} editor={this.editor} isSelected={isSelected} />;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  sidebar: {
    width: 280,
    background: '#fff',
    borderRight: '1px solid #E8E8E8',
    height: '100%',
    overflowY: 'auto' as const,
    fontSize: 13,
    zIndex: 10,
    position: 'relative' as const,
  },
  section: {
    padding: '14px 16px',
    borderBottom: '1px solid #E8E8E8',
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: '#222',
    marginBottom: 10,
  },
  button: {
    border: 'none',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s',
    pointerEvents: 'auto' as const,
  },
  toolbar: {
    position: 'absolute' as const,
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    display: 'flex',
    padding: 6,
    gap: 4,
    zIndex: 10000,
    pointerEvents: 'auto' as const,
  },
  toolButton: {
    width: 42,
    height: 42,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    transition: 'background 0.15s',
    pointerEvents: 'auto' as const,
  },
  activeToolButton: {
    background: '#222',
    color: '#fff',
  },
  mapButton: {
    pointerEvents: 'auto' as const,
    zIndex: 10000,
  },
};

// =============================================================================
// Map Component
// =============================================================================

function MapComponent({ shape, editor, isSelected }: { shape: IMapShape; editor: MapShape['editor']; isSelected: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const isMountedRef = useRef(true); // Track if component is still mounted

  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTool, setActiveTool] = useState<'cursor' | 'marker' | 'line' | 'area' | 'eraser'>('cursor');
  const activeToolRef = useRef(activeTool); // Ref to track current tool in event handlers
  const [selectedColor, setSelectedColor] = useState(COLORS[4]);

  // Drawing state for lines and areas
  const [drawingPoints, setDrawingPoints] = useState<Coordinate[]>([]);
  const drawingPointsRef = useRef<Coordinate[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    activeToolRef.current = activeTool;
    // Clear drawing points when switching tools
    if (activeTool !== 'line' && activeTool !== 'area') {
      setDrawingPoints([]);
      drawingPointsRef.current = [];
    }
  }, [activeTool]);

  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [_nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);
  const [observingUser, setObservingUser] = useState<string | null>(null);

  // GPS Location Sharing State
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [myLocation, setMyLocation] = useState<Coordinate | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const collaboratorMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const styleKey = (shape.props.styleKey || 'voyager') as StyleKey;
  const currentStyle = MAP_STYLES[styleKey] || MAP_STYLES.voyager;

  // Use the pinning hook to keep the shape fixed to viewport when pinned
  usePinnedToView(editor, shape.id, shape.props.pinnedToView);

  // Use the maximize hook for fullscreen functionality
  const { isMaximized, toggleMaximize } = useMaximize({
    editor: editor,
    shapeId: shape.id,
    currentW: shape.props.w,
    currentH: shape.props.h,
    shapeType: 'Map',
  });

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      // Cleanup GPS watch on unmount
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Cleanup collaborator markers
      collaboratorMarkersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch (err) {
          // Marker may already be removed
        }
      });
      collaboratorMarkersRef.current.clear();
    };
  }, []);

  // ==========================================================================
  // Map Initialization
  // ==========================================================================

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: typeof currentStyle.url === 'string' ? currentStyle.url : currentStyle.url,
      center: [shape.props.viewport.center.lng, shape.props.viewport.center.lat],
      zoom: shape.props.viewport.zoom,
      bearing: shape.props.viewport.bearing,
      pitch: shape.props.viewport.pitch,
      attributionControl: false,
    });

    mapRef.current = map;

    const handleLoad = () => {
      if (isMountedRef.current) {
        setIsLoaded(true);
      }
    };

    // Save viewport changes with null checks
    const handleMoveEnd = () => {
      if (!isMountedRef.current || !mapRef.current) return;
      try {
        const center = mapRef.current.getCenter();
        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: {
            viewport: {
              center: { lat: center.lat, lng: center.lng },
              zoom: mapRef.current.getZoom(),
              bearing: mapRef.current.getBearing(),
              pitch: mapRef.current.getPitch(),
            },
          },
        });
      } catch (err) {
        // Map may have been destroyed, ignore
      }
    };

    // Handle map clicks based on active tool
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (!isMountedRef.current) return;
      const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const currentTool = activeToolRef.current;
      const currentDrawingPoints = drawingPointsRef.current;


      if (currentTool === 'marker') {
        addAnnotation('marker', [coord]);
      } else if (currentTool === 'line') {
        // Add point to line drawing
        const newPoints = [...currentDrawingPoints, coord];
        setDrawingPoints(newPoints);
        drawingPointsRef.current = newPoints;
      } else if (currentTool === 'area') {
        // Add point to area drawing
        const newPoints = [...currentDrawingPoints, coord];
        setDrawingPoints(newPoints);
        drawingPointsRef.current = newPoints;
      } else if (currentTool === 'eraser') {
        // Find and remove annotation at click location
        // Check if clicked near any annotation
        const clickThreshold = 0.0005; // ~50m at equator
        const annotationToRemove = shape.props.annotations.find((ann: Annotation) => {
          if (ann.type === 'marker') {
            const annCoord = ann.coordinates[0];
            return Math.abs(annCoord.lat - coord.lat) < clickThreshold &&
                   Math.abs(annCoord.lng - coord.lng) < clickThreshold;
          } else {
            // For lines/areas, check if click is near any point
            return ann.coordinates.some((c: Coordinate) =>
              Math.abs(c.lat - coord.lat) < clickThreshold &&
              Math.abs(c.lng - coord.lng) < clickThreshold
            );
          }
        });
        if (annotationToRemove) {
          removeAnnotation(annotationToRemove.id);
        }
      }
    };

    // Handle double-click to finish line/area drawing
    const handleDblClick = (_e: maplibregl.MapMouseEvent) => {
      if (!isMountedRef.current) return;
      const currentTool = activeToolRef.current;
      const currentDrawingPoints = drawingPointsRef.current;


      if (currentTool === 'line' && currentDrawingPoints.length >= 2) {
        addAnnotation('line', currentDrawingPoints);
        setDrawingPoints([]);
        drawingPointsRef.current = [];
      } else if (currentTool === 'area' && currentDrawingPoints.length >= 3) {
        addAnnotation('area', currentDrawingPoints);
        setDrawingPoints([]);
        drawingPointsRef.current = [];
      }
    };

    map.on('load', handleLoad);
    map.on('moveend', handleMoveEnd);
    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);

    return () => {
      // Remove event listeners before destroying map
      map.off('load', handleLoad);
      map.off('moveend', handleMoveEnd);
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);

      // Clear all markers
      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch (err) {
          // Marker may already be removed
        }
      });
      markersRef.current.clear();

      // Destroy the map
      try {
        map.remove();
      } catch (err) {
        // Map may already be destroyed
      }
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [containerRef.current]);

  // Style changes
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isMountedRef.current) return;
    try {
      mapRef.current.setStyle(typeof currentStyle.url === 'string' ? currentStyle.url : currentStyle.url);
    } catch (err) {
      // Map may have been destroyed
    }
  }, [styleKey, isLoaded]);

  // Resize
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isMountedRef.current) return;
    const resizeTimeout = setTimeout(() => {
      if (mapRef.current && isMountedRef.current) {
        try {
          mapRef.current.resize();
        } catch (err) {
          // Map may have been destroyed
        }
      }
    }, 0);
    return () => clearTimeout(resizeTimeout);
  }, [shape.props.w, shape.props.h, isLoaded, shape.props.showSidebar]);

  // ==========================================================================
  // Collaborator GPS Markers (renders ALL users sharing location on the map)
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isMountedRef.current) return;

    const map = mapRef.current;
    const myUserId = editor.user.getId();

    // Get ALL collaborators with locations (including self)
    const allCollaborators = shape.props.collaborators || [];
    const collaboratorsWithLocation = allCollaborators.filter(
      (c: CollaboratorPresence) => c.location
    );
    const currentCollaboratorIds = new Set(collaboratorsWithLocation.map((c: CollaboratorPresence) => c.id));

    // Remove old collaborator markers that are no longer sharing
    collaboratorMarkersRef.current.forEach((marker, id) => {
      if (!currentCollaboratorIds.has(id)) {
        try {
          marker.remove();
        } catch (err) {
          // Marker may already be removed
        }
        collaboratorMarkersRef.current.delete(id);
      }
    });

    // Add/update markers for ALL collaborators sharing location
    collaboratorsWithLocation.forEach((collab: CollaboratorPresence) => {
      if (!isMountedRef.current || !mapRef.current || !collab.location) return;

      const isMe = collab.id === myUserId;
      let marker = collaboratorMarkersRef.current.get(collab.id);
      const displayName = isMe ? 'You' : collab.name;
      const markerColor = isMe ? '#3b82f6' : collab.color;

      if (!marker) {
        // Create pin-style marker with name bubble and pointer
        const container = document.createElement('div');
        container.className = `gps-location-pin ${isMe ? 'is-me' : ''}`;
        container.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
          z-index: ${isMe ? 1000 : 100};
        `;
        container.title = isMe ? 'You are here' : `${collab.name} is here`;

        // Name bubble (pill shape with name)
        const bubble = document.createElement('div');
        bubble.style.cssText = `
          background: ${markerColor};
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          gap: 6px;
          animation: gps-pin-pulse 2s ease-in-out infinite;
        `;

        // Add pulsing dot indicator
        const dot = document.createElement('div');
        dot.style.cssText = `
          width: 8px;
          height: 8px;
          background: ${isMe ? '#22c55e' : 'white'};
          border-radius: 50%;
          animation: gps-dot-pulse 1.5s ease-in-out infinite;
        `;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = displayName;

        bubble.appendChild(dot);
        bubble.appendChild(nameSpan);

        // Pointer/arrow pointing down to exact location
        const pointer = document.createElement('div');
        pointer.style.cssText = `
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 14px solid ${markerColor};
          margin-top: -2px;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
        `;

        // Small dot at the exact location point
        const locationDot = document.createElement('div');
        locationDot.style.cssText = `
          width: 12px;
          height: 12px;
          background: ${markerColor};
          border: 2px solid white;
          border-radius: 50%;
          margin-top: -3px;
          box-shadow: 0 0 0 4px ${markerColor}40, 0 2px 4px rgba(0,0,0,0.3);
          animation: gps-location-ring 2s ease-out infinite;
        `;

        container.appendChild(bubble);
        container.appendChild(pointer);
        container.appendChild(locationDot);

        // Anchor at bottom so the pin points to exact location
        marker = new maplibregl.Marker({ element: container, anchor: 'bottom' })
          .setLngLat([collab.location.lng, collab.location.lat])
          .addTo(map);

        collaboratorMarkersRef.current.set(collab.id, marker);

        // If this is me and I just started sharing, fly to my location
        if (isMe) {
          map.flyTo({
            center: [collab.location.lng, collab.location.lat],
            zoom: Math.max(map.getZoom(), 14),
            duration: 1500,
          });
        }
      } else {
        // Update existing marker position
        marker.setLngLat([collab.location.lng, collab.location.lat]);
      }
    });

    // Inject pulse animation CSS if not already present
    if (!document.getElementById('collaborator-gps-styles')) {
      const style = document.createElement('style');
      style.id = 'collaborator-gps-styles';
      style.textContent = `
        @keyframes gps-pin-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes gps-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
        @keyframes gps-location-ring {
          0% { box-shadow: 0 0 0 0 currentColor, 0 2px 4px rgba(0,0,0,0.3); }
          70% { box-shadow: 0 0 0 12px transparent, 0 2px 4px rgba(0,0,0,0.3); }
          100% { box-shadow: 0 0 0 0 transparent, 0 2px 4px rgba(0,0,0,0.3); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .gps-location-pin {
          transition: transform 0.2s ease;
        }
        .gps-location-pin:hover {
          transform: scale(1.1);
          z-index: 2000 !important;
        }
        .gps-location-pin.is-me {
          z-index: 1000;
        }
      `;
      document.head.appendChild(style);
    }
  }, [shape.props.collaborators, isLoaded, editor]);

  // ==========================================================================
  // Annotations
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isMountedRef.current) return;

    const map = mapRef.current;
    const currentIds = new Set(shape.props.annotations.map((a: Annotation) => a.id));

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        try {
          marker.remove();
        } catch (err) {
          // Marker may already be removed
        }
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    shape.props.annotations.forEach((ann: Annotation) => {
      if (!isMountedRef.current || !mapRef.current) return;
      if (ann.type !== 'marker' || !ann.visible) return;

      let marker = markersRef.current.get(ann.id);
      const coord = ann.coordinates[0];

      if (!marker && coord) {
        try {
          const el = document.createElement('div');
          el.className = 'map-annotation-marker';
          el.style.cssText = `
            width: 32px;
            height: 32px;
            background: ${ann.color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          `;
          el.textContent = '📍';
          el.title = ann.name;

          const popup = new maplibregl.Popup({ offset: 20 })
            .setHTML(`<div style="padding: 8px; font-size: 13px;"><strong>${ann.name}</strong></div>`);

          marker = new maplibregl.Marker({ element: el, draggable: true })
            .setLngLat([coord.lng, coord.lat])
            .setPopup(popup)
            .addTo(map);

          marker.on('dragend', () => {
            if (!isMountedRef.current || !marker) return;
            try {
              const lngLat = marker.getLngLat();
              updateAnnotationPosition(ann.id, [{ lat: lngLat.lat, lng: lngLat.lng }]);
            } catch (err) {
              // Marker may have been removed
            }
          });

          markersRef.current.set(ann.id, marker);
        } catch (err) {
          // Map may have been destroyed
        }
      } else if (marker && coord) {
        try {
          marker.setLngLat([coord.lng, coord.lat]);
        } catch (err) {
          // Marker may have been removed
        }
      }
    });

    // Hide markers for invisible annotations
    markersRef.current.forEach((marker, id) => {
      const ann = shape.props.annotations.find((a: Annotation) => a.id === id);
      if (ann && !ann.visible) {
        try {
          marker.remove();
        } catch (err) {
          // Marker may already be removed
        }
        markersRef.current.delete(id);
      }
    });

    // Render lines and areas
    shape.props.annotations.forEach((ann: Annotation) => {
      if (!isMountedRef.current || !mapRef.current) return;
      if (!ann.visible) {
        // Remove layer/source if hidden
        try {
          if (map.getLayer(`ann-layer-${ann.id}`)) map.removeLayer(`ann-layer-${ann.id}`);
          if (ann.type === 'area' && map.getLayer(`ann-fill-${ann.id}`)) map.removeLayer(`ann-fill-${ann.id}`);
          if (map.getSource(`ann-source-${ann.id}`)) map.removeSource(`ann-source-${ann.id}`);
        } catch (err) { /* ignore */ }
        return;
      }

      if (ann.type === 'line' && ann.coordinates.length >= 2) {
        const coords = ann.coordinates.map((c: Coordinate) => [c.lng, c.lat]);
        const sourceId = `ann-source-${ann.id}`;
        const layerId = `ann-layer-${ann.id}`;

        try {
          if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            });
          } else {
            map.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: coords },
              },
            });
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': ann.color,
                'line-width': 4,
                'line-opacity': 0.8,
              },
            });
          }
        } catch (err) {
          console.warn('Error rendering line:', err);
        }
      } else if (ann.type === 'area' && ann.coordinates.length >= 3) {
        const coords = ann.coordinates.map((c: Coordinate) => [c.lng, c.lat]);
        // Close the polygon
        const closedCoords = [...coords, coords[0]];
        const sourceId = `ann-source-${ann.id}`;
        const fillLayerId = `ann-fill-${ann.id}`;
        const lineLayerId = `ann-layer-${ann.id}`;

        try {
          if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: [closedCoords] },
            });
          } else {
            map.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [closedCoords] },
              },
            });
            map.addLayer({
              id: fillLayerId,
              type: 'fill',
              source: sourceId,
              paint: {
                'fill-color': ann.color,
                'fill-opacity': 0.3,
              },
            });
            map.addLayer({
              id: lineLayerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': ann.color,
                'line-width': 3,
                'line-opacity': 0.8,
              },
            });
          }
        } catch (err) {
          console.warn('Error rendering area:', err);
        }
      }
    });

    // Clean up removed annotation layers
    currentIds.forEach((id) => {
      const ann = shape.props.annotations.find((a: Annotation) => a.id === id);
      if (!ann) {
        try {
          if (map.getLayer(`ann-layer-${id}`)) map.removeLayer(`ann-layer-${id}`);
          if (map.getLayer(`ann-fill-${id}`)) map.removeLayer(`ann-fill-${id}`);
          if (map.getSource(`ann-source-${id}`)) map.removeSource(`ann-source-${id}`);
        } catch (err) { /* ignore */ }
      }
    });
  }, [shape.props.annotations, isLoaded]);

  // ==========================================================================
  // Drawing Preview (for lines/areas in progress)
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isMountedRef.current) return;

    const map = mapRef.current;
    const sourceId = 'drawing-preview';
    const lineLayerId = 'drawing-preview-line';
    const fillLayerId = 'drawing-preview-fill';
    const pointsLayerId = 'drawing-preview-points';

    try {
      // Remove existing preview layers first
      if (map.getLayer(pointsLayerId)) map.removeLayer(pointsLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (drawingPoints.length === 0) return;

      const coords = drawingPoints.map((c) => [c.lng, c.lat]);

      if (activeTool === 'line' && coords.length >= 1) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              ...(coords.length >= 2 ? [{
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: coords },
              }] : []),
              ...coords.map((coord) => ({
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Point' as const, coordinates: coord },
              })),
            ],
          },
        });
        if (coords.length >= 2) {
          map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': selectedColor,
              'line-width': 4,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2],
            },
          });
        }
        map.addLayer({
          id: pointsLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 6,
            'circle-color': selectedColor,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
      } else if (activeTool === 'area' && coords.length >= 1) {
        const closedCoords = coords.length >= 3 ? [...coords, coords[0]] : coords;
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              ...(coords.length >= 3 ? [{
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Polygon' as const, coordinates: [closedCoords] },
              }] : []),
              ...(coords.length >= 2 ? [{
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: coords },
              }] : []),
              ...coords.map((coord) => ({
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Point' as const, coordinates: coord },
              })),
            ],
          },
        });
        if (coords.length >= 3) {
          map.addLayer({
            id: fillLayerId,
            type: 'fill',
            source: sourceId,
            filter: ['==', '$type', 'Polygon'],
            paint: {
              'fill-color': selectedColor,
              'fill-opacity': 0.2,
            },
          });
        }
        if (coords.length >= 2) {
          map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: sourceId,
            filter: ['==', '$type', 'LineString'],
            paint: {
              'line-color': selectedColor,
              'line-width': 3,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2],
            },
          });
        }
        map.addLayer({
          id: pointsLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 6,
            'circle-color': selectedColor,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
      }
    } catch (err) {
      console.warn('Error rendering drawing preview:', err);
    }
  }, [drawingPoints, activeTool, selectedColor, isLoaded]);

  // ==========================================================================
  // Collaborator presence (cursors/locations)
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isMountedRef.current) return;

    // TODO: Render collaborator cursors on map
    // This would be integrated with tldraw's presence system
  }, [shape.props.collaborators, isLoaded]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const addAnnotation = useCallback((type: Annotation['type'], coordinates: Coordinate[], options?: { name?: string; color?: string }) => {
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      name: options?.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${shape.props.annotations.length + 1}`,
      color: options?.color || selectedColor,
      visible: true,
      coordinates,
      createdAt: Date.now(),
    };

    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { annotations: [...shape.props.annotations, newAnnotation] },
    });
  }, [shape.props.annotations, selectedColor, shape.id, editor]);

  const updateAnnotationPosition = useCallback((annotationId: string, coordinates: Coordinate[]) => {
    const updated = shape.props.annotations.map((ann: Annotation) =>
      ann.id === annotationId ? { ...ann, coordinates } : ann
    );
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { annotations: updated },
    });
  }, [shape.props.annotations, shape.id, editor]);

  const toggleAnnotationVisibility = useCallback((annotationId: string) => {
    const updated = shape.props.annotations.map((ann: Annotation) =>
      ann.id === annotationId ? { ...ann, visible: !ann.visible } : ann
    );
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { annotations: updated },
    });
  }, [shape.props.annotations, shape.id, editor]);

  const removeAnnotation = useCallback((annotationId: string) => {
    const updated = shape.props.annotations.filter((ann: Annotation) => ann.id !== annotationId);
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { annotations: updated },
    });
  }, [shape.props.annotations, shape.id, editor]);

  const hideAllAnnotations = useCallback(() => {
    const updated = shape.props.annotations.map((ann: Annotation) => ({ ...ann, visible: false }));
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { annotations: updated },
    });
  }, [shape.props.annotations, shape.id, editor]);

  // ==========================================================================
  // Search
  // ==========================================================================

  const searchPlaces = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=6`,
        { headers: { 'User-Agent': 'CanvasWebsite/1.0' } }
      );
      const data = await response.json() as { display_name: string; lat: string; lon: string }[];
      setSearchResults(data.map((r) => ({
        name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      })));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const selectSearchResult = useCallback((result: { lat: number; lng: number; name: string }) => {
    if (mapRef.current && isMountedRef.current) {
      try {
        mapRef.current.flyTo({ center: [result.lng, result.lat], zoom: 15, duration: 1000 });
      } catch (err) {
        // Map may have been destroyed
      }
    }
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // ==========================================================================
  // Find Nearby
  // ==========================================================================

  const findNearby = useCallback(async (category: typeof NEARBY_CATEGORIES[0]) => {
    if (!mapRef.current || !isMountedRef.current) return;

    setIsFetchingNearby(true);

    let bounds;
    try {
      bounds = mapRef.current.getBounds();
    } catch (err) {
      console.error('🗺️ Error getting bounds:', err);
      setIsFetchingNearby(false);
      return;
    }

    try {
      const query = `
        [out:json][timeout:10];
        (
          node["amenity"~"${category.types.replace(/,/g, '|')}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out body 10;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });

      if (!isMountedRef.current) {
        setIsFetchingNearby(false);
        return;
      }

      const data = await response.json() as { elements: { id: number; lat: number; lon: number; tags?: { name?: string; amenity?: string } }[] };

      const places = data.elements.slice(0, 10).map((el) => ({
        id: el.id,
        name: el.tags?.name || category.label,
        lat: el.lat,
        lng: el.lon,
        type: el.tags?.amenity || category.key,
        color: category.color,
      }));

      if (!isMountedRef.current) {
        setIsFetchingNearby(false);
        return;
      }
      setNearbyPlaces(places);

      // Add markers for nearby places
      places.forEach((place: any) => {
        if (isMountedRef.current) {
          addAnnotation('marker', [{ lat: place.lat, lng: place.lng }], {
            name: place.name,
            color: place.color,
          });
        }
      });
      setIsFetchingNearby(false);
    } catch (err) {
      console.error('🗺️ Find nearby error:', err);
      setIsFetchingNearby(false);
    }
  }, [addAnnotation]);

  // ==========================================================================
  // Observe User
  // ==========================================================================

  const observeUser = useCallback((userId: string | null) => {
    setObservingUser(userId);
    if (userId && mapRef.current && isMountedRef.current) {
      const collaborator = shape.props.collaborators.find((c: CollaboratorPresence) => c.id === userId);
      if (collaborator?.location) {
        try {
          mapRef.current.flyTo({
            center: [collaborator.location.lng, collaborator.location.lat],
            zoom: 15,
            duration: 1000,
          });
        } catch (err) {
          // Map may have been destroyed
        }
      }
    }
  }, [shape.props.collaborators]);

  // ==========================================================================
  // GPS Location Sharing
  // ==========================================================================

  const startSharingLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    const userId = editor.user.getId();
    const userName = editor.user.getName() || 'Anonymous';
    const userColor = editor.user.getColor();

    setIsSharingLocation(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: Coordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMyLocation(newLocation);

        // IMPORTANT: Get the CURRENT shape from editor to avoid stale closure!
        // This ensures we don't overwrite other users' locations
        const currentShape = editor.getShape<IMapShape>(shape.id);
        if (!currentShape) {
          console.error('📍 Shape not found, cannot update location');
          return;
        }

        // Filter out our old entry and keep all other collaborators
        const existingCollaborators = (currentShape.props.collaborators || []).filter(
          (c: CollaboratorPresence) => c.id !== userId
        );

        const myPresence: CollaboratorPresence = {
          id: userId,
          name: userName,
          color: userColor,
          location: newLocation,
          lastSeen: Date.now(),
        };


        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: {
            collaborators: [...existingCollaborators, myPresence],
          },
        });
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        setIsSharingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  }, [editor, shape.id]); // Note: No shape.props.collaborators - we get current data from editor

  const stopSharingLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsSharingLocation(false);
    setMyLocation(null);

    // Get current shape to avoid stale closure
    const currentShape = editor.getShape<IMapShape>(shape.id);
    if (!currentShape) {
      return;
    }

    // Remove self from collaborators
    const userId = editor.user.getId();
    const filteredCollaborators = (currentShape.props.collaborators || []).filter(
      (c: CollaboratorPresence) => c.id !== userId
    );


    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: {
        collaborators: filteredCollaborators,
      },
    });
  }, [editor, shape.id]); // Note: No shape.props.collaborators - we get current data from editor

  const toggleLocationSharing = useCallback(() => {
    if (isSharingLocation) {
      stopSharingLocation();
    } else {
      startSharingLocation();
    }
  }, [isSharingLocation, startSharingLocation, stopSharingLocation]);

  // ==========================================================================
  // Title/Description
  // ==========================================================================

  const updateTitle = useCallback((title: string) => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { title },
    });
  }, [shape.id, editor]);

  const updateDescription = useCallback((description: string) => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { description },
    });
  }, [shape.id, editor]);

  // ==========================================================================
  // Toggle Sidebar
  // ==========================================================================

  const toggleSidebar = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { showSidebar: !shape.props.showSidebar },
    });
  }, [shape.id, shape.props.showSidebar, editor]);

  // ==========================================================================
  // Style Change
  // ==========================================================================

  const changeStyle = useCallback((key: StyleKey) => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { styleKey: key },
    });
  }, [shape.id, editor]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const stopPropagation = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  }, []);

  // Handle wheel events on map container - attach native listener for proper capture
  useEffect(() => {
    const mapContainer = containerRef.current?.parentElement;
    if (!mapContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Stop propagation to prevent tldraw from capturing the wheel event
      e.stopPropagation();
      // Let maplibre handle the wheel event natively for zooming
      // Don't prevent default - let the map's scrollZoom handle it
    };

    // Capture wheel events before they bubble up to tldraw
    mapContainer.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      mapContainer.removeEventListener('wheel', handleWheel);
    };
  }, [isLoaded]);

  // Close handler for StandardizedToolWrapper
  const handleClose = useCallback(() => {
    editor.deleteShape(shape.id);
  }, [editor, shape.id]);

  // Minimize handler
  const handleMinimize = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { isMinimized: !shape.props.isMinimized },
    });
  }, [editor, shape.id, shape.props.isMinimized]);

  // Pin handler
  const handlePinToggle = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { pinnedToView: !shape.props.pinnedToView },
    });
  }, [editor, shape.id, shape.props.pinnedToView]);

  // Tags handler
  const handleTagsChange = useCallback((newTags: string[]) => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { tags: newTags },
    });
  }, [editor, shape.id]);

  // ==========================================================================
  // Render
  // ==========================================================================

  const contentHeight = shape.props.h;

  return (
    <HTMLContainer style={{ width: shape.props.w, height: contentHeight + 40 }}>
      <style>{`
        .mapus-sidebar::-webkit-scrollbar { width: 6px; }
        .mapus-sidebar::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
        .mapus-btn:hover { background: #f7f7f7 !important; }
        .mapus-btn:active { transform: scale(0.97); }
        .mapus-category:hover { background: #f7f7f7 !important; }
        .mapus-annotation:hover { background: #f7f7f7; }
        .mapus-result:hover { background: #f3f4f6 !important; }
        .mapus-tool:hover { background: #f7f7f7; }
        .mapus-tool.active { background: #222 !important; color: #fff !important; }
        .mapus-color:hover { transform: scale(1.15); }
        .mapus-color.selected { transform: scale(1.2); box-shadow: 0 0 0 2px #222; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      <StandardizedToolWrapper
        title={shape.props.title || 'Collaborative Map'}
        primaryColor={MapShape.PRIMARY_COLOR}
        isSelected={isSelected}
        width={shape.props.w}
        height={contentHeight + 40}
        onClose={handleClose}
        onMinimize={handleMinimize}
        isMinimized={shape.props.isMinimized}
        onMaximize={toggleMaximize}
        isMaximized={isMaximized}
        editor={editor}
        shapeId={shape.id}
        isPinnedToView={shape.props.pinnedToView}
        onPinToggle={handlePinToggle}
        tags={shape.props.tags || ['map']}
        onTagsChange={handleTagsChange}
        tagsEditable={true}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          {/* Left Sidebar */}
          {shape.props.showSidebar && (
            <div
              className="mapus-sidebar"
              style={styles.sidebar}
              onPointerDown={stopPropagation}
            >
              {/* Search */}
              <div style={styles.section}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') searchPlaces();
                    }}
                    onPointerDown={stopPropagation}
                    placeholder="Search for a place..."
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid #E8E8E8',
                      borderRadius: 6,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={searchPlaces}
                    onPointerDown={stopPropagation}
                    className="mapus-btn"
                    style={{
                      ...styles.button,
                      padding: '10px 14px',
                      border: '1px solid #E8E8E8',
                    }}
                  >
                    {isSearching ? '⏳' : '🔍'}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {searchResults.map((result, i) => (
                      <div
                        key={i}
                        className="mapus-result"
                        onClick={() => selectSearchResult(result)}
                        onPointerDown={stopPropagation}
                        style={{
                          padding: '10px 8px',
                          cursor: 'pointer',
                          fontSize: 12,
                          borderRadius: 4,
                        }}
                      >
                        📍 {result.name.slice(0, 50)}...
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Find Nearby */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  Find nearby {isFetchingNearby && <span style={{ marginLeft: 8, fontSize: 12 }}>⏳</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, opacity: isFetchingNearby ? 0.5 : 1 }}>
                  {NEARBY_CATEGORIES.map((cat) => (
                    <div
                      key={cat.key}
                      className="mapus-category"
                      onClick={() => !isFetchingNearby && findNearby(cat)}
                      onPointerDown={stopPropagation}
                      style={{
                        textAlign: 'center',
                        padding: '10px 4px',
                        borderRadius: 6,
                        cursor: isFetchingNearby ? 'wait' : 'pointer',
                        fontSize: 11,
                        color: '#626C72',
                      }}
                    >
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{cat.icon}</div>
                      {cat.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Collaborators */}
              {shape.props.collaborators.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>People ({shape.props.collaborators.length})</div>
                  {shape.props.collaborators.map((collab: CollaboratorPresence) => (
                    <div
                      key={collab.id}
                      className="mapus-annotation"
                      onClick={() => observeUser(observingUser === collab.id ? null : collab.id)}
                      onPointerDown={stopPropagation}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 6px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: observingUser === collab.id ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: collab.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: 'white',
                        fontWeight: 600,
                      }}>
                        {collab.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{collab.name}</div>
                        {observingUser === collab.id && (
                          <div style={{ fontSize: 11, color: '#22c55e' }}>👁️ Observing</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Annotations */}
              <div style={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={styles.sectionTitle}>Annotations</div>
                  <button
                    onClick={hideAllAnnotations}
                    onPointerDown={stopPropagation}
                    className="mapus-btn"
                    style={{ ...styles.button, fontSize: 12, padding: '4px 8px', color: '#626C72' }}
                  >
                    Hide all
                  </button>
                </div>

                {shape.props.annotations.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 16 }}>
                    No annotations yet.<br />Use the tools below to add some!
                  </div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {shape.props.annotations.map((ann: Annotation) => (
                      <div
                        key={ann.id}
                        className="mapus-annotation"
                        onPointerDown={stopPropagation}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 6px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          opacity: ann.visible ? 1 : 0.5,
                        }}
                      >
                        <div style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: ann.color,
                        }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ann.name}
                          </div>
                          {ann.type === 'line' && ann.coordinates.length >= 2 && (
                            <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
                              📏 {formatDistance(calculateDistance(ann.coordinates))}
                            </div>
                          )}
                          {ann.type === 'area' && ann.coordinates.length >= 3 && (
                            <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
                              ⬡ {formatArea(calculateArea(ann.coordinates))} • {formatDistance(calculateDistance([...ann.coordinates, ann.coordinates[0]]))} perimeter
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAnnotationVisibility(ann.id); }}
                          onPointerDown={stopPropagation}
                          className="mapus-btn"
                          style={{ ...styles.button, padding: 4, fontSize: 14 }}
                        >
                          {ann.visible ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
                          onPointerDown={stopPropagation}
                          className="mapus-btn"
                          style={{ ...styles.button, padding: 4, fontSize: 14, color: '#E15F59' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attribution */}
              <div style={{ ...styles.section, borderBottom: 'none', fontSize: 11, color: '#9ca3af' }}>
                © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style={{ color: '#9ca3af' }}>OpenStreetMap</a>
              </div>
            </div>
          )}

          {/* Map Container */}
          <div
            style={{ flex: 1, position: 'relative', pointerEvents: 'auto' }}
            onPointerDown={stopPropagation}
          >
            <div ref={containerRef} style={{ width: '100%', height: '100%', pointerEvents: 'auto' }} />

            {/* Sidebar Toggle */}
            <button
              onClick={toggleSidebar}
              onPointerDown={stopPropagation}
              className="mapus-btn"
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                zIndex: 10,
              }}
            >
              {shape.props.showSidebar ? '◀' : '▶'}
            </button>

            {/* Style Picker */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
              <select
                value={styleKey}
                onChange={(e) => changeStyle(e.target.value as StyleKey)}
                onPointerDown={stopPropagation}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {Object.entries(MAP_STYLES).map(([key, style]) => (
                  <option key={key} value={key}>{style.icon} {style.name}</option>
                ))}
              </select>
            </div>

            {/* Zoom Controls */}
            <div style={{ position: 'absolute', bottom: 80, right: 10, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
              <button
                onClick={() => mapRef.current?.zoomIn()}
                onPointerDown={stopPropagation}
                className="mapus-btn"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                +
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                onPointerDown={stopPropagation}
                className="mapus-btn"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                −
              </button>
              <button
                onClick={() => {
                  navigator.geolocation?.getCurrentPosition((pos) => {
                    mapRef.current?.flyTo({
                      center: [pos.coords.longitude, pos.coords.latitude],
                      zoom: 15,
                      duration: 1000,
                    });
                  });
                }}
                onPointerDown={stopPropagation}
                className="mapus-btn"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  fontSize: 16,
                  marginTop: 4,
                }}
                title="My location"
              >
                ⊙
              </button>
              <button
                onClick={toggleLocationSharing}
                onPointerDown={stopPropagation}
                className="mapus-btn"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: isSharingLocation ? '#22c55e' : '#fff',
                  border: isSharingLocation ? '2px solid #16a34a' : 'none',
                  boxShadow: isSharingLocation
                    ? '0 0 12px rgba(34, 197, 94, 0.5)'
                    : '0 2px 8px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  fontSize: 14,
                  marginTop: 4,
                  transition: 'all 0.2s ease',
                  animation: isSharingLocation ? 'pulse 2s infinite' : 'none',
                }}
                title={isSharingLocation ? 'Stop sharing location' : 'Share my location'}
              >
                {isSharingLocation ? '📡' : '📍'}
              </button>
            </div>

            {/* Measurement Display and Drawing Instructions */}
            {(activeTool === 'line' || activeTool === 'area') && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 80,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  borderRadius: 8,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                  padding: '8px 14px',
                  zIndex: 10000,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {drawingPoints.length > 0 && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: selectedColor }}>
                    {activeTool === 'line' && formatDistance(calculateDistance(drawingPoints))}
                    {activeTool === 'area' && drawingPoints.length >= 3 && formatArea(calculateArea(drawingPoints))}
                    {activeTool === 'area' && drawingPoints.length < 3 && `${drawingPoints.length}/3 points`}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#666' }}>
                  {drawingPoints.length === 0 && 'Click to start drawing'}
                  {drawingPoints.length > 0 && activeTool === 'line' && drawingPoints.length < 2 && 'Click to add more points'}
                  {drawingPoints.length >= 2 && activeTool === 'line' && 'Double-click to finish line'}
                  {drawingPoints.length > 0 && activeTool === 'area' && drawingPoints.length < 3 && 'Click to add more points'}
                  {drawingPoints.length >= 3 && activeTool === 'area' && 'Double-click to finish area'}
                </div>
              </div>
            )}

            {/* Drawing Toolbar (Mapus-style) */}
            <div style={styles.toolbar} onPointerDown={stopPropagation}>
              {/* Cursor Tool */}
              <button
                onClick={() => setActiveTool('cursor')}
                className={`mapus-tool ${activeTool === 'cursor' ? 'active' : ''}`}
                style={styles.toolButton}
                title="Select"
              >
                ↖️
              </button>

              {/* Marker Tool */}
              <button
                onClick={() => setActiveTool('marker')}
                className={`mapus-tool ${activeTool === 'marker' ? 'active' : ''}`}
                style={styles.toolButton}
                title="Add marker"
              >
                📍
              </button>

              {/* Line Tool */}
              <button
                onClick={() => setActiveTool('line')}
                className={`mapus-tool ${activeTool === 'line' ? 'active' : ''}`}
                style={styles.toolButton}
                title="Draw line"
              >
                📏
              </button>

              {/* Area Tool */}
              <button
                onClick={() => setActiveTool('area')}
                className={`mapus-tool ${activeTool === 'area' ? 'active' : ''}`}
                style={styles.toolButton}
                title="Draw area"
              >
                ⬡
              </button>

              {/* Eraser */}
              <button
                onClick={() => setActiveTool('eraser')}
                className={`mapus-tool ${activeTool === 'eraser' ? 'active' : ''}`}
                style={styles.toolButton}
                title="Eraser"
              >
                🧹
              </button>

              {/* Divider */}
              <div style={{ width: 1, background: '#E8E8E8', margin: '4px 6px' }} />

              {/* Color Picker */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  style={{
                    ...styles.toolButton,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title="Color"
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: selectedColor,
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </button>

                {showColorPicker && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    background: '#fff',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    padding: 8,
                    display: 'flex',
                    gap: 6,
                  }}>
                    {COLORS.map((color) => (
                      <div
                        key={color}
                        className={`mapus-color ${selectedColor === color ? 'selected' : ''}`}
                        onClick={() => { setSelectedColor(color); setShowColorPicker(false); }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: color,
                          cursor: 'pointer',
                          transition: 'transform 0.15s',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Observing Indicator */}
            {observingUser && (
              <div style={{
                position: 'absolute',
                top: 8,
                left: 8,
                right: 8,
                bottom: 8,
                pointerEvents: 'none',
                border: `3px solid ${shape.props.collaborators.find((c: CollaboratorPresence) => c.id === observingUser)?.color || '#3b82f6'}`,
                borderRadius: 8,
              }}>
                <div style={{
                  position: 'absolute',
                  top: -30,
                  left: 10,
                  background: shape.props.collaborators.find((c: CollaboratorPresence) => c.id === observingUser)?.color || '#3b82f6',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                }}>
                  👁️ Observing {shape.props.collaborators.find((c: CollaboratorPresence) => c.id === observingUser)?.name}
                </div>
              </div>
            )}
          </div>
        </div>
      </StandardizedToolWrapper>
    </HTMLContainer>
  );
}

export default MapShape;
