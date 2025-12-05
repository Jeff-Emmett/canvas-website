/**
 * Discovery Anchor Management
 *
 * Create, manage, and verify discovery anchors - the hidden or
 * semi-hidden locations that players can discover using zkGPS proofs.
 */

import type {
  DiscoveryAnchor,
  AnchorType,
  AnchorVisibility,
  AnchorHint,
  DiscoveryReward,
  IoTRequirement,
  SocialRequirement,
  HintContent,
  HintRevealCondition,
  Discovery,
  NavigationHint,
  GameEvent,
  GameEventListener,
} from './types';
import { TEMPERATURE_THRESHOLDS } from './types';
import type { GeohashCommitment, ProximityProof } from '../privacy/types';
import {
  createCommitment,
  verifyCommitment,
  generateProximityProof,
  verifyProximityProof,
} from '../privacy';

// =============================================================================
// Anchor Manager
// =============================================================================

/**
 * Configuration for anchor manager
 */
export interface AnchorManagerConfig {
  /** Default precision required for discovery */
  defaultPrecision: number;

  /** Maximum hints per anchor */
  maxHintsPerAnchor: number;

  /** Allow IoT-free discoveries */
  allowVirtualDiscoveries: boolean;

  /** Minimum time between discoveries at same anchor */
  cooldownSeconds: number;
}

/**
 * Default configuration
 */
export const DEFAULT_ANCHOR_CONFIG: AnchorManagerConfig = {
  defaultPrecision: 7, // ~76m accuracy
  maxHintsPerAnchor: 10,
  allowVirtualDiscoveries: true,
  cooldownSeconds: 60,
};

/**
 * Manages discovery anchors
 */
export class AnchorManager {
  private config: AnchorManagerConfig;
  private anchors: Map<string, DiscoveryAnchor> = new Map();
  private discoveries: Map<string, Discovery[]> = new Map(); // anchorId -> discoveries
  private listeners: Set<GameEventListener> = new Set();

  constructor(config: Partial<AnchorManagerConfig> = {}) {
    this.config = { ...DEFAULT_ANCHOR_CONFIG, ...config };
  }

  // ===========================================================================
  // Anchor Creation
  // ===========================================================================

