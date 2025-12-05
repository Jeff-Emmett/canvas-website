/**
 * Collectibles and Crafting System
 *
 * Manage collectible items, inventory, and crafting recipes for
 * the discovery game system. Items can be earned through discoveries,
 * crafted from materials, or traded between players.
 */

import type {
  Collectible,
  CollectibleCategory,
  CraftingRecipe,
  CraftingIngredient,
  CraftingOutput,
  InventorySlot,
  ItemAbility,
  ItemEffect,
  DiscoveryReward,
  ClaimedReward,
  GameEvent,
  GameEventListener,
} from './types';

// =============================================================================
// Item Registry
// =============================================================================

/**
 * Manages all collectible item definitions
 */
export class ItemRegistry {
  private items: Map<string, Collectible> = new Map();
  private recipes: Map<string, CraftingRecipe> = new Map();
  private recipesByOutput: Map<string, CraftingRecipe[]> = new Map();

  // ===========================================================================
  // Item Registration
  // ===========================================================================

  /**
   * Register a collectible item
   */
  registerItem(item: Collectible): void {
    this.items.set(item.id, item);
  }

  /**
   * Register multiple items
   */
  registerItems(items: Collectible[]): void {
    for (const item of items) {
      this.registerItem(item);
    }
  }

  /**
   * Get an item by ID
   */
  getItem(id: string): Collectible | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items
   */
  getAllItems(): Collectible[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items by category
   */
  getItemsByCategory(category: CollectibleCategory): Collectible[] {
    return Array.from(this.items.values()).filter((i) => i.category === category);
  }

  /**
   * Get items by rarity
   */
  getItemsByRarity(rarity: Collectible['rarity']): Collectible[] {
    return Array.from(this.items.values()).filter((i) => i.rarity === rarity);
  }

  // ===========================================================================
  // Recipe Registration
  // ===========================================================================

  /**
   * Register a crafting recipe
   */
  registerRecipe(recipe: CraftingRecipe): void {
    this.recipes.set(recipe.id, recipe);

    // Index by output
    for (const output of recipe.outputs) {
      const existing = this.recipesByOutput.get(output.itemId) ?? [];
      existing.push(recipe);
      this.recipesByOutput.set(output.itemId, existing);
    }
  }

  /**
   * Register multiple recipes
   */
  registerRecipes(recipes: CraftingRecipe[]): void {
    for (const recipe of recipes) {
      this.registerRecipe(recipe);
    }
  }

  /**
   * Get a recipe by ID
   */
  getRecipe(id: string): CraftingRecipe | undefined {
    return this.recipes.get(id);
  }

  /**
   * Get all recipes
   */
  getAllRecipes(): CraftingRecipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get recipes that produce a specific item
   */
  getRecipesForItem(itemId: string): CraftingRecipe[] {
    return this.recipesByOutput.get(itemId) ?? [];
  }

  /**
   * Get recipes that use a specific item as ingredient
   */
  getRecipesUsingItem(itemId: string): CraftingRecipe[] {
    return Array.from(this.recipes.values()).filter((r) =>
      r.ingredients.some((i) => i.itemId === itemId)
    );
  }
}

// =============================================================================
// Inventory Manager
// =============================================================================

/**
 * Configuration for inventory
 */
export interface InventoryConfig {
  /** Maximum inventory slots */
  maxSlots: number;

  /** Allow items to exceed stack limit */
  allowOverstack: boolean;
}

/**
 * Default inventory configuration
 */
export const DEFAULT_INVENTORY_CONFIG: InventoryConfig = {
  maxSlots: 50,
  allowOverstack: false,
};

/**
 * Manages a player's inventory
 */
export class InventoryManager {
  private config: InventoryConfig;
  private registry: ItemRegistry;
  private slots: Map<number, InventorySlot> = new Map();
  private listeners: Set<GameEventListener> = new Set();

  constructor(registry: ItemRegistry, config: Partial<InventoryConfig> = {}) {
    this.config = { ...DEFAULT_INVENTORY_CONFIG, ...config };
    this.registry = registry;
  }

  // ===========================================================================
  // Item Operations
  // ===========================================================================

