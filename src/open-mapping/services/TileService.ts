/**
 * TileService - Map tile management and caching
 */

import type { TileServiceConfig, BoundingBox } from '../types';

export interface TileSource {
  id: string; name: string; type: 'raster' | 'vector'; url: string; attribution: string; maxZoom?: number;
}

export const DEFAULT_TILE_SOURCES: TileSource[] = [
  { id: 'osm-standard', name: 'OpenStreetMap', type: 'raster', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
  { id: 'osm-humanitarian', name: 'Humanitarian', type: 'raster', url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; OSM, HOT', maxZoom: 19 },
  { id: 'carto-light', name: 'Carto Light', type: 'raster', url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', attribution: '&copy; OSM, CARTO', maxZoom: 19 },
  { id: 'carto-dark', name: 'Carto Dark', type: 'raster', url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', attribution: '&copy; OSM, CARTO', maxZoom: 19 },
];

export class TileService {
  private config: TileServiceConfig;
  private cache: Cache | null = null;
  private cacheName = 'open-mapping-tiles-v1';

  constructor(config: TileServiceConfig) {
    this.config = config;
    this.initCache();
  }

  private async initCache() {
    if ('caches' in window) { try { this.cache = await caches.open(this.cacheName); } catch {} }
  }

  getSources(): TileSource[] { return DEFAULT_TILE_SOURCES; }
  getSource(id: string): TileSource | undefined { return DEFAULT_TILE_SOURCES.find((s) => s.id === id); }
  getTileUrl(source: TileSource, z: number, x: number, y: number): string {
    return source.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  }

  async cacheTilesForArea(sourceId: string, bounds: BoundingBox, minZoom: number, maxZoom: number, onProgress?: (p: number) => void) {
    const source = this.getSource(sourceId);
    if (!source || !this.cache) throw new Error('Cannot cache');
    const tiles = this.getTilesInBounds(bounds, minZoom, maxZoom);
    let done = 0;
    for (const { z, x, y } of tiles) {
      try { const res = await fetch(this.getTileUrl(source, z, x, y)); if (res.ok) await this.cache.put(this.getTileUrl(source, z, x, y), res); } catch {}
      onProgress?.(++done / tiles.length);
    }
  }

  async clearCache() { if ('caches' in window) { await caches.delete(this.cacheName); this.cache = await caches.open(this.cacheName); } }

  private getTilesInBounds(bounds: BoundingBox, minZoom: number, maxZoom: number) {
    const tiles: Array<{ z: number; x: number; y: number }> = [];
    for (let z = minZoom; z <= maxZoom; z++) {
      const min = this.latLngToTile(bounds.south, bounds.west, z);
      const max = this.latLngToTile(bounds.north, bounds.east, z);
      for (let x = min.x; x <= max.x; x++) for (let y = max.y; y <= min.y; y++) tiles.push({ z, x, y });
    }
    return tiles;
  }

  private latLngToTile(lat: number, lng: number, z: number) {
    const n = Math.pow(2, z);
    return { x: Math.floor(((lng + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n) };
  }
}

export default TileService;
