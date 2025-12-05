/**
 * Mycelial Network Manager
 *
 * Central coordinator for the mycelium network. Manages nodes, hyphae,
 * signal propagation, and resonance detection.
 */

import type {
  MyceliumNode,
  NodeType,
  Hypha,
  HyphaType,
  Signal,
  SignalEmissionConfig,
  PropagationConfig,
  ResonanceConfig,
  Resonance,
  MyceliumNetworkState,
  NetworkStats,
  MyceliumEvent,
  MyceliumEventListener,
} from './types';
import {
  createSignal,
  propagateSignal,
  aggregateSignals,
  isSignalAlive,
  DEFAULT_PROPAGATION_CONFIG,
  PropagationStep,
} from './signals';

// =============================================================================
// Network Manager
// =============================================================================

/**
 * Configuration for the network manager
 */
export interface NetworkConfig {
  /** Propagation settings */
  propagation: PropagationConfig;

  /** Resonance detection settings */
  resonance: ResonanceConfig;

  /** How often to run maintenance (ms) */
  maintenanceInterval: number;

  /** How often to update stats (ms) */
  statsInterval: number;

  /** Maximum active signals */
  maxActiveSignals: number;

  /** Node expiration time (ms, 0 = never) */
  nodeExpiration: number;
}

/**
 * Default network configuration
 */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  propagation: DEFAULT_PROPAGATION_CONFIG,
  resonance: {
    minParticipants: 2,
    maxDistance: 1000, // 1km
    timeWindow: 300000, // 5 minutes
    minStrength: 0.3,
    serendipitousOnly: false,
  },
  maintenanceInterval: 10000, // 10 seconds
  statsInterval: 5000, // 5 seconds
  maxActiveSignals: 1000,
  nodeExpiration: 0, // Never expire by default
};

/**
 * The Mycelial Network Manager
 */
