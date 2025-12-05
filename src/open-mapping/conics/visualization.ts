/**
 * Conic Visualization
 *
 * Renders possibility cones, constraint surfaces, and optimization paths
 * on a 2D or 3D canvas. Supports multiple projection modes and
 * visual representations of n-dimensional conic structures.
 */

import type {
  PossibilityCone,
  ConeConstraint,
  ConeIntersection,
  PossibilityPath,
  ConicSection,
  ConicVisualization,
  SpacePoint,
  SpaceVector,
  ProjectionMode,
  PipelineStage,
} from './types';
import { getConicSectionType, sliceConeWithPlane, isPointInCone } from './geometry';

// =============================================================================
// Color Utilities
// =============================================================================

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

/**
 * Interpolate between two colors
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

/**
 * Add alpha to hex color
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// =============================================================================
// Projection Functions
// =============================================================================

/**
 * Project n-dimensional point to 2D/3D display coordinates
 */
export function projectPoint(
  point: SpacePoint,
  displayDimensions: number[],
  projection: ProjectionMode,
  slicePositions: Record<number, number> = {},
  viewParams: ProjectionViewParams = {}
): { x: number; y: number; z?: number; visible: boolean } {
  const coords = point.coordinates;

  // Check if point is within slice tolerance for non-displayed dimensions
  const sliceTolerance = viewParams.sliceTolerance ?? 5;
  for (const [dimStr, slicePos] of Object.entries(slicePositions)) {
    const dim = parseInt(dimStr);
    if (!displayDimensions.includes(dim) && coords[dim] !== undefined) {
      if (Math.abs(coords[dim] - slicePos) > sliceTolerance) {
        return { x: 0, y: 0, visible: false };
      }
    }
  }

  const [dimX, dimY, dimZ] = displayDimensions;
  let x = coords[dimX] ?? 0;
  let y = coords[dimY] ?? 0;
  const z = dimZ !== undefined ? coords[dimZ] ?? 0 : undefined;

  switch (projection) {
    case 'perspective':
      if (z !== undefined) {
        const focalLength = viewParams.focalLength ?? 500;
        const depth = z + focalLength;
        const scale = focalLength / Math.max(depth, 1);
        x *= scale;
        y *= scale;
      }
      break;

    case 'stereographic':
      if (z !== undefined) {
        // Stereographic projection from sphere
        const denom = 1 - z / (viewParams.sphereRadius ?? 100);
        if (denom > 0.01) {
          x /= denom;
          y /= denom;
        }
      }
      break;

    case 'orthographic':
    case 'slice':
    default:
      // Direct mapping
      break;
  }

  // Apply view transform
  const centerX = viewParams.centerX ?? 0;
  const centerY = viewParams.centerY ?? 0;
  const scale = viewParams.scale ?? 1;

  return {
    x: (x - centerX) * scale,
    y: (y - centerY) * scale,
    z: z !== undefined ? z * scale : undefined,
    visible: true,
  };
}

/**
 * View parameters for projection
 */
export interface ProjectionViewParams {
  centerX?: number;
  centerY?: number;
  scale?: number;
  focalLength?: number;
  sphereRadius?: number;
  sliceTolerance?: number;
}

// =============================================================================
// Cone Rendering
// =============================================================================

/**
 * Generate 2D points for cone edge visualization
 */
