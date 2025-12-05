/**
 * MapShapeUtil - Simplified tldraw shape for interactive maps
 *
 * Base functionality:
 * - MapLibre GL JS rendering
 * - Search (Nominatim geocoding)
 * - Routing (OSRM)
 * - Style switching
 * - GeoJSON layer support for collaboration overlays
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

export interface Waypoint {
  id: string;
  coordinate: Coordinate;
  name?: string;
}

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  geometry: GeoJSON.LineString;
}

/** GeoJSON layer for collaboration overlays */
export interface GeoJSONLayer {
  id: string;
  name: string;
  visible: boolean;
  data: GeoJSON.FeatureCollection;
}

export type IMapShape = TLBaseShape<
  'Map',
  {
    w: number;
    h: number;
    viewport: MapViewport;
    styleKey: string;
    interactive: boolean;
    waypoints: Waypoint[];
    route: RouteInfo | null;
    geoJsonLayers: GeoJSONLayer[];
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

// OSRM routing server
const OSRM_BASE_URL = 'https://routing.jeffemmett.com';

// Map styles - all free, no API key required
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
  liberty: {
    name: 'Liberty HD',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    icon: '🏛️',
  },
  bright: {
    name: 'Bright HD',
    url: 'https://tiles.openfreemap.org/styles/bright',
    icon: '✨',
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
    interactive: T.boolean,
    waypoints: T.any,
    route: T.any,
    geoJsonLayers: T.any,
  };

  static readonly PRIMARY_COLOR = '#22c55e';

  getDefaultProps(): IMapShape['props'] {
    return {
      w: 600,
      h: 400,
      viewport: DEFAULT_VIEWPORT,
      styleKey: 'voyager',
      interactive: true,
      waypoints: [],
      route: null,
      geoJsonLayers: [],
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
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} fill="none" rx={8} />;
  }

  component(shape: IMapShape) {
    return <MapComponent shape={shape} editor={this.editor} />;
  }
}

// =============================================================================
// Map Component
// =============================================================================

