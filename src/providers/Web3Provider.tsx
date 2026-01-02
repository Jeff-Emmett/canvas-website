/**
 * Web3Provider - Wagmi + WalletConnect configuration
 *
 * Provides wallet connection capabilities to the application.
 * Wraps wagmi's WagmiProvider with React Query for data fetching.
 */

import React, { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, optimism, arbitrum, base, polygon } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

// =============================================================================
// Configuration
// =============================================================================

// WalletConnect Project ID - get one at https://cloud.walletconnect.com/
// For development, we'll use a placeholder that will show a warning
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Supported chains
const chains = [mainnet, optimism, arbitrum, base, polygon] as const;

// Create wagmi config
const config = createConfig({
  chains,
  connectors: [
    // Injected wallets (MetaMask, Coinbase Wallet, etc.)
    injected({
      shimDisconnect: true,
    }),
    // WalletConnect v2 (for mobile wallets)
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      showQrModal: true,
      metadata: {
        name: 'Canvas',
        description: 'Collaborative Canvas with Web3 Integration',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://jeffemmett.com',
        icons: ['https://jeffemmett.com/favicon.ico'],
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus for wallet data
      refetchOnWindowFocus: false,
      // Cache wallet data for 30 seconds
      staleTime: 30_000,
    },
  },
});

// =============================================================================
// Provider Component
// =============================================================================

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// =============================================================================
// Exports
// =============================================================================

// Export config for use in hooks
export { config };

// Re-export chains for convenience
export { mainnet, optimism, arbitrum, base, polygon };