export function generateConeEdgePoints(
  cone: PossibilityCone,
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {},
  segments: number = 36
): Array<{ x: number; y: number }[]> {
  const edges: Array<{ x: number; y: number }[]> = [];
  const apex = cone.apex;
  const extent = cone.extent ?? 100;

  // Get the 2D plane axes
  const [dimX, dimY] = displayDimensions;
  const axisX = cone.axis.components[dimX] ?? 0;
  const axisY = cone.axis.components[dimY] ?? 0;

  // Calculate perpendicular direction in 2D
  const axisLen = Math.sqrt(axisX * axisX + axisY * axisY);
  if (axisLen < 0.001) {
    // Axis is perpendicular to view plane - show as circle
    const radius = extent * Math.tan(cone.aperture);
    const circlePoints: { x: number; y: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const point: SpacePoint = {
        coordinates: [...apex.coordinates],
      };
      point.coordinates[dimX] = apex.coordinates[dimX] + radius * Math.cos(angle);
      point.coordinates[dimY] = apex.coordinates[dimY] + radius * Math.sin(angle);

      const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
      if (projected.visible) {
        circlePoints.push({ x: projected.x, y: projected.y });
      }
    }
    if (circlePoints.length > 0) edges.push(circlePoints);
    return edges;
  }

  // Normal axis in 2D
  const normX = axisX / axisLen;
  const normY = axisY / axisLen;

  // Perpendicular to axis
  const perpX = -normY;
  const perpY = normX;

  // Calculate edge directions
  const tanAperture = Math.tan(cone.aperture);

  // Two edge lines for the cone
  for (const sign of [-1, 1]) {
    const edgePoints: { x: number; y: number }[] = [];

    // Direction along edge
    const edgeDirX = normX + sign * perpX * tanAperture;
    const edgeDirY = normY + sign * perpY * tanAperture;

    // Normalize
    const edgeLen = Math.sqrt(edgeDirX * edgeDirX + edgeDirY * edgeDirY);

    // Generate points along edge
    const stepCount = 20;
    for (let i = 0; i <= stepCount; i++) {
      const t = (i / stepCount) * extent;
      const point: SpacePoint = {
        coordinates: [...apex.coordinates],
      };

      if (cone.direction === 'forward' || cone.direction === 'bidirectional') {
        point.coordinates[dimX] = apex.coordinates[dimX] + (edgeDirX / edgeLen) * t;
        point.coordinates[dimY] = apex.coordinates[dimY] + (edgeDirY / edgeLen) * t;
      }

      const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
      if (projected.visible) {
        edgePoints.push({ x: projected.x, y: projected.y });
      }
    }

    if (edgePoints.length > 0) edges.push(edgePoints);
  }

  // Backward direction if bidirectional
  if (cone.direction === 'backward' || cone.direction === 'bidirectional') {
    for (const sign of [-1, 1]) {
      const edgePoints: { x: number; y: number }[] = [];

      const edgeDirX = -normX + sign * perpX * tanAperture;
      const edgeDirY = -normY + sign * perpY * tanAperture;
      const edgeLen = Math.sqrt(edgeDirX * edgeDirX + edgeDirY * edgeDirY);

      const stepCount = 20;
      for (let i = 0; i <= stepCount; i++) {
        const t = (i / stepCount) * extent;
        const point: SpacePoint = {
          coordinates: [...apex.coordinates],
        };
        point.coordinates[dimX] = apex.coordinates[dimX] + (edgeDirX / edgeLen) * t;
        point.coordinates[dimY] = apex.coordinates[dimY] + (edgeDirY / edgeLen) * t;

        const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
        if (projected.visible) {
          edgePoints.push({ x: projected.x, y: projected.y });
        }
      }

      if (edgePoints.length > 0) edges.push(edgePoints);
    }
  }

  return edges;
}

/**
 * Generate fill region for cone interior
 */
