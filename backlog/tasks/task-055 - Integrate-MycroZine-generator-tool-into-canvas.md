---
id: task-055
title: Integrate MycroZine generator tool into canvas
status: In Progress
assignee: []
created_date: '2025-12-15 23:41'
updated_date: '2025-12-18 23:24'
labels:
  - feature
  - canvas
  - ai
  - gemini
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a MycroZineGeneratorShape - an interactive tool on the canvas that allows users to generate complete 8-page mini-zines from a topic/prompt.

5-phase iterative workflow:
1. Ideation: User discusses content with Claude (conversational)
2. Drafts: Claude generates 8 draft pages using Gemini, spawns on canvas
3. Feedback: User gives spatial feedback on each page
4. Finalization: Claude integrates feedback into final versions
5. Print: Aggregate into single-page printable (2x4 grid)

Key requirements:
- Always use Gemini for image generation (latest model)
- Store completed zines as templates for reprinting
- Individual image shapes spawned on canvas for spatial feedback
- Single-page print layout (all 8 pages on one 8.5"x11" sheet)

References mycro-zine repo at /home/jeffe/Github/mycro-zine for layout utilities and prompt templates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MycroZineGeneratorShapeUtil.tsx created
- [x] #2 MycroZineGeneratorTool.ts created and registered
- [ ] #3 Ideation phase with embedded chat UI
- [ ] #4 Drafts phase generates 8 images via Gemini and spawns on canvas
- [ ] #5 Feedback phase collects user input per page
- [ ] #6 Finalizing phase regenerates pages with feedback
- [ ] #7 Complete phase with print-ready download and template save
- [ ] #8 Templates stored in localStorage for reprinting
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting implementation of full 5-phase MycroZineGenerator shape

Created MycroZineGeneratorShapeUtil.tsx with full 5-phase workflow (ideation, drafts, feedback, finalizing, complete)

Created MycroZineGeneratorTool.ts

Registered in Board.tsx

Build successful - no TypeScript errors

Integrated Gemini Nano Banana Pro for image generation:
- Updated standalone mycro-zine app (generate-page/route.ts) with fallback chain: Nano Banana Pro → Imagen 3 → Gemini 2.0 Flash → placeholder
- Updated canvas MycroZineGeneratorShapeUtil.tsx to call Gemini API directly with proper types
- Added getGeminiConfig() to clientConfig.ts for API key management
- Aspect ratio: 3:4 portrait for zine pages (825x1275 target dimensions)

2025-12-18: Fixed geo-restriction issue for image generation
- Direct Gemini API calls were blocked in EU (Netcup server location)
- Created RunPod serverless proxy (US-based) to bypass geo-restrictions
- Added /api/generate-image endpoint to zine.jeffemmett.com that returns base64
- Updated canvas MycroZineGeneratorShapeUtil to call zine.jeffemmett.com API instead of Gemini directly
- Image generation now works reliably from any location
<!-- SECTION:NOTES:END -->
