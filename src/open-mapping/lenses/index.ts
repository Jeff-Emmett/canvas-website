/**
 * Alternative Map Lens System
 *
 * Multiple "lens" views that project different data dimensions onto
 * the canvas coordinate space. The same underlying data can be viewed
 * through different lenses to reveal different patterns.
 *
 * Available lenses:
 * - Geographic: Traditional OSM basemap, physical locations
 * - Temporal: Time as X-axis, events as nodes, time-scrubbing
 * - Attention: Heatmap of collective focus
 * - Incentive: Value gradients, token flows
 * - Relational: Social graph topology
 * - Possibility: Branching futures, what-if scenarios
 */

// Core types
export * from './types';

// Transforms
export {
  transformGeographic,
  transformTemporal,
  transformAttention,
  transformIncentive,
  transformRelational,
  transformPossibility,
  getTransformForLens,
  transformPoint,
  computeForceDirectedLayout,
} from './transforms';

// Blending and transitions
export {
  EASING_FUNCTIONS,
  applyEasing,
  createTransition,
  updateTransition,
  isTransitionComplete,
  getTransitionConfigs,
  blendPoints,
  transformAndBlend,
  QUICK_TRANSITION,
  SMOOTH_TRANSITION,
  SLOW_TRANSITION,
  BOUNCY_TRANSITION,
  SPRING_TRANSITION,
} from './blending';

// Manager
export {
  LensManager,
  createLensManager,
  DEFAULT_LENS_MANAGER_CONFIG,
  type LensManagerConfig,
} from './manager';
