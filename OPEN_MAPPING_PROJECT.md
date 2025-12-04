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
- Map shapes that can be annotated like any canvas object

### 2. Multi-Path Routing
- Support for multiple routing profiles (car, bike, foot, transit)
- Side-by-side route comparison
- Alternative route suggestions
- Turn-by-turn directions with elevation profiles

### 3. Collaborative Editing
- Real-time waypoint sharing via Y.js/CRDT
- Cursor presence on map (see where collaborators are looking)
- Concurrent route editing without conflicts
- Share links for view-only or edit access

### 4. Layer Management
- Multiple basemap options (OSM, satellite, terrain)
- Custom overlay layers (GeoJSON import)
- Route-specific layers (cycling, hiking trails)
- POI layers with filtering

### 5. Calendar Integration
- Attach time windows to waypoints
- Visualize itinerary timeline
- Sync with external calendars (iCal export)
- Travel time estimation between events

### 6. Budget Tracking
- Cost estimates per route (fuel, tolls)
- Per-waypoint expense tracking
- Trip budget aggregation
- Currency conversion

### 7. Offline Capability
- Tile caching for offline use
- Route pre-computation and storage
- PWA support for mobile

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Canvas Website                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   tldraw Canvas                        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │            Open Mapping Layer                    │  │  │
│  │  │  ┌─────────────┐  ┌─────────────────────────┐   │  │  │
│  │  │  │ MapLibre GL │  │   Route Visualization   │   │  │  │
│  │  │  │  (basemap)  │  │   (polylines/markers)   │   │  │  │
│  │  │  └─────────────┘  └─────────────────────────┘   │  │  │
│  │  │  ┌─────────────┐  ┌─────────────────────────┐   │  │  │
│  │  │  │   Layers    │  │    Collaboration        │   │  │  │
│  │  │  │   Panel     │  │    Cursors/Presence     │   │  │  │
│  │  │  └─────────────┘  └─────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
    │  Routing API    │ │  Y.js     │ │  Tile Server    │
    │  (OSRM/Valhalla)│ │  (collab) │ │  (MapLibre)     │
    └─────────────────┘ └───────────┘ └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │    VROOM        │
    │  (optimization) │
    └─────────────────┘
```

## Technology Stack

| Component | Technology | License | Notes |
|-----------|------------|---------|-------|
| Map Renderer | MapLibre GL JS | BSD-3 | Open-source Mapbox fork |
| Base Maps | OpenStreetMap | ODbL | Free, community-maintained |
| Routing Engine | OSRM / Valhalla | BSD-2 / MIT | Self-hosted, fast |
| Multi-Route | GraphHopper | Apache 2.0 | Custom profiles |
| Optimization | VROOM | BSD | TSP/VRP solver |
| Collaboration | Y.js | MIT | CRDT-based sync |
| State Management | Jotai | MIT | Already in use |
| Tile Caching | Service Worker | - | PWA standard |

## Routing Provider Comparison

| Feature | OSRM | Valhalla | GraphHopper | ORS |
|---------|------|----------|-------------|-----|
| Speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Profiles | 3 | 6+ | 10+ | 8+ |
| Alternatives | ✅ | ✅ | ✅ | ✅ |
| Isochrones | ❌ | ✅ | ✅ | ✅ |
| Transit | ❌ | ✅ | ⚠️ | ❌ |
| License | BSD-2 | MIT | Apache | GPL |
| Docker Ready | ✅ | ✅ | ✅ | ✅ |

**Recommendation**: Start with OSRM for simplicity and speed, add Valhalla for transit/isochrones.

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] MapLibre GL JS integration with tldraw
- [ ] Basic waypoint placement and rendering
- [ ] Single-route calculation via OSRM
- [ ] Route polyline display
- [ ] Simple UI for profile selection (car/bike/foot)

### Phase 2: Multi-Route & Comparison
- [ ] Alternative routes visualization
- [ ] Route comparison panel (distance, time, cost)
- [ ] Profile-based coloring
- [ ] Elevation profile display
- [ ] Drag-to-reroute functionality

### Phase 3: Collaboration
- [ ] Y.js integration for real-time sync
- [ ] Cursor presence on map
- [ ] Concurrent waypoint editing
- [ ] Share link generation
- [ ] Permission management (view/edit)

### Phase 4: Layers & Customization
- [ ] Layer panel UI
- [ ] Multiple basemap options
- [ ] Overlay layer support (GeoJSON)
- [ ] Custom marker icons
- [ ] Style customization

### Phase 5: Calendar & Budget
- [ ] Time window attachment to waypoints
- [ ] Itinerary timeline view
- [ ] Budget tracking per waypoint
- [ ] Cost estimation for routes
- [ ] iCal export

### Phase 6: Optimization & Offline
- [ ] VROOM integration for TSP/VRP
- [ ] Multi-stop optimization
- [ ] Tile caching via Service Worker
- [ ] Offline route storage
- [ ] PWA manifest

## File Structure

```
src/open-mapping/
├── index.ts                 # Public exports
├── types/
│   └── index.ts             # TypeScript definitions
├── components/
│   ├── index.ts
│   ├── MapCanvas.tsx        # Main map component
│   ├── RouteLayer.tsx       # Route polyline rendering
│   ├── WaypointMarker.tsx   # Interactive markers
│   └── LayerPanel.tsx       # Layer management UI
├── hooks/
│   ├── index.ts
│   ├── useMapInstance.ts    # MapLibre instance management
│   ├── useRouting.ts        # Route calculation
│   ├── useCollaboration.ts  # Y.js sync
│   └── useLayers.ts         # Layer state
├── services/
│   ├── index.ts
│   ├── RoutingService.ts    # Multi-provider routing
│   ├── TileService.ts       # Tile management/caching
│   └── OptimizationService.ts # VROOM integration
└── utils/
    └── index.ts             # Helper functions
