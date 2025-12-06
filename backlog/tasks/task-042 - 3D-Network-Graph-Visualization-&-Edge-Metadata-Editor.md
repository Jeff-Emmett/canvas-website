---
id: task-042
title: 3D Network Graph Visualization & Edge Metadata Editor
status: To Do
assignee: []
created_date: '2025-12-06 06:46'
labels:
  - feature
  - visualization
  - 3d
  - networking
dependencies:
  - task-041
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the 3D interactive network visualization at graph.jeffemmett.com and implement the edge metadata editor modal. This extends the 2D minimap created in task-041.

Key Features:
1. **3D Force Graph** at graph.jeffemmett.com
   - Three.js / react-force-graph-3d visualization
   - Full-screen, interactive (spin, zoom, pan)
   - Click nodes to view user profiles
   - Click edges to edit metadata
   - Same trust level coloring (grey/yellow/green)
   - Real-time presence sync with canvas rooms

2. **Edge Metadata Editor Modal**
   - Opens on edge click in 2D minimap or 3D view
   - Edit: label, notes, color, strength (1-10)
   - Private to each party on the edge
   - Bidirectional - each user has their own metadata view

3. **Expand Button Integration**
   - 2D minimap expand button opens 3D view
   - URL sharing for specific graph views
   - Optional: embed 3D graph back in canvas as iframe
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 3D force graph at graph.jeffemmett.com renders user network
- [ ] #2 Graph is interactive: spin, zoom, pan, click nodes/edges
- [ ] #3 Edge metadata editor modal allows editing label, notes, color, strength
- [ ] #4 Edge metadata persists to D1 and is private per-user
- [ ] #5 Expand button in 2D minimap opens 3D view
- [ ] #6 Real-time updates when connections change
- [ ] #7 Trust level colors match 2D minimap (grey/yellow/green)
<!-- AC:END -->
