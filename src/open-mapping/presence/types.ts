/**
 * Real-Time Location Presence System
 *
 * Privacy-preserving location sharing for collaborative mapping.
 * Each user's location is shared at different precision levels
 * based on their trust circle configuration with other participants.
 *
 * Key concepts:
 * - LocationPresence: A user's current location with privacy controls
 * - PresenceView: How a user sees another user's location (precision varies)
 * - PresenceBroadcast: The data sent over the network (encrypted/committed)
 * - PresenceChannel: Real-time sync channel for presence updates
 */

import type { TrustLevel, GeohashCommitment, ProximityProof } from '../privacy/types';

// =============================================================================
// Location Presence
// =============================================================================

/**
 * A user's presence state
 */
export interface UserPresence {
  /** User's public key (identity) */
  pubKey: string;

  /** Display name */
  displayName: string;

  /** User's chosen color for map display */
  color: string;

  /** Current location presence */
  location: LocationPresence | null;

  /** Online status */
  status: PresenceStatus;

  /** Last activity timestamp */
  lastSeen: Date;

  /** Custom status message */
  statusMessage?: string;

  /** Whether user is actively moving */
  isMoving: boolean;

  /** Device type (for icon selection) */
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
}

/**
 * Online status
 */
export type PresenceStatus =
  | 'online'       // Actively sharing location
  | 'away'         // Online but inactive
  | 'busy'         // Do not disturb
  | 'invisible'    // Online but hidden
  | 'offline';     // Not connected

/**
 * A location with privacy controls
 */
export interface LocationPresence {
  /** Full precision coordinates (only stored locally) */
  coordinates: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
  };

  /** zkGPS commitment for the location */
  commitment: GeohashCommitment;

  /** Timestamp of this location reading */
  timestamp: Date;

  /** Source of the location */
  source: LocationSource;

  /** Whether this is a live/updating location */
  isLive: boolean;

  /** Battery level (for mobile devices) */
  batteryLevel?: number;
}

/**
 * Location data sources
 */
export type LocationSource =
  | 'gps'           // Device GPS
  | 'network'       // Cell/WiFi triangulation
  | 'manual'        // User-entered location
  | 'beacon'        // BLE beacon
  | 'nfc'           // NFC tag scan
  | 'ip'            // IP geolocation
  | 'cached';       // Last known location

// =============================================================================
// Presence Broadcasting
// =============================================================================

/**
 * Data broadcast over the network
 * Contains only commitment, not raw coordinates
 */
export interface PresenceBroadcast {
  /** Sender's public key */
  senderPubKey: string;

  /** Message type */
  type: 'location' | 'status' | 'proximity' | 'leave';

  /** Payload depends on type */
  payload: LocationBroadcastPayload | StatusBroadcastPayload | ProximityBroadcastPayload | null;

  /** Signature from sender */
  signature: string;

  /** Timestamp */
  timestamp: Date;

  /** Sequence number (for ordering) */
  sequence: number;

  /** TTL in seconds (for expiry) */
  ttl: number;
}

/**
 * Location broadcast payload
 */
export interface LocationBroadcastPayload {
  /** zkGPS commitment (hides exact location) */
  commitment: GeohashCommitment;

  /** Geohash at various precision levels for different trust circles */
  precisionLevels: PrecisionLevel[];

  /** Whether actively moving */
  isMoving: boolean;

  /** Heading (if sharing) */
  heading?: number;

  /** Speed category (not exact) */
  speedCategory?: 'stationary' | 'walking' | 'cycling' | 'driving' | 'flying';
}

/**
 * Precision level for a trust circle
 */
export interface PrecisionLevel {
  /** Trust level this precision is for */
  trustLevel: TrustLevel;

  /** Geohash at this precision (truncated) */
  geohash: string;

  /** Precision (1-12 characters) */
  precision: number;

  /** Encrypted full geohash for this trust level (optional) */
  encryptedGeohash?: string;
}

/**
 * Status broadcast payload
 */
export interface StatusBroadcastPayload {
  /** New status */
  status: PresenceStatus;

  /** Status message */
  message?: string;

  /** Device type */
  deviceType?: UserPresence['deviceType'];
}

/**
 * Proximity broadcast payload
 * Proves proximity without revealing location
 */
export interface ProximityBroadcastPayload {
  /** Target user we're proving proximity to */
  targetPubKey: string;

  /** Proximity proof */
  proof: ProximityProof;

  /** Approximate distance category */
  distanceCategory: 'here' | 'nearby' | 'same-area' | 'same-city' | 'far';
}

// =============================================================================
// Presence Views
// =============================================================================

/**
 * How a user appears to another user
 * Precision depends on trust relationship
 */
export interface PresenceView {
  /** The user being viewed */
  user: {
    pubKey: string;
    displayName: string;
    color: string;
  };

  /** Location at viewer's allowed precision */
  location: ViewableLocation | null;

  /** Status */
  status: PresenceStatus;

  /** Last seen */
  lastSeen: Date;

  /** Trust level viewer has with this user */
  trustLevel: TrustLevel;

