---
id: task-041
title: User Networking & Social Graph Visualization
status: To Do
assignee: []
created_date: '2025-12-06 06:17'
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
- [ ] #1 Users can search and add connections to other CryptIDs
- [ ] #2 Connections persist across sessions in D1 database
- [ ] #3 Bottom-right graph visualization shows room users and connections
- [ ] #4 3D graph at graph.jeffemmett.com is interactive (spin, zoom, click)
- [ ] #5 Clicking edges allows defining relationship metadata
- [ ] #6 Real-time updates when connections change
- [ ] #7 Privacy-respecting (honors trust circle permissions)
<!-- AC:END -->
