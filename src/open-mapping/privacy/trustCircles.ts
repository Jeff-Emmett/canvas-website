/**
 * Trust Circle Management for zkGPS
 *
 * Trust circles define who can see what precision of your location.
 * Each circle has a trust level that maps to a geohash precision.
 *
 * Levels:
 *   intimate: ~1m (exact position) - partners, family in same house
 *   close: ~38m (building level) - close friends, family
 *   friends: ~1.2km (neighborhood) - regular friends
 *   network: ~39km (metro area) - acquaintances
 *   public: ~1250km (large region) - everyone else
 */

import { generateSalt, sha256 } from './commitments';
import {
  TrustCircle,
  TrustLevel,
  ContactTrust,
  TRUST_LEVEL_PRECISION,
  ZkGpsConfig,
  DEFAULT_ZKGPS_CONFIG,
  GeohashPrecision,
  LocationBroadcast,
  LocationCommitment,
} from './types';

// =============================================================================
// Trust Circle Manager
// =============================================================================

/**
 * Manages trust circles and contact permissions
 */
export class TrustCircleManager {
  private circles: Map<string, TrustCircle> = new Map();
  private contacts: Map<string, ContactTrust> = new Map();
  private userId: string;
  private publicKey: string;

  constructor(userId: string, publicKey: string, config?: Partial<ZkGpsConfig>) {
    this.userId = userId;
    this.publicKey = publicKey;

    // Initialize with default circles
    const defaultCircles = config?.trustCircles ?? DEFAULT_ZKGPS_CONFIG.trustCircles ?? [];
    for (const circle of defaultCircles) {
      this.circles.set(circle.id, { ...circle });
    }

    // Initialize contacts
    const defaultContacts = config?.contacts ?? [];
    for (const contact of defaultContacts) {
      this.contacts.set(contact.contactId, { ...contact });
    }
  }

  // ===========================================================================
  // Circle Management
  // ===========================================================================

  /**
   * Create a new trust circle
   */
  createCircle(params: {
    name: string;
    level: TrustLevel;
    customPrecision?: GeohashPrecision;
    updateInterval?: number;
    requireMutual?: boolean;
  }): TrustCircle {
    const circle: TrustCircle = {
      id: generateSalt(8),
      name: params.name,
      level: params.level,
      customPrecision: params.customPrecision,
      members: [],
      updateInterval: params.updateInterval ?? this.getDefaultInterval(params.level),
      requireMutual: params.requireMutual ?? params.level === 'intimate' || params.level === 'close',
      enabled: true,
    };

    this.circles.set(circle.id, circle);
    return circle;
  }

  /**
   * Get default update interval for a trust level (ms)
   */
  private getDefaultInterval(level: TrustLevel): number {
    switch (level) {
      case 'intimate':
        return 10000; // 10 seconds
      case 'close':
        return 60000; // 1 minute
      case 'friends':
        return 300000; // 5 minutes
      case 'network':
        return 900000; // 15 minutes
      case 'public':
        return 3600000; // 1 hour
    }
  }

  /**
   * Update a trust circle
   */
  updateCircle(circleId: string, updates: Partial<TrustCircle>): TrustCircle | null {
    const circle = this.circles.get(circleId);
    if (!circle) return null;

    const updated = { ...circle, ...updates, id: circleId };
    this.circles.set(circleId, updated);
    return updated;
  }

  /**
   * Delete a trust circle
   */
  deleteCircle(circleId: string): boolean {
    // Remove circle from all contacts
    for (const [contactId, contact] of this.contacts) {
      if (contact.circles.includes(circleId)) {
        contact.circles = contact.circles.filter((c) => c !== circleId);
        this.contacts.set(contactId, contact);
      }
    }

    return this.circles.delete(circleId);
  }

  /**
   * Get a circle by ID
   */
  getCircle(circleId: string): TrustCircle | undefined {
    return this.circles.get(circleId);
  }

  /**
   * Get all circles
   */
  getAllCircles(): TrustCircle[] {
    return Array.from(this.circles.values());
  }

  /**
   * Get enabled circles
   */
  getEnabledCircles(): TrustCircle[] {
    return Array.from(this.circles.values()).filter((c) => c.enabled);
  }

  // ===========================================================================
  // Member Management
  // ===========================================================================

  /**
   * Add a contact to a circle
   */
  addToCircle(circleId: string, contactId: string): boolean {
    const circle = this.circles.get(circleId);
    if (!circle) return false;

    if (!circle.members.includes(contactId)) {
      circle.members.push(contactId);
    }

    // Update or create contact trust record
    let contact = this.contacts.get(contactId);
    if (!contact) {
      contact = {
        contactId,
        circles: [],
        paused: false,
      };
    }

    if (!contact.circles.includes(circleId)) {
      contact.circles.push(circleId);
    }

    this.contacts.set(contactId, contact);
    return true;
  }

