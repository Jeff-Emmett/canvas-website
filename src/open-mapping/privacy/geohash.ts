/**
 * Geohash encoding/decoding utilities for zkGPS
 *
 * Geohash is a hierarchical spatial encoding that converts lat/lng to a string.
 * Each character adds precision, enabling variable-granularity location sharing.
 *
 * Precision table:
 *   1 char  = ~5000 km (continent)
 *   4 chars = ~39 km (metro)
 *   6 chars = ~1.2 km (neighborhood)
 *   8 chars = ~38 m (building)
 *   10 chars = ~1.2 m (exact)
 */

// Base32 alphabet used by geohash (excludes a, i, l, o to avoid confusion)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BASE32_MAP = new Map(BASE32.split('').map((c, i) => [c, i]));

/**
 * Geohash precision levels with approximate cell sizes
 */
export const GEOHASH_PRECISION = {
  CONTINENT: 1,      // ~5000 km
  LARGE_COUNTRY: 2,  // ~1250 km
  STATE: 3,          // ~156 km
  METRO: 4,          // ~39 km
  DISTRICT: 5,       // ~5 km
  NEIGHBORHOOD: 6,   // ~1.2 km
  BLOCK: 7,          // ~153 m
  BUILDING: 8,       // ~38 m
  ROOM: 9,           // ~5 m
  EXACT: 10,         // ~1.2 m
} as const;

export type GeohashPrecision = typeof GEOHASH_PRECISION[keyof typeof GEOHASH_PRECISION];

/**
 * Approximate cell dimensions at each precision level (meters)
 */
export const PRECISION_CELL_SIZE: Record<number, { lat: number; lng: number }> = {
  1: { lat: 5000000, lng: 5000000 },
  2: { lat: 1250000, lng: 625000 },
  3: { lat: 156000, lng: 156000 },
  4: { lat: 39000, lng: 19500 },
  5: { lat: 4900, lng: 4900 },
  6: { lat: 1200, lng: 610 },
  7: { lat: 153, lng: 153 },
  8: { lat: 38, lng: 19 },
  9: { lat: 4.8, lng: 4.8 },
  10: { lat: 1.2, lng: 0.6 },
  11: { lat: 0.15, lng: 0.15 },
  12: { lat: 0.037, lng: 0.019 },
};

/**
 * Bounding box for a geohash cell
 */
export interface GeohashBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Encode latitude/longitude to geohash string
 *
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @param precision Number of characters (1-12)
 * @returns Geohash string
 */
