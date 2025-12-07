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
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} fill="none" rx={8} />;
  }

  component(shape: IMapShape) {
    return <MapComponent shape={shape} editor={this.editor} />;
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
    zIndex: 1000,
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
  },
  activeToolButton: {
    background: '#222',
    color: '#fff',
  },
};

// =============================================================================
// Map Component
// =============================================================================

function MapComponent({ shape, editor }: { shape: IMapShape; editor: MapShape['editor'] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const isMountedRef = useRef(true); // Track if component is still mounted

  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTool, setActiveTool] = useState<'cursor' | 'marker' | 'line' | 'area' | 'eraser'>('cursor');
  const [selectedColor, setSelectedColor] = useState(COLORS[4]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [observingUser, setObservingUser] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const styleKey = (shape.props.styleKey || 'voyager') as StyleKey;
  const currentStyle = MAP_STYLES[styleKey] || MAP_STYLES.voyager;

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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

      if (activeTool === 'marker') {
        addAnnotation('marker', [coord]);
      }
    };

    map.on('load', handleLoad);
    map.on('moveend', handleMoveEnd);
    map.on('click', handleClick);

    return () => {
      // Remove event listeners before destroying map
      map.off('load', handleLoad);
      map.off('moveend', handleMoveEnd);
      map.off('click', handleClick);

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
  }, [shape.props.annotations, isLoaded]);

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

  const addAnnotation = useCallback((type: Annotation['type'], coordinates: Coordinate[]) => {
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${shape.props.annotations.length + 1}`,
      color: selectedColor,
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

    let bounds;
    try {
      bounds = mapRef.current.getBounds();
    } catch (err) {
      // Map may have been destroyed
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

      if (!isMountedRef.current) return;

      const data = await response.json() as { elements: { id: number; lat: number; lon: number; tags?: { name?: string; amenity?: string } }[] };

      const places = data.elements.slice(0, 10).map((el) => ({
        id: el.id,
        name: el.tags?.name || category.label,
        lat: el.lat,
        lng: el.lon,
        type: el.tags?.amenity || category.key,
        color: category.color,
      }));

      if (!isMountedRef.current) return;
      setNearbyPlaces(places);

      // Add markers for nearby places
      places.forEach((place: any) => {
        if (isMountedRef.current) {
          addAnnotation('marker', [{ lat: place.lat, lng: place.lng }]);
        }
      });
    } catch (err) {
      console.error('Find nearby error:', err);
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

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <HTMLContainer>
      <style>{`
        .mapus-sidebar::-webkit-scrollbar { width: 6px; }
        .mapus-sidebar::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
        .mapus-btn:hover { background: #f7f7f7 !important; }
        .mapus-btn:active { transform: scale(0.97); }
        .mapus-category:hover { background: #f7f7f7; }
        .mapus-annotation:hover { background: #f7f7f7; }
        .mapus-result:hover { background: #f3f4f6; }
        .mapus-tool:hover { background: #f7f7f7; }
        .mapus-tool.active { background: #222 !important; color: #fff !important; }
        .mapus-color:hover { transform: scale(1.15); }
        .mapus-color.selected { transform: scale(1.2); box-shadow: 0 0 0 2px #222; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#e5e7eb',
          display: 'flex',
          position: 'relative',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
        onPointerDown={stopPropagation}
        onPointerMove={stopPropagation}
        onWheel={stopPropagation}
        onClick={stopPropagation}
        onDoubleClick={stopPropagation}
        onKeyDown={stopPropagation}
      >
        {/* Left Sidebar */}
        {shape.props.showSidebar && (
          <div className="mapus-sidebar" style={styles.sidebar}>
            {/* Map Details */}
            <div style={styles.section}>
              <input
                value={shape.props.title}
                onChange={(e) => updateTitle(e.target.value)}
                onFocus={() => setEditingTitle(true)}
                onBlur={() => setEditingTitle(false)}
                style={{
                  width: '100%',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#222',
                  background: 'transparent',
                  borderBottom: editingTitle ? '2px solid #E8E8E8' : '2px solid transparent',
                  outline: 'none',
                  padding: 0,
                  marginBottom: 4,
                }}
              />
              <input
                value={shape.props.description}
                onChange={(e) => updateDescription(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  fontSize: 13,
                  color: '#626C72',
                  background: 'transparent',
                  outline: 'none',
                  padding: 0,
                }}
                placeholder="Add a description..."
              />
            </div>

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
              <div style={styles.sectionTitle}>Find nearby</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {NEARBY_CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="mapus-category"
                    onClick={() => findNearby(cat)}
                    style={{
                      textAlign: 'center',
                      padding: '10px 4px',
                      borderRadius: 6,
                      cursor: 'pointer',
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
                      <div style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ann.name}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAnnotationVisibility(ann.id); }}
                        className="mapus-btn"
                        style={{ ...styles.button, padding: 4, fontSize: 14 }}
                      >
                        {ann.visible ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
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
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {/* Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
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
              zIndex: 1000,
            }}
          >
            {shape.props.showSidebar ? '◀' : '▶'}
          </button>

          {/* Style Picker */}
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
            <select
              value={styleKey}
              onChange={(e) => changeStyle(e.target.value as StyleKey)}
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
          <div style={{ position: 'absolute', bottom: 80, right: 10, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 1000 }}>
            <button
              onClick={() => mapRef.current?.zoomIn()}
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
          </div>

          {/* Drawing Toolbar (Mapus-style) */}
          <div style={styles.toolbar}>
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
    </HTMLContainer>
  );
}

export default MapShape;