  /** Whether location is verified (has valid commitment) */
  isVerified: boolean;

  /** Proximity to viewer (if calculable) */
  proximity?: ProximityInfo;
}

/**
 * Location visible to a specific viewer
 */
export interface ViewableLocation {
  /** Geohash at allowed precision */
  geohash: string;

  /** Precision level (1-12) */
  precision: number;

  /** Approximate center of the geohash cell */
  center: {
    latitude: number;
    longitude: number;
  };

  /** Bounding box of the geohash cell */
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };

  /** Uncertainty radius in meters */
  uncertaintyRadius: number;

  /** Age of the location in seconds */
  ageSeconds: number;

  /** Whether actively moving */
  isMoving: boolean;

  /** Direction of movement (if shared) */
  heading?: number;

  /** Speed category */
  speedCategory?: LocationBroadcastPayload['speedCategory'];
}

/**
 * Proximity information between two users
 */
export interface ProximityInfo {
  /** Distance category */
  category: ProximityBroadcastPayload['distanceCategory'];

  /** Whether there's a verified proximity proof */
  verified: boolean;

  /** Approximate distance in meters (if calculable) */
  approximateMeters?: number;

  /** Can they see each other with current precision? */
  mutuallyVisible: boolean;
}

// =============================================================================
// Presence Channel
// =============================================================================

/**
 * Configuration for presence channel
 */
export interface PresenceChannelConfig {
  /** Channel/room identifier */
  channelId: string;

  /** User's public key */
  userPubKey: string;

  /** User's private key for signing */
  userPrivKey: string;

  /** Display name */
  displayName: string;

  /** User color */
  color: string;

  /** Update interval in milliseconds */
  updateInterval: number;

  /** Location update throttle (min ms between updates) */
  locationThrottle: number;

  /** Presence TTL in seconds */
  presenceTtl: number;

  /** Whether to share location by default */
  shareLocationByDefault: boolean;

  /** Default precision for public sharing */
  defaultPublicPrecision: number;
}

/**
 * Default presence configuration
 */
export const DEFAULT_PRESENCE_CONFIG: Omit<PresenceChannelConfig, 'channelId' | 'userPubKey' | 'userPrivKey' | 'displayName' | 'color'> = {
  updateInterval: 5000,      // 5 seconds
  locationThrottle: 1000,    // 1 second minimum between location updates
  presenceTtl: 60,           // 1 minute TTL
  shareLocationByDefault: false,
  defaultPublicPrecision: 4, // ~20km precision for public
};

/**
 * Presence channel state
 */
export interface PresenceChannelState {
  /** Channel configuration */
  config: PresenceChannelConfig;

  /** Our own presence */
  self: UserPresence;

  /** Other users in the channel */
  others: Map<string, UserPresence>;

  /** Views of other users (with our trust-based precision) */
  views: Map<string, PresenceView>;

  /** Connection state */
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

  /** Last broadcast sequence number */
  lastSequence: number;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Presence events
 */
export type PresenceEvent =
  | { type: 'user:joined'; user: UserPresence }
  | { type: 'user:left'; pubKey: string }
  | { type: 'user:updated'; user: UserPresence; changes: string[] }
  | { type: 'location:updated'; pubKey: string; location: ViewableLocation }
  | { type: 'proximity:detected'; pubKey: string; proximity: ProximityInfo }
  | { type: 'status:changed'; pubKey: string; status: PresenceStatus }
  | { type: 'connection:changed'; state: PresenceChannelState['connectionState'] }
  | { type: 'error'; error: string };

export type PresenceEventListener = (event: PresenceEvent) => void;

// =============================================================================
// Geohash Utilities
// =============================================================================

/**
 * Precision to approximate radius mapping
 */
export const GEOHASH_PRECISION_RADIUS: Record<number, number> = {
  1: 2500000,  // ~2500km
  2: 630000,   // ~630km
  3: 78000,    // ~78km
  4: 20000,    // ~20km
  5: 2400,     // ~2.4km
  6: 610,      // ~610m
  7: 76,       // ~76m
  8: 19,       // ~19m
  9: 2.4,      // ~2.4m
  10: 0.6,     // ~60cm
  11: 0.074,   // ~7cm
  12: 0.019,   // ~2cm
};

/**
 * Trust level to default precision mapping
 */
export const TRUST_LEVEL_PRECISION: Record<TrustLevel, number> = {
  intimate: 9,    // ~2.4m (very precise)
  close: 7,       // ~76m (block level)
  friends: 5,     // ~2.4km (neighborhood)
  network: 4,     // ~20km (city area)
  public: 2,      // ~630km (region only)
};

/**
 * Get approximate radius for a precision level
 */
export function getRadiusForPrecision(precision: number): number {
  return GEOHASH_PRECISION_RADIUS[Math.min(12, Math.max(1, precision))] ?? 2500000;
}

/**
 * Get default precision for a trust level
 */
export function getPrecisionForTrustLevel(trustLevel: TrustLevel): number {
  return TRUST_LEVEL_PRECISION[trustLevel];
}