  /**
   * Add item to inventory
   */
  addItem(itemId: string, quantity: number = 1): {
    success: boolean;
    addedSlots: number[];
    overflow: number;
  } {
    const item = this.registry.getItem(itemId);
    if (!item) {
      return { success: false, addedSlots: [], overflow: quantity };
    }

    const addedSlots: number[] = [];
    let remaining = quantity;

    // First, try to stack with existing items
    if (item.stackLimit > 1) {
      for (const [slot, slotData] of this.slots.entries()) {
        if (slotData.itemId === itemId && slotData.quantity < item.stackLimit) {
          const spaceInSlot = item.stackLimit - slotData.quantity;
          const toAdd = Math.min(remaining, spaceInSlot);
          slotData.quantity += toAdd;
          remaining -= toAdd;
          addedSlots.push(slot);

          if (remaining <= 0) break;
        }
      }
    }

    // Then, add to new slots
    while (remaining > 0) {
      const emptySlot = this.findEmptySlot();
      if (emptySlot === -1) break;

      const toAdd = Math.min(remaining, item.stackLimit);
      this.slots.set(emptySlot, {
        itemId,
        quantity: toAdd,
        slot: emptySlot,
      });
      remaining -= toAdd;
      addedSlots.push(emptySlot);
    }

    return {
      success: remaining === 0,
      addedSlots,
      overflow: remaining,
    };
  }

  /**
   * Remove item from inventory
   */
  removeItem(itemId: string, quantity: number = 1): {
    success: boolean;
    removedFrom: number[];
    shortage: number;
  } {
    const removedFrom: number[] = [];
    let remaining = quantity;

    // Find all slots with this item
    const slotsWithItem: number[] = [];
    for (const [slot, slotData] of this.slots.entries()) {
      if (slotData.itemId === itemId) {
        slotsWithItem.push(slot);
      }
    }

    // Remove from slots (LIFO - last in, first out)
    for (const slot of slotsWithItem.reverse()) {
      const slotData = this.slots.get(slot)!;
      const toRemove = Math.min(remaining, slotData.quantity);

      slotData.quantity -= toRemove;
      remaining -= toRemove;
      removedFrom.push(slot);

      if (slotData.quantity <= 0) {
        this.slots.delete(slot);
      }

      if (remaining <= 0) break;
    }

    return {
      success: remaining === 0,
      removedFrom,
      shortage: remaining,
    };
  }

  /**
   * Get quantity of an item in inventory
   */
  getItemCount(itemId: string): number {
    let count = 0;
    for (const slotData of this.slots.values()) {
      if (slotData.itemId === itemId) {
        count += slotData.quantity;
      }
    }
    return count;
  }

  /**
   * Check if player has enough of an item
   */
  hasItem(itemId: string, quantity: number = 1): boolean {
    return this.getItemCount(itemId) >= quantity;
  }

  /**
   * Check if player has all items in a list
   */
  hasItems(items: Array<{ itemId: string; quantity: number }>): boolean {
    for (const { itemId, quantity } of items) {
      if (!this.hasItem(itemId, quantity)) return false;
    }
    return true;
  }

  /**
   * Get all inventory slots
   */
  getSlots(): InventorySlot[] {
    return Array.from(this.slots.values());
  }

  /**
   * Get a specific slot
   */
  getSlot(slot: number): InventorySlot | undefined {
    return this.slots.get(slot);
  }

  /**
   * Move item between slots
   */
  moveItem(fromSlot: number, toSlot: number): boolean {
    const from = this.slots.get(fromSlot);
    if (!from) return false;

    const to = this.slots.get(toSlot);

    if (!to) {
      // Move to empty slot
      this.slots.delete(fromSlot);
      this.slots.set(toSlot, { ...from, slot: toSlot });
      return true;
    }

    // Same item - try to stack
    if (to.itemId === from.itemId) {
      const item = this.registry.getItem(from.itemId);
      if (item && item.stackLimit > 1) {
        const space = item.stackLimit - to.quantity;
        const toMove = Math.min(from.quantity, space);
        to.quantity += toMove;
        from.quantity -= toMove;

        if (from.quantity <= 0) {
          this.slots.delete(fromSlot);
        }
        return true;
      }
    }

    // Swap items
    this.slots.set(fromSlot, { ...to, slot: fromSlot });
    this.slots.set(toSlot, { ...from, slot: toSlot });
    return true;
  }

  /**
   * Find an empty slot
   */
  private findEmptySlot(): number {
    for (let i = 0; i < this.config.maxSlots; i++) {
      if (!this.slots.has(i)) return i;
    }
    return -1;
  }

