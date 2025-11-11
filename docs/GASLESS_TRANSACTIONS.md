# Gasless Transactions Setup

This document explains how to set up and use gasless transactions with the Web Crypto API blockchain integration.

## Overview

Gasless transactions allow users to execute blockchain transactions without paying gas fees. Instead, a relayer service pays for the gas on behalf of users.

## Architecture

1. **User signs transaction** with Web Crypto API (P-256)
2. **Relayer service** receives the signed transaction request
3. **Relayer verifies** the signature matches the user's Web Crypto public key
4. **Relayer submits** the transaction to the blockchain and pays gas
5. **Transaction executes** through the proxy contract

## Components

### 1. Relayer Service (`worker/blockchainRelayer.ts`)

A Cloudflare Worker that:
- Accepts signed transaction requests via HTTP POST
- Verifies Web Crypto API signatures (P-256)
- Submits transactions to the blockchain
- Pays for gas fees

### 2. Client Relayer Library (`src/lib/blockchain/relayer.ts`)

Client-side utilities for:
- Submitting transactions to the relayer
- Checking relayer availability
- Managing relayer configuration

### 3. Transaction Builder (`src/components/blockchain/TransactionBuilder.tsx`)

UI component with option to use gasless transactions via checkbox.

## Setup

### Step 1: Deploy Relayer Worker

1. Add the relayer worker to your `wrangler.toml`:

```toml
[[workers]]
name = "blockchain-relayer"
route = "/relayer/*"
```

2. Set up the relayer private key as a Cloudflare Workers secret:

```bash
wrangler secret put RELAYER_PRIVATE_KEY
# Enter your relayer wallet's private key (0x...)
```

**⚠️ Security Warning**: The relayer private key must be kept secure. It will be used to pay for all gas fees.

### Step 2: Fund Relayer Wallet

The relayer wallet needs ETH to pay for gas:
- For mainnet: Send ETH to the relayer address
- For testnets: Get testnet ETH from faucets

### Step 3: Configure Relayer URL

In your application, configure the relayer URL for each chain:

```typescript
import { setRelayerConfig } from './lib/blockchain/relayer';

// Set relayer URL for a chain
setRelayerConfig(1, 'https://your-worker.workers.dev/relayer'); // Mainnet
setRelayerConfig(11155111, 'https://your-worker.workers.dev/relayer'); // Sepolia
```

Or set it in `relayer.ts`:

```typescript
const relayerUrls: Record<number, string> = {
  1: 'https://your-worker.workers.dev/relayer',
  11155111: 'https://your-worker.workers.dev/relayer',
};
```

### Step 4: Update Worker Routes

Add the relayer route to your main worker or deploy it as a separate worker:

```typescript
// In your main worker.ts
if (url.pathname.startsWith('/relayer')) {
  return await blockchainRelayer.fetch(request, env);
}
```

## Usage

### For Users

1. Build a transaction in the Transaction Builder component
2. Check the "Use gasless transaction" checkbox
3. Sign with Web Crypto API
4. Transaction is submitted to relayer (no wallet confirmation needed)
5. Relayer pays for gas and submits transaction

### For Developers

```typescript
import { submitToRelayer, getRelayerConfig } from './lib/blockchain/relayer';

// Check if relayer is available
const relayerConfig = getRelayerConfig(chainId);
if (relayerConfig) {
  // Submit to relayer
  const result = await submitToRelayer(relayerConfig, {
    authorization: signedAuthorization,
    signature: signature,
    proxyContractAddress: proxyAddress,
    chainId: chainId,
  });
  
  if (result.success) {
    console.log('Transaction hash:', result.transactionHash);
  }
}
```

## Security Considerations

### 1. Relayer Private Key Security
- Store private key as Cloudflare Workers secret (never in code)
- Use a dedicated wallet with limited funds
- Monitor relayer wallet balance
- Set up alerts for low balance

### 2. Signature Verification
- The relayer must verify Web Crypto P-256 signatures
- Currently, this verification happens in the proxy contract
- Consider adding additional verification in the relayer for early rejection

### 3. Rate Limiting
- Implement rate limiting to prevent abuse
- Limit transactions per user/IP
- Set maximum gas limits per transaction

### 4. Nonce Management
- Ensure nonces are properly managed to prevent replay attacks
- The proxy contract handles nonce checking, but relayer should also validate

### 5. Deadline Enforcement
- Relayer should check transaction deadlines before submission
- Reject expired transactions

## Cost Management

### Monitoring
- Track gas costs per transaction
- Monitor relayer wallet balance
- Set up automatic refilling if balance is low

### Limits
- Set maximum gas price limits
- Set maximum transaction value limits
- Implement daily/monthly spending limits

### Funding
- Consider using a paymaster contract (e.g., Pimlico, Alchemy) for more sophisticated gas management
- Implement user deposits if needed
- Consider subscription models for gasless transactions

## Alternative: Paymaster Contracts

Instead of a relayer service, you could use paymaster contracts:

1. **ERC-4337 Account Abstraction**: Use a paymaster contract that sponsors transactions
2. **Pimlico**: Third-party paymaster service
3. **Alchemy Gas Manager**: Gas sponsorship service

These services handle gas payment on-chain rather than through a relayer.

## Troubleshooting

### Relayer Not Available
- Check relayer URL configuration
- Verify relayer worker is deployed
- Check relayer health endpoint: `GET /relayer/health`

### Transaction Fails
- Check relayer wallet has sufficient balance
- Verify signature is valid
- Check transaction deadline hasn't expired
- Verify proxy contract is deployed

### High Gas Costs
- Monitor gas prices
- Consider using Layer 2 networks (lower gas)
- Implement gas price limits
- Use EIP-1559 for better gas estimation

## Future Enhancements

- [ ] Implement paymaster contract integration
- [ ] Add user deposit system for gasless transactions
- [ ] Implement rate limiting and abuse prevention
- [ ] Add gas price monitoring and limits
- [ ] Support for multiple relayer endpoints (load balancing)
- [ ] Transaction batching for efficiency
- [ ] Support for Layer 2 networks (Arbitrum, Optimism, etc.)

