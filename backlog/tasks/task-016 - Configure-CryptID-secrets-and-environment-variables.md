---
id: task-016
title: Configure CryptID secrets and environment variables
status: To Do
assignee: []
created_date: '2025-12-04 12:00'
labels:
  - infrastructure
  - cloudflare
  - cryptid
  - secrets
  - email
dependencies:
  - task-015
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up the required secrets and environment variables for CryptID email functionality on Cloudflare Workers.

**Required Secrets:**
- SENDGRID_API_KEY - For sending verification emails
- CRYPTID_EMAIL_FROM - Sender email address (e.g., auth@jeffemmett.com)
- APP_URL - Base URL for verification links (e.g., https://canvas.jeffemmett.com)

**Configuration:**
- Secrets set for both production and dev environments
- SendGrid account configured with verified sender domain
- Email templates tested
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SENDGRID_API_KEY secret set via wrangler secret put
- [ ] #2 CRYPTID_EMAIL_FROM secret configured
- [ ] #3 APP_URL environment variable set in wrangler.toml
- [ ] #4 SendGrid sender domain verified (jeffemmett.com or subdomain)
- [ ] #5 Test email sends successfully from Worker
<!-- AC:END -->
