---
id: task-039
title: 'MapShape Integration: Connect Subsystems to Canvas Shape'
status: In Progress
assignee: []
created_date: '2025-12-05 02:12'
updated_date: '2025-12-05 02:35'
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
- [x] #1 MapShape props extended for subsystem toggles
- [x] #2 Presence layer integrated with opt-in location sharing
- [x] #3 Lens system accessible via UI
- [x] #4 Route/waypoint visualization working
- [ ] #5 Collaboration sync via Automerge
- [ ] #6 Discovery game elements visible on map
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**MapShape Evolution Progress (Dec 5, 2025):**

### Completed:

1. **Extended IMapShape Props** - Added comprehensive subsystem configuration types:
   - `MapPresenceConfig` - Location sharing with privacy levels
   - `MapLensConfig` - Alternative map projections
   - `MapDiscoveryConfig` - Games, anchors, spores, hunts
   - `MapRoutingConfig` - Waypoints, routes, alternatives
   - `MapConicsConfig` - Possibility cones visualization

2. **Header UI Controls** - Subsystem toolbar with:
   - ⚙️ Expandable subsystem panel
   - Toggle buttons for each subsystem
   - Lens selector dropdown (6 lens types)
   - Share location button for presence
   - Active subsystem indicators in header

3. **Visualization Layers Added:**
   - Route polyline layer (MapLibre GeoJSON source/layer)
   - Waypoint markers management
   - Routing panel (bottom-right) with stats
   - Presence panel (bottom-left) with share button
   - Discovery panel (top-right) with checkboxes
   - Lens indicator badge (top-left when active)

### Still Needed:
- Actual MapLibre marker implementation for waypoints
- Integration with OSRM routing backend
- Connect presence system to actual location services
- Wire up discovery system to anchor/spore data

**Additional Implementation (Dec 5, 2025):**

### Routing System - Fully Working:
- ✅ MapLibre.Marker implementation with draggable waypoints
- ✅ Click-to-add-waypoint when routing enabled
- ✅ OSRM routing service integration (public server)
- ✅ Auto-route calculation after adding/dragging waypoints
- ✅ Route polyline rendering with GeoJSON layer
- ✅ Clear route button with full state reset
- ✅ Loading indicator during route calculation
- ✅ Distance/duration display in routing panel

### Presence System - Fully Working:
- ✅ Browser Geolocation API integration
- ✅ Location watching with configurable accuracy
- ✅ User location marker with pulsing animation
- ✅ Error handling (permission denied, unavailable, timeout)
- ✅ "Go to My Location" button with flyTo animation
- ✅ Privacy level affects GPS accuracy settings
- ✅ Real-time coordinate display when sharing

### Still TODO:
- Discovery system anchor visualization
- Automerge sync for collaborative editing

Phase 5: Automerge Sync Integration - Analyzing existing sync architecture. TLDraw shapes sync automatically via TLStoreToAutomerge.ts. MapShape props should already sync since they're part of the shape record.
<!-- SECTION:NOTES:END -->