export function generateConeFillPath(
  cone: PossibilityCone,
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {}
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const edges = generateConeEdgePoints(cone, displayDimensions, projection, viewParams, 36);

  // Start at apex
  const apexProjected = projectPoint(
    cone.apex,
    displayDimensions,
    projection,
    {},
    viewParams
  );
  if (!apexProjected.visible) return [];

  points.push({ x: apexProjected.x, y: apexProjected.y });

  // Add one edge going out
  if (edges[0]) {
    points.push(...edges[0]);
  }

  // Add arc at the end
  const extent = cone.extent ?? 100;
  const radius = extent * Math.tan(cone.aperture);
  const [dimX, dimY] = displayDimensions;

  // Arc points
  const arcSegments = 20;
  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments;
    // Interpolate along the far edge
    const point: SpacePoint = {
      coordinates: [...cone.apex.coordinates],
    };
    // Simplified arc - would need proper calculation for accurate rendering
    point.coordinates[dimX] =
      cone.apex.coordinates[dimX] +
      cone.axis.components[dimX] * extent +
      radius * Math.cos(Math.PI * t - Math.PI / 2);
    point.coordinates[dimY] =
      cone.apex.coordinates[dimY] +
      cone.axis.components[dimY] * extent +
      radius * Math.sin(Math.PI * t - Math.PI / 2);

    const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
    if (projected.visible) {
      points.push({ x: projected.x, y: projected.y });
    }
  }

  // Add other edge going back
  if (edges[1]) {
    points.push(...[...edges[1]].reverse());
  }

  return points;
}

// =============================================================================
// Conic Section Rendering
// =============================================================================

/**
 * Generate points for a conic section curve
 */
export function generateConicSectionPoints(
  section: ConicSection,
  numPoints: number = 100
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const { center, a = 1, b = 1, rotation, p = 1 } = section;

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  switch (section.type) {
    case 'circle':
    case 'ellipse': {
      for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 2;
        const x = a * Math.cos(t);
        const y = b * Math.sin(t);
        // Rotate and translate
        points.push({
          x: center.x + x * cos - y * sin,
          y: center.y + x * sin + y * cos,
        });
      }
      break;
    }

    case 'parabola': {
      const range = 10 * p;
      for (let i = 0; i <= numPoints; i++) {
        const t = ((i / numPoints) * 2 - 1) * range;
        const x = t;
        const y = (t * t) / (4 * p);
        points.push({
          x: center.x + x * cos - y * sin,
          y: center.y + x * sin + y * cos,
        });
      }
      break;
    }

    case 'hyperbola': {
      // Right branch
      for (let i = 0; i <= numPoints / 2; i++) {
        const t = ((i / (numPoints / 2)) * 2 - 1) * 3;
        const x = a / Math.cos(t);
        const y = b * Math.tan(t);
        if (isFinite(x) && isFinite(y)) {
          points.push({
            x: center.x + x * cos - y * sin,
            y: center.y + x * sin + y * cos,
          });
        }
      }
      // Left branch
      for (let i = 0; i <= numPoints / 2; i++) {
        const t = ((i / (numPoints / 2)) * 2 - 1) * 3;
        const x = -a / Math.cos(t);
        const y = b * Math.tan(t);
        if (isFinite(x) && isFinite(y)) {
          points.push({
            x: center.x + x * cos - y * sin,
            y: center.y + x * sin + y * cos,
          });
        }
      }
      break;
    }

    case 'point':
      points.push({ x: center.x, y: center.y });
      break;

    case 'line':
      points.push(
        { x: center.x - 100 * cos, y: center.y - 100 * sin },
        { x: center.x + 100 * cos, y: center.y + 100 * sin }
      );
      break;

    case 'crossed-lines':
      // Two lines through the center
      points.push(
        { x: center.x - 100 * cos, y: center.y - 100 * sin },
        { x: center.x, y: center.y },
        { x: center.x + 100 * cos, y: center.y + 100 * sin }
      );
      break;
  }

  return points;
}

// =============================================================================
// Path Rendering
// =============================================================================

/**
 * Generate visual representation of an optimization path
 */
