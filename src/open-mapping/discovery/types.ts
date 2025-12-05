/**
 * zkGPS Location Games and Discovery System
 *
 * A framework for privacy-preserving location-based games, treasure hunts,
 * and collaborative discovery experiences. Uses zkGPS proofs to verify
 * proximity without revealing exact locations.
 *
 * Core concepts:
 * - Anchors: Hidden locations that can be discovered
 * - Discoveries: Proof that a player found an anchor
 * - Collectibles: Items earned through discoveries
 * - Spores: Mycelial elements that grow networks between discoveries
 * - Hunts: Organized games with multiple anchors and rewards
 */

import type { GeohashCommitment, ProximityProof, TrustLevel } from '../privacy/types';
import type { MyceliumNode, Hypha, Signal } from '../mycelium/types';

// =============================================================================
// Discovery Anchors
// =============================================================================

/**
 * Types of physical/virtual anchors for discoveries
 */
export type AnchorType =
  | 'physical'      // Real-world location only
  | 'nfc'           // NFC tag required
  | 'qr'            // QR code scan required
  | 'ble'           // BLE beacon proximity
  | 'virtual'       // AR/virtual overlay
  | 'temporal'      // Only exists at certain times
  | 'social'        // Requires group presence
  | 'composite';    // Combination of above

/**
 * Visibility states for anchors
 */
export type AnchorVisibility =
  | 'hidden'        // No hints, must stumble upon
  | 'hinted'        // Hot/cold navigation available
  | 'revealed'      // Location shown after condition met
  | 'public';       // Always visible on map

/**
 * A discovery anchor - a hidden or semi-hidden location
 */
export interface DiscoveryAnchor {
  /** Unique identifier */
  id: string;

  /** Human-readable name (may be hidden until discovered) */
  name: string;

  /** Description revealed upon discovery */
  description: string;

  /** Type of anchor */
  type: AnchorType;

  /** Current visibility state */
  visibility: AnchorVisibility;

  /** zkGPS commitment hiding the location */
  locationCommitment: GeohashCommitment;

  /** Geohash precision required for discovery (1-12) */
  requiredPrecision: number;

  /** Optional time window when anchor is active */
  activeWindow?: {
    start: Date;
    end: Date;
    recurring?: 'daily' | 'weekly' | 'monthly';
  };

  /** IoT hardware requirements */
  iotRequirements?: IoTRequirement[];

  /** Social requirements (group size, trust levels) */
  socialRequirements?: SocialRequirement;

  /** Rewards for discovering this anchor */
  rewards: DiscoveryReward[];

  /** Clues/hints for finding this anchor */
  hints: AnchorHint[];

  /** Prerequisites (other anchors that must be found first) */
  prerequisites: string[];

  /** Metadata */
  metadata: Record<string, unknown>;

  /** Creator's public key */
  creatorPubKey: string;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * IoT hardware requirement for discovery
 */
export interface IoTRequirement {
  /** Type of hardware */
  type: 'nfc' | 'ble' | 'qr' | 'rfid' | 'gps-rtk';

  /** Hardware identifier or pattern */
  identifier: string;

  /** Challenge data that must be signed/returned */
  challenge?: string;

  /** Expected response hash */
  expectedResponseHash?: string;

  /** Signal strength requirement for BLE */
  minRssi?: number;
}

/**
 * Social requirements for group discoveries
 */
export interface SocialRequirement {
  /** Minimum players in proximity */
  minPlayers: number;

  /** Maximum players (for exclusive discoveries) */
  maxPlayers?: number;

  /** Required trust level between players */
  minTrustLevel: TrustLevel;

  /** All players must be within this geohash precision of each other */
  groupProximityPrecision: number;

  /** Specific player public keys required (for invite-only) */
  requiredPlayers?: string[];
}

/**
 * Hints for finding an anchor
 */
export interface AnchorHint {
  /** Hint identifier */
  id: string;

  /** When this hint is revealed */
  revealCondition: HintRevealCondition;

  /** The hint content (riddle, direction, image, etc.) */
  content: HintContent;

