---
id: task-024
title: 'Open Mapping: Collaborative Route Planning Module'
status: In Progress
assignee: []
created_date: '2025-12-04 14:30'
updated_date: '2025-12-06 06:40'
labels:
  - feature
  - mapping
dependencies:
  - task-029
  - task-030
  - task-031
  - task-036
  - task-037
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement an open-source mapping and routing layer for the canvas that provides advanced route planning capabilities beyond Google Maps. Built on OpenStreetMap, OSRM/Valhalla, and MapLibre GL JS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MapLibre GL JS integrated with tldraw canvas
- [x] #2 OSRM routing backend deployed to Netcup
- [x] #3 Waypoint placement and route calculation working
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Subsystem implementations completed:**
- task-029: zkGPS Privacy Protocol (src/open-mapping/privacy/)
- task-030: Mycelial Signal Propagation (src/open-mapping/mycelium/)
- task-031: Alternative Map Lens System (src/open-mapping/lenses/)
- task-036: Possibility Cones & Constraints (src/open-mapping/conics/)
- task-037: Location Games & Discovery (src/open-mapping/discovery/)

**Still needs:**
- MapLibre GL JS canvas integration
- OSRM backend deployment
- UI components for all subsystems
- Automerge sync for collaborative editing

Pushed to feature/open-mapping branch:
- MapShapeUtil for tldraw canvas integration
- Presence layer with location sharing
- Mycelium network visualization
- Discovery system (spores, hunts, collectibles)
- Privacy system with ZK-GPS protocol concepts

**Merged to dev branch (2025-12-05):**
- All subsystem TypeScript implementations merged
- MapShapeUtil integrated with canvas
- ConnectionStatusIndicator added
- Merged with PrivateWorkspace feature (no conflicts)
- Ready for staging/production testing

**Remaining work:**
- MapLibre GL JS full canvas integration
- OSRM backend deployment to Netcup
- UI polish and testing

**OSRM Backend Deployed (2025-12-05):**
- Docker container running on Netcup RS 8000
- Location: /opt/apps/osrm-routing/
- Public URL: https://routing.jeffemmett.com
- Uses Traefik for routing via Docker network
- Currently loaded with Monaco OSM data (for testing)
- MapShapeUtil updated to use self-hosted OSRM
- Verified working: curl returns valid route responses

Map refactoring completed:
- Created simplified MapShapeUtil.tsx (836 lines) with MapLibre + search + routing
- Created GPSCollaborationLayer.ts as standalone module for GPS sharing
- Added layers/index.ts and updated open-mapping exports
- Server running without compilation errors
- Architecture now follows layer pattern: Base Map → Collaboration Layers

Enhanced MapShapeUtil (1326 lines) with:
- Touch/pen/mouse support with proper z-index (1000+) and touchAction styles
- Search with autocomplete as you type (Nominatim, 400ms debounce)
- Directions panel with waypoint management, reverse route, clear
- GPS location sharing panel with start/stop, accuracy display
- Quick action toolbar: search, directions (🚗), GPS (📍), style picker
- Larger touch targets (44px buttons) for mobile
- Pulse animation on user GPS marker
- "Fit All" button to zoom to all GPS users
- Route info badge when panel is closed

Fixed persistence issue with two changes:

1. Server-side: handlePeerDisconnect now flushes pending saves immediately (prevents data loss on page close)

2. Client-side: Changed merge strategy from 'local takes precedence' to 'server takes precedence' for initial load
<!-- SECTION:NOTES:END -->