export function generatePathVisualization(
  path: PossibilityPath,
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {},
  config: ConicVisualization
): PathVisualization {
  const points: { x: number; y: number; value: number }[] = [];
  const gradientArrows: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];

  for (const waypoint of path.waypoints) {
    const projected = projectPoint(
      waypoint.position,
      displayDimensions,
      projection,
      config.slicePositions,
      viewParams
    );

    if (projected.visible) {
      points.push({
        x: projected.x,
        y: projected.y,
        value: waypoint.value,
      });

      // Add gradient arrow if available
      if (config.show.valueGradient && waypoint.valueGradient) {
        const gradientScale = 10;
        const gx = waypoint.valueGradient.components[displayDimensions[0]] ?? 0;
        const gy = waypoint.valueGradient.components[displayDimensions[1]] ?? 0;

        gradientArrows.push({
          from: { x: projected.x, y: projected.y },
          to: {
            x: projected.x + gx * gradientScale,
            y: projected.y + gy * gradientScale,
          },
        });
      }
    }
  }

  // Calculate color for each point based on value
  const minValue = Math.min(...points.map((p) => p.value));
  const maxValue = Math.max(...points.map((p) => p.value));
  const valueRange = maxValue - minValue || 1;

  const coloredPoints = points.map((p) => ({
    ...p,
    color: interpolateColor(
      config.colors.valueLow,
      config.colors.valueHigh,
      (p.value - minValue) / valueRange
    ),
  }));

  return {
    points: coloredPoints,
    gradientArrows,
    totalValue: path.totalValue,
    optimalityScore: path.optimalityScore,
  };
}

/**
 * Path visualization data
 */
export interface PathVisualization {
  points: Array<{ x: number; y: number; value: number; color: string }>;
  gradientArrows: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  totalValue: number;
  optimalityScore: number;
}

// =============================================================================
// Pipeline Visualization
// =============================================================================

/**
 * Generate visualization for pipeline stages
 */
export function generatePipelineVisualization(
  stages: PipelineStage[],
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {},
  config: ConicVisualization
): PipelineVisualization {
  const stageVisuals: StageVisual[] = [];

  for (const stage of stages) {
    const stageVisual: StageVisual = {
      id: stage.id,
      name: stage.name,
      position: stage.position,
      coneEdges: [],
      constraintSurfaces: [],
      volumeFraction: stage.remainingVolumeFraction ?? 1,
    };

    // Visualize resulting cone
    if (stage.resultingCone && config.show.coneEdges) {
      const edges = generateConeEdgePoints(
        stage.resultingCone,
        displayDimensions,
        projection,
        viewParams
      );
      stageVisual.coneEdges = edges;
    }

    // Visualize constraints
    if (config.show.constraintSurfaces) {
      for (const constraint of stage.constraints) {
        const surface = generateConstraintSurfacePoints(
          constraint,
          displayDimensions,
          projection,
          viewParams
        );
        if (surface.length > 0) {
          stageVisual.constraintSurfaces.push({
            constraintId: constraint.id,
            label: constraint.label,
            points: surface,
            hardness: constraint.hardness,
          });
        }
      }
    }

    stageVisuals.push(stageVisual);
  }

  return {
    stages: stageVisuals,
    bottleneckStageIndex: findBottleneckStageIndex(stages),
  };
}

/**
 * Find the stage with smallest remaining volume
 */
function findBottleneckStageIndex(stages: PipelineStage[]): number {
  let minIndex = 0;
  let minVolume = Infinity;

  for (let i = 0; i < stages.length; i++) {
    const vol = stages[i].remainingVolumeFraction ?? 1;
    if (vol < minVolume) {
      minVolume = vol;
      minIndex = i;
    }
  }

  return minIndex;
}

/**
 * Stage visual data
 */
export interface StageVisual {
  id: string;
  name: string;
  position: number;
  coneEdges: Array<{ x: number; y: number }[]>;
  constraintSurfaces: Array<{
    constraintId: string;
    label: string;
    points: { x: number; y: number }[];
    hardness: 'hard' | 'soft';
  }>;
  volumeFraction: number;
}

/**
 * Pipeline visualization data
 */
export interface PipelineVisualization {
  stages: StageVisual[];
  bottleneckStageIndex: number;
}

// =============================================================================
// Constraint Surface Rendering
// =============================================================================