  /**
   * Create a new discovery anchor
   */
  async createAnchor(params: {
    name: string;
    description: string;
    type: AnchorType;
    visibility: AnchorVisibility;
    latitude: number;
    longitude: number;
    precision?: number;
    creatorPubKey: string;
    creatorPrivKey: string;
    activeWindow?: DiscoveryAnchor['activeWindow'];
    iotRequirements?: IoTRequirement[];
    socialRequirements?: SocialRequirement;
    rewards?: DiscoveryReward[];
    hints?: AnchorHint[];
    prerequisites?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<DiscoveryAnchor> {
    const id = `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create zkGPS commitment for the location
    const locationCommitment = await createCommitment(
      params.latitude,
      params.longitude,
      12, // Full precision internally
      params.creatorPubKey,
      params.creatorPrivKey
    );

    const anchor: DiscoveryAnchor = {
      id,
      name: params.name,
      description: params.description,
      type: params.type,
      visibility: params.visibility,
      locationCommitment,
      requiredPrecision: params.precision ?? this.config.defaultPrecision,
      activeWindow: params.activeWindow,
      iotRequirements: params.iotRequirements,
      socialRequirements: params.socialRequirements,
      rewards: params.rewards ?? [],
      hints: params.hints ?? [],
      prerequisites: params.prerequisites ?? [],
      metadata: params.metadata ?? {},
      creatorPubKey: params.creatorPubKey,
      createdAt: new Date(),
    };

    this.anchors.set(id, anchor);
    this.discoveries.set(id, []);

    this.emit({ type: 'anchor:created', anchor });

    return anchor;
  }

  /**
   * Add a hint to an anchor
   */
  addHint(anchorId: string, hint: Omit<AnchorHint, 'id'>): AnchorHint | null {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return null;

    if (anchor.hints.length >= this.config.maxHintsPerAnchor) {
      return null;
    }

    const fullHint: AnchorHint = {
      ...hint,
      id: `hint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    anchor.hints.push(fullHint);
    return fullHint;
  }

  /**
   * Add rewards to an anchor
   */
  addReward(anchorId: string, reward: DiscoveryReward): boolean {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return false;

    anchor.rewards.push(reward);
    return true;
  }

  // ===========================================================================
  // Discovery Verification
  // ===========================================================================

  /**
   * Attempt to discover an anchor
   */
  async attemptDiscovery(params: {
    anchorId: string;
    playerPubKey: string;
    playerPrivKey: string;
    playerLatitude: number;
    playerLongitude: number;
    iotVerification?: Discovery['iotVerification'];
    groupDiscovery?: Discovery['groupDiscovery'];
  }): Promise<{ success: boolean; discovery?: Discovery; error?: string }> {
    const anchor = this.anchors.get(params.anchorId);
    if (!anchor) {
      return { success: false, error: 'Anchor not found' };
    }

    // Check prerequisites
    const prereqCheck = this.checkPrerequisites(anchor, params.playerPubKey);
    if (!prereqCheck.met) {
      return { success: false, error: `Missing prerequisites: ${prereqCheck.missing.join(', ')}` };
    }

    // Check time window
    if (anchor.activeWindow) {
      const now = new Date();
      if (now < anchor.activeWindow.start || now > anchor.activeWindow.end) {
        return { success: false, error: 'Anchor not active at this time' };
      }
    }

    // Check IoT requirements
    if (anchor.iotRequirements && anchor.iotRequirements.length > 0) {
      if (!params.iotVerification) {
        return { success: false, error: 'IoT verification required' };
      }
      const iotValid = this.verifyIoT(anchor.iotRequirements, params.iotVerification);
      if (!iotValid) {
        return { success: false, error: 'IoT verification failed' };
      }
    }

    // Check social requirements
    if (anchor.socialRequirements) {
      if (!params.groupDiscovery) {
        return { success: false, error: 'Group discovery required' };
      }
      const socialValid = this.verifySocialRequirements(
        anchor.socialRequirements,
        params.groupDiscovery
      );
      if (!socialValid.valid) {
        return { success: false, error: socialValid.error };
      }
    }

    // Generate proximity proof
    const proximityProof = await generateProximityProof(
      params.playerLatitude,
      params.playerLongitude,
      anchor.locationCommitment,
      anchor.requiredPrecision,
      params.playerPubKey,
      params.playerPrivKey
    );

    // Verify proximity
    const proofValid = await verifyProximityProof(
      proximityProof,
      anchor.locationCommitment,
      params.playerPubKey
    );

    if (!proofValid) {
      return { success: false, error: 'Not close enough to anchor' };
    }

    // Check cooldown
    const existingDiscoveries = this.discoveries.get(params.anchorId) ?? [];
    const playerDiscoveries = existingDiscoveries.filter(
      (d) => d.playerPubKey === params.playerPubKey
    );
    if (playerDiscoveries.length > 0) {
      const lastDiscovery = playerDiscoveries[playerDiscoveries.length - 1];
      const timeSince = Date.now() - lastDiscovery.timestamp.getTime();
      if (timeSince < this.config.cooldownSeconds * 1000) {
        return { success: false, error: 'Discovery cooldown active' };
      }
    }

    // Create discovery record
    const isFirstFinder = existingDiscoveries.length === 0;
    const discoveryOrder = existingDiscoveries.length + 1;

    const discovery: Discovery = {
      id: `discovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      anchorId: params.anchorId,
      playerPubKey: params.playerPubKey,
      proximityProof,
      iotVerification: params.iotVerification,
      groupDiscovery: params.groupDiscovery,
      timestamp: new Date(),
      isFirstFinder,
      discoveryOrder,
      rewardsClaimed: [],
      playerSignature: await this.signDiscovery(params.playerPrivKey, params.anchorId),
    };

    existingDiscoveries.push(discovery);
    this.discoveries.set(params.anchorId, existingDiscoveries);

    this.emit({ type: 'anchor:discovered', discovery });
    if (isFirstFinder) {
      this.emit({ type: 'anchor:firstFind', discovery, rank: 1 });
    }

    return { success: true, discovery };
  }

  /**
   * Check if prerequisites are met
   */
  private checkPrerequisites(
    anchor: DiscoveryAnchor,
    playerPubKey: string
  ): { met: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const prereqId of anchor.prerequisites) {
      const prereqDiscoveries = this.discoveries.get(prereqId) ?? [];
      const hasDiscovered = prereqDiscoveries.some((d) => d.playerPubKey === playerPubKey);
      if (!hasDiscovered) {
        missing.push(prereqId);
      }
    }

    return { met: missing.length === 0, missing };
  }

  /**
   * Verify IoT requirements
   */
  private verifyIoT(
    requirements: IoTRequirement[],
    verification: Discovery['iotVerification']
  ): boolean {
    if (!verification) return false;

    for (const req of requirements) {
      if (req.type !== verification.type) continue;

      // Check challenge response if required
      if (req.expectedResponseHash && verification.challengeResponse) {
        // In real implementation, hash the response and compare
        // For now, just check it exists
        if (!verification.challengeResponse) return false;
      }

      // Check signal strength for BLE
      if (req.type === 'ble' && req.minRssi !== undefined) {
        if (!verification.rssi || verification.rssi < req.minRssi) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Verify social requirements
   */
  private verifySocialRequirements(
    requirements: SocialRequirement,
    groupDiscovery: Discovery['groupDiscovery']
  ): { valid: boolean; error?: string } {
    if (!groupDiscovery) {
      return { valid: false, error: 'Group discovery data required' };
    }

    const playerCount = groupDiscovery.playerPubKeys.length;

    if (playerCount < requirements.minPlayers) {
      return {
        valid: false,
        error: `Need at least ${requirements.minPlayers} players, have ${playerCount}`,
      };
    }

    if (requirements.maxPlayers && playerCount > requirements.maxPlayers) {
      return {
        valid: false,
        error: `Maximum ${requirements.maxPlayers} players allowed`,
      };
    }

    if (requirements.requiredPlayers) {
      for (const required of requirements.requiredPlayers) {
        if (!groupDiscovery.playerPubKeys.includes(required)) {
          return { valid: false, error: `Required player not present: ${required}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Sign a discovery
   */
  private async signDiscovery(privKey: string, anchorId: string): Promise<string> {
    // In real implementation, use proper signing
    const message = `discovery:${anchorId}:${Date.now()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message + privKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ===========================================================================
  // Navigation and Hints
  // ===========================================================================

  /**
   * Get hot/cold navigation hint
   */
  async getNavigationHint(
    anchorId: string,
    playerLatitude: number,
    playerLongitude: number,
    playerPrecision: number = 7
  ): Promise<NavigationHint | null> {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return null;

    // Only provide hints for hinted or revealed anchors
    if (anchor.visibility === 'hidden') return null;

    // Calculate geohash difference
    // In real implementation, compare player geohash with anchor geohash
    // For now, simulate based on precision levels

    // Get player's geohash at various precisions
    const playerGeohash = this.latLongToGeohash(playerLatitude, playerLongitude, 12);
    const anchorGeohash = anchor.locationCommitment.geohash;

    // Find how many characters match
    let matchingChars = 0;
    for (let i = 0; i < Math.min(playerGeohash.length, anchorGeohash.length); i++) {
      if (playerGeohash[i] === anchorGeohash[i]) {
        matchingChars++;
      } else {
        break;
      }
    }

    const geohashDiff = anchor.requiredPrecision - matchingChars;

    // Calculate temperature
    let temperature: number;
    let description: NavigationHint['description'];

    if (geohashDiff <= 0) {
      temperature = 100;
      description = 'burning';
    } else if (geohashDiff <= TEMPERATURE_THRESHOLDS.burning.geohashDiff) {
      temperature = 90;
      description = 'burning';
    } else if (geohashDiff <= TEMPERATURE_THRESHOLDS.hot.geohashDiff) {
      temperature = 70;
      description = 'hot';
    } else if (geohashDiff <= TEMPERATURE_THRESHOLDS.warm.geohashDiff) {
      temperature = 50;
      description = 'warm';
    } else if (geohashDiff <= TEMPERATURE_THRESHOLDS.cool.geohashDiff) {
      temperature = 35;
      description = 'cool';
    } else if (geohashDiff <= TEMPERATURE_THRESHOLDS.cold.geohashDiff) {
      temperature = 20;
      description = 'cold';
    } else {
      temperature = 5;
      description = 'freezing';
    }

    // Distance category
    let distance: NavigationHint['distance'];
    if (geohashDiff <= 0) distance = 'here';
    else if (geohashDiff <= 1) distance = 'close';
    else if (geohashDiff <= 2) distance = 'near';
    else if (geohashDiff <= 4) distance = 'medium';
    else distance = 'far';

    return {
      anchorId,
      temperature,
      description,
      distance,
      currentPrecision: matchingChars,
      requiredPrecision: anchor.requiredPrecision,
    };
  }

  /**
   * Get available hints for an anchor based on current conditions
   */
  getAvailableHints(
    anchorId: string,
    playerPubKey: string,
    playerPrecision: number,
    groupSize: number = 1
  ): AnchorHint[] {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return [];

    return anchor.hints.filter((hint) => {
      return this.isHintRevealed(hint, playerPubKey, playerPrecision, groupSize);
    });
  }

  /**
   * Check if a hint should be revealed
   */
  private isHintRevealed(
    hint: AnchorHint,
    playerPubKey: string,
    playerPrecision: number,
    groupSize: number
  ): boolean {
    const condition = hint.revealCondition;

    switch (condition.type) {
      case 'immediate':
        return true;

      case 'proximity':
        return playerPrecision >= condition.precision;

      case 'time':
        // Would need anchor creation time
        return true;

      case 'discovery':
        const discoveries = this.discoveries.get(condition.anchorId) ?? [];
        return discoveries.some((d) => d.playerPubKey === playerPubKey);

      case 'social':
        return groupSize >= condition.minPlayers;

      case 'payment':
        // Would need payment verification
        return false;

      default:
        return false;
    }
  }

  /**
   * Convert lat/long to geohash
   * Simplified implementation - use a proper library in production
   */
  private latLongToGeohash(lat: number, lon: number, precision: number): string {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let minLat = -90, maxLat = 90;
    let minLon = -180, maxLon = 180;
    let hash = '';
    let bit = 0;
    let ch = 0;
    let isLon = true;

    while (hash.length < precision) {
      if (isLon) {
        const mid = (minLon + maxLon) / 2;
        if (lon >= mid) {
          ch = ch * 2 + 1;
          minLon = mid;
        } else {
          ch = ch * 2;
          maxLon = mid;
        }
      } else {
        const mid = (minLat + maxLat) / 2;
        if (lat >= mid) {
          ch = ch * 2 + 1;
          minLat = mid;
        } else {
          ch = ch * 2;
          maxLat = mid;
        }
      }

      isLon = !isLon;
      bit++;

      if (bit === 5) {
        hash += base32[ch];
        bit = 0;
        ch = 0;
      }
    }

    return hash;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get anchor by ID
   */
  getAnchor(id: string): DiscoveryAnchor | undefined {
    return this.anchors.get(id);
  }

  /**
   * Get all anchors
   */
  getAllAnchors(): DiscoveryAnchor[] {
    return Array.from(this.anchors.values());
  }

  /**
   * Get anchors by visibility
   */
  getAnchorsByVisibility(visibility: AnchorVisibility): DiscoveryAnchor[] {
    return Array.from(this.anchors.values()).filter((a) => a.visibility === visibility);
  }

  /**
   * Get discoveries for an anchor
   */
  getDiscoveries(anchorId: string): Discovery[] {
    return this.discoveries.get(anchorId) ?? [];
  }

  /**
   * Get player's discoveries
   */
  getPlayerDiscoveries(playerPubKey: string): Discovery[] {
    const all: Discovery[] = [];
    for (const discoveries of this.discoveries.values()) {
      all.push(...discoveries.filter((d) => d.playerPubKey === playerPubKey));
    }
    return all;
  }

  /**
   * Check if player has discovered an anchor
   */
  hasDiscovered(anchorId: string, playerPubKey: string): boolean {
    const discoveries = this.discoveries.get(anchorId) ?? [];
    return discoveries.some((d) => d.playerPubKey === playerPubKey);
  }

  /**
   * Get discovery count for anchor
   */
  getDiscoveryCount(anchorId: string): number {
    return (this.discoveries.get(anchorId) ?? []).length;
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
   * Export all anchors and discoveries
   */
  export(): string {
    return JSON.stringify({
      anchors: Array.from(this.anchors.entries()),
      discoveries: Array.from(this.discoveries.entries()),
    });
  }

  /**
   * Import anchors and discoveries
   */
  import(json: string): void {
    const data = JSON.parse(json);
    this.anchors = new Map(data.anchors);
    this.discoveries = new Map(data.discoveries);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an anchor manager
 */
export function createAnchorManager(
  config?: Partial<AnchorManagerConfig>
): AnchorManager {
  return new AnchorManager(config);
}

/**
 * Create a simple reward
 */
export function createReward(params: {
  type: DiscoveryReward['type'];
  rewardId: string;
  quantity?: number;
  rarity?: DiscoveryReward['rarity'];
  firstFinderOnly?: number;
  dropChance?: number;
}): DiscoveryReward {
  return {
    type: params.type,
    rewardId: params.rewardId,
    quantity: params.quantity ?? 1,
    rarity: params.rarity ?? 'common',
    firstFinderOnly: params.firstFinderOnly,
    dropChance: params.dropChance,
  };
}

/**
 * Create a text hint
 */
export function createTextHint(
  text: string,
  revealCondition: HintRevealCondition = { type: 'immediate' }
): Omit<AnchorHint, 'id'> {
  return {
    revealCondition,
    content: { type: 'text', text },
  };
}

/**
 * Create a hot/cold hint
 */
export function createHotColdHint(
  precisionLevel: number
): Omit<AnchorHint, 'id'> {
  return {
    revealCondition: { type: 'immediate' },
    content: { type: 'hotCold', temperature: 0 }, // Temperature calculated dynamically
    precisionLevel,
  };
}

/**
 * Create a riddle hint
 */
export function createRiddleHint(
  riddle: string,
  answer?: string,
  revealCondition: HintRevealCondition = { type: 'immediate' }
): Omit<AnchorHint, 'id'> {
  return {
    revealCondition,
    content: { type: 'riddle', riddle, answer },
  };
}
