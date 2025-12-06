---
id: task-041
title: User Networking & Social Graph Visualization
status: Done
assignee: []
created_date: '2025-12-06 06:17'
updated_date: '2025-12-06 06:46'
labels:
  - feature
  - social
  - visualization
  - networking
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a social networking layer on the canvas that allows users to:
1. Tag other users as "connected" to them
2. Search by username to add connections
3. Track connected network of CryptIDs
4. Replace top-right presence icons with bottom-right graph visualization
5. Create 3D interactive graph at graph.jeffemmett.com

Key Components:
- Connection storage (extend trust circles in D1/Automerge)
- User search API
- 2D mini-graph in bottom-right (like minimap)
- 3D force-graph visualization (Three.js/react-force-graph-3d)
- Edge metadata (relationship types, clickable edges)

Architecture: Extends existing presence system in open-mapping/presence/ and trust circles in privacy/trustCircles.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can search and add connections to other CryptIDs
- [x] #2 Connections persist across sessions in D1 database
- [x] #3 Bottom-right graph visualization shows room users and connections
- [ ] #4 3D graph at graph.jeffemmett.com is interactive (spin, zoom, click)
- [ ] #5 Clicking edges allows defining relationship metadata
- [x] #6 Real-time updates when connections change
- [x] #7 Privacy-respecting (honors trust circle permissions)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Design decisions made:
- Binary connections only: 'connected' or 'not connected'
- All usernames publicly searchable
- One-way following allowed (no acceptance required)
- Graph scope: full network in grey, room participants colored by presence
- Edge metadata private to the two connected parties

Implementation complete:

**Files Created:**
- worker/schema.sql: Added user_profiles, user_connections, connection_metadata tables
- worker/types.ts: Added TrustLevel, UserConnection, GraphEdge, NetworkGraph types
- worker/networkingApi.ts: Full API implementation for connections, search, graph
- src/lib/networking/types.ts: Client-side types with trust levels
- src/lib/networking/connectionService.ts: API client
- src/lib/networking/index.ts: Module exports
- src/components/networking/useNetworkGraph.ts: React hook for graph state
- src/components/networking/UserSearchModal.tsx: User search UI
- src/components/networking/NetworkGraphMinimap.tsx: 2D force graph with d3
- src/components/networking/NetworkGraphPanel.tsx: Tldraw integration wrapper
- src/components/networking/index.ts: Component exports

**Modified Files:**
- worker/worker.ts: Added networking API routes
- src/ui/components.tsx: Added NetworkGraphPanel to InFrontOfCanvas

**Trust Levels:**
- unconnected (grey): No permissions
- connected (yellow): View permission
- trusted (green): Edit permission

**Features:**
- One-way following (no acceptance required)
- Trust level upgrade/downgrade
- Edge metadata (private labels, notes, colors)
- Room participants highlighted with presence colors
- Full network shown in grey, room subset colored
- Expandable to 3D view (future: graph.jeffemmett.com)

2D implementation complete. Follow-up task-042 created for 3D graph and edge metadata editor modal.
<!-- SECTION:NOTES:END -->
