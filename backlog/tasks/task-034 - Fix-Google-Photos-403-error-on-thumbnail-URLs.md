---
id: task-034
title: Fix Google Photos 403 error on thumbnail URLs
status: To Do
assignee: []
created_date: '2025-12-04 23:24'
labels:
  - bug
  - google
  - photos
dependencies:
  - task-025
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Debug and fix the 403 Forbidden errors when fetching Google Photos thumbnails in the Google Data Sovereignty module.

Current behavior:
- Photos metadata imports successfully
- Thumbnail URLs (baseUrl with =w200-h200 suffix) return 403
- Error occurs even with valid OAuth token

Investigation areas:
1. OAuth consent screen verification status (test mode vs published)
2. Photo sharing status (private vs shared photos may behave differently)
3. baseUrl expiration - Google Photos baseUrls expire after ~1 hour
4. May need to use mediaItems.get API to refresh baseUrl before each fetch
5. Consider adding Authorization header to thumbnail fetch requests

Reference: src/lib/google/importers/photos.ts in feature/google-export branch
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Photos thumbnails download without 403 errors
- [ ] #2 OAuth consent screen properly configured if needed
- [ ] #3 baseUrl refresh mechanism implemented if required
- [ ] #4 Test with both private and shared photos
<!-- AC:END -->
