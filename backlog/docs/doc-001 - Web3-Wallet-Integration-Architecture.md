---
id: doc-001
title: Web3 Wallet Integration Architecture
type: other
created_date: '2026-01-02 16:07'
---
# Web3 Wallet Integration Architecture

**Status:** Planning  
**Created:** 2026-01-02  
**Related Task:** task-007

---

## 1. Overview

This document outlines the architecture for integrating Web3 wallet capabilities into the canvas-website, enabling CryptID users to link Ethereum wallets for on-chain transactions, voting, and token-gated features.

### Key Constraint: Cryptographic Curve Mismatch

| System | Curve | Usage |
|--------|-------|-------|
| **CryptID (WebCrypto)** | ECDSA P-256 (NIST) | Authentication, passwordless login |
| **Ethereum** | ECDSA secp256k1 | Transactions, message signing |

These curves are **incompatible**. A CryptID key cannot sign Ethereum transactions. Therefore, we use a **wallet linking** approach where:
1. CryptID handles authentication (who you are)
2. Linked wallet handles on-chain actions (what you can do)

---

## 2. Database Schema

### Migration: `002_linked_wallets.sql`

```sql
-- Migration: Add Linked Wallets for Web3 Integration
-- Date: 2026-01-02
-- Description: Enables CryptID users to link Ethereum wallets for
--              on-chain transactions, voting, and token-gated features.

-- =============================================================================
-- LINKED WALLETS TABLE
-- =============================================================================
-- Each CryptID user can link multiple Ethereum wallets (EOA, Safe, hardware)
-- Linking requires signature verification to prove wallet ownership

CREATE TABLE IF NOT EXISTS linked_wallets (
  id TEXT PRIMARY KEY,                      -- UUID for the link record
  user_id TEXT NOT NULL,                    -- References users.id (CryptID account)
  wallet_address TEXT NOT NULL,             -- Ethereum address (checksummed, 0x-prefixed)
  
  -- Wallet metadata
  wallet_type TEXT DEFAULT 'eoa' CHECK (wallet_type IN ('eoa', 'safe', 'hardware', 'contract')),
  chain_id INTEGER DEFAULT 1,               -- Primary chain (1 = Ethereum mainnet)
  label TEXT,                               -- User-provided label (e.g., "Main Wallet")
  
  -- Verification proof
  signature_message TEXT NOT NULL,          -- The message that was signed
  signature TEXT NOT NULL,                  -- EIP-191 personal_sign signature
  verified_at TEXT NOT NULL,                -- When signature was verified
  
  -- ENS integration
  ens_name TEXT,                            -- Resolved ENS name (if any)
  ens_avatar TEXT,                          -- ENS avatar URL (if any)
  ens_resolved_at TEXT,                     -- When ENS was last resolved
  
  -- Flags
  is_primary INTEGER DEFAULT 0,             -- 1 = primary wallet for this user
  is_active INTEGER DEFAULT 1,              -- 0 = soft-deleted
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,                        -- Last time wallet was used for action
  
  -- Constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, wallet_address)           -- Can't link same wallet twice
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_linked_wallets_user ON linked_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_wallets_address ON linked_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_linked_wallets_active ON linked_wallets(is_active);
CREATE INDEX IF NOT EXISTS idx_linked_wallets_primary ON linked_wallets(user_id, is_primary);

-- =============================================================================
-- WALLET LINKING TOKENS TABLE (for Safe/multisig delayed verification)
-- =============================================================================
-- For contract wallets that require on-chain signature verification

CREATE TABLE IF NOT EXISTS wallet_link_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL,                      -- Random nonce for signature message
  token TEXT NOT NULL UNIQUE,               -- Secret token for verification callback
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wallet_link_tokens_token ON wallet_link_tokens(token);

-- =============================================================================
-- TOKEN BALANCES CACHE (optional, for token-gating)
-- =============================================================================
-- Cache of token balances for faster permission checks

CREATE TABLE IF NOT EXISTS wallet_token_balances (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,              -- ERC-20/721/1155 contract address
  token_type TEXT CHECK (token_type IN ('erc20', 'erc721', 'erc1155')),
  chain_id INTEGER NOT NULL,
  balance TEXT NOT NULL,                    -- String to handle big numbers
  last_updated TEXT DEFAULT (datetime('now')),
  
  UNIQUE(wallet_address, token_address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_token_balances_wallet ON wallet_token_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_balances_token ON wallet_token_balances(token_address);
```

### TypeScript Types

Add to `worker/types.ts`:

```typescript
// =============================================================================
// Linked Wallet Types
// =============================================================================

export type WalletType = 'eoa' | 'safe' | 'hardware' | 'contract';

export interface LinkedWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_type: WalletType;
  chain_id: number;
  label: string | null;
  signature_message: string;
  signature: string;
  verified_at: string;
  ens_name: string | null;
  ens_avatar: string | null;
  ens_resolved_at: string | null;
  is_primary: number;  // SQLite boolean
  is_active: number;   // SQLite boolean
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface WalletLinkToken {
  id: string;
  user_id: string;
  wallet_address: string;
  nonce: string;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface WalletTokenBalance {
  id: string;
  wallet_address: string;
  token_address: string;
  token_type: 'erc20' | 'erc721' | 'erc1155';
  chain_id: number;
  balance: string;
  last_updated: string;
}

// API Response types
export interface LinkedWalletResponse {
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

export interface WalletLinkRequest {
  walletAddress: string;
  signature: string;
  message: string;
  walletType?: WalletType;
  chainId?: number;
  label?: string;
}
```

---

## 3. API Endpoints

### Base Path: `/api/wallet`

All endpoints require CryptID authentication via `X-CryptID-PublicKey` header.

---

### `POST /api/wallet/link`

Link a new wallet to the authenticated CryptID account.

**Request:**
```typescript
{
  walletAddress: string;    // 0x-prefixed Ethereum address
  signature: string;        // EIP-191 signature of the message
  message: string;          // Must match server-generated format
  walletType?: 'eoa' | 'safe' | 'hardware' | 'contract';
  chainId?: number;         // Default: 1 (mainnet)
  label?: string;           // Optional user label
}
```

**Message Format (must be signed):**
```
Link wallet to CryptID

Account: ${cryptidUsername}
Wallet: ${walletAddress}
Timestamp: ${isoTimestamp}
Nonce: ${randomNonce}

This signature proves you own this wallet.
```

**Response (201 Created):**
```typescript
{
  success: true;
  wallet: LinkedWalletResponse;
}
```

**Errors:**
- `400` - Invalid request body or signature
- `401` - Not authenticated
- `409` - Wallet already linked to this account
- `422` - Signature verification failed

---

### `GET /api/wallet/list`

Get all wallets linked to the authenticated user.

**Response:**
```typescript
{
  wallets: LinkedWalletResponse[];
  count: number;
}
```

---

### `GET /api/wallet/:address`

Get details for a specific linked wallet.

**Response:**
```typescript
{
  wallet: LinkedWalletResponse;
}
```

---

### `PATCH /api/wallet/:address`

Update a linked wallet (label, primary status).

**Request:**
```typescript
{
  label?: string;
  isPrimary?: boolean;
}
```

**Response:**
```typescript
{
  success: true;
  wallet: LinkedWalletResponse;
}
```

---

### `DELETE /api/wallet/:address`

Unlink a wallet from the account.

**Response:**
```typescript
{
  success: true;
  message: 'Wallet unlinked';
}
```

---

### `GET /api/wallet/verify/:address`

Check if a wallet address is linked to any CryptID account.
(Public endpoint - no auth required)

**Response:**
```typescript
{
  linked: boolean;
  cryptidUsername?: string;  // Only if user allows public display
}
```

---

### `POST /api/wallet/refresh-ens`

Refresh ENS name resolution for a linked wallet.

**Request:**
```typescript
{
  walletAddress: string;
}
```

**Response:**
```typescript
{
  ensName: string | null;
  ensAvatar: string | null;
  resolvedAt: string;
}
```

---

## 4. Signature Verification Implementation

```typescript
// worker/walletAuth.ts

import { verifyMessage, getAddress } from 'viem';

export function generateLinkMessage(
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

export async function verifyWalletSignature(
  address: string,
  message: string,
  signature: `0x${string}`
): Promise<boolean> {
  try {
    // Normalize address
    const checksumAddress = getAddress(address);
    
    // Verify EIP-191 personal_sign signature
    const valid = await verifyMessage({
      address: checksumAddress,
      message,
      signature,
    });
    
    return valid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// For ERC-1271 contract wallet verification (Safe, etc.)
export async function verifyContractSignature(
  address: string,
  message: string,
  signature: string,
  rpcUrl: string
): Promise<boolean> {
  // ERC-1271 magic value: 0x1626ba7e
  // Implementation needed for Safe/contract wallet support
  // Uses eth_call to isValidSignature(bytes32,bytes)
  throw new Error('Contract signature verification not yet implemented');
}
```

---

## 5. Library Comparison

### Recommendation: **wagmi v2 + viem**

| Library | Bundle Size | Type Safety | React Hooks | Maintenance | Recommendation |
|---------|-------------|-------------|-------------|-------------|----------------|
| **wagmi v2** | ~40KB | Excellent | Native | Active (wevm team) | ✅ **Best for React** |
| **viem** | ~25KB | Excellent | N/A | Active (wevm team) | ✅ **Best for worker** |
| **ethers v6** | ~120KB | Good | None | Active | ⚠️ Larger bundle |
| **web3.js** | ~400KB | Poor | None | Declining | ❌ Avoid |

