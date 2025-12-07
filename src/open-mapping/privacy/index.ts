/**
 * zkGPS Privacy Module
 *
 * Privacy-preserving location sharing protocol that enables:
 * - Variable precision location sharing via trust circles
 * - Proximity proofs without revealing exact location
 * - Region membership proofs
 * - Temporal presence proofs
 * - Group proximity verification
 */

// Core types
export * from './types';

// Geohash encoding/decoding
export {
  encode as encodeGeohash,
  decode as decodeGeohash,
  decodeBounds,
  decodeBounds as getGeohashBounds,
  neighbors,
  contains,
  cellsInRadius,
  cellsInPolygon,
  truncate,
  sharesPrefix,
  precisionForRadius,
  GEOHASH_PRECISION,
  PRECISION_CELL_SIZE,
  type GeohashBounds,
  type GeohashPrecision,
} from './geohash';

// Commitments
export {
  generateSalt,
  sha256,
  createCommitment,
  verifyCommitment,
  commitmentMatchesPrefix,
  signCommitment,
  verifySignedCommitment,
  generateKeyPair,
  CommitmentStore,
} from './commitments';

// Proofs
export {
  generateProximityProof,
  verifyProximityProof,
  generateRegionProof,
  verifyRegionProof,
  generateGroupProximityProof,
  generateTemporalProof,
  areLocationsProximate,
  isLocationInRegion,
  getDistance,
  type GroupParticipant,
  type HistoryEntry,
} from './proofs';

// Trust circles
export {
  TrustCircleManager,
  createTrustCircleManager,
  loadTrustCircleManager,
  describeTrustLevel,
  getTrustLevelFromPrecision,
  validateCircle,
} from './trustCircles';
