/**
 * zkGPS Type Definitions
 *
 * Types for privacy-preserving location sharing protocol
 */

import type { GeohashPrecision as _GeohashPrecision } from './geohash';

// Re-export GeohashPrecision for convenience
export type GeohashPrecision = _GeohashPrecision;
export { GEOHASH_PRECISION } from './geohash';
export type { GeohashBounds } from './geohash';

/**
 * A geohash-based location commitment (alias for LocationCommitment)
 * Used in discovery and presence systems
 */
export interface GeohashCommitment {
  /** The commitment hash */
  commitment: string;
  /** The geohash prefix that is revealed */
  geohash: string;
  /** Precision level (1-12) */
  precision: GeohashPrecision;
  /** When this commitment was created */
  timestamp: number;
  /** When this commitment expires */
  expiresAt: number;
  /** Salt used in the commitment (for verification) */
  salt?: string;
}

// =============================================================================
// Core Location Types
// =============================================================================

/**
 * A geographic coordinate
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * A timestamped location record
 */
export interface TimestampedLocation {
  coordinate: Coordinate;
  timestamp: number; // Unix timestamp (ms)
  accuracy?: number; // Reported GPS accuracy (meters)
}

// =============================================================================
// Commitment Types
// =============================================================================

/**
 * A cryptographic commitment to a location
 */
export interface LocationCommitment {
  /** The commitment hash */
  commitment: string;

  /** Precision level (1-12) - determines how much location is revealed */
  precision: GeohashPrecision;

  /** When this commitment was created */
  timestamp: number;

  /** When this commitment expires */
  expiresAt: number;

  /** Optional: the geohash prefix that is publicly revealed */
  revealedPrefix?: string;
}

/**
 * Parameters for creating a commitment
 */
export interface CommitmentParams {
  coordinate: Coordinate;
  precision: GeohashPrecision;
  salt: string;
  expirationMs?: number; // How long until commitment expires
}

/**
 * A signed location commitment (for temporal proofs)
 */
export interface SignedCommitment extends LocationCommitment {
  /** Digital signature over the commitment */
  signature: string;

  /** Public key of the signer */
  signerPublicKey: string;
}

// =============================================================================
// Trust Circle Types
// =============================================================================

/**
 * Trust levels for location sharing
 */
export type TrustLevel = 'intimate' | 'close' | 'friends' | 'network' | 'public';

/**
 * Default precision mappings for trust levels
 */
export const TRUST_LEVEL_PRECISION: Record<TrustLevel, GeohashPrecision> = {
  intimate: 10,  // ~1.2m - exact position
  close: 8,      // ~38m - building level
  friends: 6,    // ~1.2km - neighborhood
  network: 4,    // ~39km - metro area
  public: 2,     // ~1250km - large region (or don't share at all)
};

/**
 * A trust circle configuration
 */
export interface TrustCircle {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Trust level (determines default precision) */
  level: TrustLevel;

  /** Override precision (if different from level default) */
  customPrecision?: GeohashPrecision;

  /** Member identifiers (user IDs or public keys) */
  members: string[];

  /** How often to broadcast location to this circle (ms) */
  updateInterval: number;

  /** Require mutual membership (both must have each other in circles) */
  requireMutual: boolean;

  /** Whether this circle is currently active */
  enabled: boolean;
}

/**
 * Trust circle membership for a specific contact
 */
export interface ContactTrust {
  /** Contact's user ID or public key */
  contactId: string;

  /** Which trust circles they belong to */
  circles: string[];

  /** Explicit precision override for this contact */
  precisionOverride?: GeohashPrecision;

  /** Whether location sharing is paused for this contact */
  paused: boolean;

  /** When sharing was last updated */
  lastUpdate?: number;
}

// =============================================================================
// Proof Types
// =============================================================================

/**
 * Types of proofs supported by zkGPS
 */
export type ProofType = 'proximity' | 'region' | 'temporal' | 'group';

/**
 * Base proof structure
 */
export interface BaseProof {
  /** Type of proof */
  type: ProofType;

  /** Unique proof identifier */
  proofId: string;

  /** When the proof was generated */
  timestamp: number;

  /** Public key of the prover */
  proverPublicKey: string;

  /** The actual proof data (format depends on type) */
  proof: string;

  /** Signature over the proof */
  signature: string;
}

/**
 * Proximity proof: "I am within X meters of point P"
 */
export interface ProximityProof extends BaseProof {
  type: 'proximity';

  /** The target point (public) */
  targetPoint: Coordinate;

  /** Maximum distance claimed (meters) */
  maxDistance: number;

  /** Result: true if prover is within distance */
  result: boolean;
}

/**
 * Region membership proof: "I am inside region R"
 */
export interface RegionProof extends BaseProof {
  type: 'region';

  /** Region identifier (hash of polygon or named region) */
  regionId: string;

