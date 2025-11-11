// Wallet integration layer for proxy contract deployment and interaction
// Handles the connection between Web Crypto API and wallet infrastructure

import { type Address, encodeFunctionData } from 'viem';
import { connectWallet, getWalletConnection, sendTransaction, type WalletConnection } from './ethereum';
import * as crypto from '../auth/crypto';

export interface ProxyDeploymentConfig {
  publicKeyX: string;  // X coordinate of P-256 public key (hex)
  publicKeyY: string;  // Y coordinate of P-256 public key (hex)
  factoryAddress: Address;
  chainId: number;
}

/**
 * Extract X and Y coordinates from P-256 public key
 * P-256 public keys in raw format are 65 bytes: 0x04 || 32-byte X || 32-byte Y
 */
export async function extractPublicKeyCoordinates(
  publicKey: CryptoKey
): Promise<{ x: string; y: string } | null> {
  try {
    const crypto = window.crypto;
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', publicKey);
    const keyBytes = new Uint8Array(publicKeyBuffer);

    // P-256 public key format: 0x04 (uncompressed) || 32-byte X || 32-byte Y
    if (keyBytes.length !== 65 || keyBytes[0] !== 0x04) {
      console.error('Invalid P-256 public key format');
      return null;
    }

    // Extract X and Y coordinates (32 bytes each)
    const xBytes = keyBytes.slice(1, 33);
    const yBytes = keyBytes.slice(33, 65);

    // Convert to hex strings
    const x = '0x' + Array.from(xBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const y = '0x' + Array.from(yBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return { x, y };
  } catch (error) {
    console.error('Error extracting public key coordinates:', error);
    return null;
  }
}

/**
 * Deploy proxy contract via factory
 */
export async function deployProxyContract(
  config: ProxyDeploymentConfig,
  wallet: WalletConnection
): Promise<Address | null> {
  try {
    // Factory contract ABI for deployProxy function
    const factoryABI = [
      {
        name: 'deployProxy',
        type: 'function',
        inputs: [
          { name: 'publicKeyX', type: 'bytes32' },
          { name: 'publicKeyY', type: 'bytes32' },
        ],
        outputs: [{ name: 'proxy', type: 'address' }],
      },
    ] as const;

    // Convert hex strings to bytes32
    const publicKeyXBytes = config.publicKeyX.startsWith('0x')
      ? config.publicKeyX.slice(2).padStart(64, '0')
      : config.publicKeyX.padStart(64, '0');
    const publicKeyYBytes = config.publicKeyY.startsWith('0x')
      ? config.publicKeyY.slice(2).padStart(64, '0')
      : config.publicKeyY.padStart(64, '0');

    // Encode function call
    const data = encodeFunctionData({
      abi: factoryABI,
      functionName: 'deployProxy',
      args: [
        `0x${publicKeyXBytes}` as `0x${string}`,
        `0x${publicKeyYBytes}` as `0x${string}`,
      ],
    });

    // Send transaction
    const hash = await sendTransaction(config.chainId, {
      to: config.factoryAddress,
      data,
    });

    // In a full implementation, you'd wait for the transaction receipt
    // and extract the proxy address from the event logs
    // For now, return null and let the user check manually
    console.log('Proxy deployment transaction:', hash);
    return null;
  } catch (error) {
    console.error('Error deploying proxy contract:', error);
    throw error;
  }
}

/**
 * Get proxy contract address from factory
 */
export async function getProxyAddress(
  publicKeyX: string,
  publicKeyY: string,
  factoryAddress: Address,
  chainId: number
): Promise<Address | null> {
  // In a full implementation, this would call the factory's getProxy function
  // For now, return null
  return null;
}

/**
 * Prepare proxy contract deployment for a user's Web Crypto account
 */
export async function prepareProxyDeployment(
  username: string
): Promise<ProxyDeploymentConfig | null> {
  try {
    // Get user's public key
    const publicKeyBase64 = crypto.getPublicKey(username);
    if (!publicKeyBase64) {
      throw new Error('Public key not found for user');
    }

    // Import public key
    const publicKey = await crypto.importPublicKey(publicKeyBase64);
    if (!publicKey) {
      throw new Error('Failed to import public key');
    }

    // Extract coordinates
    const coordinates = await extractPublicKeyCoordinates(publicKey);
    if (!coordinates) {
      throw new Error('Failed to extract public key coordinates');
    }

    // Get wallet connection
    const wallet = await getWalletConnection();
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    // Factory address would be configured per chain
    // For now, use a placeholder
    const factoryAddress = '0x0000000000000000000000000000000000000000' as Address;

    return {
      publicKeyX: coordinates.x,
      publicKeyY: coordinates.y,
      factoryAddress,
      chainId: wallet.chainId,
    };
  } catch (error) {
    console.error('Error preparing proxy deployment:', error);
    return null;
  }
}

