/**
 * LayerPanel - UI for managing map layers
 */

import type { MapLayer } from '../types';

interface LayerPanelProps {
  layers: MapLayer[];
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerOpacity?: (layerId: string, opacity: number) => void;
  onLayerReorder?: (layerIds: string[]) => void;
  onLayerAdd?: (layer: Omit<MapLayer, 'id'>) => void;
  onLayerRemove?: (layerId: string) => void;
}

export function LayerPanel({ layers, onLayerToggle }: LayerPanelProps) {
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
