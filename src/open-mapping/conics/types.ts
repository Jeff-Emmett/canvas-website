/**
 * Possibility Cones and Constraint Propagation
 *
 * A mathematical framework for visualizing how constraints propagate
 * through decision pipelines. Each decision point creates a "possibility
 * cone" - a light-cone-like structure representing reachable futures.
 * Subsequent constraints act as apertures that narrow these cones.
 *
 * The intersection of overlapping cones from multiple constraints
 * defines the valid solution manifold, through which we can find
 * value-weighted optimal paths.
 *
 * Concepts:
 * - Forward cones: Future possibilities from a decision point
 * - Backward cones: Past decisions that could lead to a state
 * - Apertures: Constraint surfaces that narrow cones
 * - Waist: The narrowest point where cones meet (bottleneck)
 * - Caustics: Where many cone edges converge (critical points)
 */

// =============================================================================
// Dimensional Space
// =============================================================================

/**
 * A point in n-dimensional possibility space
 * Dimensions might include: time, value, risk, resources, etc.
 */
export interface SpacePoint {
  /** Dimension values */
  coordinates: number[];

  /** Dimension labels */
  dimensions?: string[];

  /** Optional weight/probability at this point */
  weight?: number;
}

/**
 * Standard dimension indices for common use cases
 */
export const DIMENSION = {
  TIME: 0,
  VALUE: 1,
  RISK: 2,
  RESOURCE: 3,
  ATTENTION: 4,
  TRUST: 5,
} as const;

/**
 * A vector in possibility space
 */
export interface SpaceVector {
  components: number[];
}

// =============================================================================
// Cone Primitives
// =============================================================================

/**
 * Direction of a possibility cone
 */
export type ConeDirection = 'forward' | 'backward' | 'bidirectional';

/**
 * A possibility cone in n-dimensional space
 *
 * Geometrically: a cone with apex at origin, opening in a direction,
 * with an opening angle that defines how possibilities spread.
 */
export interface PossibilityCone {
  /** Unique identifier */
  id: string;

  /** Apex of the cone (decision point) */
  apex: SpacePoint;

  /** Primary axis direction (unit vector) */
  axis: SpaceVector;

  /** Opening half-angle in radians (0 = laser, PI/2 = hemisphere) */
  aperture: number;

  /** Direction the cone opens */
  direction: ConeDirection;

  /** Maximum extent along axis (null = infinite) */
  extent: number | null;

  /** Value gradient along the cone (center to edge) */
  valueGradient?: {
    center: number; // Value at axis
    edge: number; // Value at cone surface
    falloff: 'linear' | 'quadratic' | 'exponential';
  };

  /** Constraints that shaped this cone */
  constraints: string[];

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * A constraint that narrows a possibility cone
 */
export interface ConeConstraint {
  /** Unique identifier */
  id: string;

  /** Human-readable label */
  label: string;

  /** Type of constraint */
  type: ConstraintType;

  /** Position along the pipeline (for ordering) */
  pipelinePosition: number;

  /** The constraint surface/condition */
  surface: ConstraintSurface;

  /** How much this constraint typically narrows cones (0-1) */
  restrictiveness: number;

  /** Dependencies on other constraints */
  dependencies: string[];

  /** Whether constraint is hard (must satisfy) or soft (prefer) */
  hardness: 'hard' | 'soft';

  /** Weight for soft constraints */
  weight?: number;
}

/**
 * Types of constraints
 */
export type ConstraintType =
  | 'temporal' // Time-based deadline
  | 'resource' // Resource availability
  | 'dependency' // Must come after X
  | 'exclusion' // Cannot coexist with Y
  | 'capacity' // Maximum throughput
  | 'quality' // Minimum quality threshold
  | 'risk' // Maximum risk tolerance
  | 'value' // Minimum value threshold
  | 'custom'; // User-defined

/**
 * A surface that defines a constraint
 * Can be a hyperplane, sphere, or more complex manifold
 */
export type ConstraintSurface =
  | HyperplaneSurface
  | SphereSurface
  | ConeSurface
  | CustomSurface;

export interface HyperplaneSurface {
  type: 'hyperplane';
  /** Normal vector to the plane */
  normal: SpaceVector;
  /** Distance from origin */
  offset: number;
  /** Which side is valid ('positive' | 'negative' | 'both') */
  validSide: 'positive' | 'negative';
}

export interface SphereSurface {
  type: 'sphere';
  /** Center of sphere */
  center: SpacePoint;
  /** Radius */
  radius: number;
  /** Is inside or outside valid? */
  validRegion: 'inside' | 'outside';
}

export interface ConeSurface {
  type: 'cone';
  /** The cone that defines the surface */
  cone: PossibilityCone;
  /** Is inside or outside the cone valid? */
  validRegion: 'inside' | 'outside';
}

export interface CustomSurface {
  type: 'custom';
  /** Function that returns signed distance to surface */
  signedDistanceFn: string; // Serialized function reference
  /** Parameters for the function */
  params: Record<string, unknown>;
}

// =============================================================================
// Conic Sections
// =============================================================================

/**
 * Type of conic section (2D slice through a cone)
 */
export type ConicSectionType =
  | 'circle' // Slice perpendicular to axis
  | 'ellipse' // Angled slice, not through apex
  | 'parabola' // Slice parallel to cone edge
  | 'hyperbola' // Steep slice through both nappes
  | 'point' // Slice through apex only
  | 'line' // Degenerate case
  | 'crossed-lines'; // Two lines through apex

/**
 * A conic section (2D representation)
 */
export interface ConicSection {
  /** Section type */
  type: ConicSectionType;

