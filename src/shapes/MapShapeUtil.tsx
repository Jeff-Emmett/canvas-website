/**
 * MapShapeUtil - Enhanced tldraw shape for interactive maps
 *
 * Features:
 * - MapLibre GL JS rendering with touch/pen/mouse support
 * - Search with autocomplete (Nominatim)
 * - Routing with directions (OSRM)
 * - GPS location sharing for trusted groups
 * - Style switching
 * - GeoJSON layer support
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
  address?: string;
}

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  geometry: GeoJSON.LineString;
  steps?: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  name: string;
}

/** GPS User for location sharing */
export interface GPSUser {
  id: string;
  name: string;
  color: string;
  coordinate: Coordinate;
  accuracy?: number;
  timestamp: number;
  isSelf?: boolean;
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
    gpsUsers: GPSUser[];
    showGPS: boolean;
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

// Person emojis for GPS markers
const PERSON_EMOJIS = ['🧑', '👤', '🚶', '🧍', '👨', '👩', '🧔', '👱'];

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
// Common Button Styles (touch-friendly)
// =============================================================================

const BUTTON_BASE: React.CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  background: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const BUTTON_PRIMARY: React.CSSProperties = {
  ...BUTTON_BASE,
  background: '#3b82f6',
  color: 'white',
};

const BUTTON_DANGER: React.CSSProperties = {
  ...BUTTON_BASE,
  background: '#ef4444',
  color: 'white',
};

const BUTTON_SUCCESS: React.CSSProperties = {
  ...BUTTON_BASE,
  background: '#22c55e',
  color: 'white',
};

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
    gpsUsers: T.any,
    showGPS: T.boolean,
  };

  static readonly PRIMARY_COLOR = '#22c55e';

  getDefaultProps(): IMapShape['props'] {
    return {
      w: 600,
      h: 450,
      viewport: DEFAULT_VIEWPORT,
      styleKey: 'voyager',
      interactive: true,
      waypoints: [],
      route: null,
      geoJsonLayers: [],
      gpsUsers: [],
      showGPS: false,
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const gpsMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'search' | 'route' | 'gps' | 'style'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'off' | 'locating' | 'sharing' | 'error'>('off');
  const [gpsError, setGpsError] = useState<string | null>(null);

  const styleKey = (shape.props.styleKey || 'voyager') as StyleKey;
  const currentStyle = MAP_STYLES[styleKey] || MAP_STYLES.voyager;

  // ==========================================================================
  // Map Initialization
  // ==========================================================================

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
      // Touch/pen settings
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
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

    // Click/tap to add waypoint when in routing mode
    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (activePanel === 'route' || e.originalEvent.shiftKey) {
        addWaypoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
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
      setTimeout(() => mapRef.current?.resize(), 0);
    }
  }, [shape.props.w, shape.props.h, isLoaded]);

  // ==========================================================================
  // Waypoint Markers
  // ==========================================================================

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
        el.className = 'map-waypoint-marker';
        el.style.cssText = `
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          color: white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          cursor: grab;
          touch-action: none;
          z-index: 1000;
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
  }, [shape.props.waypoints, isLoaded]);

  // ==========================================================================
  // GPS User Markers
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const currentIds = new Set(shape.props.gpsUsers.map((u: GPSUser) => u.id));

    // Remove old markers
    gpsMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        gpsMarkersRef.current.delete(id);
      }
    });

    // Add/update GPS markers
    shape.props.gpsUsers.forEach((user: GPSUser) => {
      let marker = gpsMarkersRef.current.get(user.id);
      const emoji = user.isSelf ? '📍' : getPersonEmoji(user.id);

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'map-gps-marker';
        el.style.cssText = `
          width: 44px;
          height: 44px;
          background: ${user.isSelf ? `linear-gradient(135deg, ${user.color}, #1d4ed8)` : user.color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 3px 12px rgba(0,0,0,0.4);
          cursor: pointer;
          touch-action: none;
          z-index: 999;
          ${user.isSelf ? 'animation: gps-pulse 2s ease-in-out infinite;' : ''}
        `;
        el.textContent = emoji;
        el.title = `${user.name}${user.isSelf ? ' (you)' : ''}`;

        // Add popup
        const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
          .setHTML(`
            <div style="font-size: 13px; padding: 4px;">
              <strong>${user.name}</strong>${user.isSelf ? ' (you)' : ''}
              ${user.accuracy ? `<br><span style="color: #666;">±${Math.round(user.accuracy)}m</span>` : ''}
            </div>
          `);

        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([user.coordinate.lng, user.coordinate.lat])
          .setPopup(popup)
          .addTo(map);

        gpsMarkersRef.current.set(user.id, marker);
      } else {
        marker.setLngLat([user.coordinate.lng, user.coordinate.lat]);
      }
    });
  }, [shape.props.gpsUsers, isLoaded]);

  // ==========================================================================
  // Route Rendering
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const sourceId = `route-${shape.id}`;
    const layerId = `route-line-${shape.id}`;
    const outlineLayerId = `route-outline-${shape.id}`;

    // Wait for style to load
    const renderRoute = () => {
      // Remove existing
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      // Add route if exists
      if (shape.props.route?.geometry) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: shape.props.route.geometry },
        });

        // Outline layer
        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#1d4ed8', 'line-width': 8 },
        });

        // Main route layer
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3b82f6', 'line-width': 5 },
        });
      }
    };

    if (map.isStyleLoaded()) {
      renderRoute();
    } else {
      map.once('style.load', renderRoute);
    }

    return () => {
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [shape.props.route, isLoaded, shape.id]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const addWaypoint = useCallback((coord: Coordinate, name?: string) => {
    const newWaypoint: Waypoint = {
      id: `wp-${Date.now()}`,
      coordinate: coord,
      name: name || `Waypoint ${shape.props.waypoints.length + 1}`,
    };

    const updatedWaypoints = [...shape.props.waypoints, newWaypoint];

    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { waypoints: updatedWaypoints },
    });

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

  const removeWaypoint = useCallback((waypointId: string) => {
    const updatedWaypoints = shape.props.waypoints.filter((wp: Waypoint) => wp.id !== waypointId);

    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: {
        waypoints: updatedWaypoints,
        route: updatedWaypoints.length < 2 ? null : shape.props.route,
      },
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
      const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url);
      const data = await response.json() as { code: string; message?: string; routes?: Array<{ distance: number; duration: number; geometry: GeoJSON.LineString; legs?: Array<{ steps?: Array<{ maneuver?: { instruction?: string }; name?: string; distance: number; duration: number }> }> }> };

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        throw new Error(data.message || 'Route calculation failed');
      }

      const route = data.routes[0];
      const steps: RouteStep[] = route.legs?.flatMap((leg: any) =>
        leg.steps?.map((step: any) => ({
          instruction: step.maneuver?.instruction || step.name || 'Continue',
          distance: step.distance,
          duration: step.duration,
          name: step.name || '',
        })) || []
      ) || [];

      const routeInfo: RouteInfo = {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        steps,
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
    setStartInput('');
    setEndInput('');
  }, [shape.id, editor]);

  const reverseRoute = useCallback(() => {
    const reversed = [...shape.props.waypoints].reverse();
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { waypoints: reversed },
    });
    if (reversed.length >= 2) {
      calculateRoute(reversed);
    }
  }, [shape.props.waypoints, shape.id, editor, calculateRoute]);

  // ==========================================================================
  // Search
  // ==========================================================================

  const searchLocation = useCallback(async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6`,
        { headers: { 'User-Agent': 'CanvasWebsite/1.0' } }
      );
      const data = await response.json() as Array<{ display_name: string; lat: string; lon: string }>;
      setSearchResults(
        data.map((r) => ({
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

  // Debounced search as you type
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => searchLocation(), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const flyTo = useCallback((coord: Coordinate, zoom?: number) => {
    mapRef.current?.flyTo({
      center: [coord.lng, coord.lat],
      zoom: zoom ?? Math.max(mapRef.current.getZoom(), 14),
      duration: 1000,
    });
  }, []);

  const selectSearchResult = useCallback((result: { name: string; lat: number; lng: number }) => {
    flyTo({ lat: result.lat, lng: result.lng }, 15);
    setSearchQuery('');
    setSearchResults([]);
    setActivePanel('none');
  }, [flyTo]);

  // ==========================================================================
  // GPS Location Sharing
  // ==========================================================================

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported');
      setGpsStatus('error');
      return;
    }

    setGpsStatus('locating');
    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus('sharing');

        const selfUser: GPSUser = {
          id: `self-${Date.now()}`,
          name: 'You',
          color: '#3b82f6',
          coordinate: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
          isSelf: true,
        };

        // Update GPS users (keep others, update self)
        const others = shape.props.gpsUsers.filter((u: GPSUser) => !u.isSelf);
        editor.updateShape<IMapShape>({
          id: shape.id,
          type: 'Map',
          props: {
            gpsUsers: [...others, selfUser],
            showGPS: true,
          },
        });

        // Fly to location on first fix
        if (gpsStatus === 'locating') {
          flyTo({ lat: position.coords.latitude, lng: position.coords.longitude }, 15);
        }
      },
      (error) => {
        setGpsStatus('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location unavailable');
            break;
          case error.TIMEOUT:
            setGpsError('Location request timeout');
            break;
          default:
            setGpsError('Location error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [shape.props.gpsUsers, shape.id, editor, gpsStatus, flyTo]);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setGpsStatus('off');

    // Remove self from GPS users
    const others = shape.props.gpsUsers.filter((u: GPSUser) => !u.isSelf);
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: {
        gpsUsers: others,
        showGPS: others.length > 0,
      },
    });
  }, [shape.props.gpsUsers, shape.id, editor]);

  const fitToAllGPS = useCallback(() => {
    if (shape.props.gpsUsers.length === 0 || !mapRef.current) return;

    const bounds = new maplibregl.LngLatBounds();
    shape.props.gpsUsers.forEach((user: GPSUser) => {
      bounds.extend([user.coordinate.lng, user.coordinate.lat]);
    });

    mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  }, [shape.props.gpsUsers]);

  // Quick locate me - one-shot location to center map and drop a pin
  const [isLocating, setIsLocating] = useState(false);
  const myLocationMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Helper to darken a color for gradient effect
  const darkenColor = useCallback((hex: string): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 40);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - 40);
    const b = Math.max(0, (num & 0x0000FF) - 40);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) {
      setGpsError('Geolocation not supported');
      return;
    }

    setIsLocating(true);

    // Get user info from the editor
    const userName = editor.user.getName() || 'You';
    const userColor = editor.user.getColor() || '#3b82f6';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        const accuracy = position.coords.accuracy;

        // Fly to location
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 1000,
        });

        // Create or update the "my location" marker
        if (myLocationMarkerRef.current) {
          myLocationMarkerRef.current.setLngLat([lng, lat]);
        } else {
          // Create marker element
          const el = document.createElement('div');
          el.className = 'my-location-marker';
          el.style.cssText = `
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, ${userColor}, ${darkenColor(userColor)});
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 3px 12px rgba(0,0,0,0.4);
            cursor: pointer;
            z-index: 1000;
            animation: my-location-pulse 2s ease-in-out infinite;
          `;
          el.textContent = '📍';
          el.title = `${userName} (you)`;

          // Add popup with name
          const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
            .setHTML(`
              <div style="font-size: 13px; padding: 4px 8px;">
                <strong>${userName}</strong> (you)
                ${accuracy ? `<br><span style="color: #666; font-size: 11px;">±${Math.round(accuracy)}m accuracy</span>` : ''}
              </div>
            `);

          myLocationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(mapRef.current!);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location unavailable');
            break;
          default:
            setGpsError('Could not get location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [editor, darkenColor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.remove();
        myLocationMarkerRef.current = null;
      }
    };
  }, []);

  // ==========================================================================
  // Style
  // ==========================================================================

  const changeStyle = useCallback((key: StyleKey) => {
    editor.updateShape<IMapShape>({
      id: shape.id,
      type: 'Map',
      props: { styleKey: key },
    });
    setActivePanel('none');
  }, [shape.id, editor]);

  // ==========================================================================
  // Helpers
  // ==========================================================================

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

  const getPersonEmoji = (id: string): string => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return PERSON_EMOJIS[Math.abs(hash) % PERSON_EMOJIS.length];
  };

  // ==========================================================================
  // Event Handlers - Stop propagation to tldraw
  // ==========================================================================

  // Stop events from bubbling up to tldraw
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  // Prevent tldraw from capturing wheel/zoom events
  // Using native event listener for better control
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    // Don't preventDefault - let MapLibre handle the actual zoom
  }, []);

  // Native wheel event handler for the container (more reliable)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const nativeWheelHandler = (e: WheelEvent) => {
      // Stop propagation to tldraw but let MapLibre handle it
      e.stopPropagation();
    };

    // Use capture phase to intercept before tldraw
    wrapper.addEventListener('wheel', nativeWheelHandler, { capture: true, passive: false });

    return () => {
      wrapper.removeEventListener('wheel', nativeWheelHandler, { capture: true });
    };
  }, []);

  // Prevent tldraw from intercepting pointer events
  // Note: Don't use setPointerCapture as it blocks child element interaction
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  // For inputs, we need to prevent tldraw from stealing focus
  const handleInputFocus = useCallback((e: React.FocusEvent) => {
    e.stopPropagation();
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <HTMLContainer>
      <style>{`
        @keyframes gps-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 3px 12px rgba(0,0,0,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 4px 16px rgba(59,130,246,0.5); }
        }
        @keyframes my-location-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 3px 12px rgba(0,0,0,0.4); }
          50% { transform: scale(1.1); box-shadow: 0 4px 20px rgba(59,130,246,0.6); }
        }
        .map-btn:hover { filter: brightness(1.05); }
        .map-btn:active { transform: scale(0.96); }
        .map-result:hover { background: #f3f4f6 !important; }
        .map-container * { pointer-events: auto !important; }
        .my-location-marker:hover { transform: scale(1.15) !important; }
      `}</style>

      <div
        ref={wrapperRef}
        className="map-container"
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#e5e7eb',
          position: 'relative',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={stopPropagation}
        onTouchStart={stopPropagation}
        onTouchMove={stopPropagation}
        onTouchEnd={stopPropagation}
        onWheel={handleWheel}
        onClick={stopPropagation}
        onDoubleClick={stopPropagation}
        onContextMenu={stopPropagation}
        onKeyDown={stopPropagation}
        onKeyUp={stopPropagation}
      >
        {/* Map container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Top toolbar */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            display: 'flex',
            gap: 8,
            zIndex: 1000,
          }}
        >
          {/* Search bar */}
          <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Search places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') searchLocation();
                }}
                onFocus={(e) => {
                  handleInputFocus(e);
                  setActivePanel('search');
                }}
                onPointerDown={stopPropagation}
                onTouchStart={stopPropagation}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  touchAction: 'manipulation',
                }}
              />
              <button
                onClick={() => searchLocation()}
                disabled={isSearching}
                className="map-btn"
                style={{ ...BUTTON_PRIMARY, width: 44, height: 44, fontSize: '16px' }}
              >
                {isSearching ? '⏳' : '🔍'}
              </button>
            </div>

            {/* Search results */}
            {activePanel === 'search' && searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 6,
                  background: 'white',
                  borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  maxHeight: 280,
                  overflowY: 'auto',
                  zIndex: 1001,
                }}
              >
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    className="map-result"
                    onClick={() => selectSearchResult(result)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      fontSize: '13px',
                      touchAction: 'manipulation',
                    }}
                  >
                    📍 {result.name.length > 55 ? result.name.slice(0, 55) + '...' : result.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
            {/* Directions */}
            <button
              onClick={() => setActivePanel(activePanel === 'route' ? 'none' : 'route')}
              className="map-btn"
              style={{
                ...BUTTON_BASE,
                width: 44,
                height: 44,
                fontSize: '18px',
                background: activePanel === 'route' ? '#3b82f6' : 'white',
                color: activePanel === 'route' ? 'white' : 'inherit',
              }}
              title="Directions"
            >
              🚗
            </button>

            {/* GPS */}
            <button
              onClick={() => setActivePanel(activePanel === 'gps' ? 'none' : 'gps')}
              className="map-btn"
              style={{
                ...BUTTON_BASE,
                width: 44,
                height: 44,
                fontSize: '18px',
                background: gpsStatus === 'sharing' ? '#22c55e' : activePanel === 'gps' ? '#3b82f6' : 'white',
                color: gpsStatus === 'sharing' || activePanel === 'gps' ? 'white' : 'inherit',
              }}
              title="Share location"
            >
              📍
            </button>

            {/* Style */}
            <button
              onClick={() => setActivePanel(activePanel === 'style' ? 'none' : 'style')}
              className="map-btn"
              style={{ ...BUTTON_BASE, width: 44, height: 44, fontSize: '16px' }}
              title="Map style"
            >
              {currentStyle.icon}
            </button>
          </div>
        </div>

        {/* Style menu */}
        {activePanel === 'style' && (
          <div
            style={{
              position: 'absolute',
              top: 62,
              right: 10,
              background: 'white',
              borderRadius: '10px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              zIndex: 1001,
              minWidth: 150,
              pointerEvents: 'auto',
            }}
          >
            {Object.entries(MAP_STYLES).map(([key, style]) => (
              <div
                key={key}
                className="map-result"
                onClick={() => changeStyle(key as StyleKey)}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  background: key === styleKey ? '#f3f4f6' : 'white',
                  touchAction: 'manipulation',
                }}
              >
                {style.icon} {style.name}
              </div>
            ))}
          </div>
        )}

        {/* Directions panel */}
        {activePanel === 'route' && (
          <div
            style={{
              position: 'absolute',
              top: 62,
              left: 10,
              width: 300,
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              zIndex: 1001,
              pointerEvents: 'auto',
              maxHeight: shape.props.h - 80,
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>🚗 Directions</span>
                <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              {/* Waypoints list */}
              {shape.props.waypoints.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {shape.props.waypoints.map((wp: Waypoint, i: number) => (
                    <div key={wp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#3b82f6',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wp.name || `${wp.coordinate.lat.toFixed(4)}, ${wp.coordinate.lng.toFixed(4)}`}
                      </span>
                      <button
                        onClick={() => removeWaypoint(wp.id)}
                        className="map-btn"
                        style={{ ...BUTTON_BASE, width: 28, height: 28, fontSize: 14, background: '#fee2e2', color: '#ef4444' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Route info */}
              {shape.props.route && (
                <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 16, fontSize: 14, fontWeight: 500 }}>
                    <span>📏 {formatDistance(shape.props.route.distance)}</span>
                    <span>⏱️ {formatDuration(shape.props.route.duration)}</span>
                  </div>
                </div>
              )}

              {isCalculatingRoute && (
                <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>⏳ Calculating route...</div>
              )}

              {routeError && (
                <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>⚠️ {routeError}</div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {shape.props.waypoints.length >= 2 && (
                  <button onClick={reverseRoute} className="map-btn" style={{ ...BUTTON_BASE, padding: '8px 12px', fontSize: 13 }}>
                    🔄 Reverse
                  </button>
                )}
                {shape.props.waypoints.length > 0 && (
                  <button onClick={clearRoute} className="map-btn" style={{ ...BUTTON_DANGER, padding: '8px 12px', fontSize: 13 }}>
                    🗑️ Clear
                  </button>
                )}
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
                Tap map or shift+click to add waypoints
              </div>
            </div>
          </div>
        )}

        {/* GPS panel */}
        {activePanel === 'gps' && (
          <div
            style={{
              position: 'absolute',
              top: 62,
              left: 10,
              width: 280,
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              zIndex: 1001,
              pointerEvents: 'auto',
            }}
          >
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>📍 Location Sharing</span>
                <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              {/* GPS status */}
              <div style={{ marginBottom: 14 }}>
                {gpsStatus === 'off' && (
                  <button onClick={startGPS} className="map-btn" style={{ ...BUTTON_SUCCESS, width: '100%', padding: '12px', fontSize: 14 }}>
                    📍 Share My Location
                  </button>
                )}
                {gpsStatus === 'locating' && (
                  <div style={{ color: '#3b82f6', fontSize: 14 }}>⏳ Getting your location...</div>
                )}
                {gpsStatus === 'sharing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 500 }}>✅ Sharing your location</div>
                    <button onClick={stopGPS} className="map-btn" style={{ ...BUTTON_DANGER, width: '100%', padding: '10px', fontSize: 13 }}>
                      Stop Sharing
                    </button>
                  </div>
                )}
                {gpsStatus === 'error' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ color: '#ef4444', fontSize: 13 }}>⚠️ {gpsError}</div>
                    <button onClick={startGPS} className="map-btn" style={{ ...BUTTON_PRIMARY, width: '100%', padding: '10px', fontSize: 13 }}>
                      Try Again
                    </button>
                  </div>
                )}
              </div>

              {/* People nearby */}
              {shape.props.gpsUsers.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#374151' }}>
                    People ({shape.props.gpsUsers.length})
                  </div>
                  {shape.props.gpsUsers.map((user: GPSUser) => (
                    <div
                      key={user.id}
                      onClick={() => flyTo(user.coordinate, 16)}
                      className="map-result"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 8px',
                        cursor: 'pointer',
                        borderRadius: 6,
                        marginBottom: 4,
                        touchAction: 'manipulation',
                      }}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: '50%', background: user.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {user.isSelf ? '📍' : getPersonEmoji(user.id)}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{user.name}{user.isSelf ? ' (you)' : ''}</div>
                        {user.accuracy && <div style={{ fontSize: 11, color: '#9ca3af' }}>±{Math.round(user.accuracy)}m</div>}
                      </div>
                    </div>
                  ))}
                  {shape.props.gpsUsers.length > 1 && (
                    <button onClick={fitToAllGPS} className="map-btn" style={{ ...BUTTON_BASE, width: '100%', padding: '10px', fontSize: 13, marginTop: 8 }}>
                      👥 Fit All
                    </button>
                  )}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
                Location shared with people on this canvas
              </div>
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="map-btn"
            style={{ ...BUTTON_BASE, width: 40, height: 40, fontSize: 20 }}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="map-btn"
            style={{ ...BUTTON_BASE, width: 40, height: 40, fontSize: 20 }}
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={locateMe}
            disabled={isLocating}
            className="map-btn"
            style={{
              ...BUTTON_BASE,
              width: 40,
              height: 40,
              fontSize: 18,
              marginTop: 4,
              background: isLocating ? '#dbeafe' : 'white',
            }}
            title="Zoom to my location"
          >
            {isLocating ? '⏳' : '⊙'}
          </button>
        </div>

        {/* Quick route info badge (when panel closed) */}
        {activePanel !== 'route' && shape.props.route && (
          <div
            onClick={() => setActivePanel('route')}
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              background: 'white',
              borderRadius: '10px',
              padding: '10px 14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: '13px',
              zIndex: 1000,
              pointerEvents: 'auto',
              cursor: 'pointer',
              display: 'flex',
              gap: 14,
              touchAction: 'manipulation',
            }}
          >
            <span>📏 {formatDistance(shape.props.route.distance)}</span>
            <span>⏱️ {formatDuration(shape.props.route.duration)}</span>
          </div>
        )}

        {/* Click outside to close panels */}
        {activePanel !== 'none' && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 999, pointerEvents: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel('none');
            }}
            onPointerDown={stopPropagation}
            onTouchStart={stopPropagation}
          />
        )}
      </div>
    </HTMLContainer>
  );
}

export default MapShape;
