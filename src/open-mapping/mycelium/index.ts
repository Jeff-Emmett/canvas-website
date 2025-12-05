/**
 * Mycelium Network Module
 *
 * A biologically-inspired signal propagation system for collaborative spaces.
 * Models how information, attention, and value flow through a network
 * like nutrients through mycelium.
 *
 * Features:
 * - Nodes: Points of interest, events, people, resources
 * - Hyphae: Connections between nodes
 * - Signals: Information that propagates through the network
 * - Resonance: Detection of convergent attention patterns
 */

// Core types
export * from './types';

// Signal propagation
export {
  applyDecay,
  calculateMultiDecay,
  createSignal,
  isSignalAlive,
  propagateFlood,
  propagateGradient,
  propagateRandomWalk,
  propagateDiffusion,
  propagateSignal,
  aggregateSignals,
  DEFAULT_DECAY_CONFIG,
  DEFAULT_PROPAGATION_CONFIG,
  type PropagationStep,
} from './signals';

// Network management
export {
  MyceliumNetwork,
  createMyceliumNetwork,
  DEFAULT_NETWORK_CONFIG,
  type NetworkConfig,
} from './network';

// Visualization
export {
  NODE_COLORS,
  SIGNAL_COLORS,
  HYPHA_COLORS,
  getNodeVisualization,
  getNodeStyle,
  getHyphaVisualization,
  getHyphaPathAttrs,
  getSignalVisualization,
  getSignalParticleStyle,
  getResonanceVisualization,
  interpolateColor,
  getHeatMapColor,
  getStrengthColor,
  drawNode,
  drawHypha,
  drawResonance,
  getSignalPosition,
  PULSE_KEYFRAMES,
  FLOW_KEYFRAMES,
  RIPPLE_KEYFRAMES,
} from './visualization';