  /** Precision level this hint provides (for hot/cold) */
  precisionLevel?: number;
}

/**
 * Conditions for revealing hints
 */
export type HintRevealCondition =
  | { type: 'immediate' }
  | { type: 'proximity'; precision: number }
  | { type: 'time'; afterMinutes: number }
  | { type: 'discovery'; anchorId: string }
  | { type: 'payment'; amount: number; token: string }
  | { type: 'social'; minPlayers: number };

/**
 * Hint content types
 */
export type HintContent =
  | { type: 'text'; text: string }
  | { type: 'riddle'; riddle: string; answer?: string }
  | { type: 'image'; imageUrl: string; caption?: string }
  | { type: 'audio'; audioUrl: string }
  | { type: 'direction'; bearing: number; distance?: 'near' | 'medium' | 'far' }
  | { type: 'hotCold'; temperature: number } // 0-100, 100 = on top of it
  | { type: 'geohashPrefix'; prefix: string }; // Partial location reveal

// =============================================================================
// Discoveries
// =============================================================================

/**
 * A verified discovery of an anchor
 */
export interface Discovery {
  /** Unique identifier */
  id: string;

  /** The anchor that was discovered */
  anchorId: string;

  /** Player who made the discovery */
  playerPubKey: string;

  /** zkGPS proximity proof */
  proximityProof: ProximityProof;

  /** IoT verification data (if required) */
  iotVerification?: IoTVerification;

  /** Group discovery data (if social anchor) */
  groupDiscovery?: GroupDiscovery;

  /** Timestamp of discovery */
  timestamp: Date;

  /** Whether this was first discovery */
  isFirstFinder: boolean;

  /** Discovery order (1st, 2nd, 3rd, etc.) */
  discoveryOrder: number;

  /** Rewards claimed */
  rewardsClaimed: ClaimedReward[];

  /** Signature from player */
  playerSignature: string;

  /** Optional witness signatures */
  witnessSignatures?: string[];
}

/**
 * IoT verification proof
 */
export interface IoTVerification {
  /** Hardware type */
  type: 'nfc' | 'ble' | 'qr' | 'rfid';

  /** Challenge response */
  challengeResponse: string;

  /** Hardware signature (if capable) */
  hardwareSignature?: string;

  /** Signal strength for BLE */
  rssi?: number;

  /** Timestamp from hardware */
  hardwareTimestamp?: Date;
}

/**
 * Group discovery proof
 */
export interface GroupDiscovery {
  /** All player public keys */
  playerPubKeys: string[];

  /** Group proximity proof */
  groupProximityProof: ProximityProof;

  /** Individual proximity proofs from each player */
  individualProofs: ProximityProof[];

  /** Timestamp when all players were verified in proximity */
  verifiedAt: Date;
}

// =============================================================================
// Rewards and Collectibles
// =============================================================================

/**
 * Reward types for discoveries
 */
export type RewardType =
  | 'collectible'   // Unique item
  | 'spore'         // Mycelium spore for network growth
  | 'hint'          // Reveals hint for another anchor
  | 'key'           // Unlocks another anchor
  | 'badge'         // Achievement badge
  | 'points'        // Point score
  | 'token'         // Cryptocurrency/token reward
  | 'experience';   // XP for leveling

/**
 * Discovery reward definition
 */
export interface DiscoveryReward {
  /** Reward type */
  type: RewardType;

  /** Reward identifier or item ID */
  rewardId: string;

  /** Quantity (for fungible rewards) */
  quantity: number;

  /** Rarity (affects drop chance for random rewards) */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

  /** Only awarded to first N finders */
  firstFinderOnly?: number;

  /** Probability of receiving (0-1, for random drops) */
  dropChance?: number;

  /** Conditions for receiving reward */
  conditions?: RewardCondition[];
}

/**
 * Conditions for receiving rewards
 */
export type RewardCondition =
  | { type: 'firstFinder'; rank: number }
  | { type: 'timeLimit'; withinMinutes: number }
  | { type: 'groupSize'; minPlayers: number }
  | { type: 'hasItem'; itemId: string }
  | { type: 'level'; minLevel: number };

/**
 * A claimed reward
 */
export interface ClaimedReward {
  /** Reward definition */
  reward: DiscoveryReward;

