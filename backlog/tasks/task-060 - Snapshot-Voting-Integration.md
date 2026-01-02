---
id: task-060
title: Snapshot Voting Integration
status: To Do
assignee: []
created_date: '2026-01-02 16:08'
labels:
  - feature
  - web3
  - governance
  - voting
dependencies:
  - task-007
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate Snapshot.js SDK for off-chain governance voting through the canvas interface.

## Overview
Enable CryptID users with linked wallets to participate in Snapshot governance votes directly from the canvas. Proposals and voting can be visualized as shapes on the canvas.

## Dependencies
- Requires task-007 (Web3 Wallet Linking) to be completed first
- User must have at least one linked wallet with voting power

## Technical Approach
- Use Snapshot.js SDK for proposal fetching and vote submission
- Create VotingShape to visualize proposals on canvas
- Support EIP-712 signature-based voting via linked wallet
- Cache voting power from linked wallets

## Features
1. **Proposal Browser** - List active proposals from configured spaces
2. **VotingShape** - Canvas shape to display proposal details and vote
3. **Vote Signing** - Use wagmi's signTypedData for EIP-712 votes
4. **Voting Power Display** - Show user's voting power per space
5. **Vote History** - Track user's past votes

## Spaces to Support Initially
- mycofi.eth (MycoFi DAO)
- Add configuration for additional spaces

## References
- Snapshot.js: https://docs.snapshot.org/tools/snapshot.js
- Snapshot API: https://docs.snapshot.org/tools/api
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Install and configure Snapshot.js SDK
- [ ] #2 Create VotingShape with proposal details display
- [ ] #3 Implement vote signing flow with EIP-712
- [ ] #4 Add proposal browser panel to canvas UI
- [ ] #5 Display voting power from linked wallets
- [ ] #6 Support multiple Snapshot spaces via configuration
- [ ] #7 Cache and display vote history
<!-- AC:END -->
