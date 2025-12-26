---
id: task-059
title: Debug Drawfast tool output
status: To Do
assignee: []
created_date: '2025-12-26 04:37'
labels:
  - bug
  - ai
  - shapes
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Drawfast tool has been temporarily disabled due to output issues that need debugging.

## Background
Drawfast is a real-time AI image generation tool that generates images as users draw. The tool has been disabled in Board.tsx pending debugging.

## Files to investigate
- `src/shapes/DrawfastShapeUtil.tsx` - Shape rendering and state
- `src/tools/DrawfastTool.ts` - Tool interaction logic
- `src/hooks/useLiveImage.tsx` - Live image generation hook

## To re-enable
1. Uncomment imports in Board.tsx (lines 50-52)
2. Uncomment DrawfastShape in customShapeUtils array (line 173)
3. Uncomment DrawfastTool in customTools array (line 199)
<!-- SECTION:DESCRIPTION:END -->