### Why wagmi + viem?

1. **Same team** - wagmi and viem are both from wevm, designed to work together
2. **Tree-shakeable** - Only import what you use
3. **TypeScript-first** - Excellent type inference and autocomplete
4. **Modern React** - Hooks-based, works with React 18+ and Suspense
5. **WalletConnect v2** - Built-in support via Web3Modal
6. **No ethers dependency** - Pure viem underneath

### Package Configuration

```json
{
  "dependencies": {
    "wagmi": "^2.12.0",
    "viem": "^2.19.0",
    "@tanstack/react-query": "^5.45.0",
    "@web3modal/wagmi": "^5.0.0"
  }
}
```

### Supported Wallets (via Web3Modal)

- MetaMask (injected)
- WalletConnect v2 (mobile wallets)
- Coinbase Wallet
- Rainbow
- Safe (via WalletConnect)
- Hardware wallets (via MetaMask bridge)

---

## 6. Frontend Architecture

### Provider Setup (`src/providers/Web3Provider.tsx`)

```typescript
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, optimism, arbitrum, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWeb3Modal } from '@web3modal/wagmi/react';

// Configure chains
const chains = [mainnet, optimism, arbitrum, base] as const;

// Create wagmi config
const config = createConfig({
  chains,
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});

// Create Web3Modal
const projectId = process.env.WALLETCONNECT_PROJECT_ID!;

createWeb3Modal({
  wagmiConfig: config,
  projectId,
  chains,
  themeMode: 'dark',
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Wallet Link Hook (`src/hooks/useWalletLink.ts`)

```typescript
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export function useWalletLink() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { session } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  
  const linkWallet = async (label?: string) => {
    if (!address || !session.username) return;
    
    setIsLinking(true);
    try {
      // Generate link message
      const timestamp = new Date().toISOString();
      const nonce = crypto.randomUUID();
      const message = generateLinkMessage(
        session.username,
        address,
        timestamp,
        nonce
      );
      
      // Request signature from wallet
      const signature = await signMessageAsync({ message });
      
      // Send to backend for verification
      const response = await fetch('/api/wallet/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CryptID-PublicKey': session.publicKey,
        },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message,
          label,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to link wallet');
      }
      
      return await response.json();
    } finally {
      setIsLinking(false);
    }
  };
  
  return {
    address,
    isConnected,
    isLinking,
    linkWallet,
    disconnect,
  };
}
```

---

## 7. Integration Points

### A. AuthContext Extension

Add to `Session` type:
```typescript
interface Session {
  // ... existing fields
  linkedWallets?: LinkedWalletResponse[];
  primaryWallet?: LinkedWalletResponse;
}
```

### B. Token-Gated Features

```typescript
// Check if user holds specific tokens
async function checkTokenGate(
  walletAddress: string,
  requirement: {
    tokenAddress: string;
    minBalance: string;
    chainId: number;
  }
): Promise<boolean> {
  // Query on-chain balance or use cached value
}
```

### C. Snapshot Voting (Future)

```typescript
// Vote on Snapshot proposal
async function voteOnProposal(
  space: string,
  proposal: string,
  choice: number,
  walletAddress: string
): Promise<void> {
  // Use Snapshot.js SDK with linked wallet
}
```

---

## 8. Security Considerations

1. **Signature Replay Prevention**
   - Include timestamp and nonce in message
   - Server validates timestamp is recent (within 5 minutes)
   - Nonces are single-use

2. **Address Validation**
   - Always checksum addresses before storing/comparing
   - Validate address format (0x + 40 hex chars)

3. **Rate Limiting**
   - Limit link attempts per user (e.g., 5/hour)
   - Limit total wallets per user (e.g., 10)

4. **Wallet Verification**
   - EOA: EIP-191 personal_sign
   - Safe: ERC-1271 isValidSignature
   - Hardware: Same as EOA (via MetaMask bridge)

---

## 9. Next Steps

1. **Phase 1 (This Sprint)**
   - [ ] Add migration file
   - [ ] Install wagmi/viem dependencies
   - [ ] Implement link/list/unlink endpoints
   - [ ] Create WalletLinkPanel UI
   - [ ] Add wallet section to settings

2. **Phase 2 (Next Sprint)**
   - [ ] Snapshot.js integration
   - [ ] VotingShape for canvas
   - [ ] Token balance caching

3. **Phase 3 (Future)**
   - [ ] Safe SDK integration
   - [ ] TransactionBuilderShape
   - [ ] Account Abstraction exploration
