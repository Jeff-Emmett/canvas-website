---
id: task-015
title: Set up Cloudflare D1 email-collector database for cross-site subscriptions
status: To Do
assignee: []
created_date: '2025-12-04 12:00'
labels:
  - infrastructure
  - cloudflare
  - d1
  - email
  - cross-site
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a standalone Cloudflare D1 database for collecting email subscriptions across all websites (mycofi.earth, canvas.jeffemmett.com, decolonizeti.me, etc.) with easy export capabilities.

**Purpose:**
- Unified email collection from all sites
- Page-separated lists (e.g., /newsletter, /waitlist, /landing)
- Simple CSV/JSON export for email campaigns
- GDPR-compliant with unsubscribe tracking

**Sites to integrate:**
- mycofi.earth
- canvas.jeffemmett.com
- decolonizeti.me
- games.jeffemmett.com
- Future sites

**Key Features:**
- Double opt-in verification
- Source tracking (which site, which page)
- Export in multiple formats (CSV, JSON, Mailchimp)
- Basic admin dashboard or CLI for exports
- Rate limiting to prevent abuse
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 D1 database 'email-collector' created on Cloudflare
- [ ] #2 Schema deployed with subscribers, verification_tokens tables
- [ ] #3 POST /api/subscribe endpoint accepts email + source_site + source_page
- [ ] #4 Email verification flow with token-based double opt-in
- [ ] #5 GET /api/emails/export returns CSV with filters (site, date, verified)
- [ ] #6 Unsubscribe endpoint and tracking
- [ ] #7 Rate limiting prevents spam submissions
- [ ] #8 At least one site integrated and collecting emails
<!-- AC:END -->
