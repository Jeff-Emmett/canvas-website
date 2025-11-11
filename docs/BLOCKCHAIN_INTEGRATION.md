# Web Crypto API to Blockchain Integration

This document describes the implementation of linking Web Crypto API (ECDSA P-256) accounts with Ethereum-compatible wallets (MetaMask, Gnosis Safe) to enable blockchain transaction execution.

## Overview

The integration uses a **minimal proxy contract pattern** where:

1. Each user deploys a lightweight proxy contract that stores their Web Crypto P-256 public key
2. Users sign transaction authorization messages with their Web Crypto API private key (P-256)
3. The proxy contract verifies the P-256 signature and executes the transaction
4. Transactions can be submitted either:
   - **Through wallet** (MetaMask/Gnosis Safe) - User pays gas fees
   - **Through relayer** (Gasless) - Relayer service pays gas fees on behalf of users

## Architecture

### Core Components

1. **Web Crypto API Signing** (`src/lib/auth/cryptoBlockchain.ts`)
   - EIP-712 structured data signing
   - Transaction authorization message creation
   - Signature formatting for blockchain

2. **Ethereum Integration** (`src/lib/blockchain/ethereum.ts`)
   - Wallet connection (MetaMask, etc.)
   - Transaction building and submission
   - Chain management

3. **Account Linking** (`src/lib/auth/blockchainLinking.ts`)
   - Links Web Crypto accounts with Ethereum addresses
   - Stores linked account mappings
   - Verifies ownership of both keys

4. **Wallet Integration** (`src/lib/blockchain/walletIntegration.ts`)
   - Proxy contract deployment
   - Public key coordinate extraction
   - Factory contract interaction

5. **Relayer Service** (`src/lib/blockchain/relayer.ts` & `worker/blockchainRelayer.ts`)
   - Gasless transaction submission
   - Relayer configuration management
   - Cloudflare Worker relayer implementation
   - Signature verification before submission

6. **Smart Contracts** (`contracts/`)
   - `WebCryptoProxy.sol` - Minimal proxy contract for each user
   - `WebCryptoProxyFactory.sol` - Factory for deploying proxies

7. **UI Components**
   - `BlockchainLink.tsx` - Link Web Crypto account with wallet
   - `WalletStatus.tsx` - Display connection status
   - `TransactionBuilder.tsx` - Build and authorize transactions (with gasless option)

8. **Context** (`src/context/BlockchainContext.tsx`)
   - React context for blockchain state management
   - Wallet connection state
   - Linked account management

## Technical Details

### Challenge: P-256 vs secp256k1

- **Web Crypto API**: Uses ECDSA P-256 (NIST curve)
- **Ethereum**: Uses secp256k1 (different curve)
- **Solution**: Proxy contract verifies P-256 signatures on-chain

### Transaction Flow

#### Standard Flow (User Pays Gas)

1. User initiates transaction in the application
2. Application builds EIP-712 structured authorization message
3. Web Crypto API signs message with P-256 private key
4. Application constructs proxy contract call with signature
5. MetaMask/Gnosis Safe prompts user to submit transaction
6. Wallet submits transaction to proxy contract
7. Proxy contract verifies P-256 signature
8. If valid, proxy contract executes the transaction
9. User pays gas fees

#### Gasless Flow (Relayer Pays Gas)

1. User initiates transaction in the application
2. Application builds EIP-712 structured authorization message
3. Web Crypto API signs message with P-256 private key
4. User selects "Use gasless transaction" option
5. Application submits signed transaction to relayer service
6. Relayer verifies signature and transaction validity
7. Relayer submits transaction to proxy contract (pays gas)
8. Proxy contract verifies P-256 signature
9. If valid, proxy contract executes the transaction
10. User pays no gas fees

### EIP-712 Message Format

```typescript
{
  types: {
    EIP712Domain: [...],
    Transaction: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  },
  domain: {
    name: 'WebCryptoProxy',
    version: '1',
    chainId: number,
    verifyingContract: string
  },
  message: {
    to: string,
    value: string,
    data: string,
    nonce: number,
    deadline: number
  }
}
```

### Proxy Contract Structure

The minimal proxy contract (`WebCryptoProxy.sol`):

- Stores P-256 public key (X and Y coordinates)
- Verifies P-256 signatures
- Executes transactions when signature is valid
- Implements replay protection via nonces
- Enforces transaction deadlines

**Note**: The P-256 signature verification in the contract is currently a placeholder. You'll need to implement or import a P-256 verification library. Options include:

1. Use a precompile (if available on your chain)
2. Import a P-256 verification library (e.g., from OpenZeppelin)
3. Use an external verification contract

## Setup

### Dependencies

```bash
npm install viem @noble/curves
```

### Smart Contract Deployment

1. Deploy `WebCryptoProxyFactory.sol` to your target chain
2. Update factory address in `walletIntegration.ts`
3. Users deploy their proxy contracts via the factory

### Integration

1. Wrap your app with `BlockchainProvider`:

```tsx
import { BlockchainProvider } from './context/BlockchainContext';

function App() {
  return (
    <BlockchainProvider>
      {/* Your app */}
    </BlockchainProvider>
  );
}
```

2. Use the blockchain context:

