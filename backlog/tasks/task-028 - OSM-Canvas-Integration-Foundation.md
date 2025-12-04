---
id: task-028
title: OSM Canvas Integration Foundation
status: In Progress
assignee:
  - '@claude'
created_date: '2025-12-04 21:12'
updated_date: '2025-12-04 21:24'
labels:
  - feature
  - mapping
  - foundation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the foundational layer for rendering OpenStreetMap data on the tldraw canvas. This includes coordinate transformation (geographic ↔ canvas), tile rendering as canvas background, and basic interaction patterns.

Core components:
- Geographic coordinate system (lat/lng to canvas x/y transforms)
- OSM tile layer rendering (raster tiles as background)
- Zoom level handling that respects geographic scale
- Pan/zoom gestures that work with map context
- Basic marker/shape placement with geographic coordinates
- Vector tile support for interactive OSM elements

This is the foundation that task-024 (Route Planning) and other spatial features build upon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OSM raster tiles render as canvas background layer
- [x] #2 Coordinate transformation functions (geo ↔ canvas) working accurately
- [ ] #3 Zoom levels map to appropriate tile zoom levels
- [ ] #4 Pan/zoom gestures work smoothly with tile loading
- [ ] #5 Shapes can be placed with lat/lng coordinates
- [ ] #6 Basic MapLibre GL or Leaflet integration pattern established
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress (2025-12-04)

### Completed:
- Reviewed existing open-mapping module scaffolding
- Installed maplibre-gl npm package
- Created comprehensive geo-canvas coordinate transformation utilities (geoTransform.ts)
  - GeoCanvasTransform class for bidirectional geo ↔ canvas transforms
  - Web Mercator projection support
  - Tile coordinate utilities
  - Haversine distance calculations

### In Progress:
- Wiring up MapLibre GL JS in useMapInstance hook
- Creating MapShapeUtil for tldraw canvas integration
<!-- SECTION:NOTES:END -->
