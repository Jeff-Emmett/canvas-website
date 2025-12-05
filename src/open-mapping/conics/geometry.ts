/**
 * Conic Geometry
 *
 * Mathematical operations for cones, conic sections, and their intersections
 * in n-dimensional possibility space.
 */

import type {
  SpacePoint,
  SpaceVector,
  PossibilityCone,
  ConicSection,
  ConicSectionType,
  ConstraintSurface,
  HyperplaneSurface,
  SphereSurface,
  ConeSurface,
} from './types';

// =============================================================================
// Vector Operations
// =============================================================================

/**
 * Create a zero vector of given dimension
 */
export function zeroVector(dim: number): SpaceVector {
  return { components: new Array(dim).fill(0) };
}

/**
 * Create a unit vector along a given axis
 */
export function unitVector(dim: number, axis: number): SpaceVector {
  const components = new Array(dim).fill(0);
  components[axis] = 1;
  return { components };
}

/**
 * Add two vectors
 */
export function addVectors(a: SpaceVector, b: SpaceVector): SpaceVector {
  return {
    components: a.components.map((v, i) => v + (b.components[i] ?? 0)),
  };
}

/**
 * Subtract vectors (a - b)
 */
export function subtractVectors(a: SpaceVector, b: SpaceVector): SpaceVector {
  return {
    components: a.components.map((v, i) => v - (b.components[i] ?? 0)),
  };
}

/**
 * Scale a vector
 */
export function scaleVector(v: SpaceVector, scalar: number): SpaceVector {
  return {
    components: v.components.map((c) => c * scalar),
  };
}

/**
 * Dot product of two vectors
 */
export function dotProduct(a: SpaceVector, b: SpaceVector): number {
  return a.components.reduce(
    (sum, v, i) => sum + v * (b.components[i] ?? 0),
    0
  );
}

/**
 * Vector magnitude (L2 norm)
 */
export function magnitude(v: SpaceVector): number {
  return Math.sqrt(dotProduct(v, v));
}

/**
 * Normalize a vector to unit length
 */
export function normalize(v: SpaceVector): SpaceVector {
  const mag = magnitude(v);
  if (mag === 0) return v;
  return scaleVector(v, 1 / mag);
}

/**
 * Cross product (3D only)
 */
export function crossProduct(a: SpaceVector, b: SpaceVector): SpaceVector {
  if (a.components.length !== 3 || b.components.length !== 3) {
    throw new Error('Cross product only defined for 3D vectors');
  }
  return {
    components: [
      a.components[1] * b.components[2] - a.components[2] * b.components[1],
      a.components[2] * b.components[0] - a.components[0] * b.components[2],
      a.components[0] * b.components[1] - a.components[1] * b.components[0],
    ],
  };
}

/**
 * Distance between two points
 */
