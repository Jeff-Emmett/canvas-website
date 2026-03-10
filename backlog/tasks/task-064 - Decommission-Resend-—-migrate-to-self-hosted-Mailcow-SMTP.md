---
id: TASK-064
title: Decommission Resend — migrate to self-hosted Mailcow SMTP
status: Done
assignee: []
created_date: '2026-02-15 23:15'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace all Resend API integrations with self-hosted Mailcow SMTP via email relay service
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Completed 2026-02-15

### Changes
- cryptidAuth.ts: sendEmail() now calls email-relay.jeffemmett.com instead of api.resend.com
- boardPermissions.ts: admin request emails use email relay
- types.ts: RESEND_API_KEY → EMAIL_RELAY_URL + EMAIL_RELAY_API_KEY
- wrangler.toml: updated secrets docs
- Tests updated with new mock env vars

### Wrangler Secrets
- EMAIL_RELAY_URL set
- EMAIL_RELAY_API_KEY set
- RESEND_API_KEY deleted

### Email Relay
- Deployed at email-relay.jeffemmett.com
- Flask + Gunicorn, sends via Mailcow SMTP
- Bearer token auth
<!-- SECTION:NOTES:END -->
