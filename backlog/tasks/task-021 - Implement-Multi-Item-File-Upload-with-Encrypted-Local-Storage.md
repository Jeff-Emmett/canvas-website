---
id: task-021
title: Implement Multi-Item File Upload with Encrypted Local Storage
status: To Do
assignee: []
created_date: '2025-12-04 12:37'
labels:
  - feature
  - security
  - offline-storage
  - upload
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add drag-and-drop / file picker interface for batch importing local files into encrypted IndexedDB storage. Supports images, PDFs, documents, text files, audio, and video. Files are encrypted client-side and can be selectively shared to boards or backed up to R2. See docs/LOCAL_FILE_UPLOAD.md for full architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 File drop zone component with drag-and-drop
- [ ] #2 Support for images, PDFs, documents, text, audio, video
- [ ] #3 Image thumbnail generation
- [ ] #4 PDF text extraction and thumbnail
- [ ] #5 All files encrypted before IndexedDB storage
- [ ] #6 File browser panel with type filtering
- [ ] #7 Search within uploaded files
- [ ] #8 Storage quota display and warnings
- [ ] #9 Drag files from browser to canvas
- [ ] #10 Canvas shapes for images, PDFs, documents, generic files
- [ ] #11 Share confirmation dialog for private files
- [ ] #12 Per-file privacy controls
<!-- AC:END -->
