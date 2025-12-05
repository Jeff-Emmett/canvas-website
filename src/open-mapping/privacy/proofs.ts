/**
 * Proximity Proofs for zkGPS
 *
 * Implements zero-knowledge proofs for location claims:
 * - Proximity proofs: "I am within X meters of point P"
 * - Region membership: "I am inside region R"
 * - Group proximity: "All N participants are within X meters"
 *
 * MVP uses geohash cell intersection (simple but effective).
 * Future versions can use proper ZK circuits (Bulletproofs, Groth16).
 */

import {
  encode as geohashEncode,
  cellsInRadius,
  cellsInPolygon,
  sharesPrefix,
  precisionForRadius,
  PRECISION_CELL_SIZE,
} from './geohash';
import { createCommitment, sha256, generateSalt } from './commitments';
import type {
  Coordinate,
  ProximityProof,
  RegionProof,
  GroupProximityProof,
  TemporalProof,
  LocationCommitment,
  GeohashPrecision,
} from './types';

// =============================================================================
// Proximity Proofs
// =============================================================================

/**
 * Generate a proximity proof
 *
 * Proves that the prover is within `maxDistance` meters of `targetPoint`
 * without revealing their exact location.
 *
 * @param myLocation The prover's actual location (kept secret)
 * @param targetPoint The public target point
 * @param maxDistance Maximum distance in meters
 * @param privateKey Prover's private key for signing
 * @param publicKey Prover's public key
 * @returns Proximity proof
 */
export async function generateProximityProof(
  myLocation: Coordinate,
  targetPoint: Coordinate,
  maxDistance: number,
  privateKey: string,
  publicKey: string
): Promise<ProximityProof> {
  // Determine appropriate precision for the distance
  const precision = precisionForRadius(maxDistance);

  // Get all geohash cells that intersect the proximity circle
  const validCells = cellsInRadius(
    targetPoint.lat,
    targetPoint.lng,
    maxDistance,
    precision
  );

  // Get my geohash at this precision
  const myGeohash = geohashEncode(myLocation.lat, myLocation.lng, precision);

  // Check if I'm in one of the valid cells
  const isProximate = validCells.includes(myGeohash);

  // Generate proof data
  // In MVP, we reveal the precision level and the fact that we're in a valid cell
  // without revealing which specific cell
  const proofData = {
    precision,
    validCellCount: validCells.length,
    // Commitment to our cell (without revealing which one)
    cellCommitment: await sha256(`${myGeohash}|${generateSalt(16)}`),
    // Merkle root of valid cells (for verification)
    validCellsRoot: await computeMerkleRoot(validCells),
  };

  const proofId = await sha256(`proximity|${Date.now()}|${generateSalt(8)}`);
  const timestamp = Date.now();

  // Create signature over the proof
  const signatureMessage = `${proofId}|${timestamp}|${isProximate}|${targetPoint.lat}|${targetPoint.lng}|${maxDistance}`;
  const signature = await sha256(`${signatureMessage}|${privateKey}`);

  return {
    type: 'proximity',
    proofId,
    timestamp,
    proverPublicKey: publicKey,
    proof: JSON.stringify(proofData),
    signature,
    targetPoint,
    maxDistance,
    result: isProximate,
  };
}

/**
 * Verify a proximity proof
 *
 * Note: In this MVP, we trust the proof result. A full ZK implementation
 * would cryptographically verify the proof without trusting the prover.
 *
 * @param proof The proximity proof to verify
 * @returns true if the proof structure is valid
 */
