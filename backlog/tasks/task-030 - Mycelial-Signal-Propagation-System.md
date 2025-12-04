---
id: task-030
title: Mycelial Signal Propagation System
status: Done
assignee:
  - '@claude'
created_date: '2025-12-04 21:12'
updated_date: '2025-12-04 23:37'
labels:
  - feature
  - mapping
  - intelligence
  - research
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a biologically-inspired signal propagation system for the canvas network, modeling how information, attention, and value flow through the collaborative space like nutrients through mycelium.

Core concepts:
- Nodes: Points of interest, events, people, resources, discoveries
- Hyphae: Connections/paths between nodes (relationships, routes, attention threads)
- Signals: Urgency, relevance, trust, novelty gradients
- Behaviors: Gradient following, path optimization, emergence detection

Features:
- Signal emission when events/discoveries occur
- Decay with spatial, relational, and temporal distance
- Aggregation at nodes (multiple weak signals → strong signal)
- Spore dispersal pattern for notifications
- Resonance detection (unconnected focus on same location)
- Collective blindspot visualization (unmapped areas)

The map becomes a living organism that breathes with activity cycles and grows where attention focuses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Signal propagation algorithm implemented
- [x] #2 Decay functions configurable (spatial, relational, temporal)
- [x] #3 Visualization of signal gradients on canvas
- [x] #4 Resonance detection alerts working
- [x] #5 Spore-style notification system
- [x] #6 Blindspot/unknown area highlighting
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed Mycelial Signal Propagation System - 5 files in src/open-mapping/mycelium/:

types.ts: Node/Hypha/Signal/Decay/Propagation/Resonance type definitions with event system

signals.ts: Decay functions (exponential, linear, inverse, step, gaussian) + 4 propagation algorithms (flood, gradient, random-walk, diffusion)

network.ts: MyceliumNetwork class with node/hypha CRUD, signal emission/queue, resonance detection, maintenance loop, stats

visualization.ts: Color palettes, dynamic sizing, Canvas 2D rendering, heat maps, CSS keyframes

index.ts: Clean barrel export for entire module
<!-- SECTION:NOTES:END -->
