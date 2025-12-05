/**
 * useMapInstance - Hook for managing MapLibre GL JS instance
 *
 * Provides:
 * - Map initialization and cleanup
 * - Viewport state management
 * - Event handlers (click, move, zoom)
 * - Ref to underlying map instance for advanced usage
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapViewport, Coordinate, TileServiceConfig } from '../types';

interface UseMapInstanceOptions {
  container: HTMLElement | null;
  config: TileServiceConfig;
  initialViewport?: MapViewport;
  onViewportChange?: (viewport: MapViewport) => void;
  onClick?: (coordinate: Coordinate, event: maplibregl.MapMouseEvent) => void;
  onDoubleClick?: (coordinate: Coordinate, event: maplibregl.MapMouseEvent) => void;
  onMoveStart?: () => void;
  onMoveEnd?: (viewport: MapViewport) => void;
  interactive?: boolean;
}

interface UseMapInstanceReturn {
  isLoaded: boolean;
  error: Error | null;
  viewport: MapViewport;
  setViewport: (viewport: MapViewport) => void;
  flyTo: (coordinate: Coordinate, zoom?: number, options?: maplibregl.FlyToOptions) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: maplibregl.FitBoundsOptions) => void;
  getMap: () => maplibregl.Map | null;
  resize: () => void;
}

const DEFAULT_VIEWPORT: MapViewport = {
  center: { lat: 40.7128, lng: -74.006 }, // NYC default
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

// Available map styles - all free, no API key required
export const MAP_STYLES = {
  // Carto Voyager - clean, modern look (default)
  voyager: {
    name: 'Voyager',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    icon: '🗺️',
    maxZoom: 20,
  },
  // Carto Positron - light, minimal
  positron: {
    name: 'Light',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    icon: '☀️',
    maxZoom: 20,
  },
  // Carto Dark Matter - dark mode
  darkMatter: {
    name: 'Dark',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    icon: '🌙',
    maxZoom: 20,
  },
  // OpenStreetMap standard raster tiles
  osm: {
    name: 'OSM Classic',
    url: {
      version: 8,
      sources: {
        'osm-raster': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'osm-raster-layer', type: 'raster', source: 'osm-raster' }],
    } as maplibregl.StyleSpecification,
    icon: '🌍',
    maxZoom: 19,
  },
  // OpenFreeMap - high detail vector tiles (free, self-hostable)
  liberty: {
    name: 'Liberty HD',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    icon: '🏛️',
    maxZoom: 22,
  },
  // OpenFreeMap Bright - detailed bright style
  bright: {
    name: 'Bright HD',
    url: 'https://tiles.openfreemap.org/styles/bright',
    icon: '✨',
    maxZoom: 22,
  },
  // Protomaps - detailed vector tiles
  protomapsLight: {
    name: 'Proto Light',
    url: {
      version: 8,
      glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
      sources: {
        protomaps: {
          type: 'vector',
          tiles: ['https://api.protomaps.com/tiles/v3/{z}/{x}/{y}.mvt?key=1003762824b9687f'],
          maxzoom: 15,
          attribution: '&copy; Protomaps &copy; OpenStreetMap',
        },
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
        { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water', paint: { 'fill-color': '#a0c8f0' } },
        { id: 'landuse-park', type: 'fill', source: 'protomaps', 'source-layer': 'landuse', filter: ['==', 'pmap:kind', 'park'], paint: { 'fill-color': '#c8e6c8' } },
        { id: 'roads-minor', type: 'line', source: 'protomaps', 'source-layer': 'roads', filter: ['in', 'pmap:kind', 'minor_road', 'other'], paint: { 'line-color': '#ffffff', 'line-width': 1 } },
        { id: 'roads-major', type: 'line', source: 'protomaps', 'source-layer': 'roads', filter: ['in', 'pmap:kind', 'major_road', 'highway'], paint: { 'line-color': '#ffd080', 'line-width': 2 } },
        { id: 'buildings', type: 'fill', source: 'protomaps', 'source-layer': 'buildings', paint: { 'fill-color': '#e0dcd8', 'fill-opacity': 0.8 } },
      ],
    } as maplibregl.StyleSpecification,
    icon: '🔬',
    maxZoom: 22,
  },
  // Satellite imagery via ESRI World Imagery (free for personal use)
  satellite: {
    name: 'Satellite',
    url: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'esri-satellite' }],
    } as maplibregl.StyleSpecification,
    icon: '🛰️',
    maxZoom: 19,
  },
} as const;

// Default style - Carto Voyager (clean, modern, Google Maps-like)
const DEFAULT_STYLE = MAP_STYLES.voyager.url;

export function useMapInstance({
  container,
  config,
  initialViewport = DEFAULT_VIEWPORT,
  onViewportChange,
  onClick,
  onDoubleClick,
  onMoveStart,
  onMoveEnd,
  interactive = true,
}: UseMapInstanceOptions): UseMapInstanceReturn {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [viewport, setViewportState] = useState<MapViewport>(initialViewport);

  // Initialize map
  useEffect(() => {
    if (!container) return;

    // Prevent double initialization
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      const style = config.styleUrl || DEFAULT_STYLE;

      const map = new maplibregl.Map({
        container,
        style,
        center: [initialViewport.center.lng, initialViewport.center.lat],
        zoom: initialViewport.zoom,
        bearing: initialViewport.bearing,
        pitch: initialViewport.pitch,
        interactive,
        attributionControl: false,
        maxZoom: config.maxZoom ?? 22,
      });

      mapRef.current = map;

      // Handle map load
      map.on('load', () => {
        setIsLoaded(true);
        setError(null);
      });

      // Handle map errors
      map.on('error', (e) => {
        console.error('MapLibre error:', e);
        setError(new Error(e.error?.message || 'Map error occurred'));
      });

      // Handle viewport changes
      map.on('move', () => {
        const center = map.getCenter();
        const newViewport: MapViewport = {
          center: { lat: center.lat, lng: center.lng },
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
        setViewportState(newViewport);
        onViewportChange?.(newViewport);
      });

      // Handle move start/end
      map.on('movestart', () => {
        onMoveStart?.();
      });

      map.on('moveend', () => {
        const center = map.getCenter();
        const finalViewport: MapViewport = {
          center: { lat: center.lat, lng: center.lng },
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
        onMoveEnd?.(finalViewport);
      });

      // Handle click events
      map.on('click', (e) => {
        onClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, e);
      });

      map.on('dblclick', (e) => {
        onDoubleClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, e);
      });

    } catch (err) {
      console.error('Failed to initialize MapLibre:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize map'));
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsLoaded(false);
      }
    };
  }, [container]); // Only re-init if container changes

  // Update viewport when props change (external control)
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    // Only update if significantly different to avoid feedback loops
    const centerChanged =
      Math.abs(currentCenter.lat - initialViewport.center.lat) > 0.0001 ||
      Math.abs(currentCenter.lng - initialViewport.center.lng) > 0.0001;
    const zoomChanged = Math.abs(currentZoom - initialViewport.zoom) > 0.01;
    const bearingChanged = Math.abs(currentBearing - initialViewport.bearing) > 0.1;
    const pitchChanged = Math.abs(currentPitch - initialViewport.pitch) > 0.1;

    if (centerChanged || zoomChanged || bearingChanged || pitchChanged) {
      map.jumpTo({
        center: [initialViewport.center.lng, initialViewport.center.lat],
        zoom: initialViewport.zoom,
        bearing: initialViewport.bearing,
        pitch: initialViewport.pitch,
      });
    }
  }, [initialViewport, isLoaded]);

  const setViewport = useCallback(
    (newViewport: MapViewport) => {
      setViewportState(newViewport);
      onViewportChange?.(newViewport);

      if (mapRef.current && isLoaded) {
        mapRef.current.jumpTo({
          center: [newViewport.center.lng, newViewport.center.lat],
          zoom: newViewport.zoom,
          bearing: newViewport.bearing,
          pitch: newViewport.pitch,
        });
      }
    },
    [isLoaded, onViewportChange]
  );

  const flyTo = useCallback(
    (coordinate: Coordinate, zoom?: number, options?: maplibregl.FlyToOptions) => {
      if (!mapRef.current || !isLoaded) return;

      mapRef.current.flyTo({
        center: [coordinate.lng, coordinate.lat],
        zoom: zoom ?? mapRef.current.getZoom(),
        ...options,
      });
    },
    [isLoaded]
  );

  const fitBounds = useCallback(
    (bounds: [[number, number], [number, number]], options?: maplibregl.FitBoundsOptions) => {
      if (!mapRef.current || !isLoaded) return;

      mapRef.current.fitBounds(bounds, {
        padding: 50,
        ...options,
      });
    },
    [isLoaded]
  );

  const getMap = useCallback(() => mapRef.current, []);

  const resize = useCallback(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.resize();
    }
  }, [isLoaded]);

  return {
    isLoaded,
    error,
    viewport,
    setViewport,
    flyTo,
    fitBounds,
    getMap,
    resize,
  };
}

export default useMapInstance;
