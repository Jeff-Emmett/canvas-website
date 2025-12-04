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
import type { MapViewport, Coordinate, TileServiceConfig } from '../types';

interface UseMapInstanceOptions {
  container: HTMLElement | null;
  config: TileServiceConfig;
  initialViewport?: MapViewport;
  onViewportChange?: (viewport: MapViewport) => void;
  onClick?: (coordinate: Coordinate) => void;
}

interface UseMapInstanceReturn {
  isLoaded: boolean;
  viewport: MapViewport;
  setViewport: (viewport: MapViewport) => void;
  flyTo: (coordinate: Coordinate, zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
  getMap: () => unknown; // MapLibre map instance
}

const DEFAULT_VIEWPORT: MapViewport = {
  center: { lat: 0, lng: 0 },
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

export function useMapInstance({
  container,
  config,
  initialViewport = DEFAULT_VIEWPORT,
  onViewportChange,
  onClick,
}: UseMapInstanceOptions): UseMapInstanceReturn {
  const mapRef = useRef<unknown>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewport, setViewportState] = useState<MapViewport>(initialViewport);

  // Initialize map
  useEffect(() => {
    if (!container) return;

    // TODO: Initialize MapLibre GL JS
    // const map = new maplibregl.Map({
    //   container,
    //   style: config.styleUrl,
    //   center: [initialViewport.center.lng, initialViewport.center.lat],
    //   zoom: initialViewport.zoom,
    //   bearing: initialViewport.bearing,
    //   pitch: initialViewport.pitch,
    // });

    console.log('useMapInstance: Would initialize map with config', config);
    setIsLoaded(true);

    return () => {
      // map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [container]);

  const setViewport = useCallback((newViewport: MapViewport) => {
    setViewportState(newViewport);
    onViewportChange?.(newViewport);
    // TODO: Update map instance
  }, [onViewportChange]);

  const flyTo = useCallback((coordinate: Coordinate, zoom?: number) => {
    // TODO: Implement flyTo animation
    console.log('useMapInstance: flyTo', coordinate, zoom);
  }, []);

  const fitBounds = useCallback((bounds: [[number, number], [number, number]]) => {
    // TODO: Implement fitBounds
    console.log('useMapInstance: fitBounds', bounds);
  }, []);

  const getMap = useCallback(() => mapRef.current, []);

  return {
    isLoaded,
    viewport,
    setViewport,
    flyTo,
    fitBounds,
    getMap,
  };
}

export default useMapInstance;
