/**
 * Signal Propagation System for Mycelial Network
 *
 * Implements biologically-inspired signal propagation through a network
 * of nodes connected by hyphae. Signals decay over distance, time, and
 * network topology.
 */

import type {
  Signal,
  SignalType,
  SignalEmissionConfig,
  MyceliumNode,
  Hypha,
  DecayConfig,
  DecayFunctionType,
  MultiDecayConfig,
  PropagationConfig,
  PropagationAlgorithm,
} from './types';

// =============================================================================
// Decay Functions
// =============================================================================

/**
 * Apply a decay function to calculate signal attenuation
 */
export function applyDecay(distance: number, config: DecayConfig): number {
  if (distance < 0) return 1;

  switch (config.type) {
    case 'exponential':
      return Math.exp(-config.rate * distance);

    case 'linear':
      return Math.max(0, 1 - config.rate * distance);

    case 'inverse':
      return 1 / (1 + config.rate * distance);

    case 'step':
      return distance < (config.threshold ?? 1) ? 1 : 0;

    case 'gaussian':
      const sigma = config.sigma ?? 1;
      return Math.exp(-(distance * distance) / (2 * sigma * sigma));

    case 'custom':
      if (config.customFn) {
        return config.customFn(distance, config);
      }
      return 1;

    default:
      return 1;
  }
}

/**
 * Calculate combined decay from multiple factors
 */
export function calculateMultiDecay(
  distances: {
    spatial?: number;
    temporal?: number;
    relational?: number;
    topological?: number;
  },
  config: MultiDecayConfig
): number {
  const factors: number[] = [];

  if (distances.spatial !== undefined) {
    factors.push(applyDecay(distances.spatial, config.spatial));
  }

  if (distances.temporal !== undefined) {
    factors.push(applyDecay(distances.temporal, config.temporal));
  }

  if (distances.relational !== undefined) {
    factors.push(applyDecay(distances.relational, config.relational));
  }

  if (distances.topological !== undefined) {
    factors.push(applyDecay(distances.topological, config.topological));
  }

  if (factors.length === 0) return 1;

  switch (config.combination) {
    case 'multiply':
      return factors.reduce((a, b) => a * b, 1);

    case 'min':
      return Math.min(...factors);

    case 'average':
      return factors.reduce((a, b) => a + b, 0) / factors.length;

    case 'max':
      return Math.max(...factors);

    default:
      return factors.reduce((a, b) => a * b, 1);
  }
}

/**
 * Default decay configuration
 */
export const DEFAULT_DECAY_CONFIG: MultiDecayConfig = {
  spatial: { type: 'inverse', rate: 0.001 }, // 1km = 50% strength
  temporal: { type: 'exponential', rate: 0.0001 }, // ~2 hours half-life
  relational: { type: 'linear', rate: 0.2 }, // 5 hops to zero
  topological: { type: 'inverse', rate: 0.5 }, // Each hop halves
  combination: 'multiply',
};

// =============================================================================
// Signal Creation
// =============================================================================

/**
 * Generate a unique signal ID
 */
function generateSignalId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new signal
 */
export function createSignal(
  sourceId: string,
  emitterId: string,
  config: SignalEmissionConfig
): Signal {
  const strength = config.strength ?? 1;

  return {
    id: generateSignalId(),
    type: config.type,
    initialStrength: strength,
    currentStrength: strength,
    sourceId,
    emitterId,
    emittedAt: Date.now(),
    hopCount: 0,
    path: [sourceId],
    payload: config.payload,
    ttl: config.ttl ?? null,
  };
}

/**
 * Check if a signal is still alive
 */
export function isSignalAlive(signal: Signal, config: PropagationConfig): boolean {
  // Check TTL
  if (signal.ttl !== null && Date.now() - signal.emittedAt > signal.ttl) {
    return false;
  }

  // Check minimum strength
  if (signal.currentStrength < config.minStrength) {
    return false;
  }

  // Check maximum hops
  if (signal.hopCount >= config.maxHops) {
    return false;
  }

  return true;
}

