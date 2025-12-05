/**
 * Spore and Mycelium Growth System
 *
 * Integrates the mycelium network with the discovery game system.
 * Players can plant spores at discovered locations, growing networks
 * that produce fruiting bodies when they connect.
 */

import type {
  Spore,
  SporeType,
  PlantedSpore,
  FruitingBody,
  FruitingBodyType,
  DiscoveryReward,
  GameEvent,
  GameEventListener,
} from './types';
import type { GeohashCommitment } from '../privacy/types';
import type { MyceliumNode, Hypha, Signal, NodeType, HyphaType } from '../mycelium/types';
import { MyceliumNetwork, createMyceliumNetwork } from '../mycelium';

// =============================================================================
// Spore Configuration
// =============================================================================

/**
 * Configuration for the spore system
 */
export interface SporeSystemConfig {
  /** Base growth rate (units per tick) */
  baseGrowthRate: number;

  /** Nutrient decay rate per tick */
  nutrientDecayRate: number;

  /** Distance threshold for spore connection */
  connectionDistance: number;

  /** Minimum network nodes to spawn fruiting body */
  minNodesForFruit: number;

  /** Fruiting body spawn chance when conditions met */
  fruitSpawnChance: number;

  /** Maximum active spores per player */
  maxSporesPerPlayer: number;

  /** Tick interval in milliseconds */
  tickInterval: number;
}

/**
 * Default configuration
 */
export const DEFAULT_SPORE_CONFIG: SporeSystemConfig = {
  baseGrowthRate: 1,
  nutrientDecayRate: 0.1,
  connectionDistance: 100, // meters
  minNodesForFruit: 3,
  fruitSpawnChance: 0.3,
  maxSporesPerPlayer: 10,
  tickInterval: 60000, // 1 minute
};

// =============================================================================
// Spore Templates
// =============================================================================

/**
 * Pre-defined spore templates
 */
export const SPORE_TEMPLATES: Record<SporeType, Omit<Spore, 'id'>> = {
  explorer: {
    type: 'explorer',
    growthRate: 1.5,
    maxReach: 150,
    nutrientCapacity: 100,
    properties: {
      revealRadius: 50,
      speedBoost: 1.2,
    },
    visual: {
      color: '#4ade80',
      pattern: 'radial',
    },
  },
  connector: {
    type: 'connector',
    growthRate: 0.8,
    maxReach: 300,
    nutrientCapacity: 150,
    properties: {
      connectionStrength: 2,
      signalBoost: 1.5,
    },
    visual: {
      color: '#818cf8',
      pattern: 'branching',
    },
  },
  amplifier: {
    type: 'amplifier',
    growthRate: 0.5,
    maxReach: 50,
    nutrientCapacity: 200,
    properties: {
      signalAmplification: 3,
      rangeBoost: 2,
    },
    visual: {
      color: '#fbbf24',
      pattern: 'spiral',
    },
  },
  guardian: {
    type: 'guardian',
    growthRate: 0.3,
    maxReach: 75,
    nutrientCapacity: 300,
    properties: {
      protectionRadius: 100,
      decayResistance: 5,
    },
    visual: {
      color: '#f472b6',
      pattern: 'clustered',
    },
  },
  harvester: {
    type: 'harvester',
    growthRate: 0.6,
    maxReach: 100,
    nutrientCapacity: 120,
    properties: {
      yieldMultiplier: 2,
      harvestSpeed: 1.5,
    },
    visual: {
      color: '#a78bfa',
      pattern: 'branching',
    },
  },
  temporal: {
    type: 'temporal',
    growthRate: 1.0,
    maxReach: 80,
    nutrientCapacity: 80,
    properties: {
      timeShift: 30, // minutes
      phaseChance: 0.1,
    },
    visual: {
      color: '#67e8f9',
      pattern: 'spiral',
    },
  },
  social: {
    type: 'social',
    growthRate: 0.7,
    maxReach: 200,
    nutrientCapacity: 100,
    properties: {
      groupBonus: 1.5,
      connectionRange: 50,
    },
    visual: {
      color: '#fb923c',
      pattern: 'radial',
    },
  },
};

// =============================================================================
// Spore Manager
// =============================================================================

/**
 * Manages spore planting and mycelium growth
 */
