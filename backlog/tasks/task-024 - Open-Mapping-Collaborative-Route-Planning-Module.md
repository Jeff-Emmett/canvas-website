---
id: task-024
title: 'Open Mapping: Collaborative Route Planning Module'
status: To Do
assignee: []
created_date: '2025-12-04 14:30'
labels:
  - feature
  - mapping
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement an open-source mapping and routing layer for the canvas that provides advanced route planning capabilities beyond Google Maps. Built on OpenStreetMap, OSRM/Valhalla, and MapLibre GL JS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MapLibre GL JS integrated with tldraw canvas
- [ ] #2 OSRM routing backend deployed to Netcup
- [ ] #3 Waypoint placement and route calculation working
- [ ] #4 Multi-route comparison UI implemented
- [ ] #5 Y.js collaboration for shared route editing
- [ ] #6 Layer management panel with basemap switching
- [ ] #7 Offline tile caching via Service Worker
- [ ] #8 Budget tracking per waypoint/route
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Phase 1 - Foundation:
- Integrate MapLibre GL JS with tldraw
- Deploy OSRM to /opt/apps/open-mapping/
- Basic waypoint and route UI

Phase 2 - Multi-Route:
- Alternative routes visualization
- Route comparison panel
- Elevation profiles

Phase 3 - Collaboration:
- Y.js integration
- Real-time cursor presence
- Share links

Phase 4 - Layers:
- Layer panel UI
- Multiple basemaps
- Custom overlays

Phase 5 - Calendar/Budget:
- Time windows on waypoints
- Cost estimation
- iCal export

Phase 6 - Optimization:
- VROOM TSP/VRP
- Offline PWA
<!-- SECTION:PLAN:END -->
