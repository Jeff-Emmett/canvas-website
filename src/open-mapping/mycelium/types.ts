/**
 * Mycelial Network Type Definitions
 *
 * A biologically-inspired signal propagation system for collaborative spaces.
 * Models how information, attention, and value flow through the network
 * like nutrients through mycelium.
 */

// =============================================================================
// Core Node Types
// =============================================================================

/**
 * Types of nodes in the mycelial network
 */
export type NodeType =
  | 'poi' // Point of interest (location, landmark)
  | 'event' // Temporal event (meeting, activity)
  | 'person' // User/participant
  | 'resource' // Shared resource (document, tool)
  | 'discovery' // New finding/insight
  | 'waypoint' // Route waypoint
  | 'cluster' // Aggregated group of nodes
  | 'ghost'; // Historical/fading node

/**
 * A node in the mycelial network
 */
export interface MyceliumNode {
  /** Unique identifier */
  id: string;

  /** Node type */
  type: NodeType;

  /** Human-readable label */
  label: string;

  /** Geographic position (optional for non-spatial nodes) */
  position?: {
    lat: number;
    lng: number;
  };

  /** Canvas position (for canvas-native nodes) */
  canvasPosition?: {
    x: number;
    y: number;
  };

  /** Timestamp when node was created */
  createdAt: number;

  /** Timestamp when node was last active */
  lastActiveAt: number;

  /** Node's current signal strength (0-1) */
  signalStrength: number;

  /** Node's accumulated signal from network (0-1) */
  receivedSignal: number;

  /** Metadata */
  metadata: Record<string, unknown>;

  /** Connected hyphal IDs */
  hyphae: string[];

  /** Owner/creator user ID */
  ownerId?: string;

  /** Tags for categorization */
  tags: string[];
}

// =============================================================================
// Connection Types (Hyphae)
// =============================================================================

/**
 * Types of connections between nodes
 */
export type HyphaType =
  | 'route' // Physical route/path
  | 'attention' // Attention thread
  | 'reference' // Hyperlink/reference
  | 'temporal' // Time-based connection
  | 'social' // Social relationship
  | 'causal' // Cause-effect relationship
  | 'proximity' // Geographic proximity
  | 'semantic'; // Semantic similarity

/**
 * A hypha (connection) in the network
 */
export interface Hypha {
  /** Unique identifier */
  id: string;

  /** Connection type */
  type: HyphaType;

  /** Source node ID */
  sourceId: string;

  /** Target node ID */
  targetId: string;

  /** Connection strength (0-1) */
  strength: number;

  /** Directional? (false = bidirectional) */
  directed: boolean;

  /** Signal transmission efficiency (0-1) */
  conductance: number;

  /** When this connection was established */
  createdAt: number;

  /** Last time a signal passed through */
  lastSignalAt?: number;

  /** Metadata */
  metadata: Record<string, unknown>;
}

// =============================================================================
// Signal Types
// =============================================================================

/**
 * Types of signals that propagate through the network
 */
export type SignalType =
  | 'urgency' // Time-sensitive alert
  | 'discovery' // New finding
  | 'attention' // Focus/interest
  | 'trust' // Trust/reputation
  | 'novelty' // Something new/unusual
  | 'activity' // Recent activity indicator
  | 'request' // Request for help/input
  | 'presence' // Someone is here
  | 'custom'; // User-defined signal

/**
 * A signal propagating through the network
 */
export interface Signal {
  /** Unique identifier */
  id: string;

  /** Signal type */
  type: SignalType;

  /** Original strength at emission (0-1) */
  initialStrength: number;

  /** Current strength after propagation (0-1) */
  currentStrength: number;

  /** Source node ID */
  sourceId: string;

  /** User who emitted the signal */
  emitterId: string;

  /** When the signal was emitted */
  emittedAt: number;

  /** How many hops from source */
  hopCount: number;

  /** Path of node IDs the signal has traveled */
  path: string[];

  /** Custom payload data */
  payload?: unknown;

  /** Time-to-live in milliseconds (null = no expiry) */
  ttl: number | null;
}

/**
 * Configuration for signal emission
 */
export interface SignalEmissionConfig {
  /** Signal type */
  type: SignalType;

  /** Initial strength (0-1) */
  strength?: number;

  /** Payload data */
  payload?: unknown;

  /** Time-to-live in ms */
  ttl?: number;

  /** Maximum hops before signal dies */
  maxHops?: number;

  /** Minimum strength to continue propagation */
  minStrength?: number;
}

// =============================================================================
// Decay Functions
// =============================================================================

/**
 * Decay function types
 */
export type DecayFunctionType =
  | 'exponential' // e^(-k*d)
  | 'linear' // max(0, 1 - k*d)
  | 'inverse' // 1 / (1 + k*d)
  | 'step' // 1 if d < threshold, 0 otherwise
  | 'gaussian' // e^(-d^2 / 2*sigma^2)
  | 'custom'; // User-defined function

/**
 * Configuration for decay functions
 */
export interface DecayConfig {
  /** Decay function type */
  type: DecayFunctionType;

  /** Decay rate constant */
  rate: number;

  /** Threshold for step function */
  threshold?: number;

  /** Sigma for gaussian */
  sigma?: number;

  /** Custom decay function */
  customFn?: (distance: number, config: DecayConfig) => number;
}

/**
 * Multi-dimensional decay configuration
 */
export interface MultiDecayConfig {
  /** Spatial decay (geographic distance) */
  spatial: DecayConfig;

