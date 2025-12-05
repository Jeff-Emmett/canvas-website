/**
 * Geo-Canvas Coordinate Transformation Utilities
 *
 * Provides bidirectional transformation between geographic coordinates (lat/lng)
 * and canvas coordinates (x/y pixels). Supports multiple projection methods.
 *
 * Key concepts:
 * - Geographic coords: lat/lng (WGS84)
 * - Canvas coords: x/y pixels in tldraw infinite canvas space
 * - Tile coords: z/x/y for OSM-style tile addressing
 * - Web Mercator: The projection used by web maps (EPSG:3857)
 */

import type { Coordinate, BoundingBox, MapViewport } from '../types';

// Earth radius in meters (WGS84)
const EARTH_RADIUS = 6378137;

// Maximum latitude for Web Mercator projection (approximately)
const MAX_LATITUDE = 85.05112878;

/**
 * Geographic coordinate anchor point for canvas-geo mapping.
 * Defines where on the canvas a specific lat/lng maps to.
 */
export interface GeoAnchor {
  geo: Coordinate;
  canvas: { x: number; y: number };
  zoom: number; // Map zoom level (affects scale)
}

/**
 * Configuration for geo-canvas transformation
 */
export interface GeoTransformConfig {
  anchor: GeoAnchor;
  tileSize?: number; // Default 256
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Clamp latitude to valid Web Mercator range
 */
export function clampLatitude(lat: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
}

/**
 * Convert lat/lng to Web Mercator projected coordinates (meters)
 */
export function geoToMercator(coord: Coordinate): { x: number; y: number } {
  const lat = clampLatitude(coord.lat);
  const x = EARTH_RADIUS * toRadians(coord.lng);
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + toRadians(lat) / 2));
  return { x, y };
}

/**
 * Convert Web Mercator coordinates (meters) to lat/lng
 */
export function mercatorToGeo(point: { x: number; y: number }): Coordinate {
  const lng = toDegrees(point.x / EARTH_RADIUS);
  const lat = toDegrees(2 * Math.atan(Math.exp(point.y / EARTH_RADIUS)) - Math.PI / 2);
  return { lat, lng };
}

/**
 * Get the scale factor at a given zoom level
 * At zoom 0, the world is 256px wide (1 tile)
 * At zoom n, the world is 256 * 2^n px wide
 */
export function getScaleAtZoom(zoom: number, tileSize: number = 256): number {
  return tileSize * Math.pow(2, zoom);
}

/**
 * Convert lat/lng to pixel coordinates at a given zoom level
 * Origin (0,0) is at lat=85.05, lng=-180 (top-left of the world)
 */
export function geoToPixel(
  coord: Coordinate,
  zoom: number,
  tileSize: number = 256
): { x: number; y: number } {
  const scale = getScaleAtZoom(zoom, tileSize);
  const lat = clampLatitude(coord.lat);

  // Longitude: linear mapping from -180..180 to 0..scale
  const x = ((coord.lng + 180) / 360) * scale;

  // Latitude: Mercator projection
  const latRad = toRadians(lat);
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

  return { x, y };
}

/**
 * Convert pixel coordinates back to lat/lng
 */
export function pixelToGeo(
  point: { x: number; y: number },
  zoom: number,
  tileSize: number = 256
): Coordinate {
  const scale = getScaleAtZoom(zoom, tileSize);

  // Longitude: linear mapping
  const lng = (point.x / scale) * 360 - 180;

  // Latitude: inverse Mercator
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = toDegrees(Math.atan(Math.sinh(n)));

  return { lat, lng };
}

/**
 * GeoCanvasTransform - Main class for transforming between geo and canvas coordinates
 */
export class GeoCanvasTransform {
  private anchor: GeoAnchor;
  private tileSize: number;

  constructor(config: GeoTransformConfig) {
    this.anchor = config.anchor;
    this.tileSize = config.tileSize ?? 256;
  }

  /**
   * Get the current anchor point
   */
  getAnchor(): GeoAnchor {
    return { ...this.anchor };
  }

  /**
   * Update the anchor point (e.g., when user pans/zooms)
   */
  setAnchor(anchor: GeoAnchor): void {
    this.anchor = anchor;
  }

