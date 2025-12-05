---
id: task-039
title: 'MapShape Integration: Connect Subsystems to Canvas Shape'
status: In Progress
assignee: []
created_date: '2025-12-05 02:12'
updated_date: '2025-12-05 03:40'
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
- [x] #5 Collaboration sync via Automerge
- [x] #6 Discovery game elements visible on map
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

**Automerge Sync Implementation Complete (Dec 5, 2025):**

1. **Collaborative sharedLocations** - Added `sharedLocations: Record<string, SharedLocation>` to MapPresenceConfig props

2. **Conflict-free updates** - Each user updates only their own key in sharedLocations, allowing Automerge CRDT to handle concurrent updates automatically

3. **Location sync effect** - When user shares location, their coordinate is published to sharedLocations with userId, userName, color, timestamp, and privacyLevel

4. **Auto-cleanup** - User's entry is removed from sharedLocations when they stop sharing

5. **Collaborator markers** - Renders MapLibre markers for all other users' shared locations (different from user's own pulsing marker)

6. **Stale location filtering** - Collaborator locations older than 5 minutes are not rendered

7. **UI updates** - Presence panel now shows count of online collaborators

**How it works:**

- MapShape props sync automatically via existing TLDraw → Automerge infrastructure

- When user calls editor.updateShape() to update MapShape props, changes flow through TLStoreToAutomerge.ts

- Remote changes come back via Automerge patches and update the shape's props

- Each user only writes to their own key in sharedLocations, so no conflicts occur

**Discovery Visualization Complete (Dec 5, 2025):**

### Added Display Types for Automerge Sync:
- `DiscoveryAnchorMarker` - Simplified anchor data for map markers
- `SporeMarker` - Mycelium spore data with strength and connections
- `HuntMarker` - Treasure hunt waypoints with sequence numbers

### MapDiscoveryConfig Extended:
- `anchors: DiscoveryAnchorMarker[]` - Synced anchor data
- `spores: SporeMarker[]` - Synced spore data with connection graph
- `hunts: HuntMarker[]` - Synced treasure hunt waypoints

### Marker Rendering Implemented:
1. **Anchor Markers** - Circular markers with type-specific colors (physical=green, nfc=blue, qr=purple, virtual=amber). Hidden anchors shown with reduced opacity until discovered.

2. **Spore Markers** - Pulsing circular markers with radial gradients. Size scales with spore strength (40-100%). Animation keyframes for organic feel.

3. **Mycelium Network** - GeoJSON LineString layer connecting spores. Dashed green lines with 60% opacity visualize the network connections.

4. **Hunt Markers** - Numbered square markers for treasure hunts. Amber when not found, green with checkmark when discovered.

### Discovery Panel Enhanced:
- Stats display showing counts: 📍 anchors, 🍄 spores, 🏆 hunts
- "+Add Anchor" button - Creates demo anchor at map center
- "+Add Spore" button - Creates demo spore with random connection
- "+Add Hunt Point" button - Creates treasure hunt waypoint
- "Clear All" button - Removes all discovery elements

### How Automerge Sync Works:
- Discovery data stored in MapShape.props.discovery
- Shape updates via editor.updateShape() flow through TLStoreToAutomerge
- All collaborators see markers appear in real-time
- Each user can add/modify elements, CRDT handles conflicts
<!-- SECTION:NOTES:END -->
