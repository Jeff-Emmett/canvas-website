---
id: task-057
title: Set up Cloudflare WARP split tunnels for Claude Code
status: Done
assignee: []
created_date: '2025-12-19 01:10'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Configured Cloudflare Zero Trust split tunnel excludes to allow Claude Code to work in WSL2 with WARP enabled on Windows.

Completed:
- Created Zero Trust API token with device config permissions
- Added localhost (127.0.0.0/8) to excludes
- Added Anthropic domains (api.anthropic.com, claude.ai, anthropic.com)
- Private networks already excluded (172.16.0.0/12, 192.168.0.0/16, 10.0.0.0/8)
- Created ~/bin/warp-split-tunnel CLI tool for future management
- Saved token to Netcup ~/.cloudflare-credentials.env
<!-- SECTION:DESCRIPTION:END -->