/**
 * Generate points for constraint surface visualization
 */
export function generateConstraintSurfacePoints(
  constraint: ConeConstraint,
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {}
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const [dimX, dimY] = displayDimensions;
  const surface = constraint.surface;

  switch (surface.type) {
    case 'hyperplane': {
      // Line in 2D (intersection of hyperplane with display plane)
      const nx = surface.normal.components[dimX] ?? 0;
      const ny = surface.normal.components[dimY] ?? 0;
      const offset = surface.offset;

      // Find two points on the line
      if (Math.abs(ny) > 0.001) {
        // y = (offset - nx*x) / ny
        for (const x of [-100, 100]) {
          const y = (offset - nx * x) / ny;
          const point: SpacePoint = { coordinates: new Array(4).fill(0) };
          point.coordinates[dimX] = x;
          point.coordinates[dimY] = y;

          const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
          if (projected.visible) {
            points.push({ x: projected.x, y: projected.y });
          }
        }
      } else if (Math.abs(nx) > 0.001) {
        // Vertical line x = offset/nx
        const x = offset / nx;
        for (const y of [-100, 100]) {
          const point: SpacePoint = { coordinates: new Array(4).fill(0) };
          point.coordinates[dimX] = x;
          point.coordinates[dimY] = y;

          const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
          if (projected.visible) {
            points.push({ x: projected.x, y: projected.y });
          }
        }
      }
      break;
    }

    case 'sphere': {
      // Circle in 2D (if sphere intersects display plane)
      const cx = surface.center.coordinates[dimX] ?? 0;
      const cy = surface.center.coordinates[dimY] ?? 0;
      const r = surface.radius;

      const segments = 36;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const point: SpacePoint = { coordinates: [...surface.center.coordinates] };
        point.coordinates[dimX] = cx + r * Math.cos(angle);
        point.coordinates[dimY] = cy + r * Math.sin(angle);

        const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
        if (projected.visible) {
          points.push({ x: projected.x, y: projected.y });
        }
      }
      break;
    }

    case 'cone': {
      // Use cone edge generation
      const edges = generateConeEdgePoints(
        surface.cone,
        displayDimensions,
        projection,
        viewParams
      );
      for (const edge of edges) {
        points.push(...edge);
      }
      break;
    }
  }

  return points;
}

// =============================================================================
// Intersection Visualization
// =============================================================================

/**
 * Generate visualization for cone intersection region
 */
export function generateIntersectionVisualization(
  intersection: ConeIntersection,
  cones: PossibilityCone[],
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {},
  config: ConicVisualization,
  sampleResolution: number = 50
): IntersectionVisualization {
  const bounds = intersection.boundary.bounds;
  const [dimX, dimY] = displayDimensions;

  const minX = bounds.min.coordinates[dimX];
  const maxX = bounds.max.coordinates[dimX];
  const minY = bounds.min.coordinates[dimY];
  const maxY = bounds.max.coordinates[dimY];

  const stepX = (maxX - minX) / sampleResolution;
  const stepY = (maxY - minY) / sampleResolution;

  // Sample points inside intersection
  const insidePoints: { x: number; y: number }[] = [];
  const boundaryPoints: { x: number; y: number }[] = [];

  for (let i = 0; i <= sampleResolution; i++) {
    for (let j = 0; j <= sampleResolution; j++) {
      const testPoint: SpacePoint = {
        coordinates: [...bounds.min.coordinates],
      };
      testPoint.coordinates[dimX] = minX + i * stepX;
      testPoint.coordinates[dimY] = minY + j * stepY;

      // Check if in all cones
      let inAll = true;
      let inCount = 0;
      for (const cone of cones) {
        if (isPointInCone(testPoint, cone)) {
          inCount++;
        } else {
          inAll = false;
        }
      }

      const projected = projectPoint(testPoint, displayDimensions, projection, {}, viewParams);
      if (projected.visible) {
        if (inAll) {
          insidePoints.push({ x: projected.x, y: projected.y });
        } else if (inCount > 0 && inCount === cones.length - 1) {
          // Near boundary
          boundaryPoints.push({ x: projected.x, y: projected.y });
        }
      }
    }
  }

  // Waist visualization
  let waistVisual: { position: { x: number; y: number }; radius: number } | undefined;
  if (intersection.waist && config.show.waist) {
    const waistProjected = projectPoint(
      intersection.waist.position,
      displayDimensions,
      projection,
      {},
      viewParams
    );
    if (waistProjected.visible) {
      waistVisual = {
        position: { x: waistProjected.x, y: waistProjected.y },
        radius: Math.sqrt(intersection.waist.area / Math.PI) * (viewParams.scale ?? 1),
      };
    }
  }

  return {
    insidePoints,
    boundaryPoints,
    waist: waistVisual,
    volume: intersection.volume,
  };
}