  /** Temporal decay (time since emission) */
  temporal: DecayConfig;

  /** Relational decay (social/trust distance) */
  relational: DecayConfig;

  /** Topological decay (network hops) */
  topological: DecayConfig;

  /** How to combine decay factors */
  combination: 'multiply' | 'min' | 'average' | 'max';
}

// =============================================================================
// Propagation Types
// =============================================================================

/**
 * Propagation algorithm type
 */
export type PropagationAlgorithm =
  | 'flood' // Flood fill to all reachable nodes
  | 'gradient' // Follow strongest connections
  | 'random-walk' // Random walk with bias
  | 'shortest-path' // Shortest path to targets
  | 'diffusion'; // Diffusion-based spreading

/**
 * Propagation configuration
 */
export interface PropagationConfig {
  /** Algorithm to use */
  algorithm: PropagationAlgorithm;

  /** Maximum hops from source */
  maxHops: number;

  /** Minimum signal strength to continue */
  minStrength: number;

  /** Decay configuration */
  decay: MultiDecayConfig;

  /** Whether to aggregate signals at nodes */
  aggregate: boolean;

  /** Aggregation function */
  aggregateFn?: 'sum' | 'max' | 'average' | 'weighted-average';

  /** Rate limiting (signals per second) */
  rateLimit?: number;
}

// =============================================================================
// Resonance Detection
// =============================================================================

/**
 * A detected resonance pattern (multiple users focusing on same area)
 */
export interface Resonance {
  /** Unique identifier */
  id: string;

  /** Center point of resonance */
  center: {
    lat: number;
    lng: number;
  };

  /** Radius of resonance area (meters) */
  radius: number;

  /** Users contributing to this resonance */
  participants: string[];

  /** Strength of resonance (0-1) */
  strength: number;

  /** When resonance was first detected */
  detectedAt: number;

  /** When resonance was last updated */
  updatedAt: number;

  /** Whether participants are connected socially */
  isSerendipitous: boolean;
}

/**
 * Resonance detection configuration
 */
export interface ResonanceConfig {
  /** Minimum participants for resonance */
  minParticipants: number;

  /** Maximum distance between participants (meters) */
  maxDistance: number;

  /** Time window for activity (ms) */
  timeWindow: number;

  /** Minimum strength to report */
  minStrength: number;

  /** Whether to detect only serendipitous (unconnected) resonance */
  serendipitousOnly: boolean;
}

// =============================================================================
// Visualization Types
// =============================================================================

/**
 * Visualization style for nodes
 */
export interface NodeVisualization {
  /** Base color */
  color: string;

  /** Size based on signal strength */
  size: number;

  /** Opacity based on age/relevance */
  opacity: number;

  /** Pulsing animation if active */
  pulse: boolean;

  /** Glow effect for high signal */
  glow: boolean;

  /** Icon to display */
  icon?: string;
}

/**
 * Visualization style for hyphae
 */
export interface HyphaVisualization {
  /** Color (often gradient based on conductance) */
  color: string;

  /** Stroke width based on strength */
  strokeWidth: number;

  /** Opacity */
  opacity: number;

  /** Animated flow direction */
  flowAnimation: boolean;

  /** Dash pattern for different types */
  dashPattern?: number[];
}

/**
 * Visualization style for signals
 */
export interface SignalVisualization {
  /** Color by signal type */
  color: string;

  /** Particle size */
  particleSize: number;

  /** Animation speed */
  speed: number;

  /** Trail effect */
  trail: boolean;
}

// =============================================================================
// Network State
// =============================================================================

/**
 * Complete network state
 */
export interface MyceliumNetworkState {
  /** All nodes in the network */
  nodes: Map<string, MyceliumNode>;

  /** All hyphae in the network */
  hyphae: Map<string, Hypha>;

  /** Active signals */
  activeSignals: Map<string, Signal>;

  /** Detected resonances */
  resonances: Map<string, Resonance>;

  /** Network statistics */
  stats: NetworkStats;

  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  /** Total node count */
  nodeCount: number;

  /** Total hypha count */
  hyphaCount: number;

  /** Active signal count */
  activeSignalCount: number;

  /** Resonance count */
  resonanceCount: number;

  /** Average node signal strength */
  avgNodeStrength: number;

  /** Network density (hyphae / possible connections) */
  density: number;

  /** Most active node */
  mostActiveNodeId?: string;

  /** Hottest area (highest signal concentration) */
  hottestArea?: {
    lat: number;
    lng: number;
    strength: number;
  };
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events emitted by the mycelium network
 */
export type MyceliumEvent =
  | { type: 'node:created'; node: MyceliumNode }
  | { type: 'node:updated'; node: MyceliumNode }
  | { type: 'node:removed'; nodeId: string }
  | { type: 'hypha:created'; hypha: Hypha }
  | { type: 'hypha:updated'; hypha: Hypha }
  | { type: 'hypha:removed'; hyphaId: string }
  | { type: 'signal:emitted'; signal: Signal }
  | { type: 'signal:propagated'; signal: Signal; toNodeId: string }
  | { type: 'signal:expired'; signalId: string }
  | { type: 'resonance:detected'; resonance: Resonance }
  | { type: 'resonance:updated'; resonance: Resonance }
  | { type: 'resonance:faded'; resonanceId: string }
  | { type: 'network:stats-updated'; stats: NetworkStats };

/**
 * Event listener function
 */
export type MyceliumEventListener = (event: MyceliumEvent) => void;
