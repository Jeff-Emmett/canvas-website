// Blockchain context for managing wallet connections and blockchain state

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { connectWallet, getWalletConnection, type WalletConnection } from '../lib/blockchain/ethereum';
import { getLinkedAccount, linkAccount, type LinkedAccount } from '../lib/auth/blockchainLinking';
import { useAuth } from './AuthContext';

interface BlockchainContextType {
  wallet: WalletConnection | null;
  linkedAccount: LinkedAccount | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  linkWebCryptoAccount: (username: string) => Promise<{ success: boolean; error?: string }>;
  refreshConnection: () => Promise<void>;
}

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined);

export function BlockchainProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { session } = useAuth();

  // Check for existing wallet connection on mount
  useEffect(() => {
    refreshConnection();
  }, []);

  // Update linked account when wallet or session changes
  useEffect(() => {
    if (wallet && session.username) {
      const linked = getLinkedAccount(session.username);
      setLinkedAccount(linked || null);
    } else {
      setLinkedAccount(null);
    }
  }, [wallet, session.username]);

  const refreshConnection = useCallback(async () => {
    try {
      const connection = await getWalletConnection();
      setWallet(connection);
    } catch (error) {
      console.error('Error refreshing wallet connection:', error);
      setWallet(null);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const connection = await connectWallet();
      setWallet(connection);
      
      // Check if account is linked
      if (session.username) {
        const linked = getLinkedAccount(session.username);
        setLinkedAccount(linked || null);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [session.username]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setLinkedAccount(null);
  }, []);

  const linkWebCryptoAccount = useCallback(async (username: string): Promise<{ success: boolean; error?: string }> => {
    if (!wallet) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      const result = await linkAccount(username, wallet.address);
      if (result.success && result.linkedAccount) {
        setLinkedAccount(result.linkedAccount);
      }
      return result;
    } catch (error) {
      console.error('Error linking account:', error);
      return { success: false, error: String(error) };
    }
  }, [wallet]);

  // Listen for wallet account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWallet(null);
          setLinkedAccount(null);
        } else {
          refreshConnection();
        }
      };

      const handleChainChanged = () => {
        refreshConnection();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [refreshConnection]);

  return (
    <BlockchainContext.Provider
      value={{
        wallet,
        linkedAccount,
        isConnecting,
        connect,
        disconnect,
        linkWebCryptoAccount,
        refreshConnection,
      }}
    >
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain() {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

