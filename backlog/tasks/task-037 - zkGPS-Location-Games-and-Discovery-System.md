---
id: task-037
title: zkGPS Location Games and Discovery System
status: In Progress
assignee: []
created_date: '2025-12-05 00:49'
updated_date: '2025-12-05 01:41'
labels:
  - feature
  - open-mapping
  - games
  - zkGPS
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a location-based game framework combining zkGPS privacy proofs with collaborative mapping for treasure hunts, collectibles, and IoT-anchored discoveries.

Use cases:
- Conference treasure hunts with provable location without disclosure
- Collectible elements anchored to physical locations
- Crafting/combining discovered items
- Mycelial network growth between discovered nodes
- IoT hardware integration (NFC tags, BLE beacons)

Game mechanics:
- Proximity proofs ("I'm within 50m of X" without revealing where)
- Hot/cold navigation using geohash precision degradation
- First-finder rewards with timestamp proofs
- Group discovery requiring N players in proximity
- Spore collection and mycelium cultivation
- Fruiting bodies when networks connect

Integration points:
- zkGPS commitments for hidden locations
- Mycelium network for discovery propagation
- Trust circles for team-based play
- Possibility cones for "reachable discoveries" visualization
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Discovery anchor types (physical, virtual, IoT)
- [x] #2 Proximity proof verification for discoveries
- [x] #3 Collectible item system with crafting
- [x] #4 Mycelium growth between discovered locations
- [x] #5 Team/group discovery mechanics
- [x] #6 Hot/cold navigation hints
- [x] #7 First-finder and timestamp proofs
- [x] #8 IoT anchor protocol (NFC/BLE/QR)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented complete discovery game system with:

**types.ts** - Comprehensive type definitions:
- Discovery anchors (physical, NFC, BLE, QR, virtual, temporal, social)
- IoT requirements and social requirements
- Collectibles, crafting recipes, inventory slots
- Spores, planted spores, fruiting bodies
- Treasure hunts, scoring, leaderboards
- Hot/cold navigation hints

**anchors.ts** - Anchor management:
- Create anchors with zkGPS commitments
- Proximity-based discovery verification
- Hot/cold navigation hints
- Prerequisite and cooldown checking
- IoT and social requirement verification

**collectibles.ts** - Item and crafting system:
- ItemRegistry for item definitions
- InventoryManager with stacking
- CraftingManager with recipes
- Default spore, fragment, and artifact items

**spores.ts** - Mycelium integration:
- 7 spore types (explorer, connector, amplifier, guardian, harvester, temporal, social)
- Planting spores at discovered locations
- Hypha connections between nearby spores
- Fruiting body emergence when networks connect
- Growth simulation with nutrient decay

**hunts.ts** - Treasure hunt management:
- Create hunts with multiple anchors
- Sequential or free-form discovery
- Scoring with bonuses (first finder, time, sequence, group)
- Leaderboards and prizes
- Hunt templates (quick, standard, epic, team)

Moving to In Progress - core TypeScript implementation complete, still needs:
- UI components for discovery/hunt interfaces
- Canvas integration for map visualization
- Real IoT hardware testing (NFC/BLE)
- Backend persistence layer
- Multiplayer sync via Automerge
<!-- SECTION:NOTES:END -->
