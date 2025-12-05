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

// Default style using OpenStreetMap tiles via MapLibre
const DEFAULT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

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
        maxZoom: config.maxZoom ?? 19,
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
