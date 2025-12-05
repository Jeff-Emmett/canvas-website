/**
 * MapCanvas - Main map component that integrates with tldraw canvas
 *
 * Renders a MapLibre GL JS map with optional location presence layer.
 * Users must OPT-IN to share their location.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapViewport, MapLayer, Coordinate } from '../types';
import type { PresenceView } from '../presence/types';
import { PresenceLayer } from '../presence/PresenceLayer';

// =============================================================================
// Types
// =============================================================================

interface MapCanvasProps {
  /** Initial viewport */
  viewport?: MapViewport;

  /** Map layers to display */
  layers?: MapLayer[];

  /** Callback when viewport changes */
  onViewportChange?: (viewport: MapViewport) => void;

  /** Callback when map is clicked */
  onMapClick?: (coordinate: Coordinate) => void;

  /** Callback when map finishes loading */
  onMapLoad?: (map: maplibregl.Map) => void;

  /** MapLibre style URL or object */
  style?: string | maplibregl.StyleSpecification;

  /** Whether map is interactive */
  interactive?: boolean;

  /** Presence views to display */
  presenceViews?: PresenceView[];

  /** Show presence uncertainty circles */
  showPresenceUncertainty?: boolean;

  /** Callback when presence indicator is clicked */
  onPresenceClick?: (view: PresenceView) => void;

  /** Custom class name */
  className?: string;
}

// =============================================================================
// Default Style (OpenStreetMap tiles)
// =============================================================================

const DEFAULT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

// =============================================================================
// Component
// =============================================================================

export function MapCanvas({
  viewport = { center: [0, 0], zoom: 2 },
  layers = [],
  onViewportChange,
  onMapClick,
  onMapLoad,
  style = DEFAULT_STYLE,
  interactive = true,
  presenceViews = [],
  showPresenceUncertainty = true,
  onPresenceClick,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(viewport.zoom);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: viewport.center as [number, number],
      zoom: viewport.zoom,
      interactive,
      attributionControl: true,
    });

    // Add navigation controls
    if (interactive) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    }

    // Handle map load
    map.on('load', () => {
      setIsLoaded(true);
      onMapLoad?.(map);
    });

    // Handle viewport changes
    map.on('moveend', () => {
      const center = map.getCenter();
      const newViewport: MapViewport = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      setCurrentZoom(newViewport.zoom);
      onViewportChange?.(newViewport);
    });

    // Handle zoom for presence layer
    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });

    // Handle clicks
    map.on('click', (e) => {
      onMapClick?.({
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update viewport externally
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    // Only update if significantly different
    const [lng, lat] = viewport.center;
    if (
      Math.abs(currentCenter.lng - lng) > 0.0001 ||
      Math.abs(currentCenter.lat - lat) > 0.0001 ||
      Math.abs(currentZoom - viewport.zoom) > 0.1
    ) {
      map.flyTo({
        center: viewport.center as [number, number],
        zoom: viewport.zoom,
        bearing: viewport.bearing ?? 0,
        pitch: viewport.pitch ?? 0,
      });
    }
  }, [viewport, isLoaded]);

  // Update layers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    // TODO: Add layer management
    console.log('MapCanvas: Updating layers', layers);
  }, [layers, isLoaded]);

  // Project function for presence layer
  const project = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return { x: 0, y: 0 };
    const point = mapRef.current.project([lng, lat]);
    return { x: point.x, y: point.y };
  }, []);

  // Handle presence click
  const handlePresenceClick = useCallback((indicator: any) => {
    const view = presenceViews.find((v) => v.user.pubKey === indicator.id);
    if (view && onPresenceClick) {
      onPresenceClick(view);
    }
  }, [presenceViews, onPresenceClick]);

  return (
    <div
      ref={containerRef}
      className={`open-mapping-canvas ${className ?? ''}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Loading indicator */}
      {!isLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.1)',
          }}
        >
          Loading map...
        </div>
      )}

      {/* Presence layer overlay */}
      {isLoaded && presenceViews.length > 0 && (
        <PresenceLayer
          views={presenceViews}
          project={project}
          zoom={currentZoom}
          showUncertainty={showPresenceUncertainty}
          showDirection={true}
          showNames={true}
          onIndicatorClick={handlePresenceClick}
        />
      )}
    </div>
  );
}

export default MapCanvas;
