/**
 * MapCanvas - Main map component that integrates with tldraw canvas
 *
 * Renders a MapLibre GL JS map as a layer within the tldraw canvas,
 * enabling collaborative route planning with full canvas editing capabilities.
 */

import { useEffect, useRef, useState } from 'react';
import type { MapViewport, MapLayer, Coordinate } from '../types';

interface MapCanvasProps {
  viewport: MapViewport;
  layers: MapLayer[];
  onViewportChange?: (viewport: MapViewport) => void;
  onMapClick?: (coordinate: Coordinate) => void;
  onMapLoad?: () => void;
  style?: string; // MapLibre style URL
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
    // TODO: Initialize MapLibre GL JS instance
    // This will be implemented in Phase 1
    console.log('MapCanvas: Initializing with viewport', viewport);

    return () => {
      // Cleanup map instance
    };
  }, []);

  useEffect(() => {
    // TODO: Update layers when they change
    console.log('MapCanvas: Updating layers', layers);
  }, [layers]);

  useEffect(() => {
    // TODO: Sync viewport changes
    if (isLoaded) {
      console.log('MapCanvas: Viewport changed', viewport);
    }
  }, [viewport, isLoaded]);

  return (
    <div
      ref={containerRef}
      className="open-mapping-canvas"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {!isLoaded && (
        <div className="open-mapping-loading">
          Loading map...
        </div>
      )}
    </div>
  );
}

export default MapCanvas;