```

## Docker Deployment

The open-mapping backend services will be deployed to `/opt/apps/open-mapping/` on Netcup RS 8000.

### Services

1. **OSRM** - Primary routing engine
   - Pre-processed OSM data for region (Europe/Germany)
   - HTTP API on internal port

2. **Valhalla** (optional) - Extended routing
   - Transit integration via GTFS
   - Isochrone calculations

3. **Tile Server** - Vector tiles
   - OpenMapTiles-based
   - Serves tiles for offline caching

4. **VROOM** - Route optimization
   - Solves complex multi-stop problems
   - REST API

### Docker Compose Preview

```yaml
version: '3.8'
services:
  osrm:
    image: osrm/osrm-backend:latest
    volumes:
      - ./data/osrm:/data
    command: osrm-routed --algorithm mld /data/region.osrm
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.osrm.rule=Host(`routing.jeffemmett.com`)"

  tileserver:
    image: maptiler/tileserver-gl:latest
    volumes:
      - ./data/tiles:/data
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tiles.rule=Host(`tiles.jeffemmett.com`)"

networks:
  traefik-public:
    external: true
```

## Data Requirements

### OSM Data
- Download PBF files from Geofabrik
- For Europe: ~30GB (full), ~5GB (Germany only)
- Pre-process with `osrm-extract`, `osrm-partition`, `osrm-customize`

### Vector Tiles
- Generate from OSM data using OpenMapTiles
- Or download pre-built from MapTiler
- Storage: ~50GB for detailed regional tiles

## API Endpoints

### Routing API (`/api/route`)
```typescript
POST /api/route
{
  waypoints: [{ lat: number, lng: number }],
  profile: 'car' | 'bike' | 'foot',
  alternatives: number,
}
Response: Route[]
```

### Optimization API (`/api/optimize`)
```typescript
POST /api/optimize
{
  waypoints: Waypoint[],
  constraints: OptimizationConstraints,
}
Response: OptimizationResult
```

### Isochrone API (`/api/isochrone`)
```typescript
POST /api/isochrone
{
  center: { lat: number, lng: number },
  minutes: number[],
  profile: string,
}
Response: GeoJSON.FeatureCollection
```

## Dependencies to Add

```json
{
  "dependencies": {
    "maplibre-gl": "^4.x",
    "@maplibre/maplibre-gl-geocoder": "^1.x",
    "geojson": "^0.5.x"
  }
}
```

## Related Projects & Inspiration

- **Mapus** - Real-time collaborative mapping
- **uMap** - OpenStreetMap-based map maker
- **Organic Maps** - Offline-first navigation
- **Komoot** - Outdoor route planning
- **Rome2Rio** - Multi-modal journey planner
- **Wandrer.earth** - Exploration tracking

## Success Metrics

1. **Route Calculation** < 500ms for typical queries
2. **Collaboration Sync** < 100ms latency
3. **Offline Coverage** Entire planned region cached
4. **Budget Accuracy** ±15% for fuel estimates
5. **User Satisfaction** Preferred over Google Maps for trip planning

## Open Questions

1. Should we integrate transit data (GTFS feeds)?
2. What regions should we pre-process initially?
3. How to handle very long routes (cross-country)?
4. Should routes be persisted separately from canvas?
5. Integration with existing canvas tools (markdown notes on waypoints)?

## References

- [OSRM Documentation](https://project-osrm.org/docs/v5.24.0/api/)
- [Valhalla API](https://valhalla.github.io/valhalla/api/)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js-docs/api/)
- [VROOM Project](http://vroom-project.org/)
- [Y.js Documentation](https://docs.yjs.dev/)
