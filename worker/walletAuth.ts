/**
 * Wallet Authentication Module
 *
 * Handles signature verification for linking Ethereum wallets to CryptID accounts.
 * Uses EIP-191 personal_sign for EOA wallets.
 */

import {
  Environment,
  User,
  LinkedWallet,
  LinkedWalletResponse,
  WalletLinkRequest,
  WalletType
} from './types';
// @ts-ignore - noble packages have proper ESM exports
import { keccak_256 } from '@noble/hashes/sha3.js';
// @ts-ignore - noble packages have proper ESM exports
import { recoverPublicKey, Signature } from '@noble/secp256k1';

// =============================================================================
// Constants
// =============================================================================

// Maximum age for signature timestamps (5 minutes)
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

// Maximum wallets per user
const MAX_WALLETS_PER_USER = 10;

// =============================================================================
// Message Generation
// =============================================================================

/**
 * Generate the message that must be signed to link a wallet
 */
export function generateLinkMessage(
  username: string,
  address: string,
  timestamp: string,
  nonce: string
): string {
  return `Link wallet to enCryptID

Account: ${username}
Wallet: ${address}
Timestamp: ${timestamp}
Nonce: ${nonce}

This signature proves you own this wallet.`;
}

/**
 * Parse and validate a link message
 */
