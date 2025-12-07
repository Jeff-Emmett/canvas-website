---
id: task-043
title: Build and publish Voice Command Android APK
status: To Do
assignee: []
created_date: '2025-12-07 06:31'
labels:
  - android
  - voice-command
  - mobile
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Native Android app for voice-to-text transcription with on-device Whisper processing has been scaffolded. Next steps:

1. Download Whisper model files (run download-models.sh)
2. Set up Android signing keystore
3. Build debug APK and test on device
4. Fix any runtime issues
5. Build release APK
6. Publish to GitHub releases

The app uses sherpa-onnx for on-device transcription, supports floating button, volume button triggers, and Quick Settings tile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Model files downloaded and bundled
- [ ] #2 APK builds successfully
- [ ] #3 Recording works on real device
- [ ] #4 Transcription produces accurate results
- [ ] #5 All trigger methods functional
- [ ] #6 Release APK signed and published
<!-- AC:END -->
