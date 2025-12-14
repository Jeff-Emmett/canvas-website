---
id: task-050
title: Implement Make-Real Feature (Wireframe to Working Prototype)
status: To Do
assignee: []
created_date: '2025-12-14 18:32'
labels:
  - feature
  - ai
  - canvas
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the full make-real workflow that converts wireframe sketches/designs on the canvas into working HTML/CSS/JS prototypes using AI.

## Current State
The backend infrastructure is ~60% complete:
- ✅ `makeRealSettings` atom in `src/lib/settings.tsx` with provider/model/API key configs
- ✅ System prompt in `src/prompt.ts` for wireframe-to-prototype conversion
- ✅ LLM backend in `src/utils/llmUtils.ts` with OpenAI, Anthropic, Ollama, RunPod support
- ✅ Settings migration in `src/routes/Board.tsx` loading `makereal_settings_2`
- ✅ "Make Real" placeholder in AI_TOOLS dropdown

## Missing Components
1. **Selection-to-image capture** - Export selected shapes as base64 PNG
2. **`makeReal()` action function** - Orchestrate the capture → AI → render pipeline
3. **ResponseShape/PreviewShape** - Custom tldraw shape to render generated HTML in iframe
4. **UI trigger** - Button/keyboard shortcut to invoke make-real on selection
5. **Iteration support** - Allow annotations on generated output for refinement

## Reference Implementation
- tldraw make-real demo: https://github.com/tldraw/make-real
- Key files to reference: `makeReal.ts`, `ResponseShape.tsx`, `getSelectionAsImageDataUrl.ts`

## Old Branch
`remotes/origin/make-real-integration` exists but is very outdated with errors - needs complete rewrite rather than merge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User can select shapes on canvas and trigger make-real action
- [ ] #2 Selection is captured as image and sent to configured AI provider
- [ ] #3 AI generates HTML/CSS/JS prototype based on wireframe and system prompt
- [ ] #4 Generated prototype renders in interactive iframe on canvas (ResponseShape)
- [ ] #5 User can annotate/modify and re-run make-real for iterations
- [ ] #6 Settings modal allows configuring provider/model/API keys
- [ ] #7 Works with Ollama (free), OpenAI, and Anthropic backends
<!-- AC:END -->