  /** Human-readable region name */
  regionName?: string;

  /** Result: true if prover is inside region */
  result: boolean;
}

/**
 * Temporal proof: "I was at location L between T1 and T2"
 */
export interface TemporalProof extends BaseProof {
  type: 'temporal';

  /** Region or point being proven */
  location: Coordinate | string; // Coordinate or region ID

  /** Time range for the proof */
  timeRange: {
    start: number;
    end: number;
  };

  /** Result: true if prover was present during time range */
  result: boolean;
}

/**
 * Group proximity proof: "All participants are within X meters"
 */
export interface GroupProximityProof extends BaseProof {
  type: 'group';

  /** Participant public keys */
  participants: string[];

  /** Maximum pairwise distance (meters) */
  maxDistance: number;

  /** Result: true if all participants are proximate */
  result: boolean;

  /** Optional: centroid of the group (if proof succeeded) */
  centroid?: Coordinate;
}

/**
 * Union type for all proof types
 */
export type Proof = ProximityProof | RegionProof | TemporalProof | GroupProximityProof;

// =============================================================================
// Protocol Message Types
// =============================================================================

/**
 * Location broadcast message
 */
export interface LocationBroadcast {
  version: 1;
  type: 'location_broadcast';

  /** Sender identification */
  senderId: string;
  senderPublicKey: string;

  /** Commitments for each trust circle (encrypted) */
  commitments: {
    trustCircleId: string;
    encryptedCommitment: string;
    precision: GeohashPrecision;
  }[];

  /** Timestamp */
  timestamp: number;

  /** Signature over entire message */
  signature: string;
}

/**
 * Proximity query message
 */
export interface ProximityQuery {
  version: 1;
  type: 'proximity_query';

  /** Query identification */
  queryId: string;
  queryer: string;
  queryerPublicKey: string;

  /** Target user */
  targetUserId: string;

  /** Query parameters */
  maxDistance: number;

  /** Our commitment (for mutual verification) */
  ourCommitment: LocationCommitment;

  /** Timestamp */
  timestamp: number;

  /** Signature */
  signature: string;
}

/**
 * Proximity response message
 */
export interface ProximityResponse {
  version: 1;
  type: 'proximity_response';

  /** Query this responds to */
  queryId: string;

  /** Responder identification */
  responder: string;
  responderPublicKey: string;

  /** Response */
  isProximate: boolean;
  proof?: ProximityProof;

  /** Timestamp */
  timestamp: number;

  /** Signature */
  signature: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * zkGPS service configuration
 */
export interface ZkGpsConfig {
  /** User's key pair for signing */
  keyPair: {
    publicKey: string;
    privateKey: string;
  };

  /** Default trust circles */
  trustCircles: TrustCircle[];

  /** Contact-specific trust settings */
  contacts: ContactTrust[];

  /** Location update settings */
  locationSettings: {
    /** Minimum time between location updates (ms) */
    minUpdateInterval: number;

    /** Maximum age of a valid commitment (ms) */
    maxCommitmentAge: number;

    /** Whether to log location history (for temporal proofs) */
    enableHistory: boolean;

    /** How long to retain history (ms) */
    historyRetention: number;
  };

  /** Proof settings */
  proofSettings: {
    /** Whether to generate full ZK proofs (vs simple prefix matching) */
    useZkProofs: boolean;

    /** Minimum precision for any proof */
    minProofPrecision: GeohashPrecision;

    /** Rate limit for incoming queries (queries per minute) */
    queryRateLimit: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_ZKGPS_CONFIG: Partial<ZkGpsConfig> = {
  trustCircles: [
    {
      id: 'intimate',
      name: 'Intimate',
      level: 'intimate',
      members: [],
      updateInterval: 10000, // 10 seconds
      requireMutual: true,
      enabled: true,
    },
    {
      id: 'close',
      name: 'Close Friends & Family',
      level: 'close',
      members: [],
      updateInterval: 60000, // 1 minute
      requireMutual: true,
      enabled: true,
    },
    {
      id: 'friends',
      name: 'Friends',
      level: 'friends',
      members: [],
      updateInterval: 300000, // 5 minutes
      requireMutual: false,
      enabled: true,
    },
    {
      id: 'network',
      name: 'Network',
      level: 'network',
      members: [],
      updateInterval: 900000, // 15 minutes
      requireMutual: false,
      enabled: false, // Off by default
    },
  ],
  contacts: [],
  locationSettings: {
    minUpdateInterval: 5000, // 5 seconds minimum
    maxCommitmentAge: 300000, // 5 minutes
    enableHistory: false,
    historyRetention: 86400000, // 24 hours
  },
  proofSettings: {
    useZkProofs: false, // Start with simple prefix matching
    minProofPrecision: 4, // Never reveal more than metro-level in proofs
    queryRateLimit: 10, // 10 queries per minute max
  },
};