export function parseLinkMessage(message: string): {
  username: string;
  address: string;
  timestamp: string;
  nonce: string;
} | null {
  try {
    const lines = message.split('\n');

    // Find the relevant lines
    const accountLine = lines.find(l => l.startsWith('Account: '));
    const walletLine = lines.find(l => l.startsWith('Wallet: '));
    const timestampLine = lines.find(l => l.startsWith('Timestamp: '));
    const nonceLine = lines.find(l => l.startsWith('Nonce: '));

    if (!accountLine || !walletLine || !timestampLine || !nonceLine) {
      return null;
    }

    return {
      username: accountLine.replace('Account: ', '').trim(),
      address: walletLine.replace('Wallet: ', '').trim(),
      timestamp: timestampLine.replace('Timestamp: ', '').trim(),
      nonce: nonceLine.replace('Nonce: ', '').trim(),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Address Utilities
// =============================================================================

/**
 * Validate an Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Checksum an Ethereum address (EIP-55)
 * This is a simplified version - in production use viem's getAddress
 */
export function checksumAddress(address: string): string {
  // For now, just return lowercase - viem will handle proper checksumming
  return address.toLowerCase();
}

// =============================================================================
// Signature Verification
// =============================================================================

/**
 * Verify an EIP-191 personal_sign signature
 *
 * This uses the ecrecover approach to recover the signer address from the signature.
 * For Cloudflare Workers, we need to implement this without ethers/viem dependencies
 * in the worker bundle (they're too large).
 *
 * Instead, we use a lightweight approach with the Web Crypto API.
 */
export function verifyPersonalSignature(
  address: string,
  message: string,
  signature: string
): boolean {
  try {
    // The signature should be 65 bytes (130 hex chars + 0x prefix)
    if (!signature.startsWith('0x') || signature.length !== 132) {
      console.error('Invalid signature format');
      return false;
    }

    // For EIP-191 personal_sign, the message is prefixed with:
    // "\x19Ethereum Signed Message:\n" + message.length + message
    const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
    const prefixedMessage = prefix + message;

    // Hash the prefixed message with keccak256
    const messageHash = keccak256(prefixedMessage);

    // Parse signature components
    const r = signature.slice(2, 66);
    const s = signature.slice(66, 130);
    let v = parseInt(signature.slice(130, 132), 16);

    // Normalize v value (some wallets use 0/1, others use 27/28)
    if (v < 27) {
      v += 27;
    }

    // Recover the public key and derive the address
    const recoveredAddress = ecrecover(messageHash, v, r, s);

    if (!recoveredAddress) {
      return false;
    }

    // Compare addresses (case-insensitive)
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Keccak256 hash implementation using @noble/hashes
 */
function keccak256(message: string | Uint8Array): Uint8Array {
  if (typeof message === 'string') {
    const encoder = new TextEncoder();
    return keccak_256(encoder.encode(message));
  }
  return keccak_256(message);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Recover address from signature using @noble/secp256k1
 */
function ecrecover(
  messageHash: Uint8Array,
  v: number,
  r: string,
  s: string
): string | null {
  try {
    // Convert r and s to bytes
    const rBytes = hexToBytes(r);
    const sBytes = hexToBytes(s);

    // Combine r and s into signature (64 bytes compact format)
    const signature = new Uint8Array(64);
    signature.set(rBytes, 0);
    signature.set(sBytes, 32);

    // Recovery id is v - 27 (for non-EIP-155 signatures)
    const recoveryId = v - 27;

    if (recoveryId !== 0 && recoveryId !== 1) {
      console.error('Invalid recovery id:', recoveryId);
      return null;
    }

    // Recover the public key using @noble/secp256k1 v3 API
    // The signature needs to include the recovery bit (65 bytes: r || s || v)
    const recoveredSig = new Uint8Array(65);
    recoveredSig.set(signature, 0);
    recoveredSig[64] = recoveryId;

    // prehash: false because we already hashed the message with keccak256
    const pubKeyBytes = recoverPublicKey(recoveredSig, messageHash, {
      prehash: false,
    });

    if (!pubKeyBytes) {
      return null;
    }

    // Address is last 20 bytes of keccak256(pubkey without 0x04 prefix)
    // For uncompressed key (65 bytes), skip the first byte (0x04 prefix)
    const pubKeyHash = keccak256(pubKeyBytes.slice(1));
    const addressBytes = pubKeyHash.slice(-20);

    return '0x' + bytesToHex(addressBytes);
  } catch (error) {
    console.error('ecrecover error:', error);
    return null;
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Convert a LinkedWallet database record to API response format
 */
export function walletToResponse(wallet: LinkedWallet): LinkedWalletResponse {
  return {
    id: wallet.id,
    address: wallet.wallet_address,
    type: wallet.wallet_type,
    chainId: wallet.chain_id,
    label: wallet.label,
    ensName: wallet.ens_name,
    ensAvatar: wallet.ens_avatar,
    isPrimary: wallet.is_primary === 1,
    linkedAt: wallet.verified_at,
    lastUsedAt: wallet.last_used_at,
  };
}

/**
 * Get user by public key (from CryptID auth header)
 */
export async function getUserByPublicKey(
  db: D1Database,
  publicKey: string
): Promise<User | null> {
  const result = await db.prepare(`
    SELECT u.* FROM users u
    JOIN device_keys dk ON u.id = dk.user_id
    WHERE dk.public_key = ?
  `).bind(publicKey).first<User>();

  return result || null;
}

/**
 * Get all linked wallets for a user
 */
export async function getLinkedWallets(
  db: D1Database,
  userId: string
): Promise<LinkedWallet[]> {
  const result = await db.prepare(`
    SELECT * FROM linked_wallets
    WHERE user_id = ? AND is_active = 1
    ORDER BY is_primary DESC, created_at ASC
  `).bind(userId).all<LinkedWallet>();

  return result.results || [];
}

/**
 * Get a specific linked wallet
 */
export async function getLinkedWallet(
  db: D1Database,
  userId: string,
  walletAddress: string
): Promise<LinkedWallet | null> {
  const result = await db.prepare(`
    SELECT * FROM linked_wallets
    WHERE user_id = ? AND wallet_address = ? AND is_active = 1
  `).bind(userId, walletAddress.toLowerCase()).first<LinkedWallet>();

  return result || null;
}

/**
 * Check if a wallet is already linked to any account
 */
export async function isWalletLinked(
  db: D1Database,
  walletAddress: string
): Promise<{ linked: boolean; userId?: string; username?: string }> {
  const result = await db.prepare(`
    SELECT lw.user_id, u.cryptid_username
    FROM linked_wallets lw
    JOIN users u ON lw.user_id = u.id
    WHERE lw.wallet_address = ? AND lw.is_active = 1
  `).bind(walletAddress.toLowerCase()).first<{ user_id: string; cryptid_username: string }>();

  if (result) {
    return {
      linked: true,
      userId: result.user_id,
      username: result.cryptid_username,
    };
  }

  return { linked: false };
}

/**
 * Count wallets linked to a user
 */
export async function countUserWallets(
  db: D1Database,
  userId: string
): Promise<number> {
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM linked_wallets
    WHERE user_id = ? AND is_active = 1
  `).bind(userId).first<{ count: number }>();

  return result?.count || 0;
}

/**
 * Link a new wallet to a user
 */
export async function linkWallet(
  db: D1Database,
  userId: string,
  request: WalletLinkRequest
): Promise<LinkedWallet> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const walletAddress = request.walletAddress.toLowerCase();

  // Check if this is the first wallet (make it primary)
  const existingCount = await countUserWallets(db, userId);
  const isPrimary = existingCount === 0 ? 1 : 0;

  await db.prepare(`
    INSERT INTO linked_wallets (
      id, user_id, wallet_address, wallet_type, chain_id, label,
      signature_message, signature, verified_at, is_primary, is_active,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    id,
    userId,
    walletAddress,
    request.walletType || 'eoa',
    request.chainId || 1,
    request.label || null,
    request.message,
    request.signature,
    now,
    isPrimary,
    now,
    now
  ).run();

  // Fetch and return the created wallet
  const wallet = await db.prepare(`
    SELECT * FROM linked_wallets WHERE id = ?
  `).bind(id).first<LinkedWallet>();

  return wallet!;
}

/**
 * Update a linked wallet
 */
export async function updateWallet(
  db: D1Database,
  userId: string,
  walletAddress: string,
  updates: { label?: string; isPrimary?: boolean }
): Promise<LinkedWallet | null> {
  const now = new Date().toISOString();
  const address = walletAddress.toLowerCase();

  // If setting as primary, unset other primaries first
  if (updates.isPrimary) {
    await db.prepare(`
      UPDATE linked_wallets SET is_primary = 0, updated_at = ?
      WHERE user_id = ? AND is_active = 1
    `).bind(now, userId).run();
  }

  // Build update query
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

  if (updates.label !== undefined) {
    setClauses.push('label = ?');
    values.push(updates.label);
  }

  if (updates.isPrimary !== undefined) {
    setClauses.push('is_primary = ?');
    values.push(updates.isPrimary ? 1 : 0);
  }

  values.push(userId, address);

  await db.prepare(`
    UPDATE linked_wallets SET ${setClauses.join(', ')}
    WHERE user_id = ? AND wallet_address = ? AND is_active = 1
  `).bind(...values).run();

  return getLinkedWallet(db, userId, address);
}

/**
 * Unlink (soft-delete) a wallet
 */
export async function unlinkWallet(
  db: D1Database,
  userId: string,
  walletAddress: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const address = walletAddress.toLowerCase();

  const result = await db.prepare(`
    UPDATE linked_wallets SET is_active = 0, updated_at = ?
    WHERE user_id = ? AND wallet_address = ? AND is_active = 1
  `).bind(now, userId, address).run();

  return (result.meta?.changes || 0) > 0;
}

// =============================================================================
// Request Handlers
// =============================================================================

/**
 * Handle POST /api/wallet/link
 */
export async function handleLinkWallet(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return jsonResponse({ error: 'Database not configured' }, 503);
    }

    // Get authenticated user from public key header
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const user = await getUserByPublicKey(db, publicKey);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 401);
    }

    // Parse request body
    const body = await request.json() as WalletLinkRequest;

    // Validate required fields
    if (!body.walletAddress || !body.signature || !body.message) {
      return jsonResponse({ error: 'Missing required fields: walletAddress, signature, message' }, 400);
    }

    // Validate address format
    if (!isValidAddress(body.walletAddress)) {
      return jsonResponse({ error: 'Invalid wallet address format' }, 400);
    }

    // Check wallet count limit
    const walletCount = await countUserWallets(db, user.id);
    if (walletCount >= MAX_WALLETS_PER_USER) {
      return jsonResponse({ error: `Maximum ${MAX_WALLETS_PER_USER} wallets allowed per account` }, 400);
    }

    // Check if wallet is already linked
    const existingLink = await isWalletLinked(db, body.walletAddress);
    if (existingLink.linked) {
      if (existingLink.userId === user.id) {
        return jsonResponse({ error: 'Wallet already linked to your account' }, 409);
      }
      return jsonResponse({ error: 'Wallet is linked to another account' }, 409);
    }

    // Parse and validate the message
    const parsedMessage = parseLinkMessage(body.message);
    if (!parsedMessage) {
      return jsonResponse({ error: 'Invalid message format' }, 400);
    }

    // Validate message matches request
    if (parsedMessage.address.toLowerCase() !== body.walletAddress.toLowerCase()) {
      return jsonResponse({ error: 'Message wallet address does not match request' }, 400);
    }

    if (parsedMessage.username !== user.cryptid_username) {
      return jsonResponse({ error: 'Message username does not match authenticated user' }, 400);
    }

    // Validate timestamp is recent
    const messageTime = new Date(parsedMessage.timestamp).getTime();
    const now = Date.now();
    if (isNaN(messageTime) || now - messageTime > MAX_SIGNATURE_AGE_MS) {
      return jsonResponse({ error: 'Signature expired. Please sign a new message.' }, 400);
    }

    // Verify signature using proper ecrecover
    const signatureValid = verifyPersonalSignature(
      body.walletAddress,
      body.message,
      body.signature
    );

    if (!signatureValid) {
      return jsonResponse({ error: 'Signature verification failed' }, 422);
    }

    // Link the wallet
    const wallet = await linkWallet(db, user.id, body);

    return jsonResponse({
      success: true,
      wallet: walletToResponse(wallet),
    }, 201);

  } catch (error) {
    console.error('Link wallet error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle GET /api/wallet/list
 */
export async function handleListWallets(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return jsonResponse({ error: 'Database not configured' }, 503);
    }

    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const user = await getUserByPublicKey(db, publicKey);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 401);
    }

    const wallets = await getLinkedWallets(db, user.id);

    return jsonResponse({
      wallets: wallets.map(walletToResponse),
      count: wallets.length,
    });

  } catch (error) {
    console.error('List wallets error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle GET /api/wallet/:address
 */
export async function handleGetWallet(
  request: Request,
  env: Environment,
  address: string
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return jsonResponse({ error: 'Database not configured' }, 503);
    }

    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const user = await getUserByPublicKey(db, publicKey);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 401);
    }

    const wallet = await getLinkedWallet(db, user.id, address);
    if (!wallet) {
      return jsonResponse({ error: 'Wallet not found' }, 404);
    }

    return jsonResponse({
      wallet: walletToResponse(wallet),
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle PATCH /api/wallet/:address
 */
export async function handleUpdateWallet(
  request: Request,
  env: Environment,
  address: string
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return jsonResponse({ error: 'Database not configured' }, 503);
    }

    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const user = await getUserByPublicKey(db, publicKey);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 401);
    }

    const body = await request.json() as { label?: string; isPrimary?: boolean };

    const wallet = await updateWallet(db, user.id, address, body);
    if (!wallet) {
      return jsonResponse({ error: 'Wallet not found' }, 404);
    }

    return jsonResponse({
      success: true,
      wallet: walletToResponse(wallet),
    });

  } catch (error) {
    console.error('Update wallet error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle DELETE /api/wallet/:address
 */
export async function handleUnlinkWallet(
  request: Request,
  env: Environment,
  address: string
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return jsonResponse({ error: 'Database not configured' }, 503);
    }

    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const user = await getUserByPublicKey(db, publicKey);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 401);
    }

    const success = await unlinkWallet(db, user.id, address);
    if (!success) {
      return jsonResponse({ error: 'Wallet not found' }, 404);
    }

    return jsonResponse({
      success: true,
      message: 'Wallet unlinked',
    });

  } catch (error) {
    console.error('Unlink wallet error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle GET /api/wallet/verify/:address (public endpoint)
 */
export async function handleVerifyWallet(
  _request: Request,
  env: Environment,
  address: string
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return jsonResponse({ error: 'Database not configured' }, 503);
    }

    if (!isValidAddress(address)) {
      return jsonResponse({ error: 'Invalid wallet address format' }, 400);
    }

    const linkStatus = await isWalletLinked(db, address);

    return jsonResponse({
      linked: linkStatus.linked,
      cryptidUsername: linkStatus.username,
    });

  } catch (error) {
    console.error('Verify wallet error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// =============================================================================
// Utilities
// =============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
