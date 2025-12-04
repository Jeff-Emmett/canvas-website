/**
 * useLayers - Hook for managing map layers
 */

import { useState, useCallback } from 'react';
import type { MapLayer } from '../types';

interface UseLayersOptions {
  initialLayers?: MapLayer[];
  onLayerChange?: (layers: MapLayer[]) => void;
}

export type LayerPreset = 'osm-standard' | 'osm-humanitarian' | 'satellite' | 'terrain' | 'cycling' | 'hiking';

const PRESET_LAYERS: Record<LayerPreset, Omit<MapLayer, 'id'>> = {
  'osm-standard': { name: 'OpenStreetMap', type: 'basemap', visible: true, opacity: 1, zIndex: 0, source: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '&copy; OpenStreetMap' } },
  'osm-humanitarian': { name: 'Humanitarian', type: 'basemap', visible: false, opacity: 1, zIndex: 0, source: { type: 'raster', tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'], attribution: '&copy; OSM, HOT' } },
  'satellite': { name: 'Satellite', type: 'satellite', visible: false, opacity: 1, zIndex: 0, source: { type: 'raster', tiles: [] } },
  'terrain': { name: 'Terrain', type: 'terrain', visible: false, opacity: 0.5, zIndex: 1, source: { type: 'raster', tiles: ['https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png'], attribution: 'Stamen' } },
  'cycling': { name: 'Cycling Routes', type: 'route', visible: false, opacity: 0.8, zIndex: 2, source: { type: 'raster', tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'], attribution: 'Waymarked Trails' } },
  'hiking': { name: 'Hiking Trails', type: 'route', visible: false, opacity: 0.8, zIndex: 2, source: { type: 'raster', tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'], attribution: 'Waymarked Trails' } },
};

let layerIdCounter = 0;

export function useLayers({ initialLayers = [], onLayerChange }: UseLayersOptions = {}) {
  const [layers, setLayers] = useState<MapLayer[]>(initialLayers);

  const updateAndNotify = useCallback((newLayers: MapLayer[]) => {
    setLayers(newLayers);
    onLayerChange?.(newLayers);
  }, [onLayerChange]);

  const addLayer = useCallback((layer: Omit<MapLayer, 'id'>) => {
    const id = `layer-${++layerIdCounter}-${Date.now()}`;
    updateAndNotify([...layers, { ...layer, id }]);
    return id;
  }, [layers, updateAndNotify]);

  const removeLayer = useCallback((layerId: string) => updateAndNotify(layers.filter((l) => l.id !== layerId)), [layers, updateAndNotify]);
  const updateLayer = useCallback((layerId: string, updates: Partial<MapLayer>) => updateAndNotify(layers.map((l) => l.id === layerId ? { ...l, ...updates } : l)), [layers, updateAndNotify]);
  const toggleVisibility = useCallback((layerId: string) => updateAndNotify(layers.map((l) => l.id === layerId ? { ...l, visible: !l.visible } : l)), [layers, updateAndNotify]);
  const setOpacity = useCallback((layerId: string, opacity: number) => updateAndNotify(layers.map((l) => l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l)), [layers, updateAndNotify]);
  const reorderLayers = useCallback((layerIds: string[]) => {
    const reordered = layerIds.map((id, i) => { const l = layers.find((x) => x.id === id); return l ? { ...l, zIndex: i } : null; }).filter((l): l is MapLayer => !!l);
    updateAndNotify(reordered);
  }, [layers, updateAndNotify]);
  const getLayer = useCallback((layerId: string) => layers.find((l) => l.id === layerId), [layers]);
  const addPresetLayer = useCallback((preset: LayerPreset) => addLayer(PRESET_LAYERS[preset]), [addLayer]);

  return { layers, addLayer, removeLayer, updateLayer, toggleVisibility, setOpacity, reorderLayers, getLayer, addPresetLayer };
}

export default useLayers;