  /**
   * Remove a contact from a circle
   */
  removeFromCircle(circleId: string, contactId: string): boolean {
    const circle = this.circles.get(circleId);
    if (!circle) return false;

    circle.members = circle.members.filter((m) => m !== contactId);

    const contact = this.contacts.get(contactId);
    if (contact) {
      contact.circles = contact.circles.filter((c) => c !== circleId);
      this.contacts.set(contactId, contact);
    }

    return true;
  }

  /**
   * Check if a contact is in a circle
   */
  isInCircle(circleId: string, contactId: string): boolean {
    const circle = this.circles.get(circleId);
    return circle?.members.includes(contactId) ?? false;
  }

  // ===========================================================================
  // Contact Management
  // ===========================================================================

  /**
   * Get contact trust settings
   */
  getContactTrust(contactId: string): ContactTrust | undefined {
    return this.contacts.get(contactId);
  }

  /**
   * Set a precision override for a specific contact
   */
  setContactPrecision(contactId: string, precision: GeohashPrecision | undefined): void {
    let contact = this.contacts.get(contactId);
    if (!contact) {
      contact = {
        contactId,
        circles: [],
        paused: false,
      };
    }
    contact.precisionOverride = precision;
    this.contacts.set(contactId, contact);
  }

  /**
   * Pause location sharing with a contact
   */
  pauseContact(contactId: string): void {
    let contact = this.contacts.get(contactId);
    if (!contact) {
      contact = {
        contactId,
        circles: [],
        paused: true,
      };
    } else {
      contact.paused = true;
    }
    this.contacts.set(contactId, contact);
  }

  /**
   * Resume location sharing with a contact
   */
  resumeContact(contactId: string): void {
    const contact = this.contacts.get(contactId);
    if (contact) {
      contact.paused = false;
      this.contacts.set(contactId, contact);
    }
  }

  // ===========================================================================
  // Precision Resolution
  // ===========================================================================

  /**
   * Get the precision level for a specific contact
   *
   * Priority:
   * 1. Contact-specific override
   * 2. Highest precision circle they belong to
   * 3. Public level (or no sharing if not in any circle)
   */
  getPrecisionForContact(contactId: string): GeohashPrecision | null {
    const contact = this.contacts.get(contactId);

    // If contact is paused, no sharing
    if (contact?.paused) {
      return null;
    }

    // Check for override
    if (contact?.precisionOverride !== undefined) {
      return contact.precisionOverride;
    }

    // Find highest precision circle
    let highestPrecision: GeohashPrecision | null = null;

    for (const circle of this.circles.values()) {
      if (!circle.enabled) continue;
      if (!circle.members.includes(contactId)) continue;

      const circlePrecision = circle.customPrecision ?? TRUST_LEVEL_PRECISION[circle.level];

      if (highestPrecision === null || circlePrecision > highestPrecision) {
        highestPrecision = circlePrecision;
      }
    }

    return highestPrecision;
  }

  /**
   * Get all contacts at a specific precision level or higher
   */
  getContactsAtPrecision(minPrecision: GeohashPrecision): string[] {
    const contacts: string[] = [];

    for (const [contactId] of this.contacts) {
      const precision = this.getPrecisionForContact(contactId);
      if (precision !== null && precision >= minPrecision) {
        contacts.push(contactId);
      }
    }

    return contacts;
  }

  /**
   * Get precision level for a trust level
   */
  getPrecisionForLevel(level: TrustLevel): GeohashPrecision {
    return TRUST_LEVEL_PRECISION[level];
  }

  // ===========================================================================
  // Broadcast Helpers
  // ===========================================================================

  /**
   * Determine which circles need to receive a location update
   * based on time since last update
   */
  getCirclesNeedingUpdate(lastUpdateTimes: Map<string, number>): TrustCircle[] {
    const now = Date.now();
    const needsUpdate: TrustCircle[] = [];

    for (const circle of this.circles.values()) {
      if (!circle.enabled) continue;
      if (circle.members.length === 0) continue;

      const lastUpdate = lastUpdateTimes.get(circle.id) ?? 0;
      if (now - lastUpdate >= circle.updateInterval) {
        needsUpdate.push(circle);
      }
    }

    return needsUpdate;
  }

