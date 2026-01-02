/**
 * useWallet - Hooks for Web3 wallet integration
 *
 * Provides functionality for:
 * - Connecting/disconnecting wallets
 * - Linking wallets to CryptID accounts
 * - Managing linked wallets
 */

import { useState, useCallback, useEffect } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useEnsName,
  useEnsAvatar,
  useChainId,
} from 'wagmi';
import { useAuth } from '../context/AuthContext';
import { WORKER_URL } from '../constants/workerUrl';
import * as crypto from '../lib/auth/crypto';

// =============================================================================
// Types
// =============================================================================

export type WalletType = 'eoa' | 'safe' | 'hardware' | 'contract';

export interface LinkedWallet {
  id: string;
  address: string;
  type: WalletType;
  chainId: number;
  label: string | null;
  ensName: string | null;
  ensAvatar: string | null;
  isPrimary: boolean;
  linkedAt: string;
  lastUsedAt: string | null;
}

interface LinkWalletResult {
  success: boolean;
  wallet?: LinkedWallet;
  error?: string;
}

// =============================================================================
// Message Generation
// =============================================================================

/**
 * Generate the message that must be signed to link a wallet
 */
function generateLinkMessage(
  username: string,
  address: string,
  timestamp: string,
  nonce: string
): string {
  return `Link wallet to CryptID

Account: ${username}
Wallet: ${address}
Timestamp: ${timestamp}
Nonce: ${nonce}

This signature proves you own this wallet.`;
}

// =============================================================================
// useWalletConnection - Basic wallet connection
// =============================================================================

export function useWalletConnection() {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect, isPending: isDisconnectPending } = useDisconnect();
  const chainId = useChainId();

  // ENS data for connected wallet
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName || undefined });

  const connectWallet = useCallback((connectorId?: string) => {
    const targetConnector = connectorId
      ? connectors.find(c => c.id === connectorId)
      : connectors[0]; // Default to first connector (usually injected)

    if (targetConnector) {
      connect({ connector: targetConnector });
    }
  }, [connect, connectors]);

  return {
    // Connection state
    address,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    chainId,
    connectorName: connector?.name,

    // ENS data
    ensName: ensName || null,
    ensAvatar: ensAvatar || null,

    // Actions
    connect: connectWallet,
    disconnect,
    isDisconnecting: isDisconnectPending,

    // Available connectors
    connectors: connectors.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
  };
}

// =============================================================================
// useWalletLink - Link wallet to CryptID
// =============================================================================

export function useWalletLink() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { session } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const linkWallet = useCallback(async (label?: string): Promise<LinkWalletResult> => {
    if (!address) {
      return { success: false, error: 'No wallet connected' };
    }

    if (!session.authed || !session.username) {
      return { success: false, error: 'Not authenticated with CryptID' };
    }

    setIsLinking(true);
    setLinkError(null);

    try {
      // Generate the message to sign
      const timestamp = new Date().toISOString();
      const nonce = globalThis.crypto.randomUUID();
      const message = generateLinkMessage(
        session.username,
        address,
        timestamp,
        nonce
      );

      // Request signature from wallet
      const signature = await signMessageAsync({ message });

      // Get public key for auth header
      const publicKey = crypto.getPublicKey(session.username);
      if (!publicKey) {
        throw new Error('Could not get CryptID public key');
      }

      // Send to backend for verification
      const response = await fetch(`${WORKER_URL}/api/wallet/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CryptID-PublicKey': publicKey,
        },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message,
          label,
          walletType: 'eoa',
          chainId: 1,
        }),
      });

      const data = await response.json() as { error?: string; wallet?: LinkedWallet };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link wallet');
      }

      return {
        success: true,
        wallet: data.wallet,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLinkError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLinking(false);
    }
  }, [address, session.authed, session.username, signMessageAsync]);

  return {
    address,
    isConnected,
    isLinking,
    linkError,
    linkWallet,
    clearError: () => setLinkError(null),
  };
}

// =============================================================================
// useLinkedWallets - Manage linked wallets
// =============================================================================

export function useLinkedWallets() {
  const { session } = useAuth();
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch linked wallets
  const fetchWallets = useCallback(async () => {
    if (!session.authed || !session.username) {
      setWallets([]);
      return;
    }

    const publicKey = crypto.getPublicKey(session.username);
    if (!publicKey) {
      setError('Could not get CryptID public key');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${WORKER_URL}/api/wallet/list`, {
        headers: {
          'X-CryptID-PublicKey': publicKey,
        },
      });

      const data = await response.json() as { error?: string; wallets?: LinkedWallet[] };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch wallets');
      }

      setWallets(data.wallets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [session.authed, session.username]);

  // Fetch on mount and when session changes
  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Update a wallet
  const updateWallet = useCallback(async (
    address: string,
    updates: { label?: string; isPrimary?: boolean }
  ): Promise<boolean> => {
    if (!session.username) return false;

    const publicKey = crypto.getPublicKey(session.username);
    if (!publicKey) return false;

    try {
      const response = await fetch(`${WORKER_URL}/api/wallet/${address}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CryptID-PublicKey': publicKey,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchWallets(); // Refresh list
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [session.username, fetchWallets]);

  // Unlink a wallet
  const unlinkWallet = useCallback(async (address: string): Promise<boolean> => {
    if (!session.username) return false;

    const publicKey = crypto.getPublicKey(session.username);
    if (!publicKey) return false;

    try {
      const response = await fetch(`${WORKER_URL}/api/wallet/${address}`, {
        method: 'DELETE',
        headers: {
          'X-CryptID-PublicKey': publicKey,
        },
      });

      if (response.ok) {
        await fetchWallets(); // Refresh list
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [session.username, fetchWallets]);

  return {
    wallets,
    isLoading,
    error,
    refetch: fetchWallets,
    updateWallet,
    unlinkWallet,
    primaryWallet: wallets.find(w => w.isPrimary) || wallets[0] || null,
  };
}

// =============================================================================
// Utility functions
// =============================================================================

/**
 * Format an address for display (0x1234...5678)
 */
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Check if an address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