  /** When claimed */
  claimedAt: Date;

  /** Transaction hash (for on-chain rewards) */
  txHash?: string;
}

// =============================================================================
// Collectibles and Crafting
// =============================================================================

/**
 * Collectible item categories
 */
export type CollectibleCategory =
  | 'spore'         // Mycelium spores
  | 'fragment'      // Pieces that combine
  | 'artifact'      // Complete unique items
  | 'tool'          // Usable items
  | 'key'           // Unlock items
  | 'map'           // Reveals locations
  | 'badge'         // Achievement display
  | 'material';     // Crafting ingredients

/**
 * A collectible item
 */
export interface Collectible {
  /** Unique item ID */
  id: string;

  /** Item name */
  name: string;

  /** Description */
  description: string;

  /** Category */
  category: CollectibleCategory;

  /** Rarity */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

  /** Visual representation */
  visual: {
    imageUrl: string;
    iconUrl?: string;
    color?: string;
    animation?: string;
  };

  /** Item properties/stats */
  properties: Record<string, number | string | boolean>;

  /** Whether item is tradeable */
  tradeable: boolean;

  /** Whether item is consumable (one-time use) */
  consumable: boolean;

  /** Stack limit (1 = non-stackable) */
  stackLimit: number;

  /** Crafting recipes this item is used in */
  usedInRecipes: string[];

  /** Special abilities/effects */
  abilities?: ItemAbility[];
}

/**
 * Item ability/effect
 */
export interface ItemAbility {
  /** Ability name */
  name: string;

  /** What it does */
  effect: ItemEffect;

  /** Cooldown in seconds */
  cooldownSeconds?: number;

  /** Uses remaining (-1 = unlimited) */
  uses: number;
}

/**
 * Item effects
 */
export type ItemEffect =
  | { type: 'revealHint'; anchorId: string }
  | { type: 'unlockAnchor'; anchorId: string }
  | { type: 'boostPrecision'; precisionBoost: number; durationMinutes: number }
  | { type: 'extendRange'; rangeMultiplier: number; durationMinutes: number }
  | { type: 'groupLink'; maxDistance: number }
  | { type: 'plantSpore'; sporeType: string }
  | { type: 'harvestFruit'; yieldMultiplier: number };

/**
 * Crafting recipe
 */
export interface CraftingRecipe {
  /** Recipe ID */
  id: string;

  /** Recipe name */
  name: string;

  /** Required ingredients */
  ingredients: CraftingIngredient[];

  /** Resulting item(s) */
  outputs: CraftingOutput[];

  /** Time to craft in seconds */
  craftingTime: number;

  /** Location requirements (must craft at specific anchor) */
  locationRequirement?: string;

  /** Level requirement */
  levelRequirement?: number;

  /** Whether recipe is known by default or must be discovered */
  discoverable: boolean;
}

/**
 * Crafting ingredient
 */
export interface CraftingIngredient {
  /** Item ID */
  itemId: string;

  /** Quantity required */
  quantity: number;

  /** Whether item is consumed */
  consumed: boolean;
}

/**
 * Crafting output
 */
export interface CraftingOutput {
  /** Item ID */
  itemId: string;

  /** Quantity produced */
  quantity: number;

  /** Probability (for random outputs) */
  probability?: number;
}

// =============================================================================
// Mycelium Integration
// =============================================================================

/**
 * Spore types for mycelium network growth
 */
export type SporeType =
  | 'explorer'      // Spreads quickly, reveals area
  | 'connector'     // Links discoveries together
  | 'amplifier'     // Boosts signal strength
  | 'guardian'      // Protects territory
  | 'harvester'     // Increases rewards
  | 'temporal'      // Affects time-based mechanics
  | 'social';       // Enhances group bonuses

/**
 * A spore that can be planted to grow mycelium
 */
export interface Spore {
  /** Spore ID */
  id: string;

  /** Spore type */
  type: SporeType;

  /** Growth rate multiplier */
  growthRate: number;

  /** Maximum hypha length this spore can produce */
  maxReach: number;

