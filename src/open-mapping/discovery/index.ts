/**
 * zkGPS Location Games and Discovery System
 *
 * A framework for privacy-preserving location-based games, treasure hunts,
 * and collaborative discovery experiences. Uses zkGPS proofs to verify
 * proximity without revealing exact locations.
 *
 * Key Features:
 * - Privacy-preserving location verification via zkGPS
 * - Hot/cold navigation hints without revealing target
 * - Collectible items with crafting system
 * - Mycelium-inspired spore planting and network growth
 * - Fruiting bodies that emerge when networks connect
 * - Organized treasure hunts with scoring and prizes
 * - IoT hardware integration (NFC, BLE, QR)
 *
 * Usage:
 * ```typescript
 * import {
 *   createAnchorManager,
 *   createItemRegistry,
 *   createInventoryManager,
 *   createSporeManager,
 *   createHuntManager,
 * } from './discovery';
 *
 * // Initialize systems
 * const anchors = createAnchorManager();
 * const items = createItemRegistry();
 * const inventory = createInventoryManager(items);
 * const spores = createSporeManager();
 * const hunts = createHuntManager(anchors);
 *
 * // Create a hidden anchor
 * const anchor = await anchors.createAnchor({
 *   name: 'Secret Garden',
 *   description: 'A hidden oasis in the city',
 *   type: 'physical',
 *   visibility: 'hinted',
 *   latitude: 51.5074,
 *   longitude: -0.1278,
 *   creatorPubKey: myPublicKey,
 *   creatorPrivKey: myPrivateKey,
 *   rewards: [
 *     { type: 'spore', rewardId: 'spore-explorer', quantity: 3, rarity: 'common' },
 *   ],
 * });
 *
 * // Get hot/cold hint for player
 * const hint = await anchors.getNavigationHint(
 *   anchor.id,
 *   playerLat,
 *   playerLon
 * );
 * // hint.description = 'warm' | 'hot' | 'burning' etc.
 *
 * // Attempt discovery
 * const result = await anchors.attemptDiscovery({
 *   anchorId: anchor.id,
 *   playerPubKey: playerKey,
 *   playerPrivKey: playerPriv,
 *   playerLatitude: playerLat,
 *   playerLongitude: playerLon,
 * });
 *
 * if (result.success) {
 *   // Claim rewards, update inventory, etc.
 * }
 *
 * // Plant spores at discovered location
 * const spore = spores.createSpore('explorer');
 * await spores.plantSpore({
 *   spore,
 *   locationCommitment: anchor.locationCommitment,
 *   planterPubKey: playerKey,
 * });
 *
 * // Create a treasure hunt
 * const hunt = await hunts.createHunt({
 *   name: 'Conference Scavenger Hunt',
 *   description: 'Find all the hidden spots!',
 *   creatorPubKey: organizerKey,
 *   anchorIds: [anchor1.id, anchor2.id, anchor3.id],
 *   startsAt: new Date(),
 *   endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
 *   prizes: [
 *     createPrize({ position: 1, description: '1st Place', rewards: [...] }),
 *   ],
 * });
 * ```
 */

// Core types
export type {
  // Anchors
  AnchorType,
  AnchorVisibility,
  DiscoveryAnchor,
  IoTRequirement,
  SocialRequirement,
  AnchorHint,
  HintRevealCondition,
  HintContent,

  // Discoveries
  Discovery,
  IoTVerification,
  GroupDiscovery,

  // Rewards
  RewardType,
  DiscoveryReward,
  RewardCondition,
  ClaimedReward,

  // Collectibles
  CollectibleCategory,
  Collectible,
  ItemAbility,
  ItemEffect,
  CraftingRecipe,
  CraftingIngredient,
  CraftingOutput,
  InventorySlot,

  // Spores and Mycelium
  SporeType,
  Spore,
  PlantedSpore,
  FruitingBody,
  FruitingBodyType,

  // Treasure Hunts
  TreasureHunt,
  HuntScoring,
  HuntPrize,
  LeaderboardEntry,

  // Player
  PlayerState,
  PlayerStats,
  PlayerPreferences,

  // Navigation
  NavigationHint,

  // Events
  GameEvent,
  GameEventListener,
} from './types';

export { TEMPERATURE_THRESHOLDS } from './types';

// Anchor management
export {
  AnchorManager,
  createAnchorManager,
  createReward,
  createTextHint,
  createHotColdHint,
  createRiddleHint,
  DEFAULT_ANCHOR_CONFIG,
  type AnchorManagerConfig,
} from './anchors';

// Collectibles and crafting
export {
  ItemRegistry,
  InventoryManager,
  CraftingManager,
  createItemRegistry,
  createInventoryManager,
  createCraftingManager,
  createCollectible,
  createRecipe,
  DEFAULT_SPORE_ITEMS,
  DEFAULT_FRAGMENT_ITEMS,
  DEFAULT_ARTIFACT_ITEMS,
  DEFAULT_RECIPES,
  DEFAULT_INVENTORY_CONFIG,
  type InventoryConfig,
  type CraftingJob,
} from './collectibles';

// Spore and mycelium integration
export {
  SporeManager,
  createSporeManager,
  createSporeFromType,
  SPORE_TEMPLATES,
  DEFAULT_SPORE_CONFIG,
  type SporeSystemConfig,
} from './spores';

// Treasure hunts
export {
  HuntManager,
  createHuntManager,
  createScoring,
  createPrize,
  QUICK_HUNT_TEMPLATE,
  STANDARD_HUNT_TEMPLATE,
  EPIC_HUNT_TEMPLATE,
  TEAM_HUNT_TEMPLATE,
  DEFAULT_HUNT_CONFIG,
  type HuntManagerConfig,
} from './hunts';
