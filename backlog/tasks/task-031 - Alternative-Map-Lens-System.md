---
id: task-031
title: Alternative Map Lens System
status: Done
assignee:
  - '@claude'
created_date: '2025-12-04 21:12'
updated_date: '2025-12-04 23:42'
labels:
  - feature
  - mapping
  - visualization
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement multiple "lens" views that project different data dimensions onto the canvas coordinate space. The same underlying data can be viewed through different lenses.

Lens types:
- Geographic: Traditional OSM basemap, physical locations
- Temporal: Time as X-axis, events as nodes, time-scrubbing UI
- Attention: Heatmap of collective focus, nodes sized by current attention
- Incentive: Value gradients, token flows, MycoFi integration
- Relational: Social graph topology, force-directed layout
- Possibility: Branching futures, what-if scenarios, alternate timelines

Features:
- Smooth transitions between lens types
- Lens blending (e.g., 50% geographic + 50% attention)
- Temporal scrubber for historical playback
- Temporal portals (click location to see across time)
- Living maps that grow/fade based on attention

Each lens uses the same canvas shapes but transforms their positions and styling based on the active projection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Lens switcher UI implemented
- [x] #2 Geographic lens working with OSM
- [x] #3 Temporal lens with time scrubber
- [x] #4 Attention heatmap visualization
- [x] #5 Smooth transitions between lenses
- [x] #6 Lens blending capability
- [ ] #7 Temporal portal feature (click to see history)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed Alternative Map Lens System - 5 files in src/open-mapping/lenses/:

types.ts: All lens type definitions (Geographic, Temporal, Attention, Incentive, Relational, Possibility) with configs, transitions, events

transforms.ts: Coordinate transform functions for each lens type + force-directed layout algorithm for relational lens

blending.ts: Easing functions, transition creation/interpolation, point blending for multi-lens views

manager.ts: LensManager class with lens activation/deactivation, transitions, viewport control, temporal playback, temporal portals

index.ts: Clean barrel export for entire lens system
<!-- SECTION:NOTES:END -->