export class MyceliumNetwork {
  private nodes: Map<string, MyceliumNode> = new Map();
  private hyphae: Map<string, Hypha> = new Map();
  private activeSignals: Map<string, Signal> = new Map();
  private resonances: Map<string, Resonance> = new Map();
  private signalQueue: Signal[] = [];
  private nodeSignals: Map<string, Signal[]> = new Map(); // Signals at each node
  private listeners: Set<MyceliumEventListener> = new Set();
  private config: NetworkConfig;
  private maintenanceTimer?: ReturnType<typeof setInterval>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private stats: NetworkStats = {
    nodeCount: 0,
    hyphaCount: 0,
    activeSignalCount: 0,
    resonanceCount: 0,
    avgNodeStrength: 0,
    density: 0,
  };

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_CONFIG, ...config };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the network (background processing)
   */
  start(): void {
    // Maintenance loop: clean up expired signals, nodes
    this.maintenanceTimer = setInterval(
      () => this.runMaintenance(),
      this.config.maintenanceInterval
    );

    // Stats loop: update network statistics
    this.statsTimer = setInterval(
      () => this.updateStats(),
      this.config.statsInterval
    );
  }

  /**
   * Stop the network
   */
  stop(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
  }

  /**
   * Get current network state
   */
  getState(): MyceliumNetworkState {
    return {
      nodes: new Map(this.nodes),
      hyphae: new Map(this.hyphae),
      activeSignals: new Map(this.activeSignals),
      resonances: new Map(this.resonances),
      stats: { ...this.stats },
      lastUpdate: Date.now(),
    };
  }

  // ===========================================================================
  // Node Management
  // ===========================================================================

  /**
   * Create a new node
   */
  createNode(params: {
    type: NodeType;
    label: string;
    position?: { lat: number; lng: number };
    canvasPosition?: { x: number; y: number };
    metadata?: Record<string, unknown>;
    ownerId?: string;
    tags?: string[];
  }): MyceliumNode {
    const now = Date.now();
    const node: MyceliumNode = {
      id: this.generateId('node'),
      type: params.type,
      label: params.label,
      position: params.position,
      canvasPosition: params.canvasPosition,
      createdAt: now,
      lastActiveAt: now,
      signalStrength: 0,
      receivedSignal: 0,
      metadata: params.metadata ?? {},
      hyphae: [],
      ownerId: params.ownerId,
      tags: params.tags ?? [],
    };

    this.nodes.set(node.id, node);
    this.nodeSignals.set(node.id, []);
    this.emit({ type: 'node:created', node });

    return node;
  }

  /**
   * Update a node
   */
  updateNode(nodeId: string, updates: Partial<MyceliumNode>): MyceliumNode | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const updated = { ...node, ...updates, id: nodeId, lastActiveAt: Date.now() };
    this.nodes.set(nodeId, updated);
    this.emit({ type: 'node:updated', node: updated });

    return updated;
  }

  /**
   * Remove a node
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove all connected hyphae
    for (const hyphaId of [...node.hyphae]) {
      this.removeHypha(hyphaId);
    }

    this.nodes.delete(nodeId);
    this.nodeSignals.delete(nodeId);
    this.emit({ type: 'node:removed', nodeId });

    return true;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): MyceliumNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): MyceliumNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Find nodes by criteria
   */
  findNodes(criteria: {
    type?: NodeType;
    ownerId?: string;
    tags?: string[];
    withinRadius?: { lat: number; lng: number; meters: number };
  }): MyceliumNode[] {
    return Array.from(this.nodes.values()).filter((node) => {
      if (criteria.type && node.type !== criteria.type) return false;
      if (criteria.ownerId && node.ownerId !== criteria.ownerId) return false;
      if (criteria.tags && !criteria.tags.every((t) => node.tags.includes(t))) {
        return false;
      }
      if (criteria.withinRadius && node.position) {
        const dist = this.haversineDistance(
          node.position.lat,
          node.position.lng,
          criteria.withinRadius.lat,
          criteria.withinRadius.lng
        );
        if (dist > criteria.withinRadius.meters) return false;
      }
      return true;
    });
  }

  // ===========================================================================
  // Hypha Management
  // ===========================================================================

  /**
   * Create a connection between nodes
   */
  createHypha(params: {
    type: HyphaType;
    sourceId: string;
    targetId: string;
    strength?: number;
    directed?: boolean;
    conductance?: number;
    metadata?: Record<string, unknown>;
  }): Hypha | null {
    const source = this.nodes.get(params.sourceId);
    const target = this.nodes.get(params.targetId);

    if (!source || !target) return null;

    const hypha: Hypha = {
      id: this.generateId('hypha'),
      type: params.type,
      sourceId: params.sourceId,
      targetId: params.targetId,
      strength: params.strength ?? 1,
      directed: params.directed ?? false,
      conductance: params.conductance ?? 1,
      createdAt: Date.now(),
      metadata: params.metadata ?? {},
    };

    this.hyphae.set(hypha.id, hypha);

    // Update node connections
    source.hyphae.push(hypha.id);
    target.hyphae.push(hypha.id);

    this.emit({ type: 'hypha:created', hypha });

    return hypha;
  }

  /**
   * Update a hypha
   */
  updateHypha(hyphaId: string, updates: Partial<Hypha>): Hypha | null {
    const hypha = this.hyphae.get(hyphaId);
    if (!hypha) return null;

    const updated = { ...hypha, ...updates, id: hyphaId };
    this.hyphae.set(hyphaId, updated);
    this.emit({ type: 'hypha:updated', hypha: updated });

    return updated;
  }

  /**
   * Remove a hypha
   */
  removeHypha(hyphaId: string): boolean {
    const hypha = this.hyphae.get(hyphaId);
    if (!hypha) return false;

    // Remove from connected nodes
    const source = this.nodes.get(hypha.sourceId);
    const target = this.nodes.get(hypha.targetId);

    if (source) {
      source.hyphae = source.hyphae.filter((id) => id !== hyphaId);
    }
    if (target) {
      target.hyphae = target.hyphae.filter((id) => id !== hyphaId);
    }

    this.hyphae.delete(hyphaId);
    this.emit({ type: 'hypha:removed', hyphaId });

    return true;
  }

  /**
   * Get hyphae connected to a node
   */
  getNodeHyphae(nodeId: string): Hypha[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    return node.hyphae
      .map((id) => this.hyphae.get(id))
      .filter((h): h is Hypha => h !== undefined);
  }

  // ===========================================================================
  // Signal Management
  // ===========================================================================

  /**
   * Emit a signal from a node
   */
  emitSignal(
    sourceNodeId: string,
    emitterId: string,
    config: SignalEmissionConfig
  ): Signal | null {
    const sourceNode = this.nodes.get(sourceNodeId);
    if (!sourceNode) return null;

    // Check signal limit
    if (this.activeSignals.size >= this.config.maxActiveSignals) {
      // Remove oldest signal
      const oldest = Array.from(this.activeSignals.values()).sort(
        (a, b) => a.emittedAt - b.emittedAt
      )[0];
      if (oldest) {
        this.removeSignal(oldest.id);
      }
    }

    const signal = createSignal(sourceNodeId, emitterId, config);

    this.activeSignals.set(signal.id, signal);

    // Add to source node's signals
    const nodeSignals = this.nodeSignals.get(sourceNodeId) ?? [];
    nodeSignals.push(signal);
    this.nodeSignals.set(sourceNodeId, nodeSignals);

    // Update source node
    sourceNode.signalStrength = Math.min(1, sourceNode.signalStrength + signal.currentStrength);
    sourceNode.lastActiveAt = Date.now();

    this.emit({ type: 'signal:emitted', signal });

    // Queue for propagation
    this.signalQueue.push(signal);

    // Process queue
    this.processSignalQueue();

    return signal;
  }

  /**
   * Process queued signals
   */
  private processSignalQueue(): void {
    while (this.signalQueue.length > 0) {
      const signal = this.signalQueue.shift()!;

      if (!isSignalAlive(signal, this.config.propagation)) {
        continue;
      }

      const currentNodeId = signal.path[signal.path.length - 1];
      const visited = new Set(signal.path);

      const steps = propagateSignal(
        signal,
        currentNodeId,
        this.nodes,
        this.hyphae,
        this.config.propagation,
        visited
      );

      for (const step of steps) {
        this.applyPropagationStep(step);
      }
    }
  }

  /**
   * Apply a propagation step
   */
  private applyPropagationStep(step: PropagationStep): void {
    const { targetNodeId, signal, viaHyphaId } = step;

    const targetNode = this.nodes.get(targetNodeId);
    if (!targetNode) return;

    // Add signal to node
    const nodeSignals = this.nodeSignals.get(targetNodeId) ?? [];
    nodeSignals.push(signal);
    this.nodeSignals.set(targetNodeId, nodeSignals);

    // Aggregate signals and update node
    if (this.config.propagation.aggregate) {
      const aggregated = aggregateSignals(
        nodeSignals,
        this.config.propagation.aggregateFn
      );
      targetNode.receivedSignal = aggregated;
    } else {
      targetNode.receivedSignal = signal.currentStrength;
    }

    targetNode.lastActiveAt = Date.now();

    // Update hypha (mark signal flow)
    const hypha = this.hyphae.get(viaHyphaId);
    if (hypha) {
      hypha.lastSignalAt = Date.now();
    }

    this.emit({ type: 'signal:propagated', signal, toNodeId: targetNodeId });

    // Continue propagation if alive
    if (isSignalAlive(signal, this.config.propagation)) {
      this.signalQueue.push(signal);
    }
  }

  /**
   * Remove a signal
   */
  removeSignal(signalId: string): boolean {
    const signal = this.activeSignals.get(signalId);
    if (!signal) return false;

    this.activeSignals.delete(signalId);

    // Remove from all nodes
    for (const [nodeId, signals] of this.nodeSignals) {
      const filtered = signals.filter((s) => s.id !== signalId);
      if (filtered.length !== signals.length) {
        this.nodeSignals.set(nodeId, filtered);

        // Update node strength
        const node = this.nodes.get(nodeId);
        if (node) {
          node.receivedSignal = aggregateSignals(
            filtered,
            this.config.propagation.aggregateFn
          );
        }
      }
    }

    this.emit({ type: 'signal:expired', signalId });

    return true;
  }

  // ===========================================================================
  // Resonance Detection
  // ===========================================================================

  /**
   * Detect resonance patterns in the network
   */
  detectResonance(): Resonance[] {
    const config = this.config.resonance;
    const now = Date.now();
    const newResonances: Resonance[] = [];

    // Get recently active nodes
    const activeNodes = Array.from(this.nodes.values()).filter(
      (n) => n.position && now - n.lastActiveAt < config.timeWindow
    );

    // Group by geographic proximity
    const clusters = this.clusterByProximity(activeNodes, config.maxDistance);

    for (const cluster of clusters) {
      if (cluster.length < config.minParticipants) continue;

      // Get unique owners
      const participants = [...new Set(cluster.map((n) => n.ownerId).filter(Boolean) as string[])];
      if (participants.length < config.minParticipants) continue;

      // Check if serendipitous (unconnected)
      const isSerendipitous = !this.areNodesConnected(cluster.map((n) => n.id));

      if (config.serendipitousOnly && !isSerendipitous) continue;

      // Calculate center and strength
      const center = this.calculateCentroid(cluster);
      const strength = this.calculateResonanceStrength(cluster);

      if (strength < config.minStrength) continue;

      // Check for existing resonance in this area
      const existingId = this.findExistingResonance(center, config.maxDistance);

      if (existingId) {
        // Update existing
        const existing = this.resonances.get(existingId)!;
        existing.participants = participants;
        existing.strength = strength;
        existing.updatedAt = now;
        existing.isSerendipitous = isSerendipitous;

        this.emit({ type: 'resonance:updated', resonance: existing });
      } else {
        // Create new
        const resonance: Resonance = {
          id: this.generateId('resonance'),
          center,
          radius: config.maxDistance,
          participants,
          strength,
          detectedAt: now,
          updatedAt: now,
          isSerendipitous,
        };

        this.resonances.set(resonance.id, resonance);
        newResonances.push(resonance);

        this.emit({ type: 'resonance:detected', resonance });
      }
    }

    return newResonances;
  }

  /**
   * Check if nodes are connected
   */
  private areNodesConnected(nodeIds: string[]): boolean {
    if (nodeIds.length < 2) return true;

    // BFS from first node
    const visited = new Set<string>();
    const queue = [nodeIds[0]];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      for (const hyphaId of node.hyphae) {
        const hypha = this.hyphae.get(hyphaId);
        if (!hypha) continue;

        const other = hypha.sourceId === current ? hypha.targetId : hypha.sourceId;
        if (nodeIds.includes(other) && !visited.has(other)) {
          queue.push(other);
        }
      }
    }

    // Check if all nodes were reached
    return nodeIds.every((id) => visited.has(id));
  }

  /**
   * Cluster nodes by proximity
   */
  private clusterByProximity(
    nodes: MyceliumNode[],
    maxDistance: number
  ): MyceliumNode[][] {
    const clusters: MyceliumNode[][] = [];
    const assigned = new Set<string>();

    for (const node of nodes) {
      if (assigned.has(node.id)) continue;
      if (!node.position) continue;

      const cluster = [node];
      assigned.add(node.id);

      // Find nearby nodes
      for (const other of nodes) {
        if (assigned.has(other.id)) continue;
        if (!other.position) continue;

        const dist = this.haversineDistance(
          node.position.lat,
          node.position.lng,
          other.position.lat,
          other.position.lng
        );

        if (dist <= maxDistance) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }

      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Calculate centroid of nodes
   */
  private calculateCentroid(nodes: MyceliumNode[]): { lat: number; lng: number } {
    const positions = nodes
      .map((n) => n.position)
      .filter((p): p is { lat: number; lng: number } => p !== undefined);

    if (positions.length === 0) {
      return { lat: 0, lng: 0 };
    }

    const sumLat = positions.reduce((s, p) => s + p.lat, 0);
    const sumLng = positions.reduce((s, p) => s + p.lng, 0);

    return {
      lat: sumLat / positions.length,
      lng: sumLng / positions.length,
    };
  }

  /**
   * Calculate resonance strength
   */
  private calculateResonanceStrength(nodes: MyceliumNode[]): number {
    if (nodes.length === 0) return 0;

    // Average signal strength + bonus for more participants
    const avgStrength =
      nodes.reduce((s, n) => s + n.signalStrength + n.receivedSignal, 0) /
      nodes.length;
    const participantBonus = Math.min(1, nodes.length / 10);

    return Math.min(1, avgStrength + participantBonus * 0.3);
  }

  /**
   * Find existing resonance near a point
   */
  private findExistingResonance(
    center: { lat: number; lng: number },
    maxDistance: number
  ): string | null {
    for (const [id, resonance] of this.resonances) {
      const dist = this.haversineDistance(
        center.lat,
        center.lng,
        resonance.center.lat,
        resonance.center.lng
      );
      if (dist <= maxDistance) {
        return id;
      }
    }
    return null;
  }

  // ===========================================================================
  // Maintenance
  // ===========================================================================

  /**
   * Run network maintenance
   */
  private runMaintenance(): void {
    const now = Date.now();

    // Remove expired signals
    for (const [id, signal] of this.activeSignals) {
      if (!isSignalAlive(signal, this.config.propagation)) {
        this.removeSignal(id);
      }
    }

    // Fade old node signals
    for (const node of this.nodes.values()) {
      // Decay signal strength over time
      const timeSinceActive = now - node.lastActiveAt;
      const decay = Math.exp(-timeSinceActive / 60000); // 1 minute half-life
      node.signalStrength *= decay;
      node.receivedSignal *= decay;
    }

    // Remove stale resonances
    for (const [id, resonance] of this.resonances) {
      const age = now - resonance.updatedAt;
      if (age > this.config.resonance.timeWindow * 2) {
        this.resonances.delete(id);
        this.emit({ type: 'resonance:faded', resonanceId: id });
      }
    }

    // Expire old nodes if configured
    if (this.config.nodeExpiration > 0) {
      for (const [id, node] of this.nodes) {
        if (now - node.lastActiveAt > this.config.nodeExpiration) {
          if (node.type === 'ghost') {
            this.removeNode(id);
          } else {
            // Convert to ghost
            node.type = 'ghost';
            this.emit({ type: 'node:updated', node });
          }
        }
      }
    }

    // Detect resonances
    this.detectResonance();
  }

  /**
   * Update network statistics
   */
  private updateStats(): void {
    const nodes = Array.from(this.nodes.values());
    const nodeCount = nodes.length;
    const hyphaCount = this.hyphae.size;

    // Calculate density
    const possibleConnections = (nodeCount * (nodeCount - 1)) / 2;
    const density = possibleConnections > 0 ? hyphaCount / possibleConnections : 0;

    // Calculate average strength
    const avgStrength =
      nodeCount > 0
        ? nodes.reduce((s, n) => s + n.signalStrength + n.receivedSignal, 0) /
          nodeCount
        : 0;

    // Find most active node
    let mostActiveNode: MyceliumNode | undefined;
    let maxActivity = 0;

    for (const node of nodes) {
      const activity = node.signalStrength + node.receivedSignal;
      if (activity > maxActivity) {
        maxActivity = activity;
        mostActiveNode = node;
      }
    }

    // Find hottest area
    const hotNodes = nodes
      .filter((n) => n.position)
      .sort(
        (a, b) =>
          b.signalStrength + b.receivedSignal - (a.signalStrength + a.receivedSignal)
      )
      .slice(0, 10);

    const hottestArea =
      hotNodes.length > 0
        ? {
            ...this.calculateCentroid(hotNodes),
            strength: hotNodes[0].signalStrength + hotNodes[0].receivedSignal,
          }
        : undefined;

    this.stats = {
      nodeCount,
      hyphaCount,
      activeSignalCount: this.activeSignals.size,
      resonanceCount: this.resonances.size,
      avgNodeStrength: avgStrength,
      density,
      mostActiveNodeId: mostActiveNode?.id,
      hottestArea,
    };

    this.emit({ type: 'network:stats-updated', stats: this.stats });
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to network events
   */
  on(listener: MyceliumEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(event: MyceliumEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in mycelium event listener:', e);
      }
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Haversine distance between two points (meters)
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export network to JSON
   */
  export(): {
    nodes: MyceliumNode[];
    hyphae: Hypha[];
    signals: Signal[];
    resonances: Resonance[];
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      hyphae: Array.from(this.hyphae.values()),
      signals: Array.from(this.activeSignals.values()),
      resonances: Array.from(this.resonances.values()),
    };
  }

  /**
   * Import network from JSON
   */
  import(data: {
    nodes: MyceliumNode[];
    hyphae: Hypha[];
    signals?: Signal[];
    resonances?: Resonance[];
  }): void {
    this.nodes.clear();
    this.hyphae.clear();
    this.activeSignals.clear();
    this.resonances.clear();
    this.nodeSignals.clear();

    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      this.nodeSignals.set(node.id, []);
    }

    for (const hypha of data.hyphae) {
      this.hyphae.set(hypha.id, hypha);
    }

    if (data.signals) {
      for (const signal of data.signals) {
        this.activeSignals.set(signal.id, signal);
      }
    }

    if (data.resonances) {
      for (const resonance of data.resonances) {
        this.resonances.set(resonance.id, resonance);
      }
    }

    this.updateStats();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new mycelium network with default configuration
 */
export function createMyceliumNetwork(
  config?: Partial<NetworkConfig>
): MyceliumNetwork {
  return new MyceliumNetwork(config);
}