export function distance(a: SpacePoint, b: SpacePoint): number {
  let sum = 0;
  for (let i = 0; i < a.coordinates.length; i++) {
    const diff = a.coordinates[i] - (b.coordinates[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Convert point to vector (from origin)
 */
export function pointToVector(p: SpacePoint): SpaceVector {
  return { components: [...p.coordinates] };
}

/**
 * Convert vector to point
 */
export function vectorToPoint(v: SpaceVector): SpacePoint {
  return { coordinates: [...v.components] };
}

// =============================================================================
// Cone Operations
// =============================================================================

/**
 * Create a possibility cone
 */
export function createCone(params: {
  apex: SpacePoint;
  axis: SpaceVector;
  aperture: number;
  direction?: 'forward' | 'backward' | 'bidirectional';
  extent?: number | null;
  constraints?: string[];
}): PossibilityCone {
  return {
    id: `cone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    apex: params.apex,
    axis: normalize(params.axis),
    aperture: Math.max(0, Math.min(Math.PI / 2, params.aperture)),
    direction: params.direction ?? 'forward',
    extent: params.extent ?? null,
    constraints: params.constraints ?? [],
    metadata: {},
  };
}

/**
 * Check if a point is inside a cone
 */
export function isPointInCone(point: SpacePoint, cone: PossibilityCone): boolean {
  // Vector from apex to point
  const toPoint = subtractVectors(
    pointToVector(point),
    pointToVector(cone.apex)
  );

  const distanceFromApex = magnitude(toPoint);

  // Check extent
  if (cone.extent !== null) {
    const axialDistance = dotProduct(toPoint, cone.axis);
    if (cone.direction === 'forward' && (axialDistance < 0 || axialDistance > cone.extent)) {
      return false;
    }
    if (cone.direction === 'backward' && (axialDistance > 0 || axialDistance < -cone.extent)) {
      return false;
    }
    if (cone.direction === 'bidirectional' && Math.abs(axialDistance) > cone.extent) {
      return false;
    }
  }

  // Check direction
  const axialComponent = dotProduct(toPoint, cone.axis);
  if (cone.direction === 'forward' && axialComponent < 0) return false;
  if (cone.direction === 'backward' && axialComponent > 0) return false;

  // Check angle from axis
  if (distanceFromApex === 0) return true; // At apex

  const cosAngle = Math.abs(axialComponent) / distanceFromApex;
  const angle = Math.acos(Math.min(1, cosAngle));

  return angle <= cone.aperture;
}

/**
 * Get distance from point to cone surface (signed: negative = inside)
 */
export function signedDistanceToCone(
  point: SpacePoint,
  cone: PossibilityCone
): number {
  const toPoint = subtractVectors(
    pointToVector(point),
    pointToVector(cone.apex)
  );

  const distanceFromApex = magnitude(toPoint);
  if (distanceFromApex === 0) return 0; // At apex

  const axialComponent = dotProduct(toPoint, cone.axis);

  // For bidirectional, use absolute value
  const effectiveAxial =
    cone.direction === 'bidirectional' ? Math.abs(axialComponent) : axialComponent;

  // Check direction
  if (cone.direction === 'forward' && axialComponent < 0) {
    return distanceFromApex; // Behind cone
  }
  if (cone.direction === 'backward' && axialComponent > 0) {
    return distanceFromApex; // In front of backward cone
  }

  // Angle from axis
  const cosAngle = effectiveAxial / distanceFromApex;
  const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle)));

  // Distance perpendicular to cone surface
  const angleDiff = angle - cone.aperture;

  // Convert angular difference to linear distance (approximate)
  return angleDiff * distanceFromApex;
}

/**
 * Narrow a cone by applying a constraint (reduce aperture)
 */
export function narrowCone(
  cone: PossibilityCone,
  factor: number,
  constraintId: string
): PossibilityCone {
  const newAperture = cone.aperture * Math.max(0, Math.min(1, factor));

  return {
    ...cone,
    id: `cone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    aperture: newAperture,
    constraints: [...cone.constraints, constraintId],
  };
}

/**
 * Shift cone apex along axis
 */
export function shiftConeApex(
  cone: PossibilityCone,
  distance: number
): PossibilityCone {
  const shift = scaleVector(cone.axis, distance);
  const newApex: SpacePoint = {
    coordinates: cone.apex.coordinates.map(
      (c, i) => c + (shift.components[i] ?? 0)
    ),
  };

  return {
    ...cone,
    apex: newApex,
  };
}

// =============================================================================
// Conic Sections
// =============================================================================

/**
 * Determine the type of conic section from cutting plane angle
 *
 * @param coneAperture Half-angle of the cone
 * @param planeAngle Angle of cutting plane from axis (0 = perpendicular)
 */
export function getConicSectionType(
  coneAperture: number,
  planeAngle: number
): ConicSectionType {
  const normalizedPlane = Math.abs(planeAngle);

  if (normalizedPlane < 0.001) {
    return 'circle'; // Perpendicular to axis
  }

  if (Math.abs(normalizedPlane - coneAperture) < 0.001) {
    return 'parabola'; // Parallel to cone edge
  }

  if (normalizedPlane < coneAperture) {
    return 'ellipse'; // Steeper than cone edge, doesn't cross apex
  }

  return 'hyperbola'; // Shallower than cone edge, crosses both nappes
}

/**
 * Create a conic section from cone and cutting plane
 */
export function createConicSection(
  cone: PossibilityCone,
  planeNormal: SpaceVector,
  planeOffset: number
): ConicSection {
  // Angle between plane normal and cone axis
  const cosPlaneAngle = Math.abs(dotProduct(normalize(planeNormal), cone.axis));
  const planeAngle = Math.acos(Math.min(1, cosPlaneAngle));

  const type = getConicSectionType(cone.aperture, planeAngle);

  // Calculate eccentricity
  let eccentricity: number;
  if (type === 'circle') {
    eccentricity = 0;
  } else if (type === 'parabola') {
    eccentricity = 1;
  } else if (type === 'ellipse') {
    eccentricity = Math.sin(planeAngle) / Math.sin(cone.aperture);
  } else {
    eccentricity = Math.sin(planeAngle) / Math.sin(cone.aperture);
  }

  // Calculate semi-axes (simplified for 3D case)
  const d = planeOffset / dotProduct(planeNormal, cone.axis);
  const r = Math.abs(d) * Math.tan(cone.aperture);

  let a: number | undefined;
  let b: number | undefined;
  let p: number | undefined;

  if (type === 'circle') {
    a = r;
    b = r;
  } else if (type === 'ellipse' || type === 'hyperbola') {
    a = r / (1 - eccentricity * eccentricity);
    b = a * Math.sqrt(Math.abs(1 - eccentricity * eccentricity));
  } else if (type === 'parabola') {
    p = 2 * r;
  }

  return {
    type,
    center: { x: 0, y: 0 }, // Would need proper calculation
    a,
    b,
    p,
    rotation: 0,
    eccentricity,
    slicePlane: {
      normal: planeNormal,
      offset: planeOffset,
    },
  };
}

// =============================================================================
// Constraint Surfaces
// =============================================================================

/**
 * Calculate signed distance from point to constraint surface
 */
export function signedDistanceToSurface(
  point: SpacePoint,
  surface: ConstraintSurface
): number {
  switch (surface.type) {
    case 'hyperplane':
      return signedDistanceToHyperplane(point, surface);
    case 'sphere':
      return signedDistanceToSphere(point, surface);
    case 'cone':
      return signedDistanceToCone(point, surface.cone) *
        (surface.validRegion === 'inside' ? 1 : -1);
    case 'custom':
      // Would need to evaluate custom function
      return 0;
  }
}

function signedDistanceToHyperplane(
  point: SpacePoint,
  plane: HyperplaneSurface
): number {
  const pv = pointToVector(point);
  const dist = dotProduct(pv, plane.normal) - plane.offset;
  return plane.validSide === 'positive' ? -dist : dist;
}

function signedDistanceToSphere(
  point: SpacePoint,
  sphere: SphereSurface
): number {
  const dist = distance(point, sphere.center) - sphere.radius;
  return sphere.validRegion === 'inside' ? dist : -dist;
}

/**
 * Check if a point satisfies a constraint
 */
export function satisfiesConstraint(
  point: SpacePoint,
  surface: ConstraintSurface
): boolean {
  return signedDistanceToSurface(point, surface) <= 0;
}

// =============================================================================
// Cone Intersections
// =============================================================================

/**
 * Check if a point is in the intersection of multiple cones
 */
export function isPointInIntersection(
  point: SpacePoint,
  cones: PossibilityCone[]
): boolean {
  return cones.every((cone) => isPointInCone(point, cone));
}

/**
 * Estimate intersection volume using Monte Carlo sampling
 */
export function estimateIntersectionVolume(
  cones: PossibilityCone[],
  bounds: { min: SpacePoint; max: SpacePoint },
  samples: number = 10000
): number {
  if (cones.length === 0) return 1;

  let insideCount = 0;
  const dim = bounds.min.coordinates.length;

  for (let i = 0; i < samples; i++) {
    // Random point in bounding box
    const point: SpacePoint = {
      coordinates: bounds.min.coordinates.map(
        (min, j) => min + Math.random() * (bounds.max.coordinates[j] - min)
      ),
    };

    if (isPointInIntersection(point, cones)) {
      insideCount++;
    }
  }

  // Volume of bounding box
  let boxVolume = 1;
  for (let i = 0; i < dim; i++) {
    boxVolume *= bounds.max.coordinates[i] - bounds.min.coordinates[i];
  }

  return (insideCount / samples) * boxVolume;
}

/**
 * Find the "waist" of a cone intersection (narrowest cross-section)
 * by sampling along the primary axis
 */
export function findIntersectionWaist(
  cones: PossibilityCone[],
  axisIndex: number,
  bounds: { min: SpacePoint; max: SpacePoint },
  resolution: number = 50
): { position: SpacePoint; area: number } | null {
  if (cones.length === 0) return null;

  const dim = bounds.min.coordinates.length;
  const axisMin = bounds.min.coordinates[axisIndex];
  const axisMax = bounds.max.coordinates[axisIndex];
  const step = (axisMax - axisMin) / resolution;

  let minArea = Infinity;
  let minPosition: SpacePoint | null = null;

  for (let i = 0; i <= resolution; i++) {
    const axisValue = axisMin + i * step;

    // Sample cross-section at this axis value
    let insideCount = 0;
    const crossSectionSamples = 1000;

    for (let j = 0; j < crossSectionSamples; j++) {
      const point: SpacePoint = {
        coordinates: bounds.min.coordinates.map((min, k) => {
          if (k === axisIndex) return axisValue;
          return min + Math.random() * (bounds.max.coordinates[k] - min);
        }),
      };

      if (isPointInIntersection(point, cones)) {
        insideCount++;
      }
    }

    const area = insideCount / crossSectionSamples;

    if (area > 0 && area < minArea) {
      minArea = area;
      minPosition = {
        coordinates: bounds.min.coordinates.map((min, k) => {
          if (k === axisIndex) return axisValue;
          return (min + bounds.max.coordinates[k]) / 2;
        }),
      };
    }
  }

  if (minPosition === null) return null;

  return {
    position: minPosition,
    area: minArea,
  };
}

// =============================================================================
// Projection
// =============================================================================

/**
 * Project a point to 2D using orthographic projection
 */
export function projectOrthographic(
  point: SpacePoint,
  xAxis: number,
  yAxis: number
): { x: number; y: number } {
  return {
    x: point.coordinates[xAxis] ?? 0,
    y: point.coordinates[yAxis] ?? 0,
  };
}

/**
 * Project a point to 2D using perspective projection
 */
export function projectPerspective(
  point: SpacePoint,
  xAxis: number,
  yAxis: number,
  depthAxis: number,
  focalLength: number = 1
): { x: number; y: number } {
  const depth = point.coordinates[depthAxis] ?? 1;
  const scale = focalLength / (focalLength + depth);

  return {
    x: (point.coordinates[xAxis] ?? 0) * scale,
    y: (point.coordinates[yAxis] ?? 0) * scale,
  };
}

/**
 * Generate points on cone surface for visualization
 */
export function sampleConeSurface(
  cone: PossibilityCone,
  radialSamples: number = 16,
  axialSamples: number = 10
): SpacePoint[] {
  const points: SpacePoint[] = [];
  const dim = cone.apex.coordinates.length;

  // Find orthogonal vectors to axis
  const ortho1 = findOrthogonalVector(cone.axis);
  const ortho2 = dim >= 3 ? crossProduct(cone.axis, ortho1) : ortho1;

  const maxExtent = cone.extent ?? 10;

  for (let i = 0; i < axialSamples; i++) {
    const t = (i / (axialSamples - 1)) * maxExtent;
    const radius = t * Math.tan(cone.aperture);

    for (let j = 0; j < radialSamples; j++) {
      const angle = (j / radialSamples) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const point: SpacePoint = {
        coordinates: cone.apex.coordinates.map((c, k) => {
          const axialOffset = (cone.axis.components[k] ?? 0) * t;
          const radialOffset =
            radius * cos * (ortho1.components[k] ?? 0) +
            radius * sin * (ortho2.components[k] ?? 0);
          return c + axialOffset + radialOffset;
        }),
      };

      points.push(point);
    }
  }

  return points;
}

/**
 * Find a vector orthogonal to the given vector
 */
function findOrthogonalVector(v: SpaceVector): SpaceVector {
  const dim = v.components.length;

  // Find component with smallest magnitude
  let minIdx = 0;
  let minVal = Math.abs(v.components[0]);

  for (let i = 1; i < dim; i++) {
    if (Math.abs(v.components[i]) < minVal) {
      minVal = Math.abs(v.components[i]);
      minIdx = i;
    }
  }

  // Create vector with 1 in that position
  const other = zeroVector(dim);
  other.components[minIdx] = 1;

  // Gram-Schmidt orthogonalization
  const projection = dotProduct(v, other);
  const result = subtractVectors(other, scaleVector(v, projection));

  return normalize(result);
}