function MapComponent({ shape, editor }: { shape: IMapShape; editor: MapShape['editor'] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const [isLoaded, setIsLoaded] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const styleKey = (shape.props.styleKey || 'voyager') as StyleKey;
  const currentStyle = MAP_STYLES[styleKey] || MAP_STYLES.voyager;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const styleUrl = typeof currentStyle.url === 'string' ? currentStyle.url : currentStyle.url;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [shape.props.viewport.center.lng, shape.props.viewport.center.lat],
      zoom: shape.props.viewport.zoom,
      bearing: shape.props.viewport.bearing,
      pitch: shape.props.viewport.pitch,
      interactive: shape.props.interactive,
      attributionControl: false,
      maxZoom: 22,
    });

    mapRef.current = map;

    map.on('load', () => setIsLoaded(true));

    map.on('moveend', () => {
      const center = map.getCenter();
      const newViewport: MapViewport = {
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };

      // Debounce - only update if significantly changed
      const current = shape.props.viewport;
      const changed =
        Math.abs(current.center.lat - newViewport.center.lat) > 0.001 ||
        Math.abs(current.center.lng - newViewport.center.lng) > 0.001 ||
        Math.abs(current.zoom - newViewport.zoom) > 0.1;

      if (changed) {
        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: { viewport: newViewport },
        });
      }
    });

    // Click to add waypoint when in routing mode
    map.on('click', (e) => {
      if (shape.props.waypoints.length > 0 || e.originalEvent.shiftKey) {
        addWaypoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [containerRef.current]);

  // Handle style changes
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const styleUrl = typeof currentStyle.url === 'string' ? currentStyle.url : currentStyle.url;
    mapRef.current.setStyle(styleUrl);
  }, [styleKey, isLoaded]);

  // Resize map when shape dimensions change
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.resize();
    }
  }, [shape.props.w, shape.props.h, isLoaded]);

  // Render waypoint markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const currentIds = new Set(shape.props.waypoints.map((w: Waypoint) => w.id));

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    shape.props.waypoints.forEach((waypoint: Waypoint, index: number) => {
      let marker = markersRef.current.get(waypoint.id);

      if (!marker) {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 32px;
          height: 32px;
          background: #3b82f6;
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
        `;
        el.textContent = String(index + 1);
        el.title = waypoint.name || `Waypoint ${index + 1}`;

        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
          .setLngLat([waypoint.coordinate.lng, waypoint.coordinate.lat])
          .addTo(map);

        marker.on('dragend', () => {
          const lngLat = marker!.getLngLat();
          updateWaypointPosition(waypoint.id, { lat: lngLat.lat, lng: lngLat.lng });
        });

        markersRef.current.set(waypoint.id, marker);
      } else {
        marker.setLngLat([waypoint.coordinate.lng, waypoint.coordinate.lat]);
        const el = marker.getElement();
        if (el) {
          el.textContent = String(index + 1);
          el.title = waypoint.name || `Waypoint ${index + 1}`;
        }
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
    };
  }, [shape.props.waypoints, isLoaded]);

  // Render route
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const sourceId = `route-${shape.id}`;
    const layerId = `route-line-${shape.id}`;

    // Remove existing
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // Add route if exists
    if (shape.props.route?.geometry) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: shape.props.route.geometry },
      });

      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#22c55e', 'line-width': 5, 'line-opacity': 0.8 },
      });
    }

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [shape.props.route, isLoaded, shape.id]);

  // Render GeoJSON layers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;

    shape.props.geoJsonLayers.forEach((layer: GeoJSONLayer) => {
      const sourceId = `geojson-${layer.id}`;
      const layerId = `geojson-layer-${layer.id}`;

      // Remove if not visible
      if (!layer.visible) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        return;
      }

      // Add/update layer
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(layer.data);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: layer.data });
        map.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }
    });
  }, [shape.props.geoJsonLayers, isLoaded]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const addWaypoint = useCallback((coord: Coordinate) => {
    const newWaypoint: Waypoint = {
      id: `wp-${Date.now()}`,
      coordinate: coord,
      name: `Waypoint ${shape.props.waypoints.length + 1}`,
    };

    const updatedWaypoints = [...shape.props.waypoints, newWaypoint];

    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { waypoints: updatedWaypoints },
    });

    // Auto-calculate route if 2+ waypoints
    if (updatedWaypoints.length >= 2) {
      calculateRoute(updatedWaypoints);
    }
  }, [shape.props.waypoints, shape.id, editor]);

  const updateWaypointPosition = useCallback((waypointId: string, coord: Coordinate) => {
    const updatedWaypoints = shape.props.waypoints.map((wp: Waypoint) =>
      wp.id === waypointId ? { ...wp, coordinate: coord } : wp
    );

    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { waypoints: updatedWaypoints },
    });

    if (updatedWaypoints.length >= 2) {
      calculateRoute(updatedWaypoints);
    }
  }, [shape.props.waypoints, shape.id, editor]);

  const calculateRoute = useCallback(async (waypoints: Waypoint[]) => {
    if (waypoints.length < 2) return;

    setIsCalculatingRoute(true);
    setRouteError(null);

    try {
      const coords = waypoints.map((wp) => `${wp.coordinate.lng},${wp.coordinate.lat}`).join(';');
      const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        throw new Error(data.message || 'Route calculation failed');
      }

      const route = data.routes[0];
      const routeInfo: RouteInfo = {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      };

      editor.updateShape<IMapShape>({
        id: shape.id,
        type: 'Map',
        props: { route: routeInfo },
      });
    } catch (err) {
      console.error('Routing error:', err);
      setRouteError(err instanceof Error ? err.message : 'Route calculation failed');
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [shape.id, editor]);

  const clearRoute = useCallback(() => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { waypoints: [], route: null },
    });
  }, [shape.id, editor]);

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { headers: { 'User-Agent': 'CanvasWebsite/1.0' } }
      );
      const data = await response.json();
      setSearchResults(
        data.map((r: { display_name: string; lat: string; lon: string }) => ({
          name: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }))
      );
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const flyTo = useCallback((coord: Coordinate, zoom?: number) => {
    mapRef.current?.flyTo({
      center: [coord.lng, coord.lat],
      zoom: zoom ?? mapRef.current.getZoom(),
      duration: 1000,
    });
  }, []);

  const changeStyle = useCallback((key: StyleKey) => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { styleKey: key },
    });
    setShowStyleMenu(false);
  }, [shape.id, editor]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <HTMLContainer>
      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#e5e7eb',
          position: 'relative',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        {/* Map container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Top toolbar */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {/* Search */}
          <div style={{ pointerEvents: 'auto', position: 'relative', flex: 1, maxWidth: 300 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                placeholder="Search location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                onFocus={() => setShowSearch(true)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              />
              <button
                onClick={searchLocation}
                disabled={isSearching}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {isSearching ? '...' : '🔍'}
              </button>
            </div>

            {/* Search results dropdown */}
            {showSearch && searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: 'white',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  maxHeight: 200,
                  overflowY: 'auto',
                  zIndex: 100,
                }}
              >
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      flyTo({ lat: result.lat, lng: result.lng }, 14);
                      setShowSearch(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      fontSize: '12px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    {result.name.length > 60 ? result.name.slice(0, 60) + '...' : result.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Style selector */}
          <div style={{ pointerEvents: 'auto', position: 'relative' }}>
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: 'white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {currentStyle.icon} {currentStyle.name}
            </button>

            {showStyleMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: 'white',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  zIndex: 100,
                  minWidth: 140,
                }}
              >
                {Object.entries(MAP_STYLES).map(([key, style]) => (
                  <div
                    key={key}
                    onClick={() => changeStyle(key as StyleKey)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      background: key === styleKey ? '#f3f4f6' : 'white',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = key === styleKey ? '#f3f4f6' : 'white')}
                  >
                    {style.icon} {style.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Route info panel */}
        {(shape.props.waypoints.length > 0 || shape.props.route) && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              background: 'white',
              borderRadius: '8px',
              padding: '10px 14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: '13px',
              pointerEvents: 'auto',
              maxWidth: 280,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🚗 Route</span>
              <button
                onClick={clearRoute}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#6b7280',
                }}
                title="Clear route"
              >
                ✕
              </button>
            </div>

            <div style={{ color: '#6b7280', marginBottom: 6 }}>
              {shape.props.waypoints.length} waypoint{shape.props.waypoints.length !== 1 ? 's' : ''}
              {isCalculatingRoute && ' • Calculating...'}
            </div>

            {shape.props.route && (
              <div style={{ display: 'flex', gap: 16 }}>
                <span>📏 {formatDistance(shape.props.route.distance)}</span>
                <span>⏱️ {formatDuration(shape.props.route.duration)}</span>
              </div>
            )}

            {routeError && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginTop: 4 }}>
                ⚠️ {routeError}
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: '11px', color: '#9ca3af' }}>
              Shift+click to add waypoints
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => mapRef.current?.zoomIn()}
            style={{
              width: 32,
              height: 32,
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            style={{
              width: 32,
              height: 32,
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            −
          </button>
        </div>

        {/* Click outside to close menus */}
        {(showStyleMenu || showSearch) && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 50 }}
            onClick={() => {
              setShowStyleMenu(false);
              setShowSearch(false);
            }}
          />
        )}
      </div>
    </HTMLContainer>
  );
}

export default MapShape;