  /** Nutrient capacity (how long it lives) */
  nutrientCapacity: number;

  /** Special properties */
  properties: Record<string, number>;

  /** Visual style */
  visual: {
    color: string;
    pattern: 'radial' | 'branching' | 'spiral' | 'clustered';
  };
}

/**
 * A planted spore growing into mycelium
 */
export interface PlantedSpore {
  /** Instance ID */
  id: string;

  /** Spore template */
  spore: Spore;

  /** Location commitment where planted */
  locationCommitment: GeohashCommitment;

  /** Player who planted */
  planterPubKey: string;

  /** When planted */
  plantedAt: Date;

  /** Current nutrient level (0-100) */
  nutrients: number;

  /** Mycelium node created from this spore */
  nodeId: string;

  /** Hyphae grown from this spore */
  hyphaIds: string[];
}

/**
 * Fruiting body - emerges when mycelium networks connect
 */
export interface FruitingBody {
  /** Unique ID */
  id: string;

  /** Type of fruiting body */
  type: FruitingBodyType;

  /** Location commitment */
  locationCommitment: GeohashCommitment;

  /** Connected spore IDs that created this */
  sourceSporeIds: string[];

  /** Rewards available for harvest */
  harvestableRewards: DiscoveryReward[];

  /** When it emerged */
  emergedAt: Date;

  /** How long until it decays */
  decaysAt: Date;

  /** Current maturity (0-100) */
  maturity: number;

  /** Players who contributed to creation */
  contributors: string[];
}

/**
 * Types of fruiting bodies
 */
export type FruitingBodyType =
  | 'common'        // Basic rewards
  | 'cluster'       // Multiple smaller rewards
  | 'giant'         // Rare, large rewards
  | 'bioluminescent' // Reveals hidden anchors
  | 'symbiotic'     // Requires multiple players to harvest
  | 'temporal';     // Only exists briefly

// =============================================================================
// Treasure Hunts
// =============================================================================

/**
 * An organized treasure hunt with multiple anchors
 */
export interface TreasureHunt {
  /** Hunt ID */
  id: string;

  /** Hunt name */
  name: string;

  /** Description */
  description: string;

  /** Hunt creator */
  creatorPubKey: string;

  /** All anchors in this hunt */
  anchorIds: string[];

  /** Order matters? */
  sequential: boolean;

  /** Time limits */
  timing: {
    startsAt: Date;
    endsAt: Date;
    maxDurationMinutes?: number; // Per-player time limit
  };

  /** Participation rules */
  participation: {
    maxPlayers?: number;
    teamSize?: { min: number; max: number };
    entryFee?: { amount: number; token: string };
    inviteOnly: boolean;
    allowedPlayers?: string[];
  };

  /** Scoring system */
  scoring: HuntScoring;

  /** Grand prizes for winners */
  prizes: HuntPrize[];

  /** Current hunt state */
  state: 'upcoming' | 'active' | 'completed' | 'cancelled';

  /** Leaderboard */
  leaderboard: LeaderboardEntry[];
}

/**
 * Hunt scoring configuration
 */
export interface HuntScoring {
  /** Points per discovery */
  pointsPerDiscovery: number;

  /** Bonus for first finder */
  firstFinderBonus: number;

  /** Time bonus (points per minute under par) */
  timeBonus?: number;

  /** Bonus for completing in sequence */
  sequenceBonus?: number;

  /** Bonus for group discovery */
  groupBonus?: number;

  /** Multiplier for rare finds */
  rarityMultiplier: Record<string, number>;
}

/**
 * Hunt prizes
 */
export interface HuntPrize {
  /** Position (1st, 2nd, 3rd, etc.) */
  position: number;

  /** Prize description */
  description: string;

  /** Rewards */
  rewards: DiscoveryReward[];
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  /** Player or team ID */
  playerId: string;

  /** Display name */
  displayName: string;

  /** Total score */
  score: number;

  /** Discoveries made */
  discoveriesCount: number;

  /** First finds */
  firstFindsCount: number;

  /** Time taken (for timed hunts) */
  timeSeconds?: number;

