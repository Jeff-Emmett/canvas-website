---
id: task-018
title: Create Cloudflare D1 cryptid-auth database
status: To Do
assignee: []
created_date: '2025-12-04 12:02'
labels:
  - infrastructure
  - cloudflare
  - d1
  - cryptid
  - auth
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the D1 database on Cloudflare for CryptID authentication system. This is the first step before deploying the email recovery feature.

**Database Purpose:**
- Store user accounts linked to CryptID usernames
- Store device public keys for multi-device auth
- Store verification tokens for email/device linking
- Enable account recovery via verified email

**Security Considerations:**
- Emails should be encrypted at rest (task-016)
- Public keys are safe to store (not secrets)
- Tokens are time-limited and single-use
- No passwords stored (WebCrypto key-based auth)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 D1 database 'cryptid-auth' created via wrangler d1 create
- [ ] #2 D1 database 'cryptid-auth-dev' created for dev environment
- [ ] #3 Database IDs added to wrangler.toml (replacing placeholders)
- [ ] #4 Schema from worker/schema.sql deployed to both databases
- [ ] #5 Verified tables exist: users, device_keys, verification_tokens
<!-- AC:END -->