  /**
   * Update zoom level while keeping the anchor geo-point at the same canvas position
   */
  setZoom(zoom: number): void {
    this.anchor = { ...this.anchor, zoom };
  }

  /**
   * Convert geographic coordinates to canvas coordinates
   */
  geoToCanvas(coord: Coordinate): { x: number; y: number } {
    // Get pixel coords for both the target and anchor at current zoom
    const targetPixel = geoToPixel(coord, this.anchor.zoom, this.tileSize);
    const anchorPixel = geoToPixel(this.anchor.geo, this.anchor.zoom, this.tileSize);

    // Calculate offset from anchor
    const dx = targetPixel.x - anchorPixel.x;
    const dy = targetPixel.y - anchorPixel.y;

    // Apply to canvas anchor position
    return {
      x: this.anchor.canvas.x + dx,
      y: this.anchor.canvas.y + dy,
    };
  }

  /**
   * Convert canvas coordinates to geographic coordinates
   */
  canvasToGeo(point: { x: number; y: number }): Coordinate {
    // Get anchor pixel position
    const anchorPixel = geoToPixel(this.anchor.geo, this.anchor.zoom, this.tileSize);

    // Calculate offset from canvas anchor
    const dx = point.x - this.anchor.canvas.x;
    const dy = point.y - this.anchor.canvas.y;

    // Apply to pixel coords
    const targetPixel = {
      x: anchorPixel.x + dx,
      y: anchorPixel.y + dy,
    };

    return pixelToGeo(targetPixel, this.anchor.zoom, this.tileSize);
  }

  /**
   * Get the geographic bounds visible in a canvas viewport
   */
  canvasBoundsToGeo(bounds: { x: number; y: number; w: number; h: number }): BoundingBox {
    const topLeft = this.canvasToGeo({ x: bounds.x, y: bounds.y });
    const bottomRight = this.canvasToGeo({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });

    return {
      north: topLeft.lat,
      south: bottomRight.lat,
      east: bottomRight.lng,
      west: topLeft.lng,
    };
  }

  /**
   * Get canvas bounds for a geographic bounding box
   */
  geoBoundsToCanvas(bounds: BoundingBox): { x: number; y: number; w: number; h: number } {
    const topLeft = this.geoToCanvas({ lat: bounds.north, lng: bounds.west });
    const bottomRight = this.geoToCanvas({ lat: bounds.south, lng: bounds.east });

    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y,
    };
  }

  /**
   * Get meters per pixel at the current zoom level at a given latitude
   */
  getMetersPerPixel(lat: number = 0): number {
    const circumference = 2 * Math.PI * EARTH_RADIUS * Math.cos(toRadians(lat));
    const scale = getScaleAtZoom(this.anchor.zoom, this.tileSize);
    return circumference / scale;
  }

  /**
   * Calculate distance between two canvas points in meters
   */
  canvasDistanceToMeters(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const geo1 = this.canvasToGeo(p1);
    const geo2 = this.canvasToGeo(p2);
    return haversineDistance(geo1, geo2);
  }
}

/**
 * Haversine distance between two geographic coordinates (meters)
 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Get tile coordinates for a given lat/lng and zoom
 */
export function geoToTile(coord: Coordinate, zoom: number): { x: number; y: number; z: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((coord.lng + 180) / 360) * n);
  const latRad = toRadians(clampLatitude(coord.lat));
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

/**
 * Get the center lat/lng of a tile
 */
export function tileCenterToGeo(x: number, y: number, z: number): Coordinate {
  const n = Math.pow(2, z);
  const lng = ((x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  return { lat: toDegrees(latRad), lng };
}

/**
 * Get the bounding box of a tile
 */
export function tileBounds(x: number, y: number, z: number): BoundingBox {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = toDegrees(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))));
  const south = toDegrees(Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))));
  return { north, south, east, west };
}

/**
 * Create a default GeoCanvasTransform centered at a location
 */
export function createDefaultTransform(
  center: Coordinate = { lat: 0, lng: 0 },
  canvasCenter: { x: number; y: number } = { x: 0, y: 0 },
  zoom: number = 10
): GeoCanvasTransform {
  return new GeoCanvasTransform({
    anchor: {
      geo: center,
      canvas: canvasCenter,
      zoom,
    },
  });
}