/**
 * Intersection visualization data
 */
export interface IntersectionVisualization {
  insidePoints: { x: number; y: number }[];
  boundaryPoints: { x: number; y: number }[];
  waist?: { position: { x: number; y: number }; radius: number };
  volume: number;
}

// =============================================================================
// Heat Map for Value Field
// =============================================================================

/**
 * Generate value field heat map
 */
export function generateValueHeatMap(
  intersection: ConeIntersection,
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams = {},
  resolution: number = 30
): HeatMapData {
  const bounds = intersection.boundary.bounds;
  const [dimX, dimY] = displayDimensions;

  const minX = bounds.min.coordinates[dimX];
  const maxX = bounds.max.coordinates[dimX];
  const minY = bounds.min.coordinates[dimY];
  const maxY = bounds.max.coordinates[dimY];

  const stepX = (maxX - minX) / resolution;
  const stepY = (maxY - minY) / resolution;

  const cells: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
  }> = [];

  // If we have a value field, sample it
  if (intersection.valueField) {
    const field = intersection.valueField;
    const fieldResX = field.resolution[dimX] ?? resolution;
    const fieldResY = field.resolution[dimY] ?? resolution;

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const worldX = minX + (i + 0.5) * stepX;
        const worldY = minY + (j + 0.5) * stepY;

        // Map to field coordinates
        const fieldI = Math.floor((i / resolution) * fieldResX);
        const fieldJ = Math.floor((j / resolution) * fieldResY);
        const fieldIndex = fieldI * fieldResY + fieldJ;

        const value = field.values[fieldIndex] ?? 0;

        const point: SpacePoint = { coordinates: [...bounds.min.coordinates] };
        point.coordinates[dimX] = worldX;
        point.coordinates[dimY] = worldY;

        const projected = projectPoint(point, displayDimensions, projection, {}, viewParams);
        if (projected.visible) {
          cells.push({
            x: projected.x - (stepX * (viewParams.scale ?? 1)) / 2,
            y: projected.y - (stepY * (viewParams.scale ?? 1)) / 2,
            width: stepX * (viewParams.scale ?? 1),
            height: stepY * (viewParams.scale ?? 1),
            value,
          });
        }
      }
    }
  }

  return { cells };
}

/**
 * Heat map data
 */
export interface HeatMapData {
  cells: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
  }>;
}

// =============================================================================
// SVG Path Generation
// =============================================================================

/**
 * Convert points to SVG path string
 */
export function pointsToSvgPath(
  points: { x: number; y: number }[],
  closed: boolean = false
): string {
  if (points.length === 0) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  if (closed) {
    path += ' Z';
  }

  return path;
}

/**
 * Convert conic section to SVG path
 */
export function conicSectionToSvgPath(section: ConicSection): string {
  const points = generateConicSectionPoints(section);
  return pointsToSvgPath(points, section.type === 'circle' || section.type === 'ellipse');
}

