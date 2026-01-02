-- Migration: Add Linked Wallets for Web3 Integration
-- Date: 2026-01-02
-- Description: Enables CryptID users to link Ethereum wallets for
--              on-chain transactions, voting, and token-gated features.
-- Related: task-007, doc-001

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
CREATE INDEX IF NOT EXISTS idx_wallet_link_tokens_user ON wallet_link_tokens(user_id);

-- =============================================================================
-- TOKEN BALANCES CACHE (optional, for token-gating)
-- =============================================================================
-- Cache of token balances for faster permission checks
-- Updated periodically or on-demand

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
CREATE INDEX IF NOT EXISTS idx_token_balances_chain ON wallet_token_balances(chain_id);