export async function verifyProximityProof(
  proof: ProximityProof
): Promise<boolean> {
  try {
    const proofData = JSON.parse(proof.proof);

    // Verify proof has required fields
    if (!proofData.precision || !proofData.validCellCount || !proofData.validCellsRoot) {
      return false;
    }

    // Verify timestamp is recent (within 5 minutes)
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - proof.timestamp > maxAge) {
      return false;
    }

    // Recompute valid cells and verify merkle root
    const validCells = cellsInRadius(
      proof.targetPoint.lat,
      proof.targetPoint.lng,
      proof.maxDistance,
      proofData.precision
    );

    const expectedRoot = await computeMerkleRoot(validCells);
    if (expectedRoot !== proofData.validCellsRoot) {
      return false;
    }

    // Verify cell count matches
    if (validCells.length !== proofData.validCellCount) {
      return false;
    }

    // In a full ZK implementation, we would verify the cryptographic proof
    // that the prover's cell commitment is in the valid set

    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Region Membership Proofs
// =============================================================================

/**
 * Generate a region membership proof
 *
 * Proves that the prover is inside a polygon region without revealing
 * their exact position within the region.
 *
 * @param myLocation The prover's actual location
 * @param regionPolygon Array of [lat, lng] points defining the region
 * @param regionId Unique identifier for this region
 * @param regionName Human-readable region name
 * @param privateKey Prover's private key
 * @param publicKey Prover's public key
 * @returns Region membership proof
 */
export async function generateRegionProof(
  myLocation: Coordinate,
  regionPolygon: [number, number][],
  regionId: string,
  regionName: string,
  privateKey: string,
  publicKey: string
): Promise<RegionProof> {
  // Determine precision based on region size
  const bounds = getPolygonBounds(regionPolygon);
  const regionSizeMeters = Math.max(
    haversineDistance(bounds.minLat, bounds.minLng, bounds.maxLat, bounds.minLng),
    haversineDistance(bounds.minLat, bounds.minLng, bounds.minLat, bounds.maxLng)
  );
  const precision = precisionForRadius(regionSizeMeters / 4);

  // Get all cells in the region
  const regionCells = cellsInPolygon(regionPolygon, precision);

  // Get my geohash
  const myGeohash = geohashEncode(myLocation.lat, myLocation.lng, precision);

  // Check if I'm in the region
  const isInRegion = regionCells.includes(myGeohash);

  // Generate proof data
  const proofData = {
    precision,
    regionCellCount: regionCells.length,
    regionCellsRoot: await computeMerkleRoot(regionCells),
    cellCommitment: await sha256(`${myGeohash}|${generateSalt(16)}`),
  };

  const proofId = await sha256(`region|${regionId}|${Date.now()}`);
  const timestamp = Date.now();

  const signatureMessage = `${proofId}|${timestamp}|${isInRegion}|${regionId}`;
  const signature = await sha256(`${signatureMessage}|${privateKey}`);

  return {
    type: 'region',
    proofId,
    timestamp,
    proverPublicKey: publicKey,
    proof: JSON.stringify(proofData),
    signature,
    regionId,
    regionName,
    result: isInRegion,
  };
}

/**
 * Verify a region membership proof
 */
export async function verifyRegionProof(
  proof: RegionProof,
  regionPolygon: [number, number][]
): Promise<boolean> {
  try {
    const proofData = JSON.parse(proof.proof);

    // Verify timestamp
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - proof.timestamp > maxAge) {
      return false;
    }

    // Recompute region cells
    const regionCells = cellsInPolygon(regionPolygon, proofData.precision);

    // Verify merkle root
    const expectedRoot = await computeMerkleRoot(regionCells);
    if (expectedRoot !== proofData.regionCellsRoot) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Group Proximity Proofs
// =============================================================================

/**
 * Participant's commitment for group proximity proof
 */
export interface GroupParticipant {
  publicKey: string;
  commitment: LocationCommitment;
}

/**
 * Generate a group proximity proof
 *
 * Proves that all participants are within `maxDistance` of each other.
 * This requires coordination between all participants.
 *
 * @param participants Array of participant commitments
 * @param maxDistance Maximum pairwise distance in meters
 * @param coordinatorPrivateKey Coordinator's private key
 * @param coordinatorPublicKey Coordinator's public key
 * @returns Group proximity proof
 */
export async function generateGroupProximityProof(
  participants: GroupParticipant[],
  maxDistance: number,
  coordinatorPrivateKey: string,
  coordinatorPublicKey: string
): Promise<GroupProximityProof> {
  const precision = precisionForRadius(maxDistance);

  // Extract revealed prefixes from commitments
  const prefixes = participants
    .map((p) => p.commitment.revealedPrefix)
    .filter((p): p is string => p !== undefined);

  // Check if all participants share a common prefix at appropriate precision
  // For group proximity, we check if all prefixes are compatible
  const minPrefixLength = Math.min(...prefixes.map((p) => p.length));
  const compatiblePrecision = Math.min(precision, minPrefixLength);

  let allProximate = true;
  for (let i = 0; i < prefixes.length && allProximate; i++) {
    for (let j = i + 1; j < prefixes.length && allProximate; j++) {
      if (!sharesPrefix(prefixes[i], prefixes[j], compatiblePrecision)) {
        allProximate = false;
      }
    }
  }

  // Generate proof
  const proofId = await sha256(`group|${Date.now()}|${generateSalt(8)}`);
  const timestamp = Date.now();

  const proofData = {
    precision: compatiblePrecision,
    participantCount: participants.length,
    commitmentsRoot: await computeMerkleRoot(
      participants.map((p) => p.commitment.commitment)
    ),
  };

  const signatureMessage = `${proofId}|${timestamp}|${allProximate}|${participants.length}|${maxDistance}`;
  const signature = await sha256(`${signatureMessage}|${coordinatorPrivateKey}`);

  return {
    type: 'group',
    proofId,
    timestamp,
    proverPublicKey: coordinatorPublicKey,
    proof: JSON.stringify(proofData),
    signature,
    participants: participants.map((p) => p.publicKey),
    maxDistance,
    result: allProximate,
    // Don't reveal centroid unless explicitly needed
  };
}

// =============================================================================
// Temporal Proofs
// =============================================================================

/**
 * Location history entry for temporal proofs
 */
export interface HistoryEntry {
  commitment: LocationCommitment;
  coordinate: Coordinate; // Only stored locally, never shared
  salt: string;
}

/**
 * Generate a temporal presence proof
 *
 * Proves that the prover was at a location during a time range.
 *
 * @param history Array of signed location commitments with timestamps
 * @param targetLocation Target location or region
 * @param timeRange Start and end timestamps
 * @param privateKey Prover's private key
 * @param publicKey Prover's public key
 */
export async function generateTemporalProof(
  history: HistoryEntry[],
  targetLocation: Coordinate,
  timeRange: { start: number; end: number },
  maxDistance: number,
  privateKey: string,
  publicKey: string
): Promise<TemporalProof> {
  // Filter history to time range
  const relevantHistory = history.filter(
    (h) =>
      h.commitment.timestamp >= timeRange.start &&
      h.commitment.timestamp <= timeRange.end
  );

  // Check if any entries are within distance of target
  const precision = precisionForRadius(maxDistance);
  const validCells = cellsInRadius(
    targetLocation.lat,
    targetLocation.lng,
    maxDistance,
    precision
  );

  let wasPresent = false;
  for (const entry of relevantHistory) {
    const entryGeohash = geohashEncode(
      entry.coordinate.lat,
      entry.coordinate.lng,
      precision
    );
    if (validCells.includes(entryGeohash)) {
      wasPresent = true;
      break;
    }
  }

  const proofId = await sha256(`temporal|${Date.now()}|${generateSalt(8)}`);
  const timestamp = Date.now();

  const proofData = {
    precision,
    historyCount: relevantHistory.length,
    timeRange,
    commitmentsRoot: await computeMerkleRoot(
      relevantHistory.map((h) => h.commitment.commitment)
    ),
  };

  const signatureMessage = `${proofId}|${timestamp}|${wasPresent}|${timeRange.start}|${timeRange.end}`;
  const signature = await sha256(`${signatureMessage}|${privateKey}`);

  return {
    type: 'temporal',
    proofId,
    timestamp,
    proverPublicKey: publicKey,
    proof: JSON.stringify(proofData),
    signature,
    location: targetLocation,
    timeRange,
    result: wasPresent,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute a simple merkle root from an array of strings
 */
async function computeMerkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) {
    return sha256('empty');
  }

  // Sort leaves for deterministic ordering
  const sortedLeaves = [...leaves].sort();

  // Hash all leaves
  let currentLevel = await Promise.all(sortedLeaves.map((l) => sha256(l)));

  // Build tree
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left; // Duplicate last if odd
      nextLevel.push(await sha256(`${left}|${right}`));
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Get bounding box of a polygon
 */
function getPolygonBounds(polygon: [number, number][]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLng = Infinity,
    maxLng = -Infinity;

  for (const [lat, lng] of polygon) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Haversine distance between two points (meters)
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// =============================================================================
// Quick Proof Utilities
// =============================================================================

/**
 * Quick check if two locations are within a distance
 * (Used for testing without full proof generation)
 */
export function areLocationsProximate(
  loc1: Coordinate,
  loc2: Coordinate,
  maxDistanceMeters: number
): boolean {
  const distance = haversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
  return distance <= maxDistanceMeters;
}

/**
 * Quick check if a location is in a region
 */
export function isLocationInRegion(
  location: Coordinate,
  polygon: [number, number][]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    if (
      yi > location.lat !== yj > location.lat &&
      location.lng < ((xj - xi) * (location.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Get distance between two locations in meters
 */
export function getDistance(loc1: Coordinate, loc2: Coordinate): number {
  return haversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
}