// =============================================================================
// Signal Propagation Algorithms
// =============================================================================

/**
 * Propagation result for a single step
 */
export interface PropagationStep {
  targetNodeId: string;
  signal: Signal;
  viaHyphaId: string;
  decayFactor: number;
}

/**
 * Get neighbors of a node through its hyphae
 */
function getNeighbors(
  nodeId: string,
  nodes: Map<string, MyceliumNode>,
  hyphae: Map<string, Hypha>
): Array<{ nodeId: string; hypha: Hypha }> {
  const node = nodes.get(nodeId);
  if (!node) return [];

  const neighbors: Array<{ nodeId: string; hypha: Hypha }> = [];

  for (const hyphaId of node.hyphae) {
    const hypha = hyphae.get(hyphaId);
    if (!hypha) continue;

    // Find the other end of the hypha
    let otherId: string | null = null;
    if (hypha.sourceId === nodeId) {
      otherId = hypha.targetId;
    } else if (hypha.targetId === nodeId) {
      // Only follow if bidirectional
      if (!hypha.directed) {
        otherId = hypha.sourceId;
      }
    }

    if (otherId && nodes.has(otherId)) {
      neighbors.push({ nodeId: otherId, hypha });
    }
  }

  return neighbors;
}

/**
 * Calculate spatial distance between two nodes
 */
