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
// Only include WalletConnect if a valid project ID is provided
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const hasValidWalletConnectId = WALLETCONNECT_PROJECT_ID &&
  WALLETCONNECT_PROJECT_ID !== 'YOUR_PROJECT_ID' &&
  WALLETCONNECT_PROJECT_ID.length > 10;

// Supported chains
const chains = [mainnet, optimism, arbitrum, base, polygon] as const;

// Build connectors array - always include injected, optionally include WalletConnect
const connectors = [
  // Injected wallets (MetaMask, Coinbase Wallet, etc.) - always available
  injected({
    shimDisconnect: true,
  }),
];

// Only add WalletConnect if we have a valid project ID
if (hasValidWalletConnectId) {
  connectors.push(
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      // Disable QR modal - web3modal has issues with project ID propagation
      // Users can still connect via injected wallets (MetaMask, etc.)
      showQrModal: false,
      metadata: {
        name: 'Canvas',
        description: 'Collaborative Canvas with Web3 Integration',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://jeffemmett.com',
        icons: ['https://jeffemmett.com/favicon.ico'],
      },
    })
  );

  if (import.meta.env.DEV) {
    console.log('[Web3Provider] WalletConnect enabled with project ID:', WALLETCONNECT_PROJECT_ID.slice(0, 8) + '...');
  }
} else if (import.meta.env.DEV) {
  console.warn(
    '[Web3Provider] WalletConnect disabled - no valid VITE_WALLETCONNECT_PROJECT_ID set.\n' +
    'Get a project ID at https://cloud.walletconnect.com/ to enable mobile wallet support.'
  );
}

// Create wagmi config
const config = createConfig({
  chains,
  connectors,
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