```tsx
import { useBlockchain } from './context/BlockchainContext';

function MyComponent() {
  const { wallet, connect, linkWebCryptoAccount } = useBlockchain();
  // ...
}
```

## Usage

### Linking Accounts

1. User logs in with Web Crypto API
2. User connects their Ethereum wallet (MetaMask, etc.)
3. User links accounts via `BlockchainLink` component
4. System stores the mapping between Web Crypto and Ethereum accounts

### Building Transactions

#### Standard Transaction (User Pays Gas)

1. User fills out transaction details in `TransactionBuilder`
2. Application creates EIP-712 authorization message
3. Web Crypto API signs the message
4. Application builds proxy contract call
5. Wallet prompts user to submit transaction
6. Transaction executes through proxy contract
7. User pays gas fees

#### Gasless Transaction (Relayer Pays Gas)

1. User fills out transaction details in `TransactionBuilder`
2. User checks "Use gasless transaction" checkbox
3. Application creates EIP-712 authorization message
4. Web Crypto API signs the message
5. Application submits to relayer service
6. Relayer verifies and submits transaction
7. Transaction executes through proxy contract
8. Relayer pays gas fees (user pays nothing)

**Note**: Gasless transactions require a relayer service to be deployed and configured. See [Gasless Transactions Setup](./GASLESS_TRANSACTIONS.md) for details.

## Gasless Transactions

The system supports gasless transactions through a relayer service. This allows users to execute blockchain transactions without paying gas fees.

### How It Works

1. **User signs** transaction with Web Crypto API
2. **Relayer receives** signed transaction request
3. **Relayer verifies** signature and transaction validity
4. **Relayer submits** transaction to blockchain (pays gas)
5. **Transaction executes** through proxy contract

### Setup

See [Gasless Transactions Setup](./GASLESS_TRANSACTIONS.md) for complete setup instructions, including:
- Deploying the relayer worker
- Configuring relayer URLs
- Funding the relayer wallet
- Security considerations

### Usage

Users can enable gasless transactions by checking the "Use gasless transaction" checkbox in the `TransactionBuilder` component. The system automatically falls back to wallet-based transactions if the relayer is unavailable.

## Security Considerations

1. **Private Key Storage**: Web Crypto private keys should use secure storage (IndexedDB, Web Crypto API key storage)
2. **Signature Verification**: P-256 verification must be properly implemented in the smart contract
3. **Replay Protection**: Nonces prevent transaction replay attacks
4. **Deadline Enforcement**: Transactions expire after deadline
5. **Gas Limits**: Set reasonable gas limits for executed transactions
6. **Relayer Security**: Relayer private key must be stored securely (Cloudflare Workers secrets)
7. **Relayer Rate Limiting**: Implement rate limiting to prevent abuse of gasless transactions
8. **Relayer Monitoring**: Monitor relayer wallet balance and transaction costs

## Limitations & TODO

### Current Limitations

1. **P-256 Verification**: The smart contract's P-256 signature verification is not yet implemented
2. **Private Key Storage**: Currently uses simplified storage - needs secure key management
3. **Nonce Management**: Nonces are currently timestamp-based - should use contract state
4. **Proxy Deployment**: Factory address needs to be configured per chain

### TODO

- [ ] Implement P-256 signature verification in smart contract
- [ ] Add secure private key storage using Web Crypto API key storage
- [ ] Implement proper nonce management from contract state
- [ ] Add support for multiple chains
- [ ] Add transaction history tracking
- [ ] Add error handling and retry logic
- [ ] Add support for Gnosis Safe multi-sig wallets
- [ ] Add gas estimation and optimization
- [ ] Add transaction status monitoring
- [x] Implement gasless transactions via relayer service
- [ ] Add relayer rate limiting and abuse prevention
- [ ] Implement paymaster contract integration (alternative to relayer)
- [ ] Add relayer health monitoring and automatic failover

## File Structure

```
src/
├── lib/
│   ├── auth/
│   │   ├── cryptoBlockchain.ts      # Blockchain signing utilities
│   │   └── blockchainLinking.ts      # Account linking service
│   └── blockchain/
│       ├── ethereum.ts               # Ethereum integration
│       ├── walletIntegration.ts     # Wallet integration
│       ├── relayer.ts                # Gasless transaction relayer client
│       └── index.ts                  # Exports
├── components/
│   ├── auth/
│   │   └── BlockchainLink.tsx       # Link account UI
│   └── blockchain/
│       ├── WalletStatus.tsx          # Status display
│       └── TransactionBuilder.tsx   # Transaction builder (with gasless option)
├── context/
│   └── BlockchainContext.tsx         # Blockchain state context
worker/
└── blockchainRelayer.ts               # Cloudflare Worker relayer service
contracts/
├── WebCryptoProxy.sol                # Minimal proxy contract
└── WebCryptoProxyFactory.sol         # Factory contract
```

## Related Documentation

- [Gasless Transactions Setup](./GASLESS_TRANSACTIONS.md) - Complete guide for setting up and using gasless transactions
- [Blockchain Implementation Summary](./BLOCKCHAIN_IMPLEMENTATION_SUMMARY.md) - Implementation details and status

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)
- [Viem Documentation](https://viem.sh/)
- [Ethereum Cryptography](https://github.com/ethereum/js-ethereum-cryptography)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337) - Alternative approach for gasless transactions

