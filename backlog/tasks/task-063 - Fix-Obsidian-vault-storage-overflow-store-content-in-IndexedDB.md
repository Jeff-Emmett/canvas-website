---
id: task-063
title: Fix Obsidian vault storage overflow - store content in IndexedDB
status: In Progress
assignee: []
created_date: '2026-01-22 20:03'
labels:
  - bug
  - obsidian
  - automerge
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Obsidian vault browser is storing full note content in Automerge, causing capacity overflow errors and localStorage quota exceeded errors. Need to:
1. Store only metadata in Automerge (id, title, tags, links, paths)
2. Store full content in IndexedDB separately
3. Clear existing vault data from Automerge for privacy
4. Load content on-demand when notes are opened
<!-- SECTION:DESCRIPTION:END -->
