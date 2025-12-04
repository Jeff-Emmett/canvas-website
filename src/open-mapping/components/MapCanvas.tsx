/**
 * MapCanvas - Main map component integrating with tldraw canvas
 */

import { useEffect, useRef, useState } from 'react';
import type { MapViewport, MapLayer, Coordinate } from '../types';

interface MapCanvasProps {
  viewport: MapViewport;
  layers: MapLayer[];
  onViewportChange?: (viewport: MapViewport) => void;
  onMapClick?: (coordinate: Coordinate) => void;
  onMapLoad?: () => void;
  style?: string;
  interactive?: boolean;
}

export function MapCanvas({
  viewport,
  layers,
  onViewportChange,
  onMapClick,
  onMapLoad,
  style = 'https://demotiles.maplibre.org/style.json',
  interactive = true,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // TODO: Initialize MapLibre GL JS instance (Phase 1)
    console.log('MapCanvas: Initializing with viewport', viewport);
    return () => { /* Cleanup */ };
  }, []);

  return (
    <div
      ref={containerRef}
      className="open-mapping-canvas"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {!isLoaded && <div className="open-mapping-loading">Loading map...</div>}
    </div>
  );
}

export default MapCanvas;
