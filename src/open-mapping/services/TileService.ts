/**
 * TileService - Manages map tile sources and caching
 *
 * Features:
 * - Multiple tile providers (OSM, Mapbox, custom)
 * - Offline tile caching via Service Worker
 * - Vector tile support
 * - Custom style management
 */

import type { TileServiceConfig, BoundingBox } from '../types';

export interface TileSource {
  id: string;
  name: string;
  type: 'raster' | 'vector';
  url: string;
  attribution: string;
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
}

export const DEFAULT_TILE_SOURCES: TileSource[] = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    type: 'raster',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'osm-humanitarian',
    name: 'Humanitarian',
    type: 'raster',
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, Tiles: HOT',
    maxZoom: 19,
  },
  {
    id: 'carto-light',
    name: 'Carto Light',
    type: 'raster',
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    maxZoom: 19,
  },
  {
    id: 'carto-dark',
    name: 'Carto Dark',
    type: 'raster',
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    maxZoom: 19,
  },
  {
    id: 'stamen-terrain',
    name: 'Terrain',
    type: 'raster',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
    maxZoom: 18,
  },
  {
    id: 'cycling',
    name: 'Cycling Routes',
    type: 'raster',
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    attribution: '<a href="https://waymarkedtrails.org">Waymarked Trails</a>',
    maxZoom: 18,
  },
  {
    id: 'hiking',
    name: 'Hiking Trails',
    type: 'raster',
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    attribution: '<a href="https://waymarkedtrails.org">Waymarked Trails</a>',
    maxZoom: 18,
  },
];

export class TileService {
  private config: TileServiceConfig;
  private cache: Cache | null = null;
  private cacheName = 'open-mapping-tiles-v1';

  constructor(config: TileServiceConfig) {
    this.config = config;
    this.initCache();
  }

  private async initCache(): Promise<void> {
    if ('caches' in window) {
      try {
        this.cache = await caches.open(this.cacheName);
      } catch (error) {
        console.warn('TileService: Cache API not available', error);
      }
    }
  }

  /**
   * Get all available tile sources
   */
  getSources(): TileSource[] {
    return DEFAULT_TILE_SOURCES;
  }

  /**
   * Get a specific tile source by ID
   */
  getSource(id: string): TileSource | undefined {
    return DEFAULT_TILE_SOURCES.find((s) => s.id === id);
  }

  /**
   * Generate tile URL for a specific coordinate
   */
  getTileUrl(source: TileSource, z: number, x: number, y: number): string {
    return source.url
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
  }

  /**
   * Pre-cache tiles for offline use
   */
  async cacheTilesForArea(
    sourceId: string,
    bounds: BoundingBox,
    minZoom: number,
    maxZoom: number,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const source = this.getSource(sourceId);
    if (!source || !this.cache) {
      throw new Error('Cannot cache tiles: source not found or cache unavailable');
    }

    const tiles = this.getTilesInBounds(bounds, minZoom, maxZoom);
    const total = tiles.length;
    let completed = 0;

    for (const { z, x, y } of tiles) {
      const url = this.getTileUrl(source, z, x, y);
      try {
        const response = await fetch(url);
        if (response.ok) {
          await this.cache.put(url, response);
        }
      } catch (error) {
        console.warn(`Failed to cache tile ${z}/${x}/${y}:`, error);
      }
      completed++;
      onProgress?.(completed / total);
    }
  }

  /**
   * Clear cached tiles
   */
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      await caches.delete(this.cacheName);
      this.cache = await caches.open(this.cacheName);
    }
  }

  /**
   * Get cache size estimate
   */
  async getCacheSize(): Promise<number> {
    if (!this.cache) return 0;

    const keys = await this.cache.keys();
    let totalSize = 0;

    for (const request of keys) {
      const response = await this.cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }

    return totalSize;
  }

  /**
   * Calculate tiles within a bounding box
   */
  private getTilesInBounds(
    bounds: BoundingBox,
    minZoom: number,
    maxZoom: number
  ): Array<{ z: number; x: number; y: number }> {
    const tiles: Array<{ z: number; x: number; y: number }> = [];

    for (let z = minZoom; z <= maxZoom; z++) {
      const minTile = this.latLngToTile(bounds.south, bounds.west, z);
      const maxTile = this.latLngToTile(bounds.north, bounds.east, z);

      for (let x = minTile.x; x <= maxTile.x; x++) {
        for (let y = maxTile.y; y <= minTile.y; y++) {
          tiles.push({ z, x, y });
        }
      }
    }

    return tiles;
  }

  /**
   * Convert lat/lng to tile coordinates
   */
  private latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
    );
    return { x, y };
  }
}

export default TileService;