export function encode(lat: number, lng: number, precision: number = 9): string {
  if (precision < 1 || precision > 12) {
    throw new Error('Precision must be between 1 and 12');
  }
  if (lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (lng < -180 || lng > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true; // Alternate between lng and lat

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode geohash string to latitude/longitude (center of cell)
 *
 * @param hash Geohash string
 * @returns { lat, lng } center point
 */
export function decode(hash: string): { lat: number; lng: number } {
  const bounds = decodeBounds(hash);
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

/**
 * Decode geohash string to bounding box
 *
 * @param hash Geohash string
 * @returns Bounding box of the cell
 */
export function decodeBounds(hash: string): GeohashBounds {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let isLng = true;

  for (const c of hash.toLowerCase()) {
    const bits = BASE32_MAP.get(c);
    if (bits === undefined) {
      throw new Error(`Invalid geohash character: ${c}`);
    }

    for (let i = 4; i >= 0; i--) {
      const bit = (bits >> i) & 1;
      if (isLng) {
        const mid = (minLng + maxLng) / 2;
        if (bit) {
          minLng = mid;
        } else {
          maxLng = mid;
        }
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bit) {
          minLat = mid;
        } else {
          maxLat = mid;
        }
      }
      isLng = !isLng;
    }
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Get all 8 neighboring geohash cells
 *
 * @param hash Geohash string
 * @returns Array of 8 neighboring geohash strings
 */
export function neighbors(hash: string): string[] {
  const { lat, lng } = decode(hash);
  const bounds = decodeBounds(hash);
  const latDelta = bounds.maxLat - bounds.minLat;
  const lngDelta = bounds.maxLng - bounds.minLng;
  const precision = hash.length;

  const directions = [
    { dLat: latDelta, dLng: 0 },         // N
    { dLat: latDelta, dLng: lngDelta },  // NE
    { dLat: 0, dLng: lngDelta },         // E
    { dLat: -latDelta, dLng: lngDelta }, // SE
    { dLat: -latDelta, dLng: 0 },        // S
    { dLat: -latDelta, dLng: -lngDelta }, // SW
    { dLat: 0, dLng: -lngDelta },        // W
    { dLat: latDelta, dLng: -lngDelta }, // NW
  ];

  return directions.map(({ dLat, dLng }) => {
    let newLat = lat + dLat;
    let newLng = lng + dLng;

    // Wrap longitude
    if (newLng > 180) newLng -= 360;
    if (newLng < -180) newLng += 360;

    // Clamp latitude (can't wrap)
    newLat = Math.max(-90, Math.min(90, newLat));

    return encode(newLat, newLng, precision);
  });
}

/**
 * Check if a point is inside a geohash cell
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param hash Geohash string
 * @returns true if point is inside the cell
 */
export function contains(lat: number, lng: number, hash: string): boolean {
  const bounds = decodeBounds(hash);
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

/**
 * Get all geohash cells that intersect a circle
 *
 * @param centerLat Center latitude
 * @param centerLng Center longitude
 * @param radiusMeters Radius in meters
 * @param precision Geohash precision
 * @returns Array of geohash strings that intersect the circle
 */
export function cellsInRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  precision: number
): string[] {
  const cells = new Set<string>();
  const centerHash = encode(centerLat, centerLng, precision);
  cells.add(centerHash);

  // BFS to find all intersecting cells
  const queue = [centerHash];
  const visited = new Set<string>([centerHash]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighborList = neighbors(current);

    for (const neighbor of neighborList) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      // Check if this cell intersects the circle
      if (cellIntersectsCircle(neighbor, centerLat, centerLng, radiusMeters)) {
        cells.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return Array.from(cells);
}

/**
 * Check if a geohash cell intersects a circle
 */
function cellIntersectsCircle(
  hash: string,
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): boolean {
  const bounds = decodeBounds(hash);

  // Find closest point on cell to circle center
  const closestLat = Math.max(bounds.minLat, Math.min(bounds.maxLat, centerLat));
  const closestLng = Math.max(bounds.minLng, Math.min(bounds.maxLng, centerLng));

  // Calculate distance to closest point
  const distance = haversineDistance(
    centerLat,
    centerLng,
    closestLat,
    closestLng
  );

  return distance <= radiusMeters;
}

/**
 * Haversine distance between two points (meters)
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Get geohash cells that cover a polygon (approximation)
 *
 * @param polygon Array of [lat, lng] points forming a closed polygon
 * @param precision Geohash precision
 * @returns Array of geohash strings that intersect the polygon
 */
export function cellsInPolygon(
  polygon: [number, number][],
  precision: number
): string[] {
  // Find bounding box of polygon
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const [lat, lng] of polygon) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  // Get cell size at this precision
  const cellSize = PRECISION_CELL_SIZE[precision] || PRECISION_CELL_SIZE[12];
  const latStep = cellSize.lat / 111000; // meters to degrees (rough)
  const lngStep = cellSize.lng / (111000 * Math.cos(toRad((minLat + maxLat) / 2)));

  const cells = new Set<string>();

  // Sample points in bounding box
  for (let lat = minLat; lat <= maxLat; lat += latStep * 0.5) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep * 0.5) {
      if (pointInPolygon(lat, lng, polygon)) {
        cells.add(encode(lat, lng, precision));
      }
    }
  }

  return Array.from(cells);
}

/**
 * Ray casting algorithm for point-in-polygon test
 */
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Truncate geohash to lower precision (reveal less location info)
 *
 * @param hash Full geohash
 * @param precision Target precision (must be <= current length)
 * @returns Truncated geohash
 */
export function truncate(hash: string, precision: number): string {
  if (precision >= hash.length) return hash;
  if (precision < 1) return '';
  return hash.slice(0, precision);
}

/**
 * Check if two geohashes share a common prefix (are in same area)
 *
 * @param hash1 First geohash
 * @param hash2 Second geohash
 * @param minLength Minimum prefix length to match
 * @returns true if they share a prefix of at least minLength
 */
export function sharesPrefix(hash1: string, hash2: string, minLength: number): boolean {
  const prefix1 = truncate(hash1, minLength);
  const prefix2 = truncate(hash2, minLength);
  return prefix1 === prefix2;
}

/**
 * Estimate appropriate precision for a given radius
 *
 * @param radiusMeters Desired radius in meters
 * @returns Recommended geohash precision
 */
export function precisionForRadius(radiusMeters: number): number {
  for (let p = 12; p >= 1; p--) {
    const cellSize = PRECISION_CELL_SIZE[p];
    if (cellSize && Math.max(cellSize.lat, cellSize.lng) <= radiusMeters * 2) {
      return p;
    }
  }
  return 1;
}
