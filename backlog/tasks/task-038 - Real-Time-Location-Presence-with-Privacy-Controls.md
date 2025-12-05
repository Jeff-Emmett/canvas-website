---
id: task-038
title: Real-Time Location Presence with Privacy Controls
status: Done
assignee: []
created_date: '2025-12-05 02:00'
labels:
  - feature
  - open-mapping
  - privacy
  - collaboration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implemented real-time location sharing with trust-based privacy controls for collaborative mapping.

Key features:
- Privacy-preserving location via zkGPS commitments
- Trust circle precision controls (intimate ~2.4m → public ~630km)
- Real-time broadcasting and receiving of presence
- Proximity detection without revealing exact location
- React hook for easy canvas integration
- Map visualization components (PresenceLayer, PresenceList)

Files created in src/open-mapping/presence/:
- types.ts: Comprehensive type definitions
- manager.ts: PresenceManager class with location watch, broadcasting, trust circles
- useLocationPresence.ts: React hook for canvas integration
- PresenceLayer.tsx: Map visualization components
- index.ts: Barrel export

Integration pattern:
```typescript
const presence = useLocationPresence({
  channelId: 'room-id',
  user: { pubKey, privKey, displayName, color },
  broadcastFn: (data) => automergeAdapter.broadcast(data),
});

// Set trust levels for contacts
presence.setTrustLevel(bobKey, 'friends'); // ~2.4km precision
presence.setTrustLevel(aliceKey, 'intimate'); // ~2.4m precision
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Location presence types defined
- [ ] #2 PresenceManager with broadcasting
- [ ] #3 Trust-based precision controls
- [ ] #4 React hook for canvas integration
- [ ] #5 Map visualization components
- [ ] #6 Proximity detection without exact location
<!-- AC:END -->
