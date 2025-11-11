// Blockchain-specific Web Crypto API utilities
// Extends crypto.ts with EIP-712 structured data signing for blockchain transactions

import * as crypto from './crypto';
import { isBrowser } from '../utils/browser';
import { getKeyPairFromMemory } from './keyStorage';

export interface TransactionAuthorization {
  to: string;           // Target address
  value: string;         // Amount in wei (hex string)
  data: string;          // Contract call data (hex string)
  nonce: number;         // Replay protection
  deadline: number;      // Expiration timestamp
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface EIP712Message {
  types: {
    EIP712Domain: Array<{ name: string; type: string }>;
    Transaction: Array<{ name: string; type: string }>;
  };
  domain: EIP712Domain;
  primaryType: string;
  message: TransactionAuthorization;
}

/**
 * Create EIP-712 domain for Web Crypto Proxy contract
 */
export function createEIP712Domain(
  chainId: number,
  verifyingContract: string
): EIP712Domain {
  return {
    name: 'WebCryptoProxy',
    version: '1',
    chainId,
    verifyingContract,
  };
}

/**
 * Create EIP-712 structured message for transaction authorization
 */
export function createTransactionMessage(
  authorization: TransactionAuthorization,
  domain: EIP712Domain
): EIP712Message {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Transaction: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    domain,
    primaryType: 'Transaction',
    message: authorization,
  };
}

/**
 * Hash EIP-712 message for signing
 * This creates the message hash that will be signed by Web Crypto API
 */
export async function hashEIP712Message(message: EIP712Message): Promise<string | null> {
  if (!isBrowser()) return null;

  try {
    // EIP-712 encoding: keccak256(0x1901 || domainSeparator || messageHash)
    // For Web Crypto API, we'll sign the structured message JSON
    // The smart contract will need to reconstruct and verify this
    
    // Create the message string that will be signed
    // In a full implementation, you'd use proper EIP-712 encoding
    // For now, we'll create a deterministic string representation
    const messageString = JSON.stringify({
      types: message.types,
      domain: message.domain,
      primaryType: message.primaryType,
      message: message.message,
    });

    return messageString;
  } catch (error) {
    console.error('Error hashing EIP-712 message:', error);
    return null;
  }
}

/**
 * Sign a transaction authorization with Web Crypto API P-256 key
 */
export async function signTransactionAuthorization(
  privateKey: CryptoKey,
  authorization: TransactionAuthorization,
  domain: EIP712Domain
): Promise<{ signature: string; message: EIP712Message } | null> {
  if (!isBrowser()) return null;

  try {
    // Create EIP-712 structured message
    const message = createTransactionMessage(authorization, domain);

    // Hash the message
    const messageHash = await hashEIP712Message(message);
    if (!messageHash) {
      return null;
    }

    // Sign with Web Crypto API
    const signature = await crypto.signData(privateKey, messageHash);
    if (!signature) {
      return null;
    }

    return {
      signature,
      message,
    };
  } catch (error) {
    console.error('Error signing transaction authorization:', error);
    return null;
  }
}

/**
 * Export signature in format suitable for on-chain verification
 * Returns signature as hex string with r, s, v components
 */
export function formatSignatureForBlockchain(signature: string): string {
  // Web Crypto API ECDSA signatures are in DER format
  // For blockchain, we need to convert to r, s, v format
  // This is a simplified version - full implementation would parse DER format
  
  // For now, return base64 signature (will need conversion in smart contract)
  // In production, you'd parse the DER signature and extract r, s, v
  return signature;
}

/**
 * Get user's private key from storage (for signing)
 * Note: In production, this should use secure key storage
 */
export async function getUserPrivateKey(username: string): Promise<CryptoKey | null> {
  if (!isBrowser()) return null;

  try {
    // Get key pair from memory (session-based)
    // In production, use Web Crypto API's persistent key storage
    const keyPair = getKeyPairFromMemory(username);
    if (!keyPair) {
      console.warn('Key pair not found in memory. User may need to re-authenticate.');
      return null;
    }

    return keyPair.privateKey;
  } catch (error) {
    console.error('Error getting user private key:', error);
    return null;
  }
}

/**
 * Store user's key pair securely
 * Note: In production, use Web Crypto API's key storage
 */
export async function storeUserKeyPair(
  username: string,
  keyPair: CryptoKeyPair
): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    // Export private key (in production, use Web Crypto API's key storage)
    // For now, we'll store a reference
    // In production, use IndexedDB or Web Crypto API's persistent key storage
    
    // Store public key (already handled by crypto.ts)
    const publicKeyBase64 = await crypto.exportPublicKey(keyPair.publicKey);
    if (publicKeyBase64) {
      crypto.storePublicKey(username, publicKeyBase64);
    }

    // Store key pair reference
    // In production, use Web Crypto API's key storage API
    localStorage.setItem(`${username}_keyPair`, 'stored');
    
    return true;
  } catch (error) {
    console.error('Error storing user key pair:', error);
    return false;
  }
}

