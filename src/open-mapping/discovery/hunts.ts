/**
 * Treasure Hunt Management System
 *
 * Organize and run treasure hunts with multiple anchors, teams,
 * scoring, and prizes. Perfect for conferences, events, and
 * collaborative discovery experiences.
 */

import type {
  TreasureHunt,
  HuntScoring,
  HuntPrize,
  LeaderboardEntry,
  Discovery,
  DiscoveryAnchor,
  DiscoveryReward,
  PlayerState,
  GameEvent,
  GameEventListener,
} from './types';
import { AnchorManager } from './anchors';

// =============================================================================
// Hunt Configuration
// =============================================================================

/**
 * Configuration for treasure hunt manager
 */
export interface HuntManagerConfig {
  /** Maximum anchors per hunt */
  maxAnchorsPerHunt: number;

  /** Maximum active hunts */
  maxActiveHunts: number;

  /** Default hunt duration in minutes */
  defaultDurationMinutes: number;

  /** Update leaderboard every N seconds */
  leaderboardUpdateInterval: number;
}

/**
 * Default configuration
 */
export const DEFAULT_HUNT_CONFIG: HuntManagerConfig = {
  maxAnchorsPerHunt: 50,
  maxActiveHunts: 10,
  defaultDurationMinutes: 120,
  leaderboardUpdateInterval: 30,
};

// =============================================================================
// Hunt Manager
// =============================================================================

/**
 * Manages treasure hunts
 */
export class HuntManager {
  private config: HuntManagerConfig;
  private anchorManager: AnchorManager;
  private hunts: Map<string, TreasureHunt> = new Map();
  private playerHunts: Map<string, Set<string>> = new Map(); // playerPubKey -> huntIds
  private huntDiscoveries: Map<string, Discovery[]> = new Map(); // huntId -> discoveries
  private listeners: Set<GameEventListener> = new Set();
  private updateTimer: ReturnType<typeof setInterval> | null = null;

  constructor(anchorManager: AnchorManager, config: Partial<HuntManagerConfig> = {}) {
    this.config = { ...DEFAULT_HUNT_CONFIG, ...config };
    this.anchorManager = anchorManager;
  }

  // ===========================================================================
  // Hunt Creation
  // ===========================================================================