  /** Center point (in slice plane) */
  center: { x: number; y: number };

  /** For ellipse/hyperbola: semi-major axis */
  a?: number;

  /** For ellipse/hyperbola: semi-minor axis */
  b?: number;

  /** Rotation angle in radians */
  rotation: number;

  /** For parabola: focal parameter */
  p?: number;

  /** Eccentricity (0=circle, 0<e<1=ellipse, 1=parabola, >1=hyperbola) */
  eccentricity: number;

  /** The slicing plane that created this section */
  slicePlane?: {
    normal: SpaceVector;
    offset: number;
  };
}

// =============================================================================
// Cone Intersections
// =============================================================================

/**
 * The intersection of multiple possibility cones
 * This represents the valid solution space
 */
export interface ConeIntersection {
  /** Unique identifier */
  id: string;

  /** Cones that form this intersection */
  coneIds: string[];

  /** Constraints that shaped these cones */
  constraintIds: string[];

  /** Approximate volume of intersection (normalized) */
  volume: number;

  /** The "waist" - narrowest cross-section */
  waist?: {
    position: SpacePoint;
    area: number;
  };

  /** Boundary representation */
  boundary: IntersectionBoundary;

  /** Value distribution within intersection */
  valueField?: ValueField;
}

/**
 * Boundary of an intersection region
 */
export interface IntersectionBoundary {
  /** Type of boundary representation */
  type: 'mesh' | 'implicit' | 'parametric';

  /** For mesh: vertices and faces */
  mesh?: {
    vertices: SpacePoint[];
    faces: number[][]; // Indices into vertices
  };

  /** For implicit: signed distance function */
  implicitFn?: string;

  /** Bounding box */
  bounds: {
    min: SpacePoint;
    max: SpacePoint;
  };
}

/**
 * A scalar field of values within a region
 */
export interface ValueField {
  /** Sampling resolution */
  resolution: number[];

  /** Sampled values (flattened n-dimensional array) */
  values: number[];

  /** Interpolation method */
  interpolation: 'nearest' | 'linear' | 'cubic';
}

// =============================================================================
// Pipeline and Paths
// =============================================================================

/**
 * A pipeline of constraints that progressively narrow possibilities
 */
export interface ConstraintPipeline {
  /** Pipeline identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Ordered constraints */
  stages: PipelineStage[];

  /** Initial cone (unconstrained possibilities) */
  initialCone: PossibilityCone;

  /** Final intersection after all constraints */
  finalIntersection?: ConeIntersection;

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * A stage in the constraint pipeline
 */
export interface PipelineStage {
  /** Stage identifier */
  id: string;

  /** Stage name */
  name: string;

  /** Position in pipeline (0-indexed) */
  position: number;

  /** Constraints applied at this stage */
  constraints: ConeConstraint[];

  /** Cone after applying this stage's constraints */
  resultingCone?: PossibilityCone;

  /** Intersection volume after this stage (as fraction of initial) */
  remainingVolumeFraction?: number;
}

/**
 * A path through the possibility space
 */
export interface PossibilityPath {
  /** Path identifier */
  id: string;

  /** Sequence of waypoints */
  waypoints: PathWaypoint[];

  /** Total path length */
  length: number;

  /** Accumulated value along path */
  totalValue: number;

  /** Risk exposure along path */
  riskExposure: number;

  /** Constraints satisfied */
  satisfiedConstraints: string[];

  /** Constraints violated (for soft constraints) */
  violatedConstraints: string[];

  /** Path optimality score */
  optimalityScore: number;
}

/**
 * A waypoint along a path
 */
export interface PathWaypoint {
  /** Position in space */
  position: SpacePoint;

  /** Value at this point */
  value: number;

  /** Distance from path start */
  distanceFromStart: number;

  /** Which cones contain this point */
  containingCones: string[];