  /**
   * Get used slot count
   */
  getUsedSlots(): number {
    return this.slots.size;
  }

  /**
   * Get available slot count
   */
  getAvailableSlots(): number {
    return this.config.maxSlots - this.slots.size;
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export inventory
   */
  export(): InventorySlot[] {
    return this.getSlots();
  }

  /**
   * Import inventory
   */
  import(slots: InventorySlot[]): void {
    this.slots.clear();
    for (const slot of slots) {
      this.slots.set(slot.slot, slot);
    }
  }
}

// =============================================================================
// Crafting System
// =============================================================================

/**
 * Crafting job state
 */
export interface CraftingJob {
  /** Job ID */
  id: string;

  /** Recipe being crafted */
  recipeId: string;

  /** When crafting started */
  startedAt: Date;

  /** When crafting completes */
  completesAt: Date;

  /** Current progress (0-1) */
  progress: number;

  /** Whether job is paused */
  paused: boolean;
}

/**
 * Manages crafting operations
 */
export class CraftingManager {
  private registry: ItemRegistry;
  private inventory: InventoryManager;
  private knownRecipes: Set<string> = new Set();
  private activeJobs: Map<string, CraftingJob> = new Map();
  private listeners: Set<GameEventListener> = new Set();

  constructor(registry: ItemRegistry, inventory: InventoryManager) {
    this.registry = registry;
    this.inventory = inventory;
  }

  // ===========================================================================
  // Recipe Discovery
  // ===========================================================================

  /**
   * Learn a recipe
   */
  learnRecipe(recipeId: string): boolean {
    const recipe = this.registry.getRecipe(recipeId);
    if (!recipe) return false;

    this.knownRecipes.add(recipeId);
    return true;
  }

  /**
   * Check if recipe is known
   */
  knowsRecipe(recipeId: string): boolean {
    const recipe = this.registry.getRecipe(recipeId);
    if (!recipe) return false;

    // Non-discoverable recipes are always known
    if (!recipe.discoverable) return true;

    return this.knownRecipes.has(recipeId);
  }

  /**
   * Get all known recipes
   */
  getKnownRecipes(): CraftingRecipe[] {
    const recipes: CraftingRecipe[] = [];

    for (const recipe of this.registry.getAllRecipes()) {
      if (!recipe.discoverable || this.knownRecipes.has(recipe.id)) {
        recipes.push(recipe);
      }
    }

    return recipes;
  }

  // ===========================================================================
  // Crafting Operations
  // ===========================================================================

  /**
   * Check if a recipe can be crafted
   */
  canCraft(recipeId: string, playerLevel: number = 1): {
    canCraft: boolean;
    reason?: string;
    missingIngredients?: Array<{ itemId: string; have: number; need: number }>;
  } {
    const recipe = this.registry.getRecipe(recipeId);
    if (!recipe) {
      return { canCraft: false, reason: 'Recipe not found' };
    }

    if (!this.knowsRecipe(recipeId)) {
      return { canCraft: false, reason: 'Recipe not learned' };
    }

    if (recipe.levelRequirement && playerLevel < recipe.levelRequirement) {
      return { canCraft: false, reason: `Requires level ${recipe.levelRequirement}` };
    }

    // Check ingredients
    const missing: Array<{ itemId: string; have: number; need: number }> = [];
    for (const ingredient of recipe.ingredients) {
      const have = this.inventory.getItemCount(ingredient.itemId);
      if (have < ingredient.quantity) {
        missing.push({
          itemId: ingredient.itemId,
          have,
          need: ingredient.quantity,
        });
      }
    }

    if (missing.length > 0) {
      return { canCraft: false, reason: 'Missing ingredients', missingIngredients: missing };
    }

    // Check inventory space for outputs
    let neededSlots = 0;
    for (const output of recipe.outputs) {
      const item = this.registry.getItem(output.itemId);
      if (item) {
        const existingCount = this.inventory.getItemCount(output.itemId);
        const total = existingCount + output.quantity;
        const slotsNeeded = Math.ceil(total / item.stackLimit);
        const slotsHave = Math.ceil(existingCount / item.stackLimit);
        neededSlots += slotsNeeded - slotsHave;
      }
    }

    if (neededSlots > this.inventory.getAvailableSlots()) {
      return { canCraft: false, reason: 'Not enough inventory space' };
    }

    return { canCraft: true };
  }

