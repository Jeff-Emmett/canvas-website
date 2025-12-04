/**
 * useMapInstance - Hook for managing MapLibre GL JS instance
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

const DEFAULT_VIEWPORT: MapViewport = {
  center: { lat: 0, lng: 0 }, zoom: 2, bearing: 0, pitch: 0,
};

export function useMapInstance({
  container, config, initialViewport = DEFAULT_VIEWPORT, onViewportChange,
}: UseMapInstanceOptions) {
  const mapRef = useRef<unknown>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewport, setViewportState] = useState<MapViewport>(initialViewport);

  useEffect(() => {
    if (!container) return;
    // TODO: Initialize MapLibre GL JS (Phase 1)
    setIsLoaded(true);
    return () => { mapRef.current = null; setIsLoaded(false); };
  }, [container]);

  const setViewport = useCallback((newViewport: MapViewport) => {
    setViewportState(newViewport);
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  const flyTo = useCallback((coordinate: Coordinate, zoom?: number) => {
    console.log('flyTo', coordinate, zoom);
  }, []);

  const fitBounds = useCallback((bounds: [[number, number], [number, number]]) => {
    console.log('fitBounds', bounds);
  }, []);

  return { isLoaded, viewport, setViewport, flyTo, fitBounds, getMap: () => mapRef.current };
}

export default useMapInstance;
