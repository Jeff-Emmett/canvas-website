---
id: task-055
title: Integrate MycroZine generator tool into canvas
status: To Do
assignee: []
created_date: '2025-12-15 23:41'
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
- [ ] #1 MycroZineGeneratorShapeUtil.tsx created
- [ ] #2 MycroZineGeneratorTool.ts created and registered
- [ ] #3 Ideation phase with embedded chat UI
- [ ] #4 Drafts phase generates 8 images via Gemini and spawns on canvas
- [ ] #5 Feedback phase collects user input per page
- [ ] #6 Finalizing phase regenerates pages with feedback
- [ ] #7 Complete phase with print-ready download and template save
- [ ] #8 Templates stored in localStorage for reprinting
<!-- AC:END -->
