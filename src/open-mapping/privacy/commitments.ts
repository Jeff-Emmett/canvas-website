/**
 * Location Commitment Scheme for zkGPS
 *
 * Implements hash-based commitments for privacy-preserving location sharing.
 * A commitment hides the exact location while allowing verification of
 * location claims at configurable precision levels.
 */

import { encode as geohashEncode } from './geohash';
import type {
  Coordinate,
  LocationCommitment,
  CommitmentParams,
  SignedCommitment,
  GeohashPrecision,
} from './types';

// =============================================================================
// Cryptographic Utilities
// =============================================================================

/**
 * Generate cryptographically secure random salt
 */
export function generateSalt(length: number = 32): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without crypto API
  let salt = '';
  for (let i = 0; i < length * 2; i++) {
    salt += Math.floor(Math.random() * 16).toString(16);
  }
  return salt;
}

/**
 * Compute SHA-256 hash of input string
 */
export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // For environments without SubtleCrypto, use a simple hash
  // This is NOT cryptographically secure and should only be used for testing
  console.warn('SubtleCrypto not available, using insecure hash');
  return simpleHash(message);
}

/**
 * Simple hash function for testing (NOT cryptographically secure)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
}

// =============================================================================
// Commitment Creation
// =============================================================================

/**
 * Create a location commitment
 *
 * The commitment hides the exact location while revealing only the
 * geohash prefix at the specified precision level.
 *
 * @param params Commitment parameters
 * @returns Location commitment
 */
export async function createCommitment(
  params: CommitmentParams
): Promise<LocationCommitment> {
  const { coordinate, precision, salt, expirationMs = 300000 } = params;

  // Encode location to geohash at full precision (for commitment)
  const fullGeohash = geohashEncode(coordinate.lat, coordinate.lng, 12);

  // Create commitment: Hash(geohash || salt)
  const commitmentInput = `${fullGeohash}|${salt}`;
  const commitment = await sha256(commitmentInput);

  // Calculate revealed prefix at requested precision
  const revealedPrefix = fullGeohash.slice(0, precision);

  const now = Date.now();

  return {
    commitment,
    precision: precision as GeohashPrecision,
    timestamp: now,
    expiresAt: now + expirationMs,
    revealedPrefix,
  };
}

/**
 * Verify a location commitment
 *
 * Given the original location and salt, verify that a commitment is valid.
 *
 * @param commitment The commitment to verify
 * @param coordinate The claimed location
 * @param salt The salt used when creating the commitment
 * @returns true if the commitment is valid
 */
export async function verifyCommitment(
  commitment: LocationCommitment,
  coordinate: Coordinate,
  salt: string
): Promise<boolean> {
  // Check if commitment has expired
  if (Date.now() > commitment.expiresAt) {
    return false;
  }

  // Recompute the commitment
  const fullGeohash = geohashEncode(coordinate.lat, coordinate.lng, 12);
  const commitmentInput = `${fullGeohash}|${salt}`;
  const recomputedCommitment = await sha256(commitmentInput);

  // Verify commitment matches
  if (recomputedCommitment !== commitment.commitment) {
    return false;
  }

  // Verify revealed prefix is consistent
  const expectedPrefix = fullGeohash.slice(0, commitment.precision);
  if (commitment.revealedPrefix && commitment.revealedPrefix !== expectedPrefix) {
    return false;
  }

  return true;
}

/**
 * Check if a commitment matches a claimed geohash prefix
 *
 * This allows verifying that someone is in a particular area without
 * knowing their exact location.
 *
 * @param commitment The commitment
 * @param claimedPrefix The geohash prefix they claim to be in
 * @returns true if the revealed prefix matches
 */
export function commitmentMatchesPrefix(
  commitment: LocationCommitment,
  claimedPrefix: string
): boolean {
  if (!commitment.revealedPrefix) {
    return false;
  }

  // Check if either prefix is a prefix of the other
  const shorter = Math.min(commitment.revealedPrefix.length, claimedPrefix.length);
  return (
    commitment.revealedPrefix.slice(0, shorter) === claimedPrefix.slice(0, shorter)
  );
}

// =============================================================================
// Commitment Signing
// =============================================================================

/**
 * Sign a commitment with a private key
 *
 * Creates a signed commitment that can be verified by others.
 * Uses Ed25519 or ECDSA depending on availability.
 *
 * @param commitment The commitment to sign
 * @param privateKey The signer's private key (hex)
 * @param publicKey The signer's public key (hex)
 * @returns Signed commitment
 */
