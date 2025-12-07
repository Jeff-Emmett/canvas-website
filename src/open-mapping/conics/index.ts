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
 * Key Concepts:
 * - Forward cones: Future possibilities from a decision point
 * - Backward cones: Past decisions that could lead to a state
 * - Apertures: Constraint surfaces that narrow cones
 * - Waist: The narrowest point where cones meet (bottleneck)
 * - Caustics: Where many cone edges converge (critical points)
 *
 * Usage:
 * ```typescript
 * import {
 *   createPipelineManager,
 *   createConstraint,
 *   PathOptimizer,
 * } from './conics';
 *
 * // Create pipeline manager
 * const manager = createPipelineManager({
 *   dimensions: 4,
 *   dimensionLabels: ['Time', 'Value', 'Risk', 'Resources'],
 * });
 *
 * // Create a pipeline from an origin point
 * const pipeline = manager.createPipeline('Planning', {
 *   coordinates: [0, 50, 50, 100],
 * });
 *
 * // Add constraint stages
 * manager.addStage(pipeline.id, 'Deadlines', [
 *   createConstraint({
 *     label: 'Q1 Deadline',
 *     type: 'temporal',
 *     restrictiveness: 0.3,
 *   }),
 * ]);
 *
 * manager.addStage(pipeline.id, 'Budget', [
 *   createConstraint({
 *     label: 'Budget Cap',
 *     type: 'resource',
 *     restrictiveness: 0.4,
 *   }),
 * ]);
 *
 * // Run pipeline and compute intersection
 * const intersection = manager.runPipeline(pipeline.id);
 *
 * // Find optimal path through constrained space
 * const optimizer = new PathOptimizer(manager, pipeline.id, {
 *   algorithm: 'a-star',
 * });
 *
 * const result = optimizer.findOptimalPath(
 *   { coordinates: [0, 50, 50, 100] },
 *   { coordinates: [100, 80, 20, 50] }
 * );
 *
 * console.log('Best path:', result.bestPath);
 * console.log('Optimality:', result.bestPath.optimalityScore);
 * ```
 */

// Core types
export type {
  // Dimensional space
  SpacePoint,
  SpaceVector,

  // Cone primitives
  ConeDirection,
  PossibilityCone,

  // Constraints
  ConeConstraint,
  ConstraintType,
  ConstraintSurface,
  HyperplaneSurface,
  SphereSurface,
  ConeSurface,
  CustomSurface,

  // Conic sections
  ConicSectionType,
  ConicSection,

  // Intersections
  ConeIntersection,
  IntersectionBoundary,
  ValueField,

  // Pipeline
  ConstraintPipeline,
  PipelineStage,

  // Paths
  PossibilityPath,
  PathWaypoint,

  // Optimization
  OptimizationConfig,
  OptimizationResult,

  // Visualization
  ProjectionMode,
  ConicVisualization,

  // Events
  ConicEvent,
  ConicEventListener,
} from './types';

export {
  DIMENSION,
  DEFAULT_OPTIMIZATION_CONFIG,
  DEFAULT_CONIC_VISUALIZATION,
} from './types';

// Geometry functions
export {
  // Vector operations
  vectorAdd,
  vectorSubtract,
  vectorScale,
  vectorDot,
  vectorNorm,
  vectorNormalize,
  vectorCross3D,

  // Cone operations
  createCone,
  isPointInCone,
  signedDistanceToCone,
  angleFromAxis,
  narrowCone,
  combineCones,

  // Conic sections
  getConicSectionType,
  sliceConeWithPlane,

  // Constraint surfaces
  signedDistanceToSurface,

  // Intersection operations
  estimateIntersectionVolume,
  findIntersectionWaist,
} from './geometry';

// Pipeline management
export {
  ConstraintPipelineManager,
  createPipelineManager,
  analyzeConstraintDependencies,
  createConstraint,
  DEFAULT_PIPELINE_CONFIG,
  type PipelineConfig,
} from './pipeline';

// Path optimization
export {
  PathOptimizer,
  createPathOptimizer,
} from './optimization';

// Visualization
export {
  // Color utilities
  interpolateColor,
  withAlpha,

  // Projection
  projectPoint,
  type ProjectionViewParams,

  // Cone rendering
  generateConeEdgePoints,
  generateConeFillPath,

  // Conic sections
  generateConicSectionPoints,

  // Path visualization
  generatePathVisualization,
  type PathVisualization,

  // Pipeline visualization
  generatePipelineVisualization,
  type PipelineVisualization,
  type StageVisual,

  // Constraint surfaces
  generateConstraintSurfacePoints,

  // Intersection visualization
  generateIntersectionVisualization,
  type IntersectionVisualization,

  // Heat maps
  generateValueHeatMap,
  type HeatMapData,

  // SVG generation
  pointsToSvgPath,
  conicSectionToSvgPath,

  // Canvas rendering
  renderConeToCanvas,
  renderPathToCanvas,
  renderIntersectionToCanvas,

  // Animation
  generateNarrowingAnimation,
  generateWaistPulse,
  type ConeAnimationFrame,

  // Caustic detection
  findCausticPoints,
} from './visualization';
