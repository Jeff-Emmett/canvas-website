---
id: task-040
title: 'Open-Mapping Production Ready: Fix TypeScript, Enable Build, Polish UI'
status: In Progress
assignee: []
created_date: '2025-12-05 21:58'
updated_date: '2025-12-05 22:12'
labels:
  - feature
  - mapping
  - typescript
  - build
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the open-mapping module production-ready by fixing TypeScript errors, re-enabling it in the build, and polishing the UI components.

Currently the open-mapping directory is excluded from tsconfig due to TypeScript errors. This task covers:
1. Fix TypeScript errors in src/open-mapping/**
2. Re-enable in tsconfig.json
3. Add NODE_OPTIONS for build memory
4. Polish MapShapeUtil UI (multi-route, layer panel)
5. Test collaboration features
6. Deploy to staging
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 open-mapping included in tsconfig without errors
- [ ] #2 npm run build succeeds
- [ ] #3 MapShapeUtil renders and functions correctly
- [ ] #4 Routing via OSRM works
- [ ] #5 GPS sharing works between clients
- [ ] #6 Layer switching works
- [ ] #7 Search with autocomplete works
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Progress (2025-12-05):**
- Fixed ~40 TypeScript errors
- Added missing type exports (GeohashPrecision, GeohashCommitment)
- Added function aliases for backwards compatibility
- Fixed type annotations in services (RoutingService, OptimizationService)
- Suppressed unused params in stub components
- Still have ~51 errors remaining, mainly in discovery module and hooks
- Committed progress to dev branch (f440c4d)
<!-- SECTION:NOTES:END -->
