// Relayer service for gasless transactions
// Accepts signed transaction requests and submits them on behalf of users

import { type Address, type Hash, type TransactionRequest, createPublicClient, http, encodeFunctionData } from 'viem';
import { getChain } from './ethereum';
import type { TransactionAuthorization } from '../auth/cryptoBlockchain';

export interface RelayerConfig {
  relayerUrl: string;  // URL of the relayer service
  relayerAddress?: Address;  // Address that will pay for gas
}

export interface RelayerTransactionRequest {
  authorization: TransactionAuthorization;
  signature: string;
  proxyContractAddress: Address;
  chainId: number;
}

export interface RelayerResponse {
  success: boolean;
  transactionHash?: Hash;
  error?: string;
}

/**
 * Submit a signed transaction to the relayer service
 * The relayer will verify the signature and submit the transaction, paying for gas
 */
export async function submitToRelayer(
  config: RelayerConfig,
  request: RelayerTransactionRequest
): Promise<RelayerResponse> {
  try {
    const response = await fetch(config.relayerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization: request.authorization,
        signature: request.signature,
        proxyContractAddress: request.proxyContractAddress,
        chainId: request.chainId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: error || `Relayer returned status ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      transactionHash: data.transactionHash as Hash,
    };
  } catch (error) {
    console.error('Error submitting to relayer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if relayer service is available
 */
export async function checkRelayerAvailability(
  relayerUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${relayerUrl}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get relayer configuration from environment or settings
 */
export function getRelayerConfig(chainId: number): RelayerConfig | null {
  // Read from environment variables or localStorage
  // Format: RELAYER_URL_<CHAIN_ID> or use a default relayer URL pattern
  
  if (typeof window === 'undefined') return null;
  
  // Check localStorage for relayer configuration
  const relayerConfigKey = `relayer_config_${chainId}`;
  const stored = localStorage.getItem(relayerConfigKey);
  
  if (stored) {
    try {
      const config = JSON.parse(stored);
      return {
        relayerUrl: config.url,
        relayerAddress: config.address,
      };
    } catch (e) {
      console.error('Error parsing relayer config:', e);
    }
  }
  
  // Default relayer URLs (configure these for your deployment)
  const relayerUrls: Record<number, string> = {
    // 1: 'https://relayer.mainnet.yourdomain.com',
    // 11155111: 'https://relayer.sepolia.yourdomain.com',
  };
  
  const url = relayerUrls[chainId];
  if (!url) return null;
  
  return {
    relayerUrl: url,
  };
}

/**
 * Set relayer configuration for a chain
 */
export function setRelayerConfig(chainId: number, url: string, address?: Address): void {
  if (typeof window === 'undefined') return;
  
  const relayerConfigKey = `relayer_config_${chainId}`;
  localStorage.setItem(relayerConfigKey, JSON.stringify({
    url,
    address,
  }));
}

