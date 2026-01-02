---
id: task-007
title: Web3 Wallet Linking & Blockchain Integration
status: In Progress
assignee: []
created_date: '2025-12-03'
updated_date: '2026-01-02 16:14'
labels:
  - feature
  - web3
  - blockchain
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate Web3 wallet capabilities to enable CryptID users to link EOA wallets and Safe multisigs for on-chain transactions, voting (Snapshot), and token-gated features.

## Architecture Overview

CryptID uses ECDSA P-256 (WebCrypto), while Ethereum uses secp256k1. These curves are incompatible, so we use a **wallet linking** approach rather than key reuse.

### Core Concept
1. CryptID remains the primary authentication layer (passwordless)
2. Users can link one or more Ethereum wallets to their CryptID
3. Linking requires signing a verification message with the wallet
4. Linked wallets enable: transactions, voting, token-gating, NFT features

### Tech Stack
- **wagmi v2** + **viem** - Modern React hooks for wallet connection
- **WalletConnect v2** - Multi-wallet support (MetaMask, Rainbow, etc.)
- **Safe SDK** - Multisig wallet integration
- **Snapshot.js** - Off-chain governance voting

## Implementation Phases

### Phase 1: Wallet Linking Foundation (This Task)
- Add wagmi/viem/walletconnect dependencies
- Create linked_wallets D1 table
- Implement wallet linking API endpoints
- Build WalletLinkPanel UI component
- Display linked wallets in user settings

### Phase 2: Snapshot Voting (Future Task)
- Integrate Snapshot.js SDK
- Create VotingShape for canvas visualization
- Implement vote signing flow

### Phase 3: Safe Multisig (Future Task)
- Safe SDK integration
- TransactionBuilderShape for visual tx composition
- Collaborative signing UI

### Phase 4: Account Abstraction (Future Task)
- ERC-4337 smart wallet with P-256 signature validation
- Gasless transactions via paymaster
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Install and configure wagmi v2, viem, and @walletconnect/web3modal
- [ ] #2 Create linked_wallets table in Cloudflare D1 with proper schema
- [ ] #3 Implement POST /api/wallet/link endpoint with signature verification
- [ ] #4 Implement GET /api/wallet/list endpoint to retrieve linked wallets
- [ ] #5 Implement DELETE /api/wallet/unlink endpoint to remove wallet links
- [ ] #6 Create WalletConnectButton component using wagmi hooks
- [ ] #7 Create WalletLinkPanel component for linking flow UI
- [ ] #8 Add wallet section to user settings/profile panel
- [ ] #9 Display linked wallet addresses with ENS resolution
- [ ] #10 Support multiple wallet types: EOA, Safe, Hardware
- [ ] #11 Add wallet connection state to AuthContext
- [ ] #12 Write tests for wallet linking flow
- [ ] #13 Update CLAUDE.md with Web3 architecture documentation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Step 1: Dependencies & Configuration
```bash
npm install wagmi viem @tanstack/react-query @walletconnect/web3modal
```

Configure wagmi with WalletConnect projectId and supported chains.

### Step 2: Database Schema
Add to D1 migration:
- linked_wallets table (user_id, wallet_address, wallet_type, chain_id, verified_at, signature_proof, ens_name, is_primary)

### Step 3: API Endpoints
Worker routes:
- POST /api/wallet/link - Verify signature, create link
- GET /api/wallet/list - List user's linked wallets  
- DELETE /api/wallet/unlink - Remove a linked wallet
- GET /api/wallet/verify/:address - Check if address is linked to any CryptID

### Step 4: Frontend Components
- WagmiProvider wrapper in App.tsx
- WalletConnectButton - Connect/disconnect wallet
- WalletLinkPanel - Full linking flow with signature
- WalletBadge - Display linked wallet in UI

### Step 5: Integration
- Add linkedWallets to Session type
- Update AuthContext with wallet state
- Add wallet section to settings panel

### Step 6: Testing
- Unit tests for signature verification
- Integration tests for linking flow
- E2E test for full wallet link journey
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Planning Complete (2026-01-02)

Comprehensive planning phase completed:

### Created Architecture Document (doc-001)
- Full technical architecture for wallet linking
- Database schema design
- API endpoint specifications  
- Library comparison (wagmi/viem recommended)
- Security considerations
- Frontend component designs

### Created Migration File
- `worker/migrations/002_linked_wallets.sql`
- Tables: linked_wallets, wallet_link_tokens, wallet_token_balances
- Proper indexes and foreign keys

### Created Follow-up Tasks
- task-060: Snapshot Voting Integration
- task-061: Safe Multisig Integration
- task-062: Account Abstraction Exploration

### Key Architecture Decisions
1. **Wallet Linking** approach (not key reuse) due to P-256/secp256k1 incompatibility
2. **wagmi v2 + viem** for frontend (React hooks, tree-shakeable)
3. **viem** for worker (signature verification)
4. **EIP-191 personal_sign** for EOA verification
5. **ERC-1271** for Safe/contract wallet verification (future)

### Next Steps
1. Install dependencies: wagmi, viem, @tanstack/react-query, @web3modal/wagmi
2. Run migration on D1
3. Implement API endpoints in worker
4. Build WalletLinkPanel UI component
<!-- SECTION:NOTES:END -->