  /**
   * Create commitments for each circle based on current location
   * Returns a map of circleId -> encrypted commitment
   */
  async createCircleCommitments(
    coordinate: { lat: number; lng: number },
    createCommitmentFn: (precision: GeohashPrecision) => Promise<LocationCommitment>
  ): Promise<Map<string, { commitment: LocationCommitment; precision: GeohashPrecision }>> {
    const commitments = new Map<
      string,
      { commitment: LocationCommitment; precision: GeohashPrecision }
    >();

    for (const circle of this.circles.values()) {
      if (!circle.enabled) continue;
      if (circle.members.length === 0) continue;

      const precision = circle.customPrecision ?? TRUST_LEVEL_PRECISION[circle.level];
      const commitment = await createCommitmentFn(precision);

      commitments.set(circle.id, { commitment, precision });
    }

    return commitments;
  }

  // ===========================================================================
  // Mutual Verification
  // ===========================================================================

  /**
   * Check if mutual membership requirement is satisfied
   *
   * @param theirUserId The other user's ID
   * @param theirCircles Their trust circles (if known)
   * @returns true if mutual requirement is satisfied
   */
  checkMutualMembership(
    theirUserId: string,
    theirCircles?: Map<string, TrustCircle>
  ): boolean {
    // Get circles that require mutual membership and include them
    const ourMutualCircles = Array.from(this.circles.values()).filter(
      (c) => c.requireMutual && c.members.includes(theirUserId)
    );

    if (ourMutualCircles.length === 0) {
      // No mutual circles containing them
      return true;
    }

    if (!theirCircles) {
      // We require mutual but don't have their circles - fail
      return false;
    }

    // Check if they have us in any of their mutual circles
    for (const theirCircle of theirCircles.values()) {
      if (theirCircle.requireMutual && theirCircle.members.includes(this.userId)) {
        return true;
      }
    }

    return false;
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export configuration for storage
   */
  export(): { circles: TrustCircle[]; contacts: ContactTrust[] } {
    return {
      circles: Array.from(this.circles.values()),
      contacts: Array.from(this.contacts.values()),
    };
  }

  /**
   * Import configuration from storage
   */
  import(data: { circles: TrustCircle[]; contacts: ContactTrust[] }): void {
    this.circles.clear();
    this.contacts.clear();

    for (const circle of data.circles) {
      this.circles.set(circle.id, circle);
    }

    for (const contact of data.contacts) {
      this.contacts.set(contact.contactId, contact);
    }
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    circleCount: number;
    enabledCircleCount: number;
    contactCount: number;
    pausedContactCount: number;
  } {
    const circles = Array.from(this.circles.values());
    const contacts = Array.from(this.contacts.values());

    return {
      circleCount: circles.length,
      enabledCircleCount: circles.filter((c) => c.enabled).length,
      contactCount: contacts.length,
      pausedContactCount: contacts.filter((c) => c.paused).length,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a trust circle manager with default configuration
 */
export function createTrustCircleManager(
  userId: string,
  publicKey: string
): TrustCircleManager {
  return new TrustCircleManager(userId, publicKey, DEFAULT_ZKGPS_CONFIG);
}

/**
 * Create a trust circle manager from saved configuration
 */
export function loadTrustCircleManager(
  userId: string,
  publicKey: string,
  savedConfig: { circles: TrustCircle[]; contacts: ContactTrust[] }
): TrustCircleManager {
  const manager = new TrustCircleManager(userId, publicKey, {
    trustCircles: [],
    contacts: [],
  });
  manager.import(savedConfig);
  return manager;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get human-readable description of trust level
 */
export function describeTrustLevel(level: TrustLevel): string {
  const descriptions: Record<TrustLevel, string> = {
    intimate: 'Exact location (~1m) - Partners, family in same house',
    close: 'Building level (~38m) - Close friends and family',
    friends: 'Neighborhood (~1.2km) - Regular friends',
    network: 'Metro area (~39km) - Acquaintances',
    public: 'Large region (~1250km) - Public visibility',
  };
  return descriptions[level];
}

/**
 * Get trust level from precision
 */
export function getTrustLevelFromPrecision(precision: GeohashPrecision): TrustLevel {
  if (precision >= 10) return 'intimate';
  if (precision >= 8) return 'close';
  if (precision >= 6) return 'friends';
  if (precision >= 4) return 'network';
  return 'public';
}

/**
 * Validate a trust circle configuration
 */
export function validateCircle(circle: Partial<TrustCircle>): string[] {
  const errors: string[] = [];

  if (!circle.name || circle.name.trim().length === 0) {
    errors.push('Circle name is required');
  }

  if (!circle.level || !['intimate', 'close', 'friends', 'network', 'public'].includes(circle.level)) {
    errors.push('Invalid trust level');
  }

  if (circle.customPrecision !== undefined) {
    if (circle.customPrecision < 1 || circle.customPrecision > 12) {
      errors.push('Custom precision must be between 1 and 12');
    }
  }

  if (circle.updateInterval !== undefined && circle.updateInterval < 1000) {
    errors.push('Update interval must be at least 1 second (1000ms)');
  }

  return errors;
}
