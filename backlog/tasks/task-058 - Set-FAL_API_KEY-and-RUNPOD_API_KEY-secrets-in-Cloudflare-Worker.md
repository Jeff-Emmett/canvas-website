---
id: task-058
title: Set FAL_API_KEY and RUNPOD_API_KEY secrets in Cloudflare Worker
status: Done
assignee: []
created_date: '2025-12-25 23:30'
updated_date: '2025-12-25 23:33'
labels:
  - security
  - infrastructure
  - canvas-website
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SECURITY FIX: API keys were exposed in browser bundle. They've been removed from client code and proxy endpoints added to the worker. Need to set the secrets server-side for the proxy to work.

Run these commands:
```bash
cd /home/jeffe/Github/canvas-website
wrangler secret put FAL_API_KEY
# Paste: (REDACTED-FAL-KEY)

wrangler secret put RUNPOD_API_KEY  
# Paste: (REDACTED-RUNPOD-KEY)

wrangler deploy
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 FAL_API_KEY secret set in Cloudflare Worker
- [x] #2 RUNPOD_API_KEY secret set in Cloudflare Worker
- [x] #3 Worker deployed with new secrets
- [x] #4 Browser console no longer shows 'fal credentials exposed' warning
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Secrets set and deployed on 2025-12-25
<!-- SECTION:NOTES:END -->