  /**
   * Create a new treasure hunt
   */
  async createHunt(params: {
    name: string;
    description: string;
    creatorPubKey: string;
    anchorIds: string[];
    sequential?: boolean;
    startsAt: Date;
    endsAt: Date;
    maxDurationMinutes?: number;
    maxPlayers?: number;
    teamSize?: { min: number; max: number };
    entryFee?: { amount: number; token: string };
    inviteOnly?: boolean;
    allowedPlayers?: string[];
    scoring?: Partial<HuntScoring>;
    prizes?: HuntPrize[];
  }): Promise<{ success: boolean; hunt?: TreasureHunt; error?: string }> {
    // Validate anchors
    if (params.anchorIds.length > this.config.maxAnchorsPerHunt) {
      return {
        success: false,
        error: `Maximum ${this.config.maxAnchorsPerHunt} anchors per hunt`,
      };
    }

    for (const anchorId of params.anchorIds) {
      const anchor = this.anchorManager.getAnchor(anchorId);
      if (!anchor) {
        return { success: false, error: `Anchor not found: ${anchorId}` };
      }
    }

    // Check active hunt limit
    const activeHunts = Array.from(this.hunts.values()).filter(
      (h) => h.state === 'active' || h.state === 'upcoming'
    );
    if (activeHunts.length >= this.config.maxActiveHunts) {
      return { success: false, error: 'Maximum active hunts reached' };
    }

    const id = `hunt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const scoring: HuntScoring = {
      pointsPerDiscovery: params.scoring?.pointsPerDiscovery ?? 100,
      firstFinderBonus: params.scoring?.firstFinderBonus ?? 50,
      timeBonus: params.scoring?.timeBonus,
      sequenceBonus: params.scoring?.sequenceBonus,
      groupBonus: params.scoring?.groupBonus,
      rarityMultiplier: params.scoring?.rarityMultiplier ?? {},
    };

    const hunt: TreasureHunt = {
      id,
      name: params.name,
      description: params.description,
      creatorPubKey: params.creatorPubKey,
      anchorIds: params.anchorIds,
      sequential: params.sequential ?? false,
      timing: {
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        maxDurationMinutes: params.maxDurationMinutes,
      },
      participation: {
        maxPlayers: params.maxPlayers,
        teamSize: params.teamSize,
        entryFee: params.entryFee,
        inviteOnly: params.inviteOnly ?? false,
        allowedPlayers: params.allowedPlayers,
      },
      scoring,
      prizes: params.prizes ?? [],
      state: 'upcoming',
      leaderboard: [],
    };

    this.hunts.set(id, hunt);
    this.huntDiscoveries.set(id, []);

    this.emit({ type: 'hunt:started', hunt });

    return { success: true, hunt };
  }

  /**
   * Add a prize to a hunt
   */
  addPrize(huntId: string, prize: HuntPrize): boolean {
    const hunt = this.hunts.get(huntId);
    if (!hunt || hunt.state !== 'upcoming') return false;

    hunt.prizes.push(prize);
    return true;
  }

  /**
   * Add an anchor to a hunt
   */
  addAnchor(huntId: string, anchorId: string): boolean {
    const hunt = this.hunts.get(huntId);
    if (!hunt || hunt.state !== 'upcoming') return false;

    if (hunt.anchorIds.length >= this.config.maxAnchorsPerHunt) return false;

    const anchor = this.anchorManager.getAnchor(anchorId);
    if (!anchor) return false;

    hunt.anchorIds.push(anchorId);
    return true;
  }

  // ===========================================================================
  // Hunt Participation
  // ===========================================================================

  /**
   * Join a hunt
   */
  joinHunt(
    huntId: string,
    playerPubKey: string
  ): { success: boolean; error?: string } {
    const hunt = this.hunts.get(huntId);
    if (!hunt) {
      return { success: false, error: 'Hunt not found' };
    }

    if (hunt.state !== 'upcoming' && hunt.state !== 'active') {
      return { success: false, error: 'Hunt not accepting participants' };
    }

    // Check invite-only
    if (hunt.participation.inviteOnly) {
      if (
        !hunt.participation.allowedPlayers?.includes(playerPubKey) &&
        hunt.creatorPubKey !== playerPubKey
      ) {
        return { success: false, error: 'Hunt is invite-only' };
      }
    }

    // Check max players
    const currentPlayers = this.getHuntParticipants(huntId);
    if (
      hunt.participation.maxPlayers &&
      currentPlayers.length >= hunt.participation.maxPlayers
    ) {
      return { success: false, error: 'Hunt is full' };
    }

    // Add player to hunt
    const playerHunts = this.playerHunts.get(playerPubKey) ?? new Set();
    playerHunts.add(huntId);
    this.playerHunts.set(playerPubKey, playerHunts);

    // Initialize leaderboard entry
    if (!hunt.leaderboard.find((e) => e.playerId === playerPubKey)) {
      hunt.leaderboard.push({
        playerId: playerPubKey,
        displayName: playerPubKey.slice(0, 8) + '...',
        score: 0,
        discoveriesCount: 0,
        firstFindsCount: 0,
        rank: hunt.leaderboard.length + 1,
      });
    }

    return { success: true };
  }

  /**
   * Leave a hunt
   */
  leaveHunt(huntId: string, playerPubKey: string): boolean {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return false;

    const playerHunts = this.playerHunts.get(playerPubKey);
    if (playerHunts) {
      playerHunts.delete(huntId);
    }

    // Remove from leaderboard
    hunt.leaderboard = hunt.leaderboard.filter((e) => e.playerId !== playerPubKey);

    return true;
  }

  /**
   * Get all participants in a hunt
   */
  getHuntParticipants(huntId: string): string[] {
    const participants: string[] = [];
    for (const [playerId, hunts] of this.playerHunts.entries()) {
      if (hunts.has(huntId)) {
        participants.push(playerId);
      }
    }
    return participants;
  }

  // ===========================================================================
  // Discovery Recording
  // ===========================================================================

  /**
   * Record a discovery for a hunt
   */
  recordDiscovery(
    huntId: string,
    discovery: Discovery
  ): { success: boolean; pointsAwarded: number; error?: string } {
    const hunt = this.hunts.get(huntId);
    if (!hunt) {
      return { success: false, pointsAwarded: 0, error: 'Hunt not found' };
    }

    if (hunt.state !== 'active') {
      return { success: false, pointsAwarded: 0, error: 'Hunt not active' };
    }

    // Check if anchor is part of hunt
    if (!hunt.anchorIds.includes(discovery.anchorId)) {
      return { success: false, pointsAwarded: 0, error: 'Anchor not in hunt' };
    }

    // Check sequential order
    if (hunt.sequential) {
      const playerDiscoveries = this.getPlayerHuntDiscoveries(
        huntId,
        discovery.playerPubKey
      );
      const expectedAnchorIndex = playerDiscoveries.length;
      const actualAnchorIndex = hunt.anchorIds.indexOf(discovery.anchorId);

      if (actualAnchorIndex !== expectedAnchorIndex) {
        return {
          success: false,
          pointsAwarded: 0,
          error: 'Must discover anchors in sequence',
        };
      }
    }

    // Record discovery
    const discoveries = this.huntDiscoveries.get(huntId) ?? [];
    discoveries.push(discovery);
    this.huntDiscoveries.set(huntId, discoveries);

    // Calculate points
    let points = hunt.scoring.pointsPerDiscovery;

    // First finder bonus
    if (discovery.isFirstFinder) {
      points += hunt.scoring.firstFinderBonus;
    }

    // Sequence bonus
    if (hunt.sequential && hunt.scoring.sequenceBonus) {
      points += hunt.scoring.sequenceBonus;
    }

    // Update leaderboard
    this.updatePlayerScore(huntId, discovery.playerPubKey, points, discovery.isFirstFinder);

    return { success: true, pointsAwarded: points };
  }

  /**
   * Get player's discoveries in a hunt
   */
  getPlayerHuntDiscoveries(huntId: string, playerPubKey: string): Discovery[] {
    const discoveries = this.huntDiscoveries.get(huntId) ?? [];
    return discoveries.filter((d) => d.playerPubKey === playerPubKey);
  }

  /**
   * Update a player's score
   */
  private updatePlayerScore(
    huntId: string,
    playerPubKey: string,
    pointsToAdd: number,
    isFirstFind: boolean
  ): void {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return;

    const entry = hunt.leaderboard.find((e) => e.playerId === playerPubKey);
    if (entry) {
      entry.score += pointsToAdd;
      entry.discoveriesCount++;
      if (isFirstFind) {
        entry.firstFindsCount++;
      }
    }

    this.updateLeaderboardRanks(huntId);
  }

  /**
   * Update leaderboard rankings
   */
  private updateLeaderboardRanks(huntId: string): void {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return;

    // Sort by score descending
    hunt.leaderboard.sort((a, b) => b.score - a.score);

    // Update ranks
    for (let i = 0; i < hunt.leaderboard.length; i++) {
      hunt.leaderboard[i].rank = i + 1;
    }
  }

  // ===========================================================================
  // Hunt Lifecycle
  // ===========================================================================

  /**
   * Start hunt lifecycle management
   */
  startLifecycleManager(): void {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(() => {
      this.updateHuntStates();
    }, this.config.leaderboardUpdateInterval * 1000);
  }

  /**
   * Stop lifecycle manager
   */
  stopLifecycleManager(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Update hunt states based on time
   */
  private updateHuntStates(): void {
    const now = new Date();

    for (const hunt of this.hunts.values()) {
      // Start upcoming hunts
      if (hunt.state === 'upcoming' && now >= hunt.timing.startsAt) {
        hunt.state = 'active';
        this.emit({ type: 'hunt:started', hunt });
      }

      // End active hunts
      if (hunt.state === 'active' && now >= hunt.timing.endsAt) {
        this.completeHunt(hunt.id);
      }
    }
  }

  /**
   * Manually start a hunt
   */
  startHunt(huntId: string): boolean {
    const hunt = this.hunts.get(huntId);
    if (!hunt || hunt.state !== 'upcoming') return false;

    hunt.state = 'active';
    hunt.timing.startsAt = new Date();

    this.emit({ type: 'hunt:started', hunt });
    return true;
  }

  /**
   * Complete a hunt and determine winners
   */
  completeHunt(huntId: string): {
    success: boolean;
    winners?: Array<{ playerId: string; position: number; prize: HuntPrize }>;
  } {
    const hunt = this.hunts.get(huntId);
    if (!hunt) {
      return { success: false };
    }

    hunt.state = 'completed';

    // Determine winners
    const winners: Array<{ playerId: string; position: number; prize: HuntPrize }> = [];

    for (const prize of hunt.prizes) {
      const entry = hunt.leaderboard[prize.position - 1];
      if (entry) {
        winners.push({
          playerId: entry.playerId,
          position: prize.position,
          prize,
        });
      }
    }

    const winnerId = hunt.leaderboard[0]?.playerId ?? '';
    this.emit({ type: 'hunt:completed', hunt, winnerId });

    return { success: true, winners };
  }

  /**
   * Cancel a hunt
   */
  cancelHunt(huntId: string): boolean {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return false;

    hunt.state = 'cancelled';
    return true;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get hunt by ID
   */
  getHunt(id: string): TreasureHunt | undefined {
    return this.hunts.get(id);
  }

  /**
   * Get all hunts
   */
  getAllHunts(): TreasureHunt[] {
    return Array.from(this.hunts.values());
  }

  /**
   * Get active hunts
   */
  getActiveHunts(): TreasureHunt[] {
    return Array.from(this.hunts.values()).filter((h) => h.state === 'active');
  }

  /**
   * Get upcoming hunts
   */
  getUpcomingHunts(): TreasureHunt[] {
    return Array.from(this.hunts.values()).filter((h) => h.state === 'upcoming');
  }

  /**
   * Get player's active hunts
   */
  getPlayerHunts(playerPubKey: string): TreasureHunt[] {
    const huntIds = this.playerHunts.get(playerPubKey) ?? new Set();
    return Array.from(huntIds)
      .map((id) => this.hunts.get(id))
      .filter((h): h is TreasureHunt => h !== undefined);
  }

  /**
   * Get hunt leaderboard
   */
  getLeaderboard(huntId: string): LeaderboardEntry[] {
    const hunt = this.hunts.get(huntId);
    return hunt?.leaderboard ?? [];
  }

  /**
   * Get player's rank in a hunt
   */
  getPlayerRank(huntId: string, playerPubKey: string): number | null {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return null;

    const entry = hunt.leaderboard.find((e) => e.playerId === playerPubKey);
    return entry?.rank ?? null;
  }

  /**
   * Get hunt progress for a player
   */
  getPlayerProgress(
    huntId: string,
    playerPubKey: string
  ): {
    discovered: number;
    total: number;
    percentage: number;
    nextAnchor?: string;
  } | null {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return null;

    const discoveries = this.getPlayerHuntDiscoveries(huntId, playerPubKey);
    const discoveredAnchorIds = new Set(discoveries.map((d) => d.anchorId));

    const discovered = discoveredAnchorIds.size;
    const total = hunt.anchorIds.length;
    const percentage = total > 0 ? (discovered / total) * 100 : 0;

    let nextAnchor: string | undefined;
    if (hunt.sequential && discovered < total) {
      nextAnchor = hunt.anchorIds[discovered];
    } else {
      // Find first undiscovered anchor
      nextAnchor = hunt.anchorIds.find((id) => !discoveredAnchorIds.has(id));
    }

    return { discovered, total, percentage, nextAnchor };
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
      hunts: Array.from(this.hunts.entries()),
      playerHunts: Array.from(this.playerHunts.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      huntDiscoveries: Array.from(this.huntDiscoveries.entries()),
    });
  }

  /**
   * Import state
   */
  import(json: string): void {
    const data = JSON.parse(json);
    this.hunts = new Map(data.hunts);
    this.playerHunts = new Map(
      data.playerHunts.map(([k, v]: [string, string[]]) => [k, new Set(v)])
    );
    this.huntDiscoveries = new Map(data.huntDiscoveries);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a hunt manager
 */
export function createHuntManager(
  anchorManager: AnchorManager,
  config?: Partial<HuntManagerConfig>
): HuntManager {
  return new HuntManager(anchorManager, config);
}

/**
 * Create a simple scoring configuration
 */
export function createScoring(params: {
  pointsPerDiscovery?: number;
  firstFinderBonus?: number;
  timeBonus?: number;
  sequenceBonus?: number;
  groupBonus?: number;
}): HuntScoring {
  return {
    pointsPerDiscovery: params.pointsPerDiscovery ?? 100,
    firstFinderBonus: params.firstFinderBonus ?? 50,
    timeBonus: params.timeBonus,
    sequenceBonus: params.sequenceBonus,
    groupBonus: params.groupBonus,
    rarityMultiplier: {},
  };
}

/**
 * Create a prize
 */
export function createPrize(params: {
  position: number;
  description: string;
  rewards: DiscoveryReward[];
}): HuntPrize {
  return {
    position: params.position,
    description: params.description,
    rewards: params.rewards,
  };
}

// =============================================================================
// Hunt Templates
// =============================================================================

/**
 * Template for a quick hunt (30 minutes, few anchors)
 */
export const QUICK_HUNT_TEMPLATE = {
  duration: 30,
  maxAnchors: 5,
  scoring: {
    pointsPerDiscovery: 100,
    firstFinderBonus: 50,
    timeBonus: 10, // Points per minute under par
  },
};

/**
 * Template for a standard hunt (2 hours)
 */
export const STANDARD_HUNT_TEMPLATE = {
  duration: 120,
  maxAnchors: 15,
  scoring: {
    pointsPerDiscovery: 100,
    firstFinderBonus: 100,
    timeBonus: 5,
    sequenceBonus: 25,
  },
};

/**
 * Template for an epic hunt (all day event)
 */
export const EPIC_HUNT_TEMPLATE = {
  duration: 480, // 8 hours
  maxAnchors: 50,
  scoring: {
    pointsPerDiscovery: 100,
    firstFinderBonus: 200,
    timeBonus: 2,
    sequenceBonus: 50,
    groupBonus: 100,
  },
};

/**
 * Template for a collaborative hunt (team-based)
 */
export const TEAM_HUNT_TEMPLATE = {
  duration: 180,
  maxAnchors: 20,
  teamSize: { min: 2, max: 5 },
  scoring: {
    pointsPerDiscovery: 150,
    firstFinderBonus: 75,
    groupBonus: 200,
  },
};