  /** Position on leaderboard */
  rank: number;
}

// =============================================================================
// Player State
// =============================================================================

/**
 * Player's game state
 */
export interface PlayerState {
  /** Player public key */
  pubKey: string;

  /** Display name */
  displayName: string;

  /** Current level */
  level: number;

  /** Experience points */
  xp: number;

  /** Inventory */
  inventory: InventorySlot[];

  /** Discoveries made */
  discoveries: string[];

  /** Active hunts */
  activeHunts: string[];

  /** Planted spores */
  plantedSpores: string[];

  /** Badges earned */
  badges: string[];

  /** Stats */
  stats: PlayerStats;

  /** Preferences */
  preferences: PlayerPreferences;
}

/**
 * Inventory slot
 */
export interface InventorySlot {
  /** Item ID */
  itemId: string;

  /** Quantity */
  quantity: number;

  /** Slot position */
  slot: number;
}

/**
 * Player statistics
 */
export interface PlayerStats {
  totalDiscoveries: number;
  firstFinds: number;
  huntsCompleted: number;
  huntsWon: number;
  sporesPlanted: number;
  fruitHarvested: number;
  distanceTraveled: number;
  itemsCrafted: number;
  itemsTraded: number;
}

/**
 * Player preferences
 */
export interface PlayerPreferences {
  /** Share discoveries publicly */
  shareDiscoveries: boolean;

  /** Allow location hints to others */
  provideHints: boolean;

  /** Notification settings */
  notifications: {
    newHunts: boolean;
    nearbyDiscoveries: boolean;
    fruitReady: boolean;
    groupInvites: boolean;
  };

  /** Privacy level for presence */
  presencePrivacy: TrustLevel;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Game events
 */
export type GameEvent =
  | { type: 'anchor:created'; anchor: DiscoveryAnchor }
  | { type: 'anchor:discovered'; discovery: Discovery }
  | { type: 'anchor:firstFind'; discovery: Discovery; rank: number }
  | { type: 'hint:revealed'; anchorId: string; hint: AnchorHint }
  | { type: 'reward:claimed'; reward: ClaimedReward; playerId: string }
  | { type: 'item:crafted'; itemId: string; playerId: string }
  | { type: 'spore:planted'; spore: PlantedSpore }
  | { type: 'fruit:emerged'; fruit: FruitingBody }
  | { type: 'fruit:harvested'; fruitId: string; playerId: string }
  | { type: 'hunt:started'; hunt: TreasureHunt }
  | { type: 'hunt:completed'; hunt: TreasureHunt; winnerId: string }
  | { type: 'player:levelUp'; playerId: string; newLevel: number }
  | { type: 'group:formed'; playerIds: string[] }
  | { type: 'network:connected'; sporeIds: string[] };

export type GameEventListener = (event: GameEvent) => void;

// =============================================================================
// Hot/Cold Navigation
// =============================================================================

/**
 * Navigation hint based on proximity
 */
export interface NavigationHint {
  /** Target anchor ID */
  anchorId: string;

  /** Temperature (0 = freezing, 100 = burning hot) */
  temperature: number;

  /** Qualitative description */
  description: 'freezing' | 'cold' | 'cool' | 'warm' | 'hot' | 'burning';

  /** Direction hint (optional, based on trust/items) */
  direction?: {
    bearing: number;
    confidence: 'low' | 'medium' | 'high';
  };

  /** Distance category */
  distance: 'far' | 'medium' | 'near' | 'close' | 'here';

  /** Precision of player's current location */
  currentPrecision: number;

  /** Required precision for discovery */
  requiredPrecision: number;
}

/**
 * Temperature thresholds for hot/cold
 */
export const TEMPERATURE_THRESHOLDS = {
  freezing: { max: 10, geohashDiff: 6 },   // 6+ chars different
  cold: { max: 25, geohashDiff: 5 },        // 5 chars different
  cool: { max: 40, geohashDiff: 4 },        // 4 chars different
  warm: { max: 60, geohashDiff: 3 },        // 3 chars different
  hot: { max: 85, geohashDiff: 2 },         // 2 chars different
  burning: { max: 100, geohashDiff: 1 },    // 1 char different = very close
} as const;