  /**
   * Start crafting a recipe
   */
  startCrafting(recipeId: string, playerLevel: number = 1): {
    success: boolean;
    job?: CraftingJob;
    error?: string;
  } {
    const canCraftResult = this.canCraft(recipeId, playerLevel);
    if (!canCraftResult.canCraft) {
      return { success: false, error: canCraftResult.reason };
    }

    const recipe = this.registry.getRecipe(recipeId)!;

    // Consume ingredients
    for (const ingredient of recipe.ingredients) {
      if (ingredient.consumed) {
        this.inventory.removeItem(ingredient.itemId, ingredient.quantity);
      }
    }

    // Create crafting job
    const now = new Date();
    const job: CraftingJob = {
      id: `craft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipeId,
      startedAt: now,
      completesAt: new Date(now.getTime() + recipe.craftingTime * 1000),
      progress: 0,
      paused: false,
    };

    this.activeJobs.set(job.id, job);

    // For instant crafting
    if (recipe.craftingTime === 0) {
      return this.completeCrafting(job.id);
    }

    return { success: true, job };
  }

  /**
   * Complete a crafting job
   */
  completeCrafting(jobId: string): {
    success: boolean;
    job?: CraftingJob;
    outputs?: Array<{ itemId: string; quantity: number }>;
    error?: string;
  } {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    const recipe = this.registry.getRecipe(job.recipeId);
    if (!recipe) {
      this.activeJobs.delete(jobId);
      return { success: false, error: 'Recipe not found' };
    }

    // Check if job is complete
    const now = new Date();
    if (now < job.completesAt) {
      return { success: false, error: 'Crafting not complete yet' };
    }

    // Award outputs
    const awardedOutputs: Array<{ itemId: string; quantity: number }> = [];

    for (const output of recipe.outputs) {
      // Check probability for random outputs
      if (output.probability !== undefined && Math.random() > output.probability) {
        continue;
      }

      const result = this.inventory.addItem(output.itemId, output.quantity);
      if (result.success || result.addedSlots.length > 0) {
        awardedOutputs.push({
          itemId: output.itemId,
          quantity: output.quantity - result.overflow,
        });
      }
    }

    this.activeJobs.delete(jobId);

    return {
      success: true,
      job,
      outputs: awardedOutputs,
    };
  }

  /**
   * Cancel a crafting job (refunds ingredients)
   */
  cancelCrafting(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    const recipe = this.registry.getRecipe(job.recipeId);
    if (recipe) {
      // Refund consumed ingredients
      for (const ingredient of recipe.ingredients) {
        if (ingredient.consumed) {
          this.inventory.addItem(ingredient.itemId, ingredient.quantity);
        }
      }
    }

    this.activeJobs.delete(jobId);
    return true;
  }

  /**
   * Get all active crafting jobs
   */
  getActiveJobs(): CraftingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Update crafting progress (call periodically)
   */
  updateProgress(): CraftingJob[] {
    const completed: CraftingJob[] = [];
    const now = Date.now();

    for (const job of this.activeJobs.values()) {
      if (job.paused) continue;

      const total = job.completesAt.getTime() - job.startedAt.getTime();
      const elapsed = now - job.startedAt.getTime();
      job.progress = Math.min(1, elapsed / total);

      if (job.progress >= 1) {
        completed.push(job);
      }
    }

    return completed;
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export state
   */
  export(): {
    knownRecipes: string[];
    activeJobs: CraftingJob[];
  } {
    return {
      knownRecipes: Array.from(this.knownRecipes),
      activeJobs: this.getActiveJobs(),
    };
  }

  /**
   * Import state
   */
  import(data: { knownRecipes: string[]; activeJobs: CraftingJob[] }): void {
    this.knownRecipes = new Set(data.knownRecipes);
    this.activeJobs.clear();
    for (const job of data.activeJobs) {
      this.activeJobs.set(job.id, job);
    }
  }
}

// =============================================================================
// Pre-built Item Definitions
// =============================================================================

/**
 * Default spore items
 */
export const DEFAULT_SPORE_ITEMS: Collectible[] = [
  {
    id: 'spore-explorer',
    name: 'Explorer Spore',
    description: 'A curious spore that spreads quickly, revealing hidden areas.',
    category: 'spore',
    rarity: 'common',
    visual: {
      imageUrl: '/items/spore-explorer.png',
      color: '#4ade80',
    },
    properties: {
      growthRate: 1.5,
      maxReach: 50,
      revealRadius: 20,
    },
    tradeable: true,
    consumable: true,
    stackLimit: 99,
    usedInRecipes: ['recipe-network-seed'],
  },
  {
    id: 'spore-connector',
    name: 'Connector Spore',
    description: 'Links discoveries together, strengthening the network.',
    category: 'spore',
    rarity: 'uncommon',
    visual: {
      imageUrl: '/items/spore-connector.png',
      color: '#818cf8',
    },
    properties: {
      growthRate: 0.8,
      maxReach: 100,
      connectionStrength: 2,
    },
    tradeable: true,
    consumable: true,
    stackLimit: 50,
    usedInRecipes: ['recipe-network-seed', 'recipe-bridge-fungus'],
  },
  {
    id: 'spore-guardian',
    name: 'Guardian Spore',
    description: 'A defensive spore that protects territory from decay.',
    category: 'spore',
    rarity: 'rare',
    visual: {
      imageUrl: '/items/spore-guardian.png',
      color: '#f472b6',
    },
    properties: {
      growthRate: 0.5,
      maxReach: 30,
      protectionRadius: 40,
      decayResistance: 3,
    },
    tradeable: true,
    consumable: true,
    stackLimit: 25,
    usedInRecipes: ['recipe-fortress-fungus'],
  },
];

/**
 * Default fragment items
 */
export const DEFAULT_FRAGMENT_ITEMS: Collectible[] = [
  {
    id: 'fragment-map-north',
    name: 'Northern Map Fragment',
    description: 'A torn piece of an ancient map showing northern territories.',
    category: 'fragment',
    rarity: 'uncommon',
    visual: {
      imageUrl: '/items/fragment-map-north.png',
      color: '#fbbf24',
    },
    properties: {},
    tradeable: true,
    consumable: false,
    stackLimit: 1,
    usedInRecipes: ['recipe-complete-map'],
  },
  {
    id: 'fragment-map-south',
    name: 'Southern Map Fragment',
    description: 'A torn piece of an ancient map showing southern territories.',
    category: 'fragment',
    rarity: 'uncommon',
    visual: {
      imageUrl: '/items/fragment-map-south.png',
      color: '#fbbf24',
    },
    properties: {},
    tradeable: true,
    consumable: false,
    stackLimit: 1,
    usedInRecipes: ['recipe-complete-map'],
  },
  {
    id: 'fragment-map-east',
    name: 'Eastern Map Fragment',
    description: 'A torn piece of an ancient map showing eastern territories.',
    category: 'fragment',
    rarity: 'uncommon',
    visual: {
      imageUrl: '/items/fragment-map-east.png',
      color: '#fbbf24',
    },
    properties: {},
    tradeable: true,
    consumable: false,
    stackLimit: 1,
    usedInRecipes: ['recipe-complete-map'],
  },
  {
    id: 'fragment-map-west',
    name: 'Western Map Fragment',
    description: 'A torn piece of an ancient map showing western territories.',
    category: 'fragment',
    rarity: 'uncommon',
    visual: {
      imageUrl: '/items/fragment-map-west.png',
      color: '#fbbf24',
    },
    properties: {},
    tradeable: true,
    consumable: false,
    stackLimit: 1,
    usedInRecipes: ['recipe-complete-map'],
  },
];

/**
 * Default artifact items
 */
export const DEFAULT_ARTIFACT_ITEMS: Collectible[] = [
  {
    id: 'artifact-ancient-compass',
    name: 'Ancient Compass',
    description: 'A mysterious compass that points toward hidden discoveries.',
    category: 'artifact',
    rarity: 'epic',
    visual: {
      imageUrl: '/items/artifact-compass.png',
      color: '#a855f7',
    },
    properties: {
      hintRange: 500,
      hintAccuracy: 0.8,
    },
    tradeable: false,
    consumable: false,
    stackLimit: 1,
    usedInRecipes: [],
    abilities: [
      {
        name: 'Divine Direction',
        effect: { type: 'boostPrecision', precisionBoost: 2, durationMinutes: 30 },
        cooldownSeconds: 3600,
        uses: -1,
      },
    ],
  },
  {
    id: 'artifact-spore-mother',
    name: 'Spore Mother',
    description: 'A legendary artifact that accelerates mycelium growth.',
    category: 'artifact',
    rarity: 'legendary',
    visual: {
      imageUrl: '/items/artifact-spore-mother.png',
      color: '#ec4899',
      animation: 'pulse',
    },
    properties: {
      growthMultiplier: 3,
      sporeYield: 2,
    },
    tradeable: false,
    consumable: false,
    stackLimit: 1,
    usedInRecipes: [],
    abilities: [
      {
        name: 'Mass Sporulation',
        effect: { type: 'plantSpore', sporeType: 'random' },
        cooldownSeconds: 86400,
        uses: -1,
      },
    ],
  },
];

/**
 * Default crafting recipes
 */
export const DEFAULT_RECIPES: CraftingRecipe[] = [
  {
    id: 'recipe-network-seed',
    name: 'Network Seed',
    ingredients: [
      { itemId: 'spore-explorer', quantity: 3, consumed: true },
      { itemId: 'spore-connector', quantity: 1, consumed: true },
    ],
    outputs: [{ itemId: 'item-network-seed', quantity: 1 }],
    craftingTime: 60,
    discoverable: false,
  },
  {
    id: 'recipe-complete-map',
    name: 'Complete Ancient Map',
    ingredients: [
      { itemId: 'fragment-map-north', quantity: 1, consumed: true },
      { itemId: 'fragment-map-south', quantity: 1, consumed: true },
      { itemId: 'fragment-map-east', quantity: 1, consumed: true },
      { itemId: 'fragment-map-west', quantity: 1, consumed: true },
    ],
    outputs: [{ itemId: 'artifact-ancient-map', quantity: 1 }],
    craftingTime: 300,
    discoverable: true,
  },
  {
    id: 'recipe-bridge-fungus',
    name: 'Bridge Fungus',
    ingredients: [
      { itemId: 'spore-connector', quantity: 5, consumed: true },
    ],
    outputs: [{ itemId: 'item-bridge-fungus', quantity: 1 }],
    craftingTime: 120,
    discoverable: false,
  },
];

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an item registry with default items
 */
export function createItemRegistry(includeDefaults: boolean = true): ItemRegistry {
  const registry = new ItemRegistry();

  if (includeDefaults) {
    registry.registerItems([
      ...DEFAULT_SPORE_ITEMS,
      ...DEFAULT_FRAGMENT_ITEMS,
      ...DEFAULT_ARTIFACT_ITEMS,
    ]);
    registry.registerRecipes(DEFAULT_RECIPES);
  }

  return registry;
}

/**
 * Create an inventory manager
 */
export function createInventoryManager(
  registry: ItemRegistry,
  config?: Partial<InventoryConfig>
): InventoryManager {
  return new InventoryManager(registry, config);
}

/**
 * Create a crafting manager
 */
export function createCraftingManager(
  registry: ItemRegistry,
  inventory: InventoryManager
): CraftingManager {
  return new CraftingManager(registry, inventory);
}

/**
 * Create a custom collectible item
 */
export function createCollectible(params: {
  id: string;
  name: string;
  description: string;
  category: CollectibleCategory;
  rarity?: Collectible['rarity'];
  imageUrl: string;
  color?: string;
  properties?: Record<string, number | string | boolean>;
  tradeable?: boolean;
  consumable?: boolean;
  stackLimit?: number;
  abilities?: ItemAbility[];
}): Collectible {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    category: params.category,
    rarity: params.rarity ?? 'common',
    visual: {
      imageUrl: params.imageUrl,
      color: params.color,
    },
    properties: params.properties ?? {},
    tradeable: params.tradeable ?? true,
    consumable: params.consumable ?? false,
    stackLimit: params.stackLimit ?? 99,
    usedInRecipes: [],
    abilities: params.abilities,
  };
}

/**
 * Create a crafting recipe
 */
export function createRecipe(params: {
  id: string;
  name: string;
  ingredients: CraftingIngredient[];
  outputs: CraftingOutput[];
  craftingTime?: number;
  levelRequirement?: number;
  locationRequirement?: string;
  discoverable?: boolean;
}): CraftingRecipe {
  return {
    id: params.id,
    name: params.name,
    ingredients: params.ingredients,
    outputs: params.outputs,
    craftingTime: params.craftingTime ?? 0,
    levelRequirement: params.levelRequirement,
    locationRequirement: params.locationRequirement,
    discoverable: params.discoverable ?? false,
  };
}
