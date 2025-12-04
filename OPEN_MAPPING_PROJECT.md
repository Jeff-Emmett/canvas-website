# Open Mapping Project

## Overview

**Open Mapping** is a collaborative route planning module for canvas-website that provides advanced mapping functionality beyond traditional tools like Google Maps. Built on open-source foundations (OpenStreetMap, OSRM, Valhalla, MapLibre), it integrates seamlessly with the tldraw canvas environment.

## Vision

Create a "living map" that exists as a layer within the collaborative canvas, enabling teams to:
- Plan multi-destination trips with optimized routing
- Compare alternative routes visually
- Share and collaborate on itineraries in real-time
- Track budgets and schedules alongside geographic planning
- Work offline with cached map data

## Core Features

### 1. Map Canvas Integration
- MapLibre GL JS as the rendering engine
- Seamless embedding within tldraw canvas
- Pan/zoom synchronized with canvas viewport

### 2. Multi-Path Routing
- Support for multiple routing profiles (car, bike, foot, transit)
- Side-by-side route comparison
- Alternative route suggestions
- Turn-by-turn directions with elevation profiles

### 3. Collaborative Editing
- Real-time waypoint sharing via Y.js/CRDT
- Cursor presence on map
- Concurrent route editing without conflicts
- Share links for view-only or edit access

### 4. Layer Management
- Multiple basemap options (OSM, satellite, terrain)
- Custom overlay layers (GeoJSON import)
- Route-specific layers (cycling, hiking trails)

### 5. Calendar Integration
- Attach time windows to waypoints
- Visualize itinerary timeline
- Sync with external calendars (iCal export)

### 6. Budget Tracking
- Cost estimates per route (fuel, tolls)
- Per-waypoint expense tracking
- Trip budget aggregation

### 7. Offline Capability
- Tile caching for offline use
- Route pre-computation and storage
- PWA support

## Technology Stack

| Component | Technology | License |
|-----------|------------|---------|
| Map Renderer | MapLibre GL JS | BSD-3 |
| Base Maps | OpenStreetMap | ODbL |
| Routing Engine | OSRM / Valhalla | BSD-2 / MIT |
| Optimization | VROOM | BSD |
| Collaboration | Y.js | MIT |

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] MapLibre GL JS integration with tldraw
- [ ] Basic waypoint placement and rendering
- [ ] Single-route calculation via OSRM
- [ ] Route polyline display

### Phase 2: Multi-Route & Comparison
- [ ] Alternative routes visualization
- [ ] Route comparison panel
- [ ] Elevation profile display
- [ ] Drag-to-reroute functionality

### Phase 3: Collaboration
- [ ] Y.js integration for real-time sync
- [ ] Cursor presence on map
- [ ] Share link generation

### Phase 4: Layers & Customization
- [ ] Layer panel UI
- [ ] Multiple basemap options
- [ ] Overlay layer support

### Phase 5: Calendar & Budget
- [ ] Time window attachment
- [ ] Budget tracking per waypoint
- [ ] iCal export

### Phase 6: Optimization & Offline
- [ ] VROOM integration for TSP/VRP
- [ ] Tile caching via Service Worker
- [ ] PWA manifest

## File Structure

```
src/open-mapping/
├── index.ts                 # Public exports
├── types/index.ts           # TypeScript definitions
├── components/
│   ├── MapCanvas.tsx        # Main map component
│   ├── RouteLayer.tsx       # Route rendering
│   ├── WaypointMarker.tsx   # Interactive markers
│   └── LayerPanel.tsx       # Layer management UI
├── hooks/
│   ├── useMapInstance.ts    # MapLibre instance
│   ├── useRouting.ts        # Route calculation
│   ├── useCollaboration.ts  # Y.js sync
│   └── useLayers.ts         # Layer state
├── services/
│   ├── RoutingService.ts    # Multi-provider routing
│   ├── TileService.ts       # Tile management
│   └── OptimizationService.ts # VROOM integration
└── utils/index.ts           # Helper functions
```

## Docker Deployment

Backend services deploy to `/opt/apps/open-mapping/` on Netcup RS 8000:

- **OSRM** - Primary routing engine
- **Valhalla** - Extended routing with transit/isochrones
- **TileServer GL** - Vector tiles
- **VROOM** - Route optimization

See `open-mapping.docker-compose.yml` for full configuration.

## References

- [OSRM Documentation](https://project-osrm.org/docs/v5.24.0/api/)
- [Valhalla API](https://valhalla.github.io/valhalla/api/)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js-docs/api/)
- [VROOM Project](http://vroom-project.org/)
- [Y.js Documentation](https://docs.yjs.dev/)