export class SporeManager {
  private config: SporeSystemConfig;
  private network: MyceliumNetwork;
  private plantedSpores: Map<string, PlantedSpore> = new Map();
  private fruitingBodies: Map<string, FruitingBody> = new Map();
  private playerSporeCount: Map<string, number> = new Map();
  private listeners: Set<GameEventListener> = new Set();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SporeSystemConfig> = {}) {
    this.config = { ...DEFAULT_SPORE_CONFIG, ...config };
    this.network = createMyceliumNetwork();
  }

  // ===========================================================================
  // Spore Planting
  // ===========================================================================

  /**
   * Create a spore from template
   */
  createSpore(type: SporeType): Spore {
    const template = SPORE_TEMPLATES[type];
    return {
      ...template,
      id: `spore-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
  }

  /**
   * Plant a spore at a location
   */
  async plantSpore(params: {
    spore: Spore;
    locationCommitment: GeohashCommitment;
    planterPubKey: string;
  }): Promise<{ success: boolean; planted?: PlantedSpore; error?: string }> {
    // Check player spore limit
    const currentCount = this.playerSporeCount.get(params.planterPubKey) ?? 0;
    if (currentCount >= this.config.maxSporesPerPlayer) {
      return {
        success: false,
        error: `Maximum ${this.config.maxSporesPerPlayer} active spores allowed`,
      };
    }

    // Create mycelium node at location
    const node = this.network.addNode({
      type: this.sporeTypeToNodeType(params.spore.type),
      position: this.geohashToPosition(params.locationCommitment.geohash),
      strength: params.spore.nutrientCapacity / 100,
      data: {
        sporeId: params.spore.id,
        planterPubKey: params.planterPubKey,
        sporeType: params.spore.type,
      },
    });

    // Create planted spore record
    const planted: PlantedSpore = {
      id: `planted-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      spore: params.spore,
      locationCommitment: params.locationCommitment,
      planterPubKey: params.planterPubKey,
      plantedAt: new Date(),
      nutrients: params.spore.nutrientCapacity,
      nodeId: node.id,
      hyphaIds: [],
    };

    this.plantedSpores.set(planted.id, planted);
    this.playerSporeCount.set(params.planterPubKey, currentCount + 1);

    this.emit({ type: 'spore:planted', spore: planted });

    // Check for nearby spores to connect
    this.attemptConnections(planted);

    return { success: true, planted };
  }

  /**
   * Attempt to connect a newly planted spore with nearby ones
   */
  private attemptConnections(planted: PlantedSpore): void {
    const plantedPosition = this.geohashToPosition(planted.locationCommitment.geohash);

    for (const [id, other] of this.plantedSpores.entries()) {
      if (id === planted.id) continue;
      if (other.nutrients <= 0) continue;

      const otherPosition = this.geohashToPosition(other.locationCommitment.geohash);
      const distance = this.calculateDistance(plantedPosition, otherPosition);

      // Check if within connection range
      const maxRange = Math.min(planted.spore.maxReach, other.spore.maxReach);
      if (distance <= maxRange) {
        // Create hypha connection
        const hypha = this.network.addHypha({
          type: this.getHyphaType(planted.spore.type, other.spore.type),
          fromId: planted.nodeId,
          toId: other.nodeId,
          strength: 0.5,
          data: {
            plantedSporeIds: [planted.id, other.id],
          },
        });

        planted.hyphaIds.push(hypha.id);
        other.hyphaIds.push(hypha.id);

        // Check for fruiting body conditions
        this.checkFruitingConditions(planted);
      }
    }
  }

  /**
   * Map spore type to mycelium node type
   */
  private sporeTypeToNodeType(sporeType: SporeType): NodeType {
    const mapping: Record<SporeType, NodeType> = {
      explorer: 'discovery',
      connector: 'waypoint',
      amplifier: 'poi',
      guardian: 'cluster',
      harvester: 'resource',
      temporal: 'event',
      social: 'person',
    };
    return mapping[sporeType];
  }

  /**
   * Get hypha type based on connected spore types
   */
  private getHyphaType(type1: SporeType, type2: SporeType): HyphaType {
    if (type1 === 'social' || type2 === 'social') return 'social';
    if (type1 === 'temporal' || type2 === 'temporal') return 'temporal';
    if (type1 === 'connector' || type2 === 'connector') return 'route';
    return 'proximity';
  }

  // ===========================================================================
  // Fruiting Bodies
  // ===========================================================================

  /**
   * Check if conditions are met for a fruiting body
   */
  private checkFruitingConditions(spore: PlantedSpore): void {
    // Find all connected spores
    const connected = this.findConnectedSpores(spore.id);

    if (connected.length >= this.config.minNodesForFruit) {
      // Random chance to spawn
      if (Math.random() < this.config.fruitSpawnChance) {
        this.spawnFruitingBody(connected);
      }
    }
  }

  /**
   * Find all spores connected to a given spore
   */
  private findConnectedSpores(sporeId: string): PlantedSpore[] {
    const connected: PlantedSpore[] = [];
    const visited = new Set<string>();
    const queue = [sporeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const spore = this.plantedSpores.get(currentId);
      if (!spore || spore.nutrients <= 0) continue;

      connected.push(spore);

      // Find connections via hyphae
      for (const hyphaId of spore.hyphaIds) {
        const hypha = this.network.getHypha(hyphaId);
        if (hypha) {
          // Find the other node
          const otherNodeId =
            hypha.fromId === spore.nodeId ? hypha.toId : hypha.fromId;

          // Find spore by node ID
          for (const [id, s] of this.plantedSpores.entries()) {
            if (s.nodeId === otherNodeId && !visited.has(id)) {
              queue.push(id);
            }
          }
        }
      }
    }

    return connected;
  }

  /**
   * Spawn a fruiting body from connected spores
   */
  private spawnFruitingBody(spores: PlantedSpore[]): FruitingBody {
    // Determine fruiting body type based on spore composition
    const type = this.determineFruitType(spores);

    // Calculate center position
    const centerGeohash = this.calculateCenterGeohash(spores);

    // Collect contributors
    const contributors = [...new Set(spores.map((s) => s.planterPubKey))];

    // Generate rewards based on type and contributor count
    const rewards = this.generateFruitRewards(type, spores.length, contributors.length);

    // Calculate decay time based on fruit type
    const lifespanMinutes = this.getFruitLifespan(type);
    const now = new Date();

    const fruit: FruitingBody = {
      id: `fruit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      locationCommitment: {
        geohash: centerGeohash,
        hash: '', // Would be calculated
        timestamp: now,
        precision: 7,
      },
      sourceSporeIds: spores.map((s) => s.id),
      harvestableRewards: rewards,
      emergedAt: now,
      decaysAt: new Date(now.getTime() + lifespanMinutes * 60 * 1000),
      maturity: 0,
      contributors,
    };

    this.fruitingBodies.set(fruit.id, fruit);

    this.emit({ type: 'fruit:emerged', fruit });

    // Notify network
    this.network.emit({
      id: `signal-fruit-${fruit.id}`,
      type: 'discovery',
      sourceId: spores[0].nodeId,
      strength: 1,
      timestamp: now,
      data: { fruitId: fruit.id, type },
    });

    return fruit;
  }

  /**
   * Determine fruiting body type from spore composition
   */
  private determineFruitType(spores: PlantedSpore[]): FruitingBodyType {
    const typeCounts: Record<SporeType, number> = {
      explorer: 0,
      connector: 0,
      amplifier: 0,
      guardian: 0,
      harvester: 0,
      temporal: 0,
      social: 0,
    };

    for (const spore of spores) {
      typeCounts[spore.spore.type]++;
    }

    // Legendary fruit: all different types
    const uniqueTypes = Object.values(typeCounts).filter((c) => c > 0).length;
    if (uniqueTypes >= 5) return 'giant';

    // Temporal fruit: mostly temporal spores
    if (typeCounts.temporal >= spores.length * 0.5) return 'temporal';

    // Social/symbiotic: requires multiple contributors
    const contributors = new Set(spores.map((s) => s.planterPubKey)).size;
    if (contributors >= 3) return 'symbiotic';

    // Bioluminescent: amplifier dominant
    if (typeCounts.amplifier >= spores.length * 0.4) return 'bioluminescent';

    // Cluster: guardian dominant
    if (typeCounts.guardian >= spores.length * 0.4) return 'cluster';

    return 'common';
  }

  /**
   * Generate rewards for a fruiting body
   */
  private generateFruitRewards(
    type: FruitingBodyType,
    sporeCount: number,
    contributorCount: number
  ): DiscoveryReward[] {
    const rewards: DiscoveryReward[] = [];

    // Base rewards by type
    const rewardConfig: Record<
      FruitingBodyType,
      { type: DiscoveryReward['type']; rarity: DiscoveryReward['rarity']; quantity: number }
    > = {
      common: { type: 'spore', rarity: 'common', quantity: 2 },
      cluster: { type: 'spore', rarity: 'uncommon', quantity: 3 },
      giant: { type: 'collectible', rarity: 'epic', quantity: 1 },
      bioluminescent: { type: 'hint', rarity: 'rare', quantity: 1 },
      symbiotic: { type: 'points', rarity: 'rare', quantity: 100 * contributorCount },
      temporal: { type: 'experience', rarity: 'uncommon', quantity: 50 },
    };

    const config = rewardConfig[type];

    rewards.push({
      type: config.type,
      rewardId: `fruit-reward-${type}`,
      quantity: config.quantity + Math.floor(sporeCount / 2),
      rarity: config.rarity,
    });

    // Bonus for multiple contributors
    if (contributorCount > 1) {
      rewards.push({
        type: 'points',
        rewardId: 'collaboration-bonus',
        quantity: 25 * contributorCount,
        rarity: 'common',
      });
    }

    return rewards;
  }

  /**
   * Get lifespan for fruit type in minutes
   */
  private getFruitLifespan(type: FruitingBodyType): number {
    const lifespans: Record<FruitingBodyType, number> = {
      common: 60,        // 1 hour
      cluster: 120,      // 2 hours
      giant: 360,        // 6 hours
      bioluminescent: 30, // 30 minutes (rare, must be quick)
      symbiotic: 240,    // 4 hours (need coordination)
      temporal: 15,      // 15 minutes (very brief)
    };
    return lifespans[type];
  }

  /**
   * Harvest a fruiting body
   */
  harvestFruit(
    fruitId: string,
    playerPubKey: string
  ): { success: boolean; rewards?: DiscoveryReward[]; error?: string } {
    const fruit = this.fruitingBodies.get(fruitId);
    if (!fruit) {
      return { success: false, error: 'Fruiting body not found' };
    }

    const now = new Date();
    if (now > fruit.decaysAt) {
      this.fruitingBodies.delete(fruitId);
      return { success: false, error: 'Fruiting body has decayed' };
    }

    if (fruit.maturity < 100) {
      return { success: false, error: 'Fruiting body not mature yet' };
    }

    // Symbiotic fruits require a contributor to harvest
    if (fruit.type === 'symbiotic' && !fruit.contributors.includes(playerPubKey)) {
      return { success: false, error: 'Only contributors can harvest symbiotic fruits' };
    }

    // Collect rewards
    const rewards = [...fruit.harvestableRewards];

    // Remove fruit
    this.fruitingBodies.delete(fruitId);

    this.emit({ type: 'fruit:harvested', fruitId, playerId: playerPubKey });

    return { success: true, rewards };
  }

  // ===========================================================================
  // Growth Simulation
  // ===========================================================================

  /**
   * Start the growth simulation
   */
  startSimulation(): void {
    if (this.tickTimer) return;

    this.tickTimer = setInterval(() => {
      this.tick();
    }, this.config.tickInterval);
  }

  /**
   * Stop the growth simulation
   */
  stopSimulation(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Process one simulation tick
   */
  tick(): void {
    const now = new Date();

    // Update spore nutrients
    for (const [id, spore] of this.plantedSpores.entries()) {
      // Decay nutrients
      spore.nutrients -= this.config.nutrientDecayRate;

      // Check for death
      if (spore.nutrients <= 0) {
        this.removeSpore(id);
        continue;
      }

      // Grow hyphae
      this.growHyphae(spore);
    }

    // Mature fruiting bodies
    for (const [id, fruit] of this.fruitingBodies.entries()) {
      // Check decay
      if (now > fruit.decaysAt) {
        this.fruitingBodies.delete(id);
        continue;
      }

      // Increase maturity
      const ageMs = now.getTime() - fruit.emergedAt.getTime();
      const lifespanMs = fruit.decaysAt.getTime() - fruit.emergedAt.getTime();
      fruit.maturity = Math.min(100, (ageMs / lifespanMs) * 100 * 2); // Mature at 50% lifespan
    }

    // Update network
    this.network.propagateSignals(0.9);
  }

  /**
   * Grow hyphae from a spore
   */
  private growHyphae(spore: PlantedSpore): void {
    const growthRate = spore.spore.growthRate * this.config.baseGrowthRate;

    // Try to extend existing hyphae or create new connections
    for (const hyphaId of spore.hyphaIds) {
      const hypha = this.network.getHypha(hyphaId);
      if (hypha) {
        // Strengthen existing connection
        hypha.strength = Math.min(1, hypha.strength + growthRate * 0.01);
      }
    }
  }

  /**
   * Remove a dead spore
   */
  private removeSpore(sporeId: string): void {
    const spore = this.plantedSpores.get(sporeId);
    if (!spore) return;

    // Remove from network
    this.network.removeNode(spore.nodeId);

    // Update player count
    const count = this.playerSporeCount.get(spore.planterPubKey) ?? 1;
    this.playerSporeCount.set(spore.planterPubKey, Math.max(0, count - 1));

    this.plantedSpores.delete(sporeId);
  }

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  /**
   * Convert geohash to approximate position
   */
  private geohashToPosition(geohash: string): { x: number; y: number } {
    // Simplified conversion - in production, use proper decoding
    let x = 0,
      y = 0;
    for (let i = 0; i < geohash.length; i++) {
      const code = geohash.charCodeAt(i);
      x += code * Math.pow(32, geohash.length - i - 1);
      y += (code * 7) % 100;
    }
    return { x: x % 10000, y: y * 100 };
  }

  /**
   * Calculate distance between positions
   */
  private calculateDistance(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate center geohash of multiple spores
   */
  private calculateCenterGeohash(spores: PlantedSpore[]): string {
    // Simplified - just use first spore's geohash
    // In production, calculate actual center
    return spores[0].locationCommitment.geohash;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get planted spore by ID
   */
  getPlantedSpore(id: string): PlantedSpore | undefined {
    return this.plantedSpores.get(id);
  }

  /**
   * Get all planted spores
   */
  getAllPlantedSpores(): PlantedSpore[] {
    return Array.from(this.plantedSpores.values());
  }

  /**
   * Get player's planted spores
   */
  getPlayerSpores(playerPubKey: string): PlantedSpore[] {
    return Array.from(this.plantedSpores.values()).filter(
      (s) => s.planterPubKey === playerPubKey
    );
  }

  /**
   * Get fruiting body by ID
   */
  getFruitingBody(id: string): FruitingBody | undefined {
    return this.fruitingBodies.get(id);
  }

  /**
   * Get all fruiting bodies
   */
  getAllFruitingBodies(): FruitingBody[] {
    return Array.from(this.fruitingBodies.values());
  }

  /**
   * Get mature fruiting bodies
   */
  getMatureFruits(): FruitingBody[] {
    return Array.from(this.fruitingBodies.values()).filter((f) => f.maturity >= 100);
  }

  /**
   * Get the underlying mycelium network
   */
  getNetwork(): MyceliumNetwork {
    return this.network;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(listener: GameEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in game event listener:', e);
      }
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export state
   */
  export(): string {
    return JSON.stringify({
      plantedSpores: Array.from(this.plantedSpores.entries()),
      fruitingBodies: Array.from(this.fruitingBodies.entries()),
      playerSporeCount: Array.from(this.playerSporeCount.entries()),
    });
  }

  /**
   * Import state
   */
  import(json: string): void {
    const data = JSON.parse(json);
    this.plantedSpores = new Map(data.plantedSpores);
    this.fruitingBodies = new Map(data.fruitingBodies);
    this.playerSporeCount = new Map(data.playerSporeCount);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a spore manager
 */
export function createSporeManager(config?: Partial<SporeSystemConfig>): SporeManager {
  return new SporeManager(config);
}

/**
 * Create a spore from type
 */
export function createSporeFromType(type: SporeType): Spore {
  const template = SPORE_TEMPLATES[type];
  return {
    ...template,
    id: `spore-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
}
