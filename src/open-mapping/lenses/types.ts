/**
 * Alternative Map Lens System - Type Definitions
 *
 * Lenses transform how data is visualized on the canvas. The same underlying
 * data can be projected through different lenses to reveal different patterns.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Available lens types
 */
export type LensType =
  | 'geographic' // Traditional OSM basemap, physical locations
  | 'temporal' // Time as X-axis, events as nodes
  | 'attention' // Heatmap of collective focus
  | 'incentive' // Value gradients, token flows
  | 'relational' // Social graph topology
  | 'possibility' // Branching futures, what-if scenarios
  | 'custom'; // User-defined lens

/**
 * A point in the source data space
 */
export interface DataPoint {
  /** Unique identifier */
  id: string;

  /** Geographic coordinates (if applicable) */
  geo?: {
    lat: number;
    lng: number;
  };

  /** Timestamp (if applicable) */
  timestamp?: number;

  /** Attention/focus value (0-1) */
  attention?: number;

  /** Value/incentive score */
  value?: number;

  /** Related entities (for relational lens) */
  relations?: string[];

  /** Custom attributes */
  attributes: Record<string, unknown>;
}

/**
 * A point after lens transformation
 */
export interface TransformedPoint {
  /** Original data point ID */
  id: string;

  /** Canvas X coordinate */
  x: number;

  /** Canvas Y coordinate */
  y: number;

  /** Optional Z for 3D effects */
  z?: number;

  /** Visual size (0-1 scale) */
  size: number;

  /** Visual opacity (0-1) */
  opacity: number;

  /** Color (hex) */
  color?: string;

  /** Whether this point is visible in current lens */
  visible: boolean;
}

// =============================================================================
// Lens Configuration
// =============================================================================

/**
 * Base lens configuration
 */
export interface BaseLensConfig {
  /** Lens type */
  type: LensType;

  /** Human-readable name */
  name: string;

  /** Icon for UI */
  icon?: string;

  /** Whether lens is active */
  active: boolean;

  /** Blend weight when multiple lenses active (0-1) */
  weight: number;
}

/**
 * Geographic lens configuration
 */
export interface GeographicLensConfig extends BaseLensConfig {
  type: 'geographic';

  /** Map style URL */
  styleUrl?: string;

  /** Center point */
  center: { lat: number; lng: number };

  /** Zoom level */
  zoom: number;

  /** Bearing (rotation) */
  bearing: number;

  /** Pitch (tilt) */
  pitch: number;
}

/**
 * Temporal lens configuration
 */
export interface TemporalLensConfig extends BaseLensConfig {
  type: 'temporal';

  /** Time range to display */
  timeRange: {
    start: number;
    end: number;
  };

  /** Current scrubber position */
  currentTime: number;

  /** Time scale (pixels per millisecond) */
  timeScale: number;

  /** Whether to animate playback */
  playing: boolean;

  /** Playback speed multiplier */
  playbackSpeed: number;

  /** Vertical grouping strategy */
  groupBy: 'type' | 'owner' | 'location' | 'none';
}

/**
 * Attention lens configuration
 */
export interface AttentionLensConfig extends BaseLensConfig {
  type: 'attention';

  /** Decay rate for attention (half-life in ms) */
  decayRate: number;

  /** Minimum attention to display */
  minAttention: number;

  /** Color gradient */
  colorGradient: {
    low: string;
    medium: string;
    high: string;
  };

  /** Whether to show heatmap overlay */
  showHeatmap: boolean;

  /** Heatmap radius (pixels) */
  heatmapRadius: number;
}

/**
 * Incentive lens configuration
 */
export interface IncentiveLensConfig extends BaseLensConfig {
  type: 'incentive';

  /** Value range to normalize */
  valueRange: { min: number; max: number };

  /** Color for positive values */
  positiveColor: string;

  /** Color for negative values */
  negativeColor: string;

  /** Whether to show flow arrows */
  showFlows: boolean;

  /** Token type to visualize */
  tokenType?: string;
}

/**
 * Relational lens configuration
 */
export interface RelationalLensConfig extends BaseLensConfig {
  type: 'relational';

  /** Layout algorithm */
  layout: 'force-directed' | 'radial' | 'hierarchical' | 'circular';

  /** Center node (if any) */
  focusNodeId?: string;

  /** Maximum depth from focus */
  maxDepth: number;

  /** Edge visibility threshold */
  minEdgeStrength: number;

  /** Node repulsion force */
  repulsionForce: number;

  /** Edge attraction force */
  attractionForce: number;
}

/**
 * Possibility lens configuration
 */
export interface PossibilityLensConfig extends BaseLensConfig {
  type: 'possibility';

  /** Branch point in time */
  branchPoint: number;

  /** Active scenario/branch */
  activeScenario: string;

  /** All available scenarios */
  scenarios: Array<{
    id: string;
    name: string;
    probability?: number;
  }>;

  /** Whether to show probability distributions */
  showProbabilities: boolean;

  /** Fade factor for unlikely scenarios */
  probabilityFade: number;
}

/**
 * Custom lens configuration
 */
export interface CustomLensConfig extends BaseLensConfig {
  type: 'custom';

  /** Custom transform function name */
  transformFn: string;

  /** Custom parameters */
  params: Record<string, unknown>;
}

/**
 * Union of all lens configs
 */
export type LensConfig =
  | GeographicLensConfig
  | TemporalLensConfig
  | AttentionLensConfig
  | IncentiveLensConfig
  | RelationalLensConfig
  | PossibilityLensConfig
  | CustomLensConfig;

// =============================================================================
// Lens State
// =============================================================================