export async function signCommitment(
  commitment: LocationCommitment,
  privateKey: string,
  publicKey: string
): Promise<SignedCommitment> {
  // Create message to sign: commitment hash + timestamp
  const message = `${commitment.commitment}|${commitment.timestamp}|${commitment.expiresAt}`;

  // Sign the message
  const signature = await signMessage(message, privateKey);

  return {
    ...commitment,
    signature,
    signerPublicKey: publicKey,
  };
}

/**
 * Verify a signed commitment
 *
 * @param signedCommitment The signed commitment to verify
 * @returns true if the signature is valid
 */
export async function verifySignedCommitment(
  signedCommitment: SignedCommitment
): Promise<boolean> {
  // Check expiration
  if (Date.now() > signedCommitment.expiresAt) {
    return false;
  }

  // Recreate the signed message
  const message = `${signedCommitment.commitment}|${signedCommitment.timestamp}|${signedCommitment.expiresAt}`;

  // Verify signature
  return verifySignature(
    message,
    signedCommitment.signature,
    signedCommitment.signerPublicKey
  );
}

// =============================================================================
// Key Generation and Signing Primitives
// =============================================================================

/**
 * Generate a new key pair for signing commitments
 *
 * @returns Object with publicKey and privateKey (hex encoded)
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      // Try to use ECDSA with P-256
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['sign', 'verify']
      );

      // Export keys
      const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      return {
        publicKey: bufferToHex(publicKeyBuffer),
        privateKey: bufferToHex(privateKeyBuffer),
      };
    } catch (e) {
      console.warn('ECDSA key generation failed, using fallback', e);
    }
  }

  // Fallback: generate random bytes as "keys" (NOT secure, testing only)
  console.warn('Using insecure key generation fallback');
  return {
    publicKey: generateSalt(32),
    privateKey: generateSalt(64),
  };
}

/**
 * Sign a message with a private key
 */
async function signMessage(message: string, privateKey: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      // Import the private key
      const keyBuffer = hexToBuffer(privateKey);
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );

      // Sign the message
      const messageBuffer = new TextEncoder().encode(message);
      const signatureBuffer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        messageBuffer
      );

      return bufferToHex(signatureBuffer);
    } catch (e) {
      console.warn('ECDSA signing failed, using fallback', e);
    }
  }

  // Fallback: HMAC-like construction (NOT secure, testing only)
  return sha256(`${message}|${privateKey}`);
}

/**
 * Verify a signature
 */
async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      // Import the public key
      const keyBuffer = hexToBuffer(publicKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      // Verify the signature
      const messageBuffer = new TextEncoder().encode(message);
      const signatureBuffer = hexToBuffer(signature);

      return crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        signatureBuffer,
        messageBuffer
      );
    } catch (e) {
      console.warn('ECDSA verification failed, using fallback', e);
    }
  }

  // Fallback: recompute and compare (NOT secure, testing only)
  const expected = await sha256(`${message}|${publicKey}`);
  return signature === expected;
}

// =============================================================================
// Utility Functions
// =============================================================================

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

// =============================================================================
// Commitment Store (for managing multiple commitments)
// =============================================================================

/**
 * In-memory commitment store for managing location commitments
 */
export class CommitmentStore {
  private commitments: Map<string, LocationCommitment> = new Map();
  private salts: Map<string, string> = new Map();

  /**
   * Create and store a new commitment
   */
  async createAndStore(
    coordinate: Coordinate,
    precision: GeohashPrecision,
    expirationMs?: number
  ): Promise<{ commitment: LocationCommitment; salt: string }> {
    const salt = generateSalt();
    const commitment = await createCommitment({
      coordinate,
      precision,
      salt,
      expirationMs,
    });

    this.commitments.set(commitment.commitment, commitment);
    this.salts.set(commitment.commitment, salt);

    return { commitment, salt };
  }

  /**
   * Get a commitment by its hash
   */
  get(commitmentHash: string): LocationCommitment | undefined {
    return this.commitments.get(commitmentHash);
  }

  /**
   * Get the salt for a commitment (only available to creator)
   */
  getSalt(commitmentHash: string): string | undefined {
    return this.salts.get(commitmentHash);
  }

  /**
   * Remove expired commitments
   */
  pruneExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [hash, commitment] of this.commitments) {
      if (commitment.expiresAt < now) {
        this.commitments.delete(hash);
        this.salts.delete(hash);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all active (non-expired) commitments
   */
  getActive(): LocationCommitment[] {
    const now = Date.now();
    return Array.from(this.commitments.values()).filter(
      (c) => c.expiresAt >= now
    );
  }

  /**
   * Clear all commitments
   */
  clear(): void {
    this.commitments.clear();
    this.salts.clear();
  }
}
