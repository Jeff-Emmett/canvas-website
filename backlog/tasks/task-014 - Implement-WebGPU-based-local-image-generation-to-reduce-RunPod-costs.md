---
id: task-014
title: Implement WebGPU-based local image generation to reduce RunPod costs
status: To Do
assignee: []
created_date: '2025-12-04 11:46'
labels:
  - performance
  - cost-optimization
  - webgpu
  - ai
  - image-generation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate WebGPU-powered browser-based image generation (SD-Turbo) to reduce RunPod API costs and eliminate cold start delays. This creates a hybrid pipeline where quick drafts/iterations run locally in the browser (FREE, ~1-3 seconds), while high-quality final renders still use RunPod SDXL.

**Problem:**
- Current image generation always hits RunPod (~$0.02/image + 10-30s cold starts)
- No instant feedback loop for creative iteration
- 100% of compute costs are cloud-based

**Solution:**
- Add WebGPU capability detection
- Integrate SD-Turbo for instant browser-based previews
- Smart routing: drafts → browser, final renders → RunPod
- Potential 70% reduction in RunPod image generation costs

**Cost Impact (projected):**
- 1,000 images/mo: $20 → $6 (save $14/mo)
- 5,000 images/mo: $100 → $30 (save $70/mo)
- 10,000 images/mo: $200 → $60 (save $140/mo)

**Browser Support:**
- Chrome/Edge: Full WebGPU (v113+)
- Firefox: Windows (July 2025)
- Safari: v26 beta
- Fallback: WASM backend for unsupported browsers
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebGPU capability detection added to clientConfig.ts
- [ ] #2 SD-Turbo model loads and runs in browser via WebGPU
- [ ] #3 ImageGenShapeUtil has Quick Preview vs High Quality toggle
- [ ] #4 Smart routing in aiOrchestrator routes drafts to browser
- [ ] #5 Fallback to WASM for browsers without WebGPU
- [ ] #6 User can generate preview images with zero cold start
- [ ] #7 RunPod only called for High Quality final renders
- [ ] #8 Model download progress indicator shown to user
- [ ] #9 Works offline after initial model download
<!-- AC:END -->