function calculateSpatialDistance(
  node1: MyceliumNode,
  node2: MyceliumNode
): number | undefined {
  if (node1.position && node2.position) {
    // Haversine distance in meters
    const R = 6371000;
    const lat1 = (node1.position.lat * Math.PI) / 180;
    const lat2 = (node2.position.lat * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLng = ((node2.position.lng - node1.position.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  if (node1.canvasPosition && node2.canvasPosition) {
    // Euclidean distance on canvas (arbitrary units)
    const dx = node2.canvasPosition.x - node1.canvasPosition.x;
    const dy = node2.canvasPosition.y - node1.canvasPosition.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return undefined;
}

/**
 * Flood propagation: signal spreads to all reachable nodes
 */
export function propagateFlood(
  signal: Signal,
  currentNodeId: string,
  nodes: Map<string, MyceliumNode>,
  hyphae: Map<string, Hypha>,
  config: PropagationConfig,
  visited: Set<string> = new Set()
): PropagationStep[] {
  const steps: PropagationStep[] = [];
  const currentNode = nodes.get(currentNodeId);
  if (!currentNode) return steps;

  visited.add(currentNodeId);

  const neighbors = getNeighbors(currentNodeId, nodes, hyphae);

  for (const { nodeId: neighborId, hypha } of neighbors) {
    // Skip already visited
    if (visited.has(neighborId)) continue;

    const neighborNode = nodes.get(neighborId);
    if (!neighborNode) continue;

    // Calculate decay
    const spatialDist = calculateSpatialDistance(currentNode, neighborNode);
    const temporalDist = Date.now() - signal.emittedAt;

    const decayFactor = calculateMultiDecay(
      {
        spatial: spatialDist,
        temporal: temporalDist,
        topological: signal.hopCount + 1,
      },
      config.decay
    );

    // Apply hypha conductance
    const effectiveDecay = decayFactor * hypha.conductance;

    // Calculate new strength
    const newStrength = signal.currentStrength * effectiveDecay;

    // Check if signal is still viable
    if (newStrength < config.minStrength) continue;

    // Create propagated signal
    const propagatedSignal: Signal = {
      ...signal,
      currentStrength: newStrength,
      hopCount: signal.hopCount + 1,
      path: [...signal.path, neighborId],
    };

    steps.push({
      targetNodeId: neighborId,
      signal: propagatedSignal,
      viaHyphaId: hypha.id,
      decayFactor: effectiveDecay,
    });
  }

  return steps;
}

/**
 * Gradient propagation: signal follows strongest connections
 */
export function propagateGradient(
  signal: Signal,
  currentNodeId: string,
  nodes: Map<string, MyceliumNode>,
  hyphae: Map<string, Hypha>,
  config: PropagationConfig,
  visited: Set<string> = new Set()
): PropagationStep[] {
  const currentNode = nodes.get(currentNodeId);
  if (!currentNode) return [];

  visited.add(currentNodeId);

  const neighbors = getNeighbors(currentNodeId, nodes, hyphae);

  // Score each neighbor
  const scored = neighbors
    .filter(({ nodeId }) => !visited.has(nodeId))
    .map(({ nodeId, hypha }) => {
      const neighborNode = nodes.get(nodeId);
      if (!neighborNode) return null;

      const spatialDist = calculateSpatialDistance(currentNode, neighborNode);
      const decayFactor =
        calculateMultiDecay(
          {
            spatial: spatialDist,
            topological: signal.hopCount + 1,
          },
          config.decay
        ) * hypha.conductance;

      return {
        nodeId,
        hypha,
        neighborNode,
        score: decayFactor * neighborNode.signalStrength,
        decayFactor,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  // Follow top path(s)
  const steps: PropagationStep[] = [];
  const topCount = Math.max(1, Math.floor(scored.length * 0.3)); // Top 30%

  for (let i = 0; i < topCount && i < scored.length; i++) {
    const { nodeId, hypha, decayFactor } = scored[i];
    const newStrength = signal.currentStrength * decayFactor;

    if (newStrength < config.minStrength) continue;

    const propagatedSignal: Signal = {
      ...signal,
      currentStrength: newStrength,
      hopCount: signal.hopCount + 1,
      path: [...signal.path, nodeId],
    };

    steps.push({
      targetNodeId: nodeId,
      signal: propagatedSignal,
      viaHyphaId: hypha.id,
      decayFactor,
    });
  }

  return steps;
}

/**
 * Random walk propagation: probabilistic path following
 */
export function propagateRandomWalk(
  signal: Signal,
  currentNodeId: string,
  nodes: Map<string, MyceliumNode>,
  hyphae: Map<string, Hypha>,
  config: PropagationConfig,
  visited: Set<string> = new Set()
): PropagationStep[] {
  const currentNode = nodes.get(currentNodeId);
  if (!currentNode) return [];

  visited.add(currentNodeId);

  const neighbors = getNeighbors(currentNodeId, nodes, hyphae).filter(
    ({ nodeId }) => !visited.has(nodeId)
  );

  if (neighbors.length === 0) return [];

  // Calculate weights based on hypha strength and conductance
  const weights = neighbors.map(({ hypha }) => hypha.strength * hypha.conductance);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (totalWeight === 0) return [];

  // Probabilistic selection
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  let selectedIndex = 0;

  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand <= cumulative) {
      selectedIndex = i;
      break;
    }
  }

  const { nodeId, hypha } = neighbors[selectedIndex];
  const neighborNode = nodes.get(nodeId);
  if (!neighborNode) return [];

  const spatialDist = calculateSpatialDistance(currentNode, neighborNode);
  const decayFactor =
    calculateMultiDecay(
      {
        spatial: spatialDist,
        topological: signal.hopCount + 1,
      },
      config.decay
    ) * hypha.conductance;

  const newStrength = signal.currentStrength * decayFactor;

  if (newStrength < config.minStrength) return [];

  const propagatedSignal: Signal = {
    ...signal,
    currentStrength: newStrength,
    hopCount: signal.hopCount + 1,
    path: [...signal.path, nodeId],
  };

  return [
    {
      targetNodeId: nodeId,
      signal: propagatedSignal,
      viaHyphaId: hypha.id,
      decayFactor,
    },
  ];
}

/**
 * Diffusion propagation: signal spreads like heat/concentration gradient
 */
export function propagateDiffusion(
  signal: Signal,
  currentNodeId: string,
  nodes: Map<string, MyceliumNode>,
  hyphae: Map<string, Hypha>,
  config: PropagationConfig,
  _visited: Set<string> = new Set()
): PropagationStep[] {
  const currentNode = nodes.get(currentNodeId);
  if (!currentNode) return [];

  const neighbors = getNeighbors(currentNodeId, nodes, hyphae);
  const steps: PropagationStep[] = [];

  // Distribute signal equally weighted by conductance
  const totalConductance = neighbors.reduce(
    (sum, { hypha }) => sum + hypha.conductance,
    0
  );

  if (totalConductance === 0) return [];

  for (const { nodeId, hypha } of neighbors) {
    const neighborNode = nodes.get(nodeId);
    if (!neighborNode) continue;

    // Fraction of signal that goes this way
    const fraction = hypha.conductance / totalConductance;
    const spatialDist = calculateSpatialDistance(currentNode, neighborNode);

    const decayFactor =
      calculateMultiDecay(
        {
          spatial: spatialDist,
          topological: signal.hopCount + 1,
        },
        config.decay
      ) * fraction;

    const newStrength = signal.currentStrength * decayFactor;

    if (newStrength < config.minStrength) continue;

    const propagatedSignal: Signal = {
      ...signal,
      currentStrength: newStrength,
      hopCount: signal.hopCount + 1,
      path: [...signal.path, nodeId],
    };

    steps.push({
      targetNodeId: nodeId,
      signal: propagatedSignal,
      viaHyphaId: hypha.id,
      decayFactor,
    });
  }

  return steps;
}

/**
 * Main propagation dispatcher
 */
export function propagateSignal(
  signal: Signal,
  currentNodeId: string,
  nodes: Map<string, MyceliumNode>,
  hyphae: Map<string, Hypha>,
  config: PropagationConfig,
  visited: Set<string> = new Set()
): PropagationStep[] {
  switch (config.algorithm) {
    case 'flood':
      return propagateFlood(signal, currentNodeId, nodes, hyphae, config, visited);

    case 'gradient':
      return propagateGradient(signal, currentNodeId, nodes, hyphae, config, visited);

    case 'random-walk':
      return propagateRandomWalk(signal, currentNodeId, nodes, hyphae, config, visited);

    case 'diffusion':
      return propagateDiffusion(signal, currentNodeId, nodes, hyphae, config, visited);

    case 'shortest-path':
      // For shortest path, we'd need target(s) specified
      // Fall back to flood for now
      return propagateFlood(signal, currentNodeId, nodes, hyphae, config, visited);

    default:
      return propagateFlood(signal, currentNodeId, nodes, hyphae, config, visited);
  }
}

// =============================================================================
// Signal Aggregation
// =============================================================================

/**
 * Aggregate multiple signals at a node
 */
export function aggregateSignals(
  signals: Signal[],
  method: 'sum' | 'max' | 'average' | 'weighted-average' = 'sum'
): number {
  if (signals.length === 0) return 0;

  const strengths = signals.map((s) => s.currentStrength);

  switch (method) {
    case 'sum':
      return Math.min(1, strengths.reduce((a, b) => a + b, 0));

    case 'max':
      return Math.max(...strengths);

    case 'average':
      return strengths.reduce((a, b) => a + b, 0) / strengths.length;

    case 'weighted-average':
      // Weight by recency
      const now = Date.now();
      let totalWeight = 0;
      let weightedSum = 0;

      for (const signal of signals) {
        const age = now - signal.emittedAt;
        const weight = Math.exp(-age / 60000); // 1 minute decay
        totalWeight += weight;
        weightedSum += signal.currentStrength * weight;
      }

      return totalWeight > 0 ? weightedSum / totalWeight : 0;

    default:
      return Math.min(1, strengths.reduce((a, b) => a + b, 0));
  }
}

/**
 * Default propagation configuration
 */
export const DEFAULT_PROPAGATION_CONFIG: PropagationConfig = {
  algorithm: 'flood',
  maxHops: 10,
  minStrength: 0.01,
  decay: DEFAULT_DECAY_CONFIG,
  aggregate: true,
  aggregateFn: 'sum',
};
