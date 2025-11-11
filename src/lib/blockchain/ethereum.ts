// Ethereum blockchain integration utilities
// Handles wallet connections, transaction building, and proxy contract interaction

import { type Address, type Hash, type TransactionRequest, createWalletClient, createPublicClient, custom, http, parseEther, encodeFunctionData, decodeFunctionResult } from 'viem';
import { mainnet, sepolia, goerli } from 'viem/chains';
import type { Chain } from 'viem';

export interface WalletConnection {
  address: Address;
  chainId: number;
  isConnected: boolean;
}

export interface ProxyContractConfig {
  address: Address;
  chainId: number;
  abi: readonly any[];
}

/**
 * Detect and connect to MetaMask or other injected wallet
 */
export async function connectWallet(): Promise<WalletConnection | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Ethereum wallet detected. Please install MetaMask or another Web3 wallet.');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const address = accounts[0] as Address;

    // Get chain ID
    const chainIdHex = await window.ethereum.request({
      method: 'eth_chainId',
    });
    const chainId = parseInt(chainIdHex as string, 16);

    return {
      address,
      chainId,
      isConnected: true,
    };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
}

/**
 * Get current wallet connection status
 */
export async function getWalletConnection(): Promise<WalletConnection | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts',
    });

    if (!accounts || accounts.length === 0) {
      return null;
    }

    const address = accounts[0] as Address;
    const chainIdHex = await window.ethereum.request({
      method: 'eth_chainId',
    });
    const chainId = parseInt(chainIdHex as string, 16);

    return {
      address,
      chainId,
      isConnected: true,
    };
  } catch (error) {
    console.error('Error getting wallet connection:', error);
    return null;
  }
}

/**
 * Switch to a specific chain
 */
export async function switchChain(chainId: number): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Ethereum wallet detected');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (error: any) {
    // If chain doesn't exist, try to add it
    if (error.code === 4902) {
      // You would add the chain here
      throw new Error(`Chain ${chainId} not found. Please add it manually.`);
    }
    throw error;
  }
}

/**
 * Get chain configuration
 */
export function getChain(chainId: number): Chain {
  switch (chainId) {
    case 1:
      return mainnet;
    case 11155111:
      return sepolia;
    case 5:
      return goerli;
    default:
      // Return a generic chain config
      return {
        id: chainId,
        name: `Chain ${chainId}`,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: [''],
          },
        },
      } as Chain;
  }
}

/**
 * Create wallet client for transaction signing
 */
export function createWalletClientForChain(chainId: number) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Ethereum wallet detected');
  }

  const chain = getChain(chainId);
  
  return createWalletClient({
    chain,
    transport: custom(window.ethereum),
  });
}

/**
 * Build transaction to call proxy contract's execute function
 */
export function buildProxyExecuteTransaction(
  config: ProxyContractConfig,
  to: Address,
  value: bigint,
  data: Hash,
  nonce: bigint,
  deadline: bigint,
  signature: string
): TransactionRequest {
  // Convert signature from base64 to hex bytes
  // Web Crypto API signature needs to be converted to format expected by contract
  const signatureBytes = `0x${Buffer.from(signature, 'base64').toString('hex')}`;

  return {
    to: config.address,
    data: encodeFunctionData({
      abi: config.abi,
      functionName: 'execute',
      args: [to, value, data, nonce, deadline, signatureBytes],
    }),
  };
}

/**
 * Send transaction through wallet
 */
export async function sendTransaction(
  chainId: number,
  transaction: TransactionRequest
): Promise<Hash> {
  const walletClient = createWalletClientForChain(chainId);
  
  const hash = await walletClient.sendTransaction(transaction);
  return hash;
}

/**
 * Wait for transaction receipt
 */
export async function waitForTransaction(
  chainId: number,
  hash: Hash
): Promise<any> {
  const chain = getChain(chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  return await publicClient.waitForTransactionReceipt({ hash });
}

/**
 * Check if address is a contract
 */
export async function isContract(
  chainId: number,
  address: Address
): Promise<boolean> {
  const chain = getChain(chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const code = await publicClient.getBytecode({ address });
  return code !== undefined && code !== '0x';
}

/**
 * Get proxy contract address for a user's Web Crypto public key
 * This would typically be stored on-chain or in a registry
 */
export async function getProxyAddressForPublicKey(
  publicKey: string,
  chainId: number
): Promise<Address | null> {
  // In a full implementation, this would query a registry contract
  // or derive the address deterministically
  // For now, return null (proxy needs to be deployed)
  return null;
}

