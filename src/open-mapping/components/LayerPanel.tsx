/**
 * LayerPanel - UI for managing map layers
 *
 * Features:
 * - Toggle layer visibility
 * - Adjust layer opacity
 * - Reorder layers (z-index)
 * - Add custom layers (GeoJSON, tiles)
 * - Import/export layer configurations
 */

import type { MapLayer } from '../types';

interface LayerPanelProps {
  layers: MapLayer[];
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerOpacity?: (layerId: string, opacity: number) => void;
  onLayerReorder?: (layerIds: string[]) => void;
  onLayerAdd?: (layer: Omit<MapLayer, 'id'>) => void;
  onLayerRemove?: (layerId: string) => void;
  onLayerEdit?: (layerId: string, updates: Partial<MapLayer>) => void;
}

export function LayerPanel({
  layers,
  onLayerToggle,
  onLayerOpacity: _onLayerOpacity,
  onLayerReorder: _onLayerReorder,
  onLayerAdd: _onLayerAdd,
  onLayerRemove: _onLayerRemove,
  onLayerEdit: _onLayerEdit,
}: LayerPanelProps) {
  // TODO: Implement layer panel UI
  // This will be implemented in Phase 2

  return (
    <div className="open-mapping-layer-panel">
      <h3>Layers</h3>
      <ul>
        {layers.map((layer) => (
          <li key={layer.id}>
            <label>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(e) => onLayerToggle?.(layer.id, e.target.checked)}
              />
              {layer.name}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LayerPanel;
