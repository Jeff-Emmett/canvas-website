/**
 * Lens Coordinate Transforms
 *
 * Transform functions for projecting data through different lenses.
 * Each lens type has its own transformation logic.
 */

import type {
  DataPoint,
  TransformedPoint,
  LensConfig,
  LensState,
  GeographicLensConfig,
  TemporalLensConfig,
  AttentionLensConfig,
  IncentiveLensConfig,
  RelationalLensConfig,
  PossibilityLensConfig,
  LensTransformFn,
} from './types';

// =============================================================================
// Geographic Transform
// =============================================================================

/**
 * Transform a point using the geographic lens
 * Projects lat/lng to Web Mercator canvas coordinates
 */
export function transformGeographic(
  point: DataPoint,
  config: GeographicLensConfig,
  viewport: LensState['viewport']
): TransformedPoint {
  if (!point.geo) {
    return createInvisiblePoint(point.id);
  }

  // Web Mercator projection
  const { lat, lng } = point.geo;
  const { center, zoom } = config;

  // Convert to tile coordinates
  const tileSize = 256;
  const scale = Math.pow(2, zoom);

  // Center in tile space
  const centerX = ((center.lng + 180) / 360) * scale * tileSize;
  const centerY =
    ((1 -
      Math.log(
        Math.tan((center.lat * Math.PI) / 180) +
          1 / Math.cos((center.lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
    scale *
    tileSize;

  // Point in tile space
  const pointX = ((lng + 180) / 360) * scale * tileSize;
  const pointY =
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
    scale *
    tileSize;

  // Offset from center
  const offsetX = pointX - centerX;
  const offsetY = pointY - centerY;

  // Apply rotation (bearing)
  const bearingRad = (config.bearing * Math.PI) / 180;
  const rotatedX = offsetX * Math.cos(bearingRad) - offsetY * Math.sin(bearingRad);
  const rotatedY = offsetX * Math.sin(bearingRad) + offsetY * Math.cos(bearingRad);

  // Convert to canvas coordinates
  const x = viewport.centerX + rotatedX * viewport.scale;
  const y = viewport.centerY + rotatedY * viewport.scale;

  // Check if in viewport
  const padding = 50;
  const visible =
    x >= -padding &&
    x <= viewport.width + padding &&
    y >= -padding &&
    y <= viewport.height + padding;

  return {
    id: point.id,
    x,
    y,
    size: 0.5,
    opacity: 1,
    visible,
  };
}

// =============================================================================
// Temporal Transform
// =============================================================================

/**
 * Transform a point using the temporal lens
 * X-axis = time, Y-axis = grouped by type/owner
 */
export function transformTemporal(
  point: DataPoint,
  config: TemporalLensConfig,
  viewport: LensState['viewport']
): TransformedPoint {
  if (!point.timestamp) {
    return createInvisiblePoint(point.id);
  }

  const { timeRange, timeScale, groupBy } = config;

  // Check if in time range
  if (point.timestamp < timeRange.start || point.timestamp > timeRange.end) {
    return createInvisiblePoint(point.id);
  }

  // X position based on time
  const timeOffset = point.timestamp - timeRange.start;
  const x = viewport.centerX - viewport.width / 2 + timeOffset * timeScale;

  // Y position based on grouping
  let y = viewport.height / 2;

  if (groupBy !== 'none') {
    // Hash the group key to a vertical position
    const groupKey = getGroupKey(point, groupBy);
    const hash = simpleHash(groupKey);
    const lanes = 10;
    const lane = hash % lanes;
    const laneHeight = viewport.height / lanes;
    y = lane * laneHeight + laneHeight / 2;
  }

  // Size based on recency to current time
  const distanceFromCurrent = Math.abs(point.timestamp - config.currentTime);
  const maxDistance = timeRange.end - timeRange.start;
  const recencyFactor = 1 - distanceFromCurrent / maxDistance;
  const size = 0.3 + recencyFactor * 0.7;

  // Opacity based on distance from current time
  const opacity = 0.3 + recencyFactor * 0.7;

  const visible = x >= 0 && x <= viewport.width;

  return {
    id: point.id,
    x,
    y,
    size,
    opacity,
    visible,
  };
}

function getGroupKey(point: DataPoint, groupBy: string): string {
  switch (groupBy) {
    case 'type':
      return String(point.attributes.type ?? 'unknown');
    case 'owner':
      return String(point.attributes.owner ?? 'unknown');
    case 'location':
      if (point.geo) {
        // Rough location bucket
        return `${Math.floor(point.geo.lat)},${Math.floor(point.geo.lng)}`;
      }
      return 'no-location';
    default:
      return 'default';
  }
}

// =============================================================================
// Attention Transform
// =============================================================================

/**
 * Transform a point using the attention lens
 * Position preserved, size/opacity based on attention
 */
export function transformAttention(
  point: DataPoint,
  config: AttentionLensConfig,
  viewport: LensState['viewport']
): TransformedPoint {
  // Need either geo or a canvas position
  if (!point.geo && !point.attributes.canvasPosition) {
    return createInvisiblePoint(point.id);
  }

  // Get base position (from geographic projection if geo exists)
  let x: number, y: number;

  if (point.geo) {
    // Simple equirectangular for attention lens
    const { lat, lng } = point.geo;
    x = viewport.centerX + (lng / 180) * (viewport.width / 2);
    y = viewport.centerY - (lat / 90) * (viewport.height / 2);
  } else {
    const pos = point.attributes.canvasPosition as { x: number; y: number };
    x = pos.x;
    y = pos.y;
  }

  // Calculate decayed attention
  const baseAttention = point.attention ?? 0;
  const lastUpdate = (point.attributes.lastUpdate as number) ?? Date.now();
  const age = Date.now() - lastUpdate;
  const decayFactor = Math.exp(-age / config.decayRate);
  const currentAttention = baseAttention * decayFactor;

  // Filter by minimum attention
  if (currentAttention < config.minAttention) {
    return createInvisiblePoint(point.id);
  }

  // Size based on attention (0.2 - 1.0)
  const size = 0.2 + currentAttention * 0.8;

  // Opacity based on attention
  const opacity = 0.3 + currentAttention * 0.7;

  // Color based on attention level
  const color = getAttentionColor(currentAttention, config.colorGradient);

  return {
    id: point.id,
    x,
    y,
    size,
    opacity,
    color,
    visible: true,
  };
}

function getAttentionColor(
  attention: number,
  gradient: { low: string; medium: string; high: string }
): string {
  if (attention < 0.33) {
    return interpolateColor(gradient.low, gradient.medium, attention * 3);
  } else if (attention < 0.67) {
    return interpolateColor(gradient.medium, gradient.high, (attention - 0.33) * 3);
  } else {
    return gradient.high;
  }
}

// =============================================================================
// Incentive Transform
// =============================================================================

/**
 * Transform a point using the incentive lens
 * Position based on value gradients
 */
export function transformIncentive(
  point: DataPoint,
  config: IncentiveLensConfig,
  viewport: LensState['viewport']
): TransformedPoint {
  if (!point.geo && !point.attributes.canvasPosition) {
    return createInvisiblePoint(point.id);
  }

  // Base position
  let x: number, y: number;

  if (point.geo) {
    x = viewport.centerX + (point.geo.lng / 180) * (viewport.width / 2);
    y = viewport.centerY - (point.geo.lat / 90) * (viewport.height / 2);
  } else {
    const pos = point.attributes.canvasPosition as { x: number; y: number };
    x = pos.x;
    y = pos.y;
  }

  // Normalize value
  const value = point.value ?? 0;
  const { min, max } = config.valueRange;
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Size based on absolute value
  const size = 0.3 + normalizedValue * 0.7;

  // Color based on positive/negative
  const isPositive = value >= 0;
  const color = isPositive ? config.positiveColor : config.negativeColor;

  // Opacity based on magnitude
  const opacity = 0.4 + normalizedValue * 0.6;

  return {
    id: point.id,
    x,
    y,
    size,
    opacity,
    color,
    visible: true,
  };
}

// =============================================================================
// Relational Transform
// =============================================================================

/**
 * Transform a point using the relational lens
 * Position based on graph layout algorithm
 */
export function transformRelational(
  point: DataPoint,
  config: RelationalLensConfig,
  viewport: LensState['viewport'],
  allPoints?: DataPoint[],
  layoutCache?: Map<string, { x: number; y: number }>
): TransformedPoint {
  // Use cached layout position if available
  if (layoutCache?.has(point.id)) {
    const pos = layoutCache.get(point.id)!;
    return {
      id: point.id,
      x: pos.x,
      y: pos.y,
      size: 0.5,
      opacity: 1,
      visible: true,
    };
  }

  // Without layout cache, use simple circular layout
  if (!allPoints) {
    // Fallback: random-ish position based on ID
    const hash = simpleHash(point.id);
    const angle = (hash % 360) * (Math.PI / 180);
    const radius = viewport.width * 0.3;

    return {
      id: point.id,
      x: viewport.centerX + Math.cos(angle) * radius,
      y: viewport.centerY + Math.sin(angle) * radius,
      size: 0.5,
      opacity: 1,
      visible: true,
    };
  }

  // Circular layout as default
  const index = allPoints.findIndex((p) => p.id === point.id);
  const total = allPoints.length;
  const angle = (index / total) * Math.PI * 2;
  const radius = Math.min(viewport.width, viewport.height) * 0.35;

  return {
    id: point.id,
    x: viewport.centerX + Math.cos(angle) * radius,
    y: viewport.centerY + Math.sin(angle) * radius,
    size: 0.5,
    opacity: 1,
    visible: true,
  };
}

/**
 * Run force-directed layout simulation
 * Returns a map of point IDs to positions
 */
export function computeForceDirectedLayout(
  points: DataPoint[],
  config: RelationalLensConfig,
  viewport: LensState['viewport'],
  iterations: number = 100
): Map<string, { x: number; y: number }> {
  // Initialize positions
  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();

  for (let i = 0; i < points.length; i++) {
    const angle = (i / points.length) * Math.PI * 2;
    const radius = Math.min(viewport.width, viewport.height) * 0.3;
    positions.set(points[i].id, {
      x: viewport.centerX + Math.cos(angle) * radius,
      y: viewport.centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  }

  // Build adjacency
  const edges: Array<{ source: string; target: string }> = [];
  for (const point of points) {
    for (const relatedId of point.relations ?? []) {
      if (positions.has(relatedId)) {
        edges.push({ source: point.id, target: relatedId });
      }
    }
  }

  // Simulation
  const { repulsionForce, attractionForce } = config;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsion between all nodes
    for (const [id1, pos1] of positions) {
      for (const [id2, pos2] of positions) {
        if (id1 >= id2) continue;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (repulsionForce * cooling) / (dist * dist);

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        pos1.vx -= fx;
        pos1.vy -= fy;
        pos2.vx += fx;
        pos2.vy += fy;
      }
    }

    // Attraction along edges
    for (const { source, target } of edges) {
      const pos1 = positions.get(source);
      const pos2 = positions.get(target);
      if (!pos1 || !pos2) continue;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attractionForce * cooling;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      pos1.vx += fx;
      pos1.vy += fy;
      pos2.vx -= fx;
      pos2.vy -= fy;
    }

    // Center gravity
    for (const pos of positions.values()) {
      const dx = viewport.centerX - pos.x;
      const dy = viewport.centerY - pos.y;
      pos.vx += dx * 0.01 * cooling;
      pos.vy += dy * 0.01 * cooling;
    }

    // Apply velocities
    for (const pos of positions.values()) {
      pos.x += pos.vx;
      pos.y += pos.vy;
      pos.vx *= 0.8; // Damping
      pos.vy *= 0.8;

      // Keep in bounds
      const margin = 50;
      pos.x = Math.max(margin, Math.min(viewport.width - margin, pos.x));
      pos.y = Math.max(margin, Math.min(viewport.height - margin, pos.y));
    }
  }

  // Return just positions
  const result = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of positions) {
    result.set(id, { x: pos.x, y: pos.y });
  }
  return result;
}

// =============================================================================
// Possibility Transform
// =============================================================================

/**
 * Transform a point using the possibility lens
 * Shows branching timelines and alternate scenarios
 */
export function transformPossibility(
  point: DataPoint,
  config: PossibilityLensConfig,
  viewport: LensState['viewport']
): TransformedPoint {
  if (!point.timestamp) {
    return createInvisiblePoint(point.id);
  }

  const { branchPoint, activeScenario, scenarios, probabilityFade } = config;

  // Get scenario for this point
  const scenarioId = (point.attributes.scenario as string) ?? 'current';
  const scenario = scenarios.find((s) => s.id === scenarioId);

  if (!scenario) {
    return createInvisiblePoint(point.id);
  }

  // X position based on time (relative to branch point)
  const timeOffset = point.timestamp - branchPoint;
  const x = viewport.centerX + timeOffset * 0.001; // Scale factor

  // Y position based on scenario
  const scenarioIndex = scenarios.findIndex((s) => s.id === scenarioId);
  const totalScenarios = scenarios.length;
  const ySpread = viewport.height * 0.6;
  const y = viewport.centerY + (scenarioIndex - totalScenarios / 2) * (ySpread / totalScenarios);

  // Opacity based on probability and whether active
  let opacity = scenario.probability ?? 0.5;
  if (scenarioId !== activeScenario) {
    opacity *= probabilityFade;
  }

  // Size based on probability
  const size = 0.3 + (scenario.probability ?? 0.5) * 0.5;

  return {
    id: point.id,
    x,
    y,
    size,
    opacity,
    visible: opacity > 0.1,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

function createInvisiblePoint(id: string): TransformedPoint {
  return {
    id,
    x: 0,
    y: 0,
    size: 0,
    opacity: 0,
    visible: false,
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// =============================================================================
// Transform Registry
// =============================================================================

/**
 * Get transform function for a lens type
 */
export function getTransformForLens(lensType: string): LensTransformFn {
  switch (lensType) {
    case 'geographic':
      return transformGeographic as LensTransformFn;
    case 'temporal':
      return transformTemporal as LensTransformFn;
    case 'attention':
      return transformAttention as LensTransformFn;
    case 'incentive':
      return transformIncentive as LensTransformFn;
    case 'relational':
      return transformRelational as LensTransformFn;
    case 'possibility':
      return transformPossibility as LensTransformFn;
    default:
      // Default to geographic
      return transformGeographic as LensTransformFn;
  }
}

/**
 * Transform a point through a lens
 */
export function transformPoint(
  point: DataPoint,
  config: LensConfig,
  viewport: LensState['viewport']
): TransformedPoint {
  const transform = getTransformForLens(config.type);
  return transform(point, config, viewport);
}
