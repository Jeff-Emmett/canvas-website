---
id: task-062
title: Account Abstraction (ERC-4337) Exploration
status: To Do
assignee: []
created_date: '2026-01-02 16:08'
labels:
  - research
  - web3
  - account-abstraction
  - erc-4337
dependencies:
  - task-007
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Research and prototype using ERC-4337 Account Abstraction to enable CryptID's P-256 keys to directly control smart contract wallets.

## Overview
Explore the possibility of using Account Abstraction (ERC-4337) to bridge CryptID's WebCrypto P-256 keys with Ethereum transactions. This would eliminate the need for wallet linking by allowing CryptID keys to directly sign UserOperations that control a smart wallet.

## Background
- CryptID uses ECDSA P-256 (NIST curve) via WebCrypto API
- Ethereum uses ECDSA secp256k1
- These curves are incompatible for direct signing
- ERC-4337 allows any signature scheme via custom validation logic

## Research Questions
1. Is P-256 signature verification gas-efficient on-chain?
2. What existing implementations exist? (Clave, Daimo)
3. What are the wallet deployment costs per user?
4. How do we handle gas sponsorship (paymaster)?
5. Which bundler/paymaster providers support this?

## Potential Benefits
- Single key for auth AND transactions
- Gasless transactions via paymaster
- Social recovery using CryptID email
- No MetaMask/wallet app needed
- True passwordless Web3

## Risks & Challenges
- Complex implementation
- Gas costs for P-256 verification (~100k gas)
- Not all L2s support ERC-4337 yet
- User education on new paradigm

## Providers to Evaluate
- Pimlico (bundler + paymaster)
- Alchemy Account Kit
- Stackup
- Biconomy

## References
- ERC-4337 Spec: https://eips.ethereum.org/EIPS/eip-4337
- Clave (P-256 wallet): https://getclave.io/
- Daimo (P-256 wallet): https://daimo.com/
- viem Account Abstraction: https://viem.sh/account-abstraction
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research P-256 on-chain verification gas costs
- [ ] #2 Evaluate existing P-256 wallet implementations (Clave, Daimo)
- [ ] #3 Prototype UserOperation signing with CryptID keys
- [ ] #4 Evaluate bundler/paymaster providers
- [ ] #5 Document architecture proposal if viable
- [ ] #6 Estimate implementation timeline and costs
<!-- AC:END -->