/**
 * Current state of the lens system
 */
export interface LensState {
  /** Active lenses (can blend multiple) */
  activeLenses: LensConfig[];

  /** Transition in progress */
  transition?: LensTransition;

  /** Canvas viewport */
  viewport: {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    scale: number;
  };

  /** Cached transformed points */
  transformedPoints: Map<string, TransformedPoint>;

  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * A lens transition (blending between states)
 */
export interface LensTransition {
  /** Transition ID */
  id: string;

  /** Starting lens configuration */
  from: LensConfig[];

  /** Target lens configuration */
  to: LensConfig[];

  /** Transition duration (ms) */
  duration: number;

  /** Start timestamp */
  startTime: number;

  /** Easing function */
  easing: EasingFunction;

  /** Current progress (0-1) */
  progress: number;
}

/**
 * Easing function types
 */
export type EasingFunction =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'spring'
  | 'bounce';

// =============================================================================
// Transform Types
// =============================================================================

/**
 * Transform function signature
 */
export type LensTransformFn = (
  point: DataPoint,
  config: LensConfig,
  viewport: LensState['viewport']
) => TransformedPoint;

/**
 * Blending function signature
 */
export type BlendFn = (
  points: TransformedPoint[],
  weights: number[]
) => TransformedPoint;

/**
 * Registry of custom transforms
 */
export interface TransformRegistry {
  transforms: Map<LensType | string, LensTransformFn>;
  blenders: Map<string, BlendFn>;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Lens system events
 */
export type LensEvent =
  | { type: 'lens:activated'; lens: LensConfig }
  | { type: 'lens:deactivated'; lensType: LensType }
  | { type: 'lens:updated'; lens: LensConfig }
  | { type: 'transition:started'; transition: LensTransition }
  | { type: 'transition:progress'; transition: LensTransition }
  | { type: 'transition:completed'; transition: LensTransition }
  | { type: 'points:transformed'; count: number }
  | { type: 'temporal:scrub'; time: number }
  | { type: 'temporal:play' }
  | { type: 'temporal:pause' };

/**
 * Lens event listener
 */
export type LensEventListener = (event: LensEvent) => void;

// =============================================================================
// Temporal Portal
// =============================================================================

/**
 * A temporal portal (view into another time at a location)
 */
export interface TemporalPortal {
  /** Portal ID */
  id: string;

  /** Geographic location */
  location: { lat: number; lng: number };

  /** Canvas position */
  position: { x: number; y: number };

  /** Target time */
  targetTime: number;

  /** Portal radius (pixels) */
  radius: number;

  /** Whether portal is active */
  active: boolean;
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default geographic lens
 */
export const DEFAULT_GEOGRAPHIC_LENS: GeographicLensConfig = {
  type: 'geographic',
  name: 'Geographic',
  icon: '🗺️',
  active: true,
  weight: 1,
  center: { lat: 0, lng: 0 },
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

/**
 * Default temporal lens
 */
export const DEFAULT_TEMPORAL_LENS: TemporalLensConfig = {
  type: 'temporal',
  name: 'Timeline',
  icon: '⏱️',
  active: false,
  weight: 1,
  timeRange: {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000, // 1 week ago
    end: Date.now(),
  },
  currentTime: Date.now(),
  timeScale: 0.0001, // 1 pixel per 10 seconds
  playing: false,
  playbackSpeed: 1,
  groupBy: 'type',
};

/**
 * Default attention lens
 */
export const DEFAULT_ATTENTION_LENS: AttentionLensConfig = {
  type: 'attention',
  name: 'Attention',
  icon: '👁️',
  active: false,
  weight: 1,
  decayRate: 60000, // 1 minute half-life
  minAttention: 0.1,
  colorGradient: {
    low: '#3b82f6', // Blue
    medium: '#eab308', // Yellow
    high: '#ef4444', // Red
  },
  showHeatmap: true,
  heatmapRadius: 50,
};

/**
 * Default incentive lens
 */
export const DEFAULT_INCENTIVE_LENS: IncentiveLensConfig = {
  type: 'incentive',
  name: 'Value',
  icon: '💰',
  active: false,
  weight: 1,
  valueRange: { min: 0, max: 1000 },
  positiveColor: '#22c55e',
  negativeColor: '#ef4444',
  showFlows: true,
};

/**
 * Default relational lens
 */
export const DEFAULT_RELATIONAL_LENS: RelationalLensConfig = {
  type: 'relational',
  name: 'Network',
  icon: '🕸️',
  active: false,
  weight: 1,
  layout: 'force-directed',
  maxDepth: 3,
  minEdgeStrength: 0.1,
  repulsionForce: 100,
  attractionForce: 0.1,
};

/**
 * Default possibility lens
 */
export const DEFAULT_POSSIBILITY_LENS: PossibilityLensConfig = {
  type: 'possibility',
  name: 'Possibilities',
  icon: '🌳',
  active: false,
  weight: 1,
  branchPoint: Date.now(),
  activeScenario: 'current',
  scenarios: [{ id: 'current', name: 'Current Path', probability: 1 }],
  showProbabilities: true,
  probabilityFade: 0.5,
};

/**
 * All default lenses
 */
export const DEFAULT_LENSES: LensConfig[] = [
  DEFAULT_GEOGRAPHIC_LENS,
  DEFAULT_TEMPORAL_LENS,
  DEFAULT_ATTENTION_LENS,
  DEFAULT_INCENTIVE_LENS,
  DEFAULT_RELATIONAL_LENS,
  DEFAULT_POSSIBILITY_LENS,
];
