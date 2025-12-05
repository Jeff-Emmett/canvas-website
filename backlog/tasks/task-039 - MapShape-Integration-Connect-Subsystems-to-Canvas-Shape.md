---
id: task-039
title: 'MapShape Integration: Connect Subsystems to Canvas Shape'
status: In Progress
assignee: []
created_date: '2025-12-05 02:12'
labels:
  - feature
  - mapping
  - integration
dependencies:
  - task-024
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evolve MapShapeUtil.tsx to integrate the 6 implemented subsystems (privacy, mycelium, lenses, conics, discovery, presence) into the canvas map shape. Currently the MapShape is a standalone map viewer - it needs to become the central hub for all open-mapping features.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MapShape props extended for subsystem toggles
- [ ] #2 Presence layer integrated with opt-in location sharing
- [ ] #3 Lens system accessible via UI
- [ ] #4 Route/waypoint visualization working
- [ ] #5 Collaboration sync via Automerge
- [ ] #6 Discovery game elements visible on map
<!-- AC:END -->