// =============================================================================
// Canvas 2D Rendering Helpers
// =============================================================================

/**
 * Render a cone to a 2D canvas context
 */
export function renderConeToCanvas(
  ctx: CanvasRenderingContext2D,
  cone: PossibilityCone,
  displayDimensions: number[],
  projection: ProjectionMode,
  viewParams: ProjectionViewParams,
  config: ConicVisualization
): void {
  // Draw fill
  if (config.opacity.cones > 0) {
    const fillPath = generateConeFillPath(cone, displayDimensions, projection, viewParams);
    if (fillPath.length > 2) {
      ctx.beginPath();
      ctx.moveTo(fillPath[0].x, fillPath[0].y);
      for (const point of fillPath.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.fillStyle = withAlpha(config.colors.coneInterior, config.opacity.cones);
      ctx.fill();
    }
  }

  // Draw edges
  if (config.show.coneEdges) {
    const edges = generateConeEdgePoints(cone, displayDimensions, projection, viewParams);
    ctx.strokeStyle = config.colors.coneSurface;
    ctx.lineWidth = 2;

    for (const edge of edges) {
      if (edge.length > 1) {
        ctx.beginPath();
        ctx.moveTo(edge[0].x, edge[0].y);
        for (const point of edge.slice(1)) {
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }
    }
  }
}

/**
 * Render path to canvas
 */
export function renderPathToCanvas(
  ctx: CanvasRenderingContext2D,
  pathVis: PathVisualization,
  config: ConicVisualization
): void {
  if (pathVis.points.length < 2) return;

  // Draw path line
  ctx.beginPath();
  ctx.moveTo(pathVis.points[0].x, pathVis.points[0].y);
  for (const point of pathVis.points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = config.colors.optimalPath;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw waypoints
  if (config.show.waypoints) {
    for (const point of pathVis.points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = point.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Draw gradient arrows
  if (config.show.valueGradient) {
    ctx.strokeStyle = config.colors.valueHigh;
    ctx.lineWidth = 1;
    for (const arrow of pathVis.gradientArrows) {
      ctx.beginPath();
      ctx.moveTo(arrow.from.x, arrow.from.y);
      ctx.lineTo(arrow.to.x, arrow.to.y);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(arrow.to.y - arrow.from.y, arrow.to.x - arrow.from.x);
      const headLength = 5;
      ctx.beginPath();
      ctx.moveTo(arrow.to.x, arrow.to.y);
      ctx.lineTo(
        arrow.to.x - headLength * Math.cos(angle - Math.PI / 6),
        arrow.to.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrow.to.x - headLength * Math.cos(angle + Math.PI / 6),
        arrow.to.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = config.colors.valueHigh;
      ctx.fill();
    }
  }
}

/**
 * Render intersection region to canvas
 */
export function renderIntersectionToCanvas(
  ctx: CanvasRenderingContext2D,
  intersectionVis: IntersectionVisualization,
  config: ConicVisualization
): void {
  // Draw inside region as dots
  if (config.show.intersection && config.opacity.intersection > 0) {
    ctx.fillStyle = withAlpha(config.colors.validRegion, config.opacity.intersection);
    for (const point of intersectionVis.insidePoints) {
      ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
    }
  }

  // Draw waist
  if (intersectionVis.waist && config.show.waist) {
    ctx.beginPath();
    ctx.arc(
      intersectionVis.waist.position.x,
      intersectionVis.waist.position.y,
      intersectionVis.waist.radius,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = config.colors.optimalPath;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw cross at center
    const cx = intersectionVis.waist.position.x;
    const cy = intersectionVis.waist.position.y;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();
  }
}

// =============================================================================
// Animation Helpers
// =============================================================================

/**
 * Generate animation keyframes for cone narrowing
 */
export function generateNarrowingAnimation(
  stages: PipelineStage[],
  framesPerStage: number = 30
): ConeAnimationFrame[] {
  const frames: ConeAnimationFrame[] = [];

  for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
    const stage = stages[stageIdx];
    const prevStage = stageIdx > 0 ? stages[stageIdx - 1] : null;

    const startAperture = prevStage?.resultingCone?.aperture ?? Math.PI / 4;
    const endAperture = stage.resultingCone?.aperture ?? startAperture;

    for (let f = 0; f < framesPerStage; f++) {
      const t = f / framesPerStage;
      const eased = 1 - Math.pow(1 - t, 3); // Ease out cubic

      frames.push({
        stageIndex: stageIdx,
        frameIndex: f,
        time: stageIdx * framesPerStage + f,
        aperture: startAperture + (endAperture - startAperture) * eased,
        volumeFraction:
          (prevStage?.remainingVolumeFraction ?? 1) +
          ((stage.remainingVolumeFraction ?? 1) - (prevStage?.remainingVolumeFraction ?? 1)) *
            eased,
        activeConstraints: stage.constraints.slice(
          0,
          Math.ceil(stage.constraints.length * t)
        ),
      });
    }
  }

  return frames;
}

/**
 * Cone animation frame data
 */
export interface ConeAnimationFrame {
  stageIndex: number;
  frameIndex: number;
  time: number;
  aperture: number;
  volumeFraction: number;
  activeConstraints: ConeConstraint[];
}

/**
 * Generate pulse animation for waist detection
 */
export function generateWaistPulse(
  waist: ConeIntersection['waist'],
  numFrames: number = 60
): Array<{ scale: number; opacity: number }> {
  if (!waist) return [];

  const frames: Array<{ scale: number; opacity: number }> = [];

  for (let i = 0; i < numFrames; i++) {
    const t = i / numFrames;
    const pulse = Math.sin(t * Math.PI * 4) * 0.3 + 1; // Pulsing scale

    frames.push({
      scale: pulse,
      opacity: 1 - t * 0.5, // Fade out slightly
    });
  }

  return frames;
}

// =============================================================================
// Caustic Detection (where many cone edges converge)
// =============================================================================

/**
 * Find caustic points where cone edges converge
 */
export function findCausticPoints(
  cones: PossibilityCone[],
  displayDimensions: number[],
  gridResolution: number = 20,
  bounds: { min: SpacePoint; max: SpacePoint }
): { x: number; y: number; intensity: number }[] {
  const [dimX, dimY] = displayDimensions;
  const caustics: { x: number; y: number; intensity: number }[] = [];

  const minX = bounds.min.coordinates[dimX];
  const maxX = bounds.max.coordinates[dimX];
  const minY = bounds.min.coordinates[dimY];
  const maxY = bounds.max.coordinates[dimY];

  const stepX = (maxX - minX) / gridResolution;
  const stepY = (maxY - minY) / gridResolution;

  // Count how many cone edges pass near each grid cell
  const edgeCounts: number[][] = Array(gridResolution)
    .fill(null)
    .map(() => Array(gridResolution).fill(0));

  for (const cone of cones) {
    const edges = generateConeEdgePoints(cone, displayDimensions, 'orthographic', {});

    for (const edge of edges) {
      for (const point of edge) {
        // Map to grid cell
        const i = Math.floor((point.x - minX) / stepX);
        const j = Math.floor((point.y - minY) / stepY);

        if (i >= 0 && i < gridResolution && j >= 0 && j < gridResolution) {
          edgeCounts[i][j]++;
        }
      }
    }
  }

  // Find cells with high edge counts (caustics)
  const threshold = cones.length * 0.5;
  for (let i = 0; i < gridResolution; i++) {
    for (let j = 0; j < gridResolution; j++) {
      if (edgeCounts[i][j] > threshold) {
        caustics.push({
          x: minX + (i + 0.5) * stepX,
          y: minY + (j + 0.5) * stepY,
          intensity: edgeCounts[i][j] / cones.length,
        });
      }
    }
  }

  return caustics;
}