  /** Gradient direction toward higher value */
  valueGradient?: SpaceVector;
}

// =============================================================================
// Optimization
// =============================================================================

/**
 * Configuration for path optimization
 */
export interface OptimizationConfig {
  /** Objective function weights */
  weights: {
    value: number; // Maximize accumulated value
    length: number; // Minimize path length
    risk: number; // Minimize risk exposure
    constraints: number; // Maximize constraints satisfied
  };

  /** Algorithm to use */
  algorithm:
    | 'gradient-descent'
    | 'simulated-annealing'
    | 'genetic'
    | 'dijkstra'
    | 'a-star';

  /** Maximum iterations */
  maxIterations: number;

  /** Convergence threshold */
  convergenceThreshold: number;

  /** Sampling resolution for discretization */
  samplingResolution: number;

  /** Whether to allow soft constraint violations */
  allowSoftViolations: boolean;

  /** Penalty multiplier for soft violations */
  softViolationPenalty: number;
}

/**
 * Result of path optimization
 */
export interface OptimizationResult {
  /** Best path found */
  bestPath: PossibilityPath;

  /** Alternative paths (Pareto frontier) */
  alternatives: PossibilityPath[];

  /** Iterations taken */
  iterations: number;

  /** Whether converged */
  converged: boolean;

  /** Optimization metrics */
  metrics: {
    initialScore: number;
    finalScore: number;
    improvement: number;
    runtime: number;
  };
}

// =============================================================================
// Visualization
// =============================================================================

/**
 * Projection mode for visualizing n-dimensional cones
 */
export type ProjectionMode =
  | 'orthographic' // Parallel projection
  | 'perspective' // Perspective projection
  | 'stereographic' // Preserves angles
  | 'slice'; // 2D slice at specific position

/**
 * Visualization configuration for conic structures
 */
export interface ConicVisualization {
  /** Projection mode */
  projection: ProjectionMode;

  /** Which dimensions to display */
  displayDimensions: [number, number] | [number, number, number];

  /** Slice position for other dimensions */
  slicePositions: Record<number, number>;

  /** Color scheme */
  colors: {
    coneInterior: string;
    coneSurface: string;
    constraintSurface: string;
    validRegion: string;
    invalidRegion: string;
    optimalPath: string;
    valueHigh: string;
    valueLow: string;
  };

  /** Opacity settings */
  opacity: {
    cones: number;
    constraints: number;
    intersection: number;
  };

  /** Whether to show various elements */
  show: {
    coneEdges: boolean;
    constraintSurfaces: boolean;
    intersection: boolean;
    valueGradient: boolean;
    paths: boolean;
    waypoints: boolean;
    waist: boolean;
    caustics: boolean;
  };
}

// =============================================================================
// Events
// =============================================================================

/**
 * Events from the conic system
 */
export type ConicEvent =
  | { type: 'cone:created'; cone: PossibilityCone }
  | { type: 'cone:updated'; cone: PossibilityCone }
  | { type: 'constraint:added'; constraint: ConeConstraint }
  | { type: 'constraint:removed'; constraintId: string }
  | { type: 'intersection:computed'; intersection: ConeIntersection }
  | { type: 'path:optimized'; result: OptimizationResult }
  | { type: 'pipeline:stage-completed'; stage: PipelineStage }
  | { type: 'waist:detected'; waist: ConeIntersection['waist'] };

export type ConicEventListener = (event: ConicEvent) => void;

// =============================================================================
// Defaults
// =============================================================================

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  weights: {
    value: 1.0,
    length: 0.3,
    risk: 0.5,
    constraints: 0.8,
  },
  algorithm: 'a-star',
  maxIterations: 1000,
  convergenceThreshold: 0.001,
  samplingResolution: 20,
  allowSoftViolations: true,
  softViolationPenalty: 0.5,
};

/**
 * Default visualization configuration
 */
export const DEFAULT_CONIC_VISUALIZATION: ConicVisualization = {
  projection: 'perspective',
  displayDimensions: [0, 1, 2], // Time, Value, Risk
  slicePositions: {},
  colors: {
    coneInterior: '#3b82f680',
    coneSurface: '#3b82f6',
    constraintSurface: '#f59e0b',
    validRegion: '#22c55e40',
    invalidRegion: '#ef444420',
    optimalPath: '#ec4899',
    valueHigh: '#22c55e',
    valueLow: '#6b7280',
  },
  opacity: {
    cones: 0.3,
    constraints: 0.5,
    intersection: 0.4,
  },
  show: {
    coneEdges: true,
    constraintSurfaces: true,
    intersection: true,
    valueGradient: true,
    paths: true,
    waypoints: true,
    waist: true,
    caustics: false,
  },
};
